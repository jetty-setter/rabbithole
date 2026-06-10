"""RabbitHole transcode worker (P3).

Long-polls SQS for S3 "Object Created" events (delivered via EventBridge),
transcodes the uploaded video into a multi-bitrate HLS ladder (480/720/1080p)
with a master playlist + thumbnail, uploads everything to the streaming bucket,
and advances the DynamoDB status:

    pending_upload -> processing -> ready   (or -> failed)

Runs on ECS Fargate. CloudFront fronts the streaming bucket for adaptive playback.
"""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
import time
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
QUEUE_URL = os.getenv("JOB_QUEUE_URL", "")
STREAMING_BUCKET = os.getenv("STREAMING_BUCKET", "")
VIDEOS_TABLE = os.getenv("VIDEOS_TABLE", "rabbithole-dev-videos")
POLL_WAIT_SECONDS = int(os.getenv("POLL_WAIT_SECONDS", "20"))

# AI auto-metadata (optional). When ANTHROPIC_API_KEY is set, a vision model
# names untitled uploads from their thumbnail. Absent key -> feature is dormant.
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "claude-opus-4-8")

# Fargate pricing inputs for the per-video cost estimate (us-east-1 defaults).
FARGATE_CPU_UNITS = int(os.getenv("FARGATE_CPU_UNITS", "512"))
FARGATE_MEMORY_MIB = int(os.getenv("FARGATE_MEMORY_MIB", "1024"))
FARGATE_VCPU_HOUR = float(os.getenv("FARGATE_VCPU_HOUR", "0.04048"))
FARGATE_GB_HOUR = float(os.getenv("FARGATE_GB_HOUR", "0.004445"))

# HLS rendition ladder. (width/resolution are advertised in the master playlist
# for the player's ABR logic; -2 height scaling preserves the real aspect ratio.)
RENDITIONS = [
    {"name": "480p", "height": 480, "width": 854, "bv": "1400k", "maxrate": "1498k", "bufsize": "2100k", "bandwidth": 1400000},
    {"name": "720p", "height": 720, "width": 1280, "bv": "2800k", "maxrate": "2996k", "bufsize": "4200k", "bandwidth": 2800000},
    {"name": "1080p", "height": 1080, "width": 1920, "bv": "5000k", "maxrate": "5350k", "bufsize": "7500k", "bandwidth": 5000000},
]

_session = boto3.session.Session(region_name=AWS_REGION)
sqs = _session.client("sqs")
s3 = _session.client("s3")
_videos = _session.resource("dynamodb").Table(VIDEOS_TABLE)


def _video_id_from_key(key: str) -> str | None:
    # keys look like: uploads/{video_id}/{filename}
    parts = key.split("/")
    if len(parts) >= 3 and parts[0] == "uploads":
        return parts[1]
    return None


def _set_status(video_id: str, status: str, extra: dict | None = None) -> None:
    expr = "SET #s = :s"
    names = {"#s": "status"}
    values: dict = {":s": status}
    for i, (field, value) in enumerate((extra or {}).items()):
        expr += f", #k{i} = :v{i}"
        names[f"#k{i}"] = field
        values[f":v{i}"] = value
    try:
        _videos.update_item(
            Key={"video_id": video_id},
            UpdateExpression=expr,
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            # Never create a record — only update an existing one. Prevents the
            # "phantom untitled video" bug when a job runs for a deleted video.
            ConditionExpression="attribute_exists(video_id)",
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            print(f"record {video_id} no longer exists; skipping status update")
            return
        raise


def _estimate_cost(seconds: float) -> float:
    """Estimated Fargate compute cost for `seconds` of processing."""
    vcpu = FARGATE_CPU_UNITS / 1024
    gb = FARGATE_MEMORY_MIB / 1024
    return seconds / 3600 * (vcpu * FARGATE_VCPU_HOUR + gb * FARGATE_GB_HOUR)


def _ai_metadata(thumb: Path, filename: str) -> dict | None:
    """Auto-generate title/description/tags from a representative frame using
    Claude vision. Best-effort: any failure returns None and the pipeline
    proceeds untouched (the video still plays; it just stays manually-titled)."""
    if not ANTHROPIC_API_KEY:
        return None
    try:
        import base64

        import anthropic

        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        img_b64 = base64.standard_b64encode(thumb.read_bytes()).decode()
        hint = Path(filename).stem.replace("-", " ").replace("_", " ").strip()
        resp = client.messages.create(
            model=AI_MODEL,
            max_tokens=400,
            system=(
                "You write metadata for short user-uploaded clips on RabbitHole, "
                "a punchy, irreverent video site. Given one representative frame, "
                "return a vivid but accurate title (max 60 chars, no quotes, no "
                "trailing punctuation), a 1-2 sentence description, and 3-5 short "
                "lowercase tags. Describe only what you can actually see — never "
                "invent specifics. Respond with ONLY a JSON object of the form "
                '{"title": str, "description": str, "tags": [str]}'
            ),
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": img_b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": f"Filename hint (weak, may be meaningless): '{hint}'. "
                            "Generate the metadata JSON.",
                        },
                    ],
                }
            ],
        )
        text = "".join(b.text for b in resp.content if b.type == "text").strip()
        if "{" in text:  # tolerate stray prose / code fences around the JSON
            text = text[text.find("{") : text.rfind("}") + 1]
        data = json.loads(text)
        title = (data.get("title") or "").strip().strip('"')[:120]
        description = (data.get("description") or "").strip()[:1000]
        tags = [str(t).strip().lower()[:30] for t in (data.get("tags") or []) if str(t).strip()][:5]
        out: dict = {}
        if title:
            out["title"] = title
        if description:
            out["description"] = description
        if tags:
            out["tags"] = tags
        return out or None
    except Exception as exc:  # noqa: BLE001
        print(f"ai metadata skipped for {filename}: {exc}")
        return None


def _ffmpeg(args: list[str]) -> None:
    subprocess.run(["ffmpeg", "-y", *args], check=True, capture_output=True)


def transcode_hls(src: Path, outdir: Path) -> None:
    """Build an HLS ladder: one playlist + segments per rendition, plus a master."""
    for r in RENDITIONS:
        rendition_dir = outdir / r["name"]
        rendition_dir.mkdir(parents=True, exist_ok=True)
        _ffmpeg([
            "-i", str(src),
            "-vf", f"scale=-2:{r['height']}",
            "-c:v", "libx264", "-preset", "veryfast",
            "-b:v", r["bv"], "-maxrate", r["maxrate"], "-bufsize", r["bufsize"],
            "-c:a", "aac", "-b:a", "128k", "-ac", "2",
            # closed GOP every 2s (48 frames @ 24fps) so renditions are segment-aligned
            "-g", "48", "-keyint_min", "48", "-sc_threshold", "0",
            "-hls_time", "4", "-hls_playlist_type", "vod",
            "-hls_segment_filename", str(rendition_dir / "seg_%03d.ts"),
            str(rendition_dir / "index.m3u8"),
        ])
    _write_master(outdir)


def _write_master(outdir: Path) -> None:
    lines = ["#EXTM3U", "#EXT-X-VERSION:3"]
    for r in RENDITIONS:
        lines.append(
            f"#EXT-X-STREAM-INF:BANDWIDTH={r['bandwidth']},"
            f"RESOLUTION={r['width']}x{r['height']}"
        )
        lines.append(f"{r['name']}/index.m3u8")
    (outdir / "master.m3u8").write_text("\n".join(lines) + "\n")


def _content_type(path: Path) -> str:
    return {
        ".m3u8": "application/vnd.apple.mpegurl",
        ".ts": "video/mp2t",
        ".jpg": "image/jpeg",
    }.get(path.suffix, "application/octet-stream")


def _upload_tree(local_dir: Path, bucket: str, prefix: str) -> None:
    for path in local_dir.rglob("*"):
        if path.is_file():
            rel = path.relative_to(local_dir).as_posix()
            s3.upload_file(
                str(path), bucket, f"{prefix}/{rel}",
                ExtraArgs={"ContentType": _content_type(path)},
            )


def process_record(bucket: str, key: str) -> None:
    video_id = _video_id_from_key(key)
    if not video_id:
        print(f"skip: unrecognized key {key}")
        return

    # Skip jobs whose video record no longer exists (deleted before processing).
    item = _videos.get_item(Key={"video_id": video_id}).get("Item")
    if not item:
        print(f"skip: no record for {video_id} (deleted)")
        return

    print(f"processing video_id={video_id} key={key}")
    _set_status(video_id, "processing")
    started = time.monotonic()

    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        src = workdir / "input"
        s3.download_file(bucket, key, str(src))

        hls_dir = workdir / "hls"
        thumb = workdir / "thumb.jpg"
        try:
            transcode_hls(src, hls_dir)
            _ffmpeg([
                "-ss", "00:00:01", "-i", str(src),
                "-vframes", "1", "-vf", "scale=640:-2", str(thumb),
            ])
        except subprocess.CalledProcessError as exc:
            tail = exc.stderr.decode(errors="ignore")[-500:] if exc.stderr else ""
            print(f"ffmpeg failed for {video_id}: {tail}")
            _set_status(video_id, "failed")
            raise

        _upload_tree(hls_dir, STREAMING_BUCKET, f"{video_id}/hls")
        s3.upload_file(
            str(thumb), STREAMING_BUCKET, f"{video_id}/thumb.jpg",
            ExtraArgs={"ContentType": "image/jpeg"},
        )

        # Timing covers transcode only — measure before the (network-bound) AI call.
        elapsed = time.monotonic() - started

        # Auto-name untitled uploads from the freshly-extracted frame.
        ai_extra: dict = {}
        if not (item.get("title") or "").strip():
            meta = _ai_metadata(thumb, Path(key).name)
            if meta:
                if meta.get("title"):
                    ai_extra["title"] = meta["title"]
                if meta.get("description") and not (item.get("description") or "").strip():
                    ai_extra["description"] = meta["description"]
                if meta.get("tags"):
                    ai_extra["tags"] = meta["tags"]
                if ai_extra:
                    ai_extra["ai_generated"] = True
                    print(f"ai-titled {video_id}: {ai_extra.get('title')!r}")

    extra = {
        "hls_key": f"{video_id}/hls/master.m3u8",
        "thumb_key": f"{video_id}/thumb.jpg",
        "duration_seconds": str(round(elapsed, 1)),
        "cost_usd": f"{_estimate_cost(elapsed):.4f}",
    }
    extra.update(ai_extra)
    _set_status(video_id, "ready", extra)
    print(f"ready video_id={video_id} ({elapsed:.1f}s, ~${_estimate_cost(elapsed):.4f})")


def handle_message(body: str) -> None:
    event = json.loads(body)
    detail = event.get("detail", {})
    bucket = detail.get("bucket", {}).get("name")
    key = detail.get("object", {}).get("key")
    if not bucket or not key:
        print(f"skip: no bucket/key in message: {body[:200]}")
        return
    process_record(bucket, key)


def main() -> None:
    if not QUEUE_URL:
        raise SystemExit("JOB_QUEUE_URL is not set")
    print(f"rabbithole-worker: polling {QUEUE_URL}")
    while True:
        resp = sqs.receive_message(
            QueueUrl=QUEUE_URL,
            MaxNumberOfMessages=1,
            WaitTimeSeconds=POLL_WAIT_SECONDS,
        )
        for msg in resp.get("Messages", []):
            try:
                handle_message(msg["Body"])
                sqs.delete_message(QueueUrl=QUEUE_URL, ReceiptHandle=msg["ReceiptHandle"])
            except Exception as exc:  # noqa: BLE001
                # Leave the message un-deleted: SQS redelivers, then routes to the
                # DLQ after maxReceiveCount. (At-least-once; transcode is idempotent.)
                print(f"error handling message: {exc}")


if __name__ == "__main__":
    main()
