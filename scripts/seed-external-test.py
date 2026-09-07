#!/usr/bin/env python3
"""Seed the TWO throwaway External-content test records used to verify the
external tier end to end, then remove them again.

    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/seed-external-test.py --seed
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/seed-external-test.py --remove

Both records are titled "TEST:" and tagged `external-test` so they are
trivially identifiable and removable. They are NOT production homepage
inventory. Content is Creative Commons open movie footage (Blender
Foundation) — explicitly free to embed.

This does the same work POST /external does; it exists only because the
verification runner has AWS creds but not an admin JWT.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone

import boto3

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))
from app import providers  # noqa: E402

REGION = os.environ.get("AWS_REGION", "us-east-1")
VIDEOS_TABLE = os.environ.get("VIDEOS_TABLE", "rabbithole-dev-videos")
STREAMING_BUCKET = os.environ.get("STREAMING_BUCKET", "rabbithole-dev-streaming-936922781601")

# Stable, Creative-Commons, embed-permitted open movies (Blender Foundation).
TEST_A_ID = "external-test-a"
TEST_B_ID = "external-test-b"

TEST_B_SEGMENTS = [
    {"start": 0.0, "end": 6.0, "text": "This is a synthetic transcript used only to verify RabbitHole's external transcript pipeline."},
    {"start": 6.0, "end": 13.0, "text": "The words about a lonely proog exploring a strange machine world are placeholder test content."},
    {"start": 13.0, "end": 20.0, "text": "If semantic search finds the phrase strange machine world, external transcript ingestion works."},
]

_TS = re.compile(r"(?<=[.!?])\s+")


def _vtt_ts(sec: float) -> str:
    ms = int(round(max(0.0, sec) * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def _to_vtt(cues: list[dict]) -> str:
    out = ["WEBVTT", ""]
    for c in cues:
        out.append(f"{_vtt_ts(c['start'])} --> {_vtt_ts(c.get('end') or c['start'])}")
        out.append(c["text"])
        out.append("")
    return "\n".join(out)


def _table():
    return boto3.resource("dynamodb", region_name=REGION).Table(VIDEOS_TABLE)


def _s3():
    return boto3.client("s3", region_name=REGION)


def seed():
    now = datetime.now(timezone.utc).isoformat()
    tbl = _table()

    # ── Test A: YouTube, NO transcript ────────────────────────────────
    a = providers.resolve_external("https://www.youtube.com/watch?v=aqz-KE-bpKQ")
    tbl.put_item(Item={
        "video_id": TEST_A_ID,
        "filename": f"{a['provider']}-{a['provider_id']}",
        "status": "ready",
        "created_at": now,
        "source_type": "external",
        "provider": a["provider"],
        "source_url": a["source_url"],
        "provider_id": a["provider_id"],
        "embed_url": a["embed_url"],
        "thumbnail_url": a["thumbnail_url"],
        "owner": "Blender Foundation",
        "source_name": "Blender Foundation",
        "created_by": "seed-script",
        "title": "TEST: External YouTube (no transcript)",
        "description": "Throwaway verification record — Creative Commons open movie. Safe to delete.",
        "tags": ["external-test", "animation", "open-movie"],
        "visibility": "public",
        "views": 0, "hops": 0, "thumps": 0,
    })
    print(f"seeded {TEST_A_ID}: {a['source_url']}")

    # ── Test B: YouTube, WITH an imported (timestamped) transcript ─────
    b = providers.resolve_external("https://youtu.be/TLkA0RELQ1g")
    cues = [
        {"start": round(float(s["start"]), 2),
         "end": round(float(s.get("end") or s["start"]), 2),
         "text": s["text"]}
        for s in TEST_B_SEGMENTS
    ]
    _s3().put_object(Bucket=STREAMING_BUCKET, Key=f"{TEST_B_ID}/cues.json",
                     Body=json.dumps(cues).encode(), ContentType="application/json")
    _s3().put_object(Bucket=STREAMING_BUCKET, Key=f"{TEST_B_ID}/captions.vtt",
                     Body=_to_vtt(cues).encode(), ContentType="text/vtt")
    tbl.put_item(Item={
        "video_id": TEST_B_ID,
        "filename": f"{b['provider']}-{b['provider_id']}",
        "status": "ready",
        "created_at": now,
        "source_type": "external",
        "provider": b["provider"],
        "source_url": b["source_url"],
        "provider_id": b["provider_id"],
        "embed_url": b["embed_url"],
        "thumbnail_url": b["thumbnail_url"],
        "owner": "Blender Foundation",
        "source_name": "Blender Foundation",
        "created_by": "seed-script",
        "title": "TEST: External YouTube (imported transcript)",
        "description": "Throwaway verification record with a synthetic imported transcript. Safe to delete.",
        "tags": ["external-test", "animation", "open-movie"],
        "visibility": "public",
        "views": 0, "hops": 0, "thumps": 0,
        "has_transcript": True,
        "transcript_status": "ready",
        "transcribing": False,
        "transcript_key": f"{TEST_B_ID}/cues.json",
        "vtt_key": f"{TEST_B_ID}/captions.vtt",
        "transcript_source": "imported",
        "transcript_timed": True,
    })
    print(f"seeded {TEST_B_ID}: {b['source_url']} (+ imported transcript, {len(cues)} cues)")


def remove():
    tbl = _table()
    s3 = _s3()
    for vid in (TEST_A_ID, TEST_B_ID):
        tbl.delete_item(Key={"video_id": vid})
        for key in (f"{vid}/cues.json", f"{vid}/captions.vtt"):
            try:
                s3.delete_object(Bucket=STREAMING_BUCKET, Key=key)
            except Exception:  # noqa: BLE001
                pass
        # best-effort: drop any embeddings the search indexer created
        emb = boto3.resource("dynamodb", region_name=REGION).Table(
            os.environ.get("EMBEDDINGS_TABLE", "rabbithole-dev-embeddings"))
        resp = emb.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key("video_id").eq(vid))
        with emb.batch_writer() as bw:
            for it in resp.get("Items", []):
                bw.delete_item(Key={"video_id": vid, "chunk": it["chunk"]})
        print(f"removed {vid}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", action="store_true")
    ap.add_argument("--remove", action="store_true")
    args = ap.parse_args()
    if args.seed:
        seed()
    elif args.remove:
        remove()
    else:
        ap.error("pass --seed or --remove")
