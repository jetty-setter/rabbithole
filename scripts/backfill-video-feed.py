#!/usr/bin/env python3
"""One-time, idempotent backfill: add `gsi_feed` to existing video records.

The library feed reads the `feed-by-created` index, which only contains items
that carry `gsi_feed`. New videos get it on creation; this adds it to records
created before the index existed. Run it after the index is applied and before
(or right after) deploying the API, or older videos will be missing from the feed.

Touches only `gsi_feed`, only on records that lack it. Never deletes a video.
A second run finds nothing to change and writes nothing.

Usage (AWS creds + api/.venv, which has boto3):
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/backfill-video-feed.py --dry-run
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/backfill-video-feed.py
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

os.environ.setdefault("VIDEOS_TABLE", "rabbithole-dev-videos")
os.environ.setdefault("AWS_REGION", "us-east-1")
os.environ.setdefault("AWS_DEFAULT_REGION", os.environ["AWS_REGION"])

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))
from app.helpers import FEED_PARTITION  # noqa: E402


def needs_backfill(item: dict) -> bool:
    return "video_id" in item and "created_at" in item and item.get("gsi_feed") != FEED_PARTITION


def iter_all_videos(table):
    kwargs: dict = {}
    while True:
        resp = table.scan(**kwargs)
        yield from resp.get("Items", [])
        if "LastEvaluatedKey" not in resp:
            return
        kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--region", default=os.environ["AWS_REGION"])
    ap.add_argument("--videos-table", default=os.environ["VIDEOS_TABLE"])
    ap.add_argument("--dry-run", action="store_true", help="print what would change, write nothing")
    args = ap.parse_args()

    import boto3

    table = (
        boto3.session.Session(region_name=args.region)
        .resource("dynamodb")
        .Table(args.videos_table)
    )

    scanned = changed = skipped = 0
    for item in iter_all_videos(table):
        scanned += 1
        if "video_id" in item and "created_at" not in item:
            skipped += 1
            print(f"skipped {item['video_id']}: no created_at, so it cannot be indexed")
            continue
        if not needs_backfill(item):
            continue
        changed += 1
        print(f"{'[dry-run] would add' if args.dry_run else 'added'} gsi_feed: {item['video_id']}")
        if not args.dry_run:
            table.update_item(
                Key={"video_id": item["video_id"]},
                UpdateExpression="SET gsi_feed = :f",
                ExpressionAttributeValues={":f": FEED_PARTITION},
            )

    print(f"scanned {scanned}, {'would change' if args.dry_run else 'changed'} {changed}, skipped {skipped}")


if __name__ == "__main__":
    main()
