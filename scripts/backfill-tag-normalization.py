#!/usr/bin/env python3
"""One-time, idempotent backfill: re-normalize `tags` on existing video records.

All write paths (upload, edit, AI-suggest) now funnel tags through
app.main.clean_tags, so new and re-saved records are already canonical. But
records created before that change can still hold mechanically inconsistent
tags -- "True Crime", "true crime" and "true-crime" showing up as three
separate tunnels. This rewrites each video's `tags` list through the SAME
canonical helper and writes back ONLY when the normalized list actually
differs.

Canonical rules (app.main.normalize_tag / clean_tags -- unchanged here):
  lowercase · trim · drop leading '#' · spaces/underscores -> hyphen ·
  collapse repeated hyphens · trim stray hyphens · dedupe preserving order ·
  keep the existing per-record tag-count cap.
Genuinely different spellings are preserved: "truecrime" stays "truecrime",
"space" never becomes "spaceflight". No synonym mapping.

Scope: touches only the `tags` attribute, only on records where it changes.
Never reads or writes media, transcripts, titles, descriptions, ownership,
timestamps, visibility, or featured state. Never deletes a video.

Idempotent: a second run finds every list already canonical and writes nothing.

Usage (AWS creds + api/.venv, which has boto3):
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/backfill-tag-normalization.py --dry-run
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/backfill-tag-normalization.py
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

os.environ.setdefault("VIDEOS_TABLE", "rabbithole-dev-videos")
os.environ.setdefault("AWS_REGION", "us-east-1")
os.environ.setdefault("AWS_DEFAULT_REGION", os.environ["AWS_REGION"])

# The one canonical implementation -- imported, never re-implemented.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))
from app.main import clean_tags  # noqa: E402


def current_tags(item: dict) -> list[str]:
    return [str(t) for t in (item.get("tags") or [])]


def plan_change(item: dict) -> tuple[list[str], list[str]] | None:
    """(before, after) if this record's `tags` need rewriting, else None.

    Returns None for records with no tags at all (nothing to normalize) and
    for records whose tags are already canonical (nothing to write)."""
    if not item.get("tags"):
        return None
    before = current_tags(item)
    after = clean_tags(before)  # same default count cap as the edit path
    if after == before:
        return None
    return before, after


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
    ap.add_argument(
        "--dry-run", action="store_true",
        help="print what would change, write nothing",
    )
    args = ap.parse_args()

    import boto3

    table = (
        boto3.session.Session(region_name=args.region)
        .resource("dynamodb")
        .Table(args.videos_table)
    )

    scanned = with_tags = changed = 0
    for item in iter_all_videos(table):
        scanned += 1
        if item.get("tags"):
            with_tags += 1
        change = plan_change(item)
        if change is None:
            continue
        before, after = change
        changed += 1
        prefix = "[dry-run] would change" if args.dry_run else "changed"
        print(f"{prefix} {item['video_id']}: {before} -> {after}")
        if not args.dry_run:
            table.update_item(
                Key={"video_id": item["video_id"]},
                UpdateExpression="SET #tags = :t",
                ExpressionAttributeNames={"#tags": "tags"},
                ExpressionAttributeValues={":t": after},
            )

    verb = "would be changed" if args.dry_run else "changed"
    print(
        f"\ndone: {scanned} record(s) scanned, {with_tags} with tags, "
        f"{changed} {verb}"
    )


if __name__ == "__main__":
    main()
