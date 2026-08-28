#!/usr/bin/env python3
"""Retry transcription for READY videos that never got one.

Root cause (see worker/worker.py history): the worker started every AWS
Transcribe job without DataAccessRoleArn, so every single job failed with
BadRequestException before this fix -- every existing video's transcript_status
is either missing entirely (legacy records, pre-dates the field) or "failed".
This script repairs those in place, WITHOUT re-transcoding: it re-runs only
the transcription half of the pipeline (worker._start_transcription, the same
function the worker itself now uses, so there is exactly one implementation
to trust) against each video's original uploaded source, which the uploads
bucket retains indefinitely (confirmed: nothing in the pipeline ever deletes
it).

Eligible video: status=ready, has a playable hls_key, and transcript_status is
missing, "pending", or "failed". Already-ready, already-transcribing, and
no_speech videos are skipped -- retrying a genuine no_speech verdict wastes a
Transcribe job on a clip that was already correctly determined to have no
speech to transcribe.

Idempotent: safe to re-run. A video that succeeds on one run is "ready" on the
next and gets skipped; a video mid-flight ("transcribing") is left alone
rather than double-started.

Usage (needs AWS credentials + the same deps as the worker; both already in
api/.venv, which also has boto3/anthropic):
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/backfill-transcripts.py --dry-run
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/backfill-transcripts.py
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/backfill-transcripts.py --limit 5
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/backfill-transcripts.py --video-id abc123
"""

from __future__ import annotations

import argparse
import os
import sys
import tempfile
import time
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

# worker._start_transcription reads STREAMING_BUCKET/TRANSCRIBE_ROLE_ARN as
# module-level globals, resolved from the environment at import time -- they
# must be set before the `from worker import ...` below, not merely by the
# time main() runs. setdefault so a real override (e.g. a different account)
# still wins if the caller exports these first.
os.environ.setdefault("STREAMING_BUCKET", "rabbithole-dev-streaming-936922781601")
os.environ.setdefault("TRANSCRIBE_ROLE_ARN", "arn:aws:iam::936922781601:role/rabbithole-dev-transcribe")
os.environ.setdefault("VIDEOS_TABLE", "rabbithole-dev-videos")
os.environ.setdefault("AWS_REGION", "us-east-1")

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "worker"))
from status import set_status  # noqa: E402
from worker import _start_transcription  # noqa: E402  (the real, fixed implementation)

ELIGIBLE_TRANSCRIPT_STATUSES = {None, "pending", "failed"}
# Between-job pause: AWS Transcribe has an account-level concurrent-job limit
# (default 100, but this is a portfolio-scale account) -- a small gap keeps a
# big backfill from slamming the API and tripping throttling on every call.
PACE_SECONDS = 2.0


def eligible(item: dict) -> bool:
    if item.get("status") != "ready":
        return False
    if not item.get("hls_key"):
        return False
    return item.get("transcript_status") in ELIGIBLE_TRANSCRIPT_STATUSES


def _original_key(item: dict) -> str | None:
    filename = item.get("filename")
    if not filename:
        return None
    return f"uploads/{item['video_id']}/{filename}"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--region", default="us-east-1")
    ap.add_argument("--videos-table", default="rabbithole-dev-videos")
    ap.add_argument("--uploads-bucket", default="rabbithole-dev-uploads-936922781601")
    ap.add_argument("--limit", type=int, default=None, help="stop after this many attempted retries")
    ap.add_argument("--video-id", action="append", default=None,
                     help="only retry this video_id (repeatable); skips the table scan")
    ap.add_argument("--dry-run", action="store_true", help="report what would run, start nothing")
    args = ap.parse_args()

    session = boto3.session.Session(region_name=args.region)
    s3 = session.client("s3")
    videos = session.resource("dynamodb").Table(args.videos_table)

    if args.video_id:
        items = []
        for vid in args.video_id:
            resp = videos.get_item(Key={"video_id": vid})
            item = resp.get("Item")
            if not item:
                print(f"skip {vid}: no such video")
                continue
            items.append(item)
    else:
        items = []
        scan_kwargs: dict = {}
        while True:
            resp = videos.scan(**scan_kwargs)
            items.extend(resp.get("Items", []))
            if "LastEvaluatedKey" not in resp:
                break
            scan_kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]

    targets = [it for it in items if eligible(it)]
    print(f"{len(items)} video record(s) scanned, {len(targets)} eligible for a transcription retry")

    if args.limit is not None:
        targets = targets[: args.limit]

    attempted = started = skipped_missing_source = failed = 0
    for item in targets:
        video_id = item["video_id"]
        key = _original_key(item)
        if not key:
            print(f"skip {video_id}: no filename on record, can't locate original source")
            skipped_missing_source += 1
            continue

        try:
            s3.head_object(Bucket=args.uploads_bucket, Key=key)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code in ("404", "NoSuchKey", "NotFound"):
                print(f"skip {video_id}: original source no longer at s3://{args.uploads_bucket}/{key}")
                skipped_missing_source += 1
                continue
            raise

        if args.dry_run:
            print(f"[dry-run] would retry {video_id} (source: {key})")
            attempted += 1
            continue

        attempted += 1
        print(f"retrying {video_id} ...")
        with tempfile.TemporaryDirectory() as tmp:
            workdir = Path(tmp)
            src = workdir / "input"
            try:
                s3.download_file(args.uploads_bucket, key, str(src))
            except ClientError as exc:
                print(f"  download failed for {video_id}: {exc}")
                skipped_missing_source += 1
                continue

            status, error = _start_transcription(video_id, src, workdir)

        extra = {"transcript_status": status, "transcribing": status == "transcribing"}
        if error:
            extra["transcript_error"] = error
        set_status(video_id, "ready", extra)

        if status == "transcribing":
            started += 1
            print(f"  started (job status: transcribing)")
        elif status == "no_speech":
            print(f"  no speech found in source audio")
        else:
            failed += 1
            print(f"  failed to start: {error}")

        time.sleep(PACE_SECONDS)

    print(
        f"\ndone: {attempted} attempted, {started} jobs started, "
        f"{failed} failed to start, {skipped_missing_source} skipped (missing source)"
    )


if __name__ == "__main__":
    main()
