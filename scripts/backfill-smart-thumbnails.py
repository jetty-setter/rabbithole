#!/usr/bin/env python3
"""Regenerate smart thumbnails for the existing catalog.

Older videos got their thumbnail from a fixed ``00:00:01`` grab, which on a
lot of real footage is a black frame, a fade-in, or a title card. This script
re-runs the *new* selection logic (worker/thumbnails.py -- the exact same code
the worker now uses, so there is one implementation to trust) against each
video's original uploaded source, which the uploads bucket retains
indefinitely (nothing in the pipeline deletes it).

Per eligible video it: downloads the original, samples + scores candidate
frames, picks the best, replaces ``{video_id}/thumb.jpg``, uploads the
candidate frames for the admin picker, and updates the thumbnail metadata
(bumping ``thumbnail_updated_at`` so the CDN/browser cache-buster changes).

Idempotent and safe to re-run. Videos an admin has hand-picked a frame for
(``thumbnail_source == "manual"``) are skipped unless ``--force`` is given --
curation wins over automation.

Usage (needs AWS credentials, ffmpeg on PATH, and the worker deps incl.
pillow -- api/.venv has them):
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/backfill-smart-thumbnails.py --dry-run
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/backfill-smart-thumbnails.py
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/backfill-smart-thumbnails.py --video-id abc123
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/backfill-smart-thumbnails.py --force --limit 5
"""

from __future__ import annotations

import argparse
import os
import sys
import tempfile
import time
from decimal import Decimal
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
VIDEOS_TABLE = os.environ.get("VIDEOS_TABLE", "rabbithole-dev-videos")
UPLOADS_BUCKET = os.environ.get("UPLOADS_BUCKET", "rabbithole-dev-uploads-936922781601")
STREAMING_BUCKET = os.environ.get("STREAMING_BUCKET", "rabbithole-dev-streaming-936922781601")

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "worker"))
from thumbnails import (  # noqa: E402
    render_thumbnail,
    score_frame,
    select_thumbnail,
)

# A frame this dark / low-scoring is what "black thumbnail" means for the
# before/after report -- not a hard pipeline threshold.
NEAR_BLACK_RATIO = 0.60
NEAR_BLACK_SCORE = 0.12


def eligible(item: dict) -> bool:
    """Regenerate for any playable, transcoded video."""
    return item.get("status") == "ready" and bool(item.get("hls_key"))


def is_manual(item: dict) -> bool:
    return item.get("thumbnail_source") == "manual"


def _original_key(item: dict) -> str | None:
    if item.get("key"):
        return str(item["key"])
    vid, filename = item.get("video_id"), item.get("filename")
    return f"uploads/{vid}/{filename}" if vid and filename else None


def _iter_videos(table, video_id: str | None):
    if video_id:
        it = table.get_item(Key={"video_id": video_id}).get("Item")
        return [it] if it else []
    items, kwargs = [], {}
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        if "LastEvaluatedKey" not in resp:
            return items
        kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]


def _current_thumb_blackness(s3, video_id: str, workdir: Path) -> float | None:
    """black_ratio of the thumbnail that's live right now (for the report)."""
    dest = workdir / "current_thumb.jpg"
    try:
        s3.download_file(STREAMING_BUCKET, f"{video_id}/thumb.jpg", str(dest))
    except ClientError:
        return None
    s = score_frame(dest)
    return s.black_ratio if s else None


def _title(item: dict) -> str:
    return (item.get("title") or item.get("filename") or item["video_id"])[:50]


def process(table, s3, item: dict, *, dry_run: bool, force: bool) -> tuple[str, bool]:
    """Returns (result, improved_near_black) where result is one of:
    'updated' | 'skipped-manual' | 'skipped-ineligible' | 'no-source'
    | 'failed' | 'dry-run'."""
    video_id = item["video_id"]

    if not eligible(item):
        return "skipped-ineligible", False
    if is_manual(item) and not force:
        print(f"  skip {video_id} ({_title(item)}): thumbnail is a manual admin choice")
        return "skipped-manual", False

    key = _original_key(item)
    if not key:
        print(f"  skip {video_id}: no original source key on the record")
        return "no-source", False

    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        src = workdir / "input"
        try:
            s3.download_file(UPLOADS_BUCKET, key, str(src))
        except ClientError as exc:
            print(f"  skip {video_id}: original source not in uploads bucket ({exc.response['Error']['Code']})")
            return "no-source", False

        before_black = _current_thumb_blackness(s3, video_id, workdir)
        t0 = time.monotonic()
        choice = select_thumbnail(src, workdir)
        pick_secs = time.monotonic() - t0

        best = None
        if choice.best_index is not None:
            best = next((c for c in choice.candidates if c.index == choice.best_index), None)
        after_black = best.score.black_ratio if best else None

        top = sorted(choice.candidates, key=lambda c: c.score.total, reverse=True)[:3]
        score_summary = ", ".join(f"{c.t:.0f}s={c.score.total:.2f}" for c in top) or "n/a"
        improved = (
            before_black is not None
            and after_black is not None
            and before_black >= NEAR_BLACK_RATIO
            and after_black < NEAR_BLACK_RATIO
        )

        if dry_run:
            print(
                f"  [dry-run] {video_id} ({_title(item)})\n"
                f"      current: source={item.get('thumbnail_source') or 'legacy'} "
                f"black_ratio={before_black if before_black is None else round(before_black, 2)}\n"
                f"      would select: {choice.timestamp:.1f}s  "
                f"score={choice.score if choice.score is not None else 'n/a'}  "
                f"source={choice.source}\n"
                f"      candidates: {len(choice.candidates)}  top: {score_summary}\n"
                f"      would change: yes  improves near-black: {'yes' if improved else 'no'}  "
                f"({pick_secs:.1f}s)"
            )
            return "dry-run", improved

        thumb = workdir / "thumb.jpg"
        if not render_thumbnail(src, choice.timestamp, thumb, crop=choice.crop) or not thumb.exists():
            print(f"  FAIL {video_id}: could not render the production thumbnail")
            return "failed", False

        s3.upload_file(str(thumb), STREAMING_BUCKET, f"{video_id}/thumb.jpg",
                       ExtraArgs={"ContentType": "image/jpeg"})

        now = int(time.time())
        set_map: dict = {
            "thumb_key": f"{video_id}/thumb.jpg",
            "thumbnail_source": "auto",
            "thumbnail_timestamp": Decimal(str(round(choice.timestamp, 2))),
            "thumbnail_updated_at": now,
        }
        if choice.score is not None:
            set_map["thumbnail_score"] = Decimal(str(round(choice.score, 4)))

        cand_meta = []
        for c in choice.candidates:
            s3.upload_file(str(c.path), STREAMING_BUCKET,
                           f"{video_id}/thumbs/cand_{c.index:02d}.jpg",
                           ExtraArgs={"ContentType": "image/jpeg"})
            cand_meta.append({
                "i": c.index,
                "t": Decimal(str(round(c.t, 2))),
                "score": Decimal(str(round(c.score.total, 4))),
            })
        if cand_meta:
            set_map["thumbnail_candidates"] = cand_meta
            set_map["thumbnail_auto_index"] = choice.best_index

        expr = "SET " + ", ".join(f"#{k} = :{k}" for k in set_map)
        names = {f"#{k}": k for k in set_map}
        values = {f":{k}": v for k, v in set_map.items()}
        if "thumbnail_manual_index" in item:
            expr += " REMOVE #mi"
            names["#mi"] = "thumbnail_manual_index"
        table.update_item(
            Key={"video_id": video_id},
            UpdateExpression=expr,
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
        )
        print(
            f"  updated {video_id} ({_title(item)}): {choice.timestamp:.1f}s "
            f"score={choice.score if choice.score is not None else 'n/a'} "
            f"source={choice.source}"
            + ("  [improved near-black]" if improved else "")
            + f"  ({pick_secs:.1f}s)"
        )
        return "updated", improved


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--dry-run", action="store_true", help="report what would change, write nothing")
    ap.add_argument("--force", action="store_true", help="also regenerate manual (admin-picked) thumbnails")
    ap.add_argument("--video-id", help="only this video")
    ap.add_argument("--limit", type=int, default=0, help="stop after N eligible videos (0 = all)")
    args = ap.parse_args()

    session = boto3.Session(region_name=AWS_REGION)
    table = session.resource("dynamodb").Table(VIDEOS_TABLE)
    s3 = session.client("s3")

    videos = _iter_videos(table, args.video_id)
    if not videos:
        print("no matching videos")
        return

    counts = {
        "updated": 0, "dry-run": 0, "skipped-manual": 0,
        "skipped-ineligible": 0, "no-source": 0, "failed": 0,
    }
    times: list[float] = []
    improved = 0
    processed = 0

    for item in videos:
        if not eligible(item):
            counts["skipped-ineligible"] += 1
            continue
        if args.limit and processed >= args.limit:
            break
        processed += 1
        t0 = time.monotonic()
        try:
            result, was_improved = process(table, s3, item, dry_run=args.dry_run, force=args.force)
        except Exception as exc:  # noqa: BLE001
            print(f"  ERROR {item['video_id']}: {exc!r}")
            counts["failed"] += 1
            continue
        counts[result] = counts.get(result, 0) + 1
        if was_improved:
            improved += 1
        if result in ("updated", "dry-run"):
            times.append(time.monotonic() - t0)

    print("\n── backfill summary ─────────────────────────────")
    print(f"  videos evaluated:        {processed}")
    print(f"  thumbnails regenerated:  {counts['updated']}")
    print(f"  would regenerate (dry):  {counts['dry-run']}")
    print(f"  manual, skipped:         {counts['skipped-manual']}")
    print(f"  not eligible:            {counts['skipped-ineligible']}")
    print(f"  no source available:     {counts['no-source']}")
    print(f"  failed:                  {counts['failed']}")
    print(f"  near-black improved:      {improved}")
    if times:
        print(f"  avg selection time:      {sum(times) / len(times):.1f}s")


if __name__ == "__main__":
    main()
