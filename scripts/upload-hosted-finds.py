"""Host reviewed public-domain finds through the normal upload pipeline.

Dry run by default. For each manifest entry this creates the same `pending_upload`
record POST /uploads would, then puts the file at uploads/<video_id>/<filename> so
S3 -> EventBridge -> SQS -> Fargate transcodes it and AWS Transcribe captions it.
Only use files whose license permits hosting; the manifest records each source.
Run: python scripts/upload-hosted-finds.py MEDIA_DIR [--profile rabbithole] [--apply]
"""
import argparse
import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

import boto3
from botocore.exceptions import ClientError


def safe_filename(name):
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)[:120]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("media_dir", type=Path)
    parser.add_argument("--profile", default="rabbithole")
    parser.add_argument("--table", default="rabbithole-dev-videos")
    parser.add_argument("--bucket", default="rabbithole-dev-uploads-936922781601")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    manifest = json.loads(Path(__file__).with_name("hosted-finds.json").read_text())
    session = boto3.Session(profile_name=args.profile, region_name="us-east-1")
    table = session.resource("dynamodb").Table(args.table)
    s3 = session.client("s3")
    for entry in manifest:
        path = args.media_dir / entry["file"]
        if not path.is_file():
            raise FileNotFoundError(path)
        # Deterministic id: re-running never creates a second copy of the same find.
        video_id = uuid.uuid5(uuid.NAMESPACE_URL, entry["source_url"]).hex
        filename = safe_filename(entry["file"])
        key = f"uploads/{video_id}/{filename}"
        size_mb = path.stat().st_size / 1e6
        print(f"{'Upload' if args.apply else 'Would upload'}: {entry['title']} | {size_mb:.1f} MB | {key}")
        if not args.apply:
            continue
        item = {
            "video_id": video_id, "filename": filename, "key": key,
            "content_type": "video/mp4", "status": "pending_upload",
            "owner": "RabbitHole", "created_by": "hosted-finds",
            "created_at": datetime.now(timezone.utc).isoformat(), "visibility": "public",
            "title": entry["title"], "description": entry["description"], "tags": entry["tags"],
        }
        try:
            table.put_item(Item=item, ConditionExpression="attribute_not_exists(video_id)")
        except ClientError as exc:
            if exc.response["Error"]["Code"] != "ConditionalCheckFailedException":
                raise
            print(f"  Already present, skipping: {video_id}")
            continue
        s3.upload_file(str(path), args.bucket, key, ExtraArgs={"ContentType": "video/mp4"})
        print(f"  Added {video_id}; the pipeline takes it from here.")
    if not args.apply:
        print(f"Dry run: {len(manifest)} entries checked. Nothing written.")


if __name__ == "__main__":
    main()
