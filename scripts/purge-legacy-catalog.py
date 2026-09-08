#!/usr/bin/env python3
"""One-time content-only purge of RabbitHole's legacy video catalog and its
derived discovery data.

This is the CONTENT reset, not a feature removal. It deletes the current
inventory of videos and everything generated from it; it does NOT touch any
table, bucket, index, queue, Lambda, or schema. Every DynamoDB table and S3
bucket it writes to survives -- empty -- and the ingestion / transcode /
transcript / embedding / search / player capabilities remain fully intact for
the next content model.

What it removes
---------------
  videos table            every item  (mirrors api/app/main.py::delete_video:
                                        uploads/{id}/ prefix, streaming/{id}/
                                        prefix, and comments for that id)
  embeddings table         every item  (per-video transcript chunk vectors --
                                        delete_video never cleaned these)
  topics table             every item  (the six legacy curiosity networks)
  topic-connections table  every item  (edges authored for those networks)
  uploads bucket           everything under uploads/  (incl. orphan prefixes)
  streaming bucket         every object

What it preserves
-----------------
  all 7 DynamoDB tables and all 4 S3 buckets (schemas + empty containers)
  rabbithole-dev-users, rabbithole-dev-connections (WebSocket), tfstate,
  frontend bucket, CloudFront, Lambdas, ECS, queues, all Terraform

Usage
-----
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/purge-legacy-catalog.py --dry-run
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/purge-legacy-catalog.py --execute

--dry-run  (default) writes a full JSON snapshot of every affected store to
           ./purge-snapshot-<timestamp>/ and prints the manifest + counts,
           deleting nothing.
--execute  takes the same snapshot first, then performs the deletions and
           re-counts every store to confirm it is empty.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")

VIDEOS_TABLE = os.environ.get("VIDEOS_TABLE", "rabbithole-dev-videos")
EMBEDDINGS_TABLE = os.environ.get("EMBEDDINGS_TABLE", "rabbithole-dev-embeddings")
TOPICS_TABLE = os.environ.get("TOPICS_TABLE", "rabbithole-dev-topics")
TOPIC_CONNECTIONS_TABLE = os.environ.get(
    "TOPIC_CONNECTIONS_TABLE", "rabbithole-dev-topic-connections"
)
COMMENTS_TABLE = os.environ.get("COMMENTS_TABLE", "rabbithole-dev-comments")
UPLOADS_BUCKET = os.environ.get("UPLOADS_BUCKET", "rabbithole-dev-uploads-936922781601")
STREAMING_BUCKET = os.environ.get(
    "STREAMING_BUCKET", "rabbithole-dev-streaming-936922781601"
)

session = boto3.Session(region_name=AWS_REGION)
dynamodb = session.resource("dynamodb")
s3 = session.client("s3")


# ── helpers ────────────────────────────────────────────────────────────
def scan_all(table_name: str) -> list[dict]:
    table = dynamodb.Table(table_name)
    resp = table.scan()
    items = resp.get("Items", [])
    while "LastEvaluatedKey" in resp:
        resp = table.scan(ExclusiveStartKey=resp["LastEvaluatedKey"])
        items += resp.get("Items", [])
    return items


def count(table_name: str) -> int:
    table = dynamodb.Table(table_name)
    resp = table.scan(Select="COUNT")
    n = resp.get("Count", 0)
    while "LastEvaluatedKey" in resp:
        resp = table.scan(Select="COUNT", ExclusiveStartKey=resp["LastEvaluatedKey"])
        n += resp.get("Count", 0)
    return n


def list_prefix(bucket: str, prefix: str) -> list[str]:
    if not bucket:
        return []
    keys: list[str] = []
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        keys.extend(o["Key"] for o in page.get("Contents", []))
    return keys


def delete_keys(bucket: str, keys: list[str]) -> int:
    for i in range(0, len(keys), 1000):
        s3.delete_objects(
            Bucket=bucket,
            Delete={"Objects": [{"Key": k} for k in keys[i : i + 1000]]},
        )
    return len(keys)


def delete_table_items(table_name: str, items: list[dict], key_attrs: list[str]) -> int:
    table = dynamodb.Table(table_name)
    with table.batch_writer() as batch:
        for it in items:
            batch.delete_item(Key={k: it[k] for k in key_attrs})
    return len(items)


# ── main ───────────────────────────────────────────────────────────────
def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="(default) snapshot + report only")
    mode.add_argument("--execute", action="store_true", help="snapshot, then delete")
    args = ap.parse_args()
    execute = args.execute

    ident = session.client("sts").get_caller_identity()
    print(f"AWS account {ident['Account']} as {ident['Arn']}")
    print(f"region {AWS_REGION}\n")

    # ── read every affected store ──────────────────────────────────────
    videos = scan_all(VIDEOS_TABLE)
    embeddings = scan_all(EMBEDDINGS_TABLE)
    topics = scan_all(TOPICS_TABLE)
    connections = scan_all(TOPIC_CONNECTIONS_TABLE)
    video_ids = sorted(v["video_id"] for v in videos if "video_id" in v)

    uploads_keys = list_prefix(UPLOADS_BUCKET, "uploads/")
    streaming_keys: dict[str, list[str]] = {}
    for vid in video_ids:
        streaming_keys[vid] = list_prefix(STREAMING_BUCKET, f"{vid}/")
    # Catch any streaming prefix with no matching video row (defensive).
    all_streaming = list_prefix(STREAMING_BUCKET, "")
    orphan_streaming = [k for k in all_streaming if k.split("/", 1)[0] not in set(video_ids)]

    comments_by_video: dict[str, list[dict]] = {}
    ct = dynamodb.Table(COMMENTS_TABLE)
    for vid in video_ids:
        resp = ct.query(KeyConditionExpression=Key("video_id").eq(vid))
        if resp.get("Items"):
            comments_by_video[vid] = resp["Items"]

    # ── snapshot ──────────────────────────────────────────────────────
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    snap_dir = f"purge-snapshot-{stamp}"
    os.makedirs(snap_dir, exist_ok=True)

    def dump(name: str, obj) -> None:
        with open(os.path.join(snap_dir, name), "w") as fh:
            json.dump(obj, fh, indent=2, default=str)

    dump("videos.json", videos)
    dump("embeddings.json", embeddings)
    dump("topics.json", topics)
    dump("topic-connections.json", connections)
    dump("comments.json", comments_by_video)
    dump(
        "s3-manifest.json",
        {
            "uploads_bucket": UPLOADS_BUCKET,
            "uploads_keys": uploads_keys,
            "streaming_bucket": STREAMING_BUCKET,
            "streaming_keys": streaming_keys,
            "orphan_streaming_keys": orphan_streaming,
        },
    )

    n_streaming = sum(len(v) for v in streaming_keys.values()) + len(orphan_streaming)
    n_comments = sum(len(v) for v in comments_by_video.values())

    print("── BEFORE ────────────────────────────────────────────────")
    print(f"  videos table .............. {len(videos):>7} items ({len(video_ids)} ids)")
    print(f"  embeddings table .......... {len(embeddings):>7} items")
    print(f"  topics table .............. {len(topics):>7} items")
    print(f"  topic-connections table ... {len(connections):>7} items")
    print(f"  comments (for these ids) .. {n_comments:>7} items")
    print(f"  uploads bucket (uploads/) . {len(uploads_keys):>7} objects")
    print(f"  streaming bucket .......... {n_streaming:>7} objects "
          f"({len(orphan_streaming)} under no video row)")
    print(f"\n  snapshot written to ./{snap_dir}/")

    if not execute:
        print("\nDRY RUN -- nothing deleted. Re-run with --execute to perform the purge.")
        return

    # ── delete ────────────────────────────────────────────────────────
    print("\n── DELETING ──────────────────────────────────────────────")

    for vid in video_ids:
        u = delete_keys(UPLOADS_BUCKET, list_prefix(UPLOADS_BUCKET, f"uploads/{vid}/"))
        strm = delete_keys(STREAMING_BUCKET, streaming_keys.get(vid, []))
        c = comments_by_video.get(vid, [])
        if c:
            with ct.batch_writer() as batch:
                for it in c:
                    batch.delete_item(
                        Key={"video_id": vid, "comment_id": it["comment_id"]}
                    )
        dynamodb.Table(VIDEOS_TABLE).delete_item(Key={"video_id": vid})
        print(f"  {vid}  uploads:-{u}  streaming:-{strm}  comments:-{len(c)}  row:-1")

    # Orphan uploads prefixes (partial uploads that never got a video row).
    orphan_uploads = [
        k for k in uploads_keys
        if k.split("/")[1] not in set(video_ids)  # uploads/<id>/...
    ]
    if orphan_uploads:
        delete_keys(UPLOADS_BUCKET, orphan_uploads)
        print(f"  orphan uploads objects:-{len(orphan_uploads)}")
    if orphan_streaming:
        delete_keys(STREAMING_BUCKET, orphan_streaming)
        print(f"  orphan streaming objects:-{len(orphan_streaming)}")

    e = delete_table_items(EMBEDDINGS_TABLE, embeddings, ["video_id", "chunk"])
    print(f"  embeddings rows:-{e}")
    t = delete_table_items(TOPICS_TABLE, topics, ["slug"])
    print(f"  topics rows:-{t}")
    tc = delete_table_items(TOPIC_CONNECTIONS_TABLE, connections, ["from_topic", "to_topic"])
    print(f"  topic-connections rows:-{tc}")

    # ── verify ────────────────────────────────────────────────────────
    print("\n── AFTER ─────────────────────────────────────────────────")
    after = {
        VIDEOS_TABLE: count(VIDEOS_TABLE),
        EMBEDDINGS_TABLE: count(EMBEDDINGS_TABLE),
        TOPICS_TABLE: count(TOPICS_TABLE),
        TOPIC_CONNECTIONS_TABLE: count(TOPIC_CONNECTIONS_TABLE),
        COMMENTS_TABLE: count(COMMENTS_TABLE),
    }
    for name, n in after.items():
        print(f"  {name:<34} {n:>7} items")
    up_left = len(list_prefix(UPLOADS_BUCKET, "uploads/"))
    st_left = len(list_prefix(STREAMING_BUCKET, ""))
    print(f"  {UPLOADS_BUCKET + ' (uploads/)':<34} {up_left:>7} objects")
    print(f"  {STREAMING_BUCKET:<34} {st_left:>7} objects")

    stray = {k: v for k, v in after.items() if v and k != COMMENTS_TABLE}
    if stray or up_left or st_left:
        print("\nWARNING: some stores are not empty -- inspect the values above.")
        sys.exit(1)
    print("\ndone -- legacy catalog purged, all tables and buckets preserved.")


if __name__ == "__main__":
    main()
