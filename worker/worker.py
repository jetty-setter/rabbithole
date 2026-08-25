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
from decimal import Decimal
from pathlib import Path

import boto3

from metrics import emit_metrics, estimate_cost
from status import set_status, video_id_from_key
from storage import upload_tree
from transcoder import _ffmpeg, sample_frames, transcode_hls

# Inlined from shared/ai_utils.py -- the container image only bakes in
# worker/, so a cross-repo import here crashed the whole process at startup
# (shared/ was never on sys.path inside the container, only in local dev).
AI_SYSTEM_PROMPT = (
    "You title videos for RabbitHole, a fun, irreverent, internet-native video "
    "site. You're given a few frames sampled in chronological order across one "
    "short clip. Read them as a SEQUENCE and find the hook — the funniest, most "
    "surprising, or most satisfying beat. Return JSON with: "
    "(1) \"title\": a SHORT, punchy, scroll-stopping title — aim for 4-8 words, "
    "max 60 chars, no quotes, no end punctuation. Write it like a clip built to "
    "go viral: bold, playful, a little cheeky, with vivid active verbs and "
    "attitude; lead with the hook or a funny angle. Examples of the VIBE (never "
    "reuse): 'Zoomies Activated: Dog vs The Entire Agility Course', 'This Dog Has "
    "Zero Chill at the Beach', 'He Fully Committed to the Bit'. Avoid flat "
    "captions ('Dog in water') and lazy hype ('Amazing video'). "
    "(2) \"description\": a lively 1-2 sentence description of what actually "
    "happens. (3) \"tags\": 3-5 short lowercase tags. "
    "Be bold in VOICE but strictly accurate about what's on screen: never invent "
    "subjects or events that aren't clearly visible — do not add extra people or "
    "animals, do not state a specific breed, name, or place unless obvious, and "
    "count subjects conservatively (if you can't tell how many, say 'a dog', not "
    "'two dogs'). The comedy comes from framing and word choice, not made-up "
    'facts. Respond with ONLY a JSON object: {"title": str, "description": str, '
    '"tags": [str]}'
)


def parse_ai_metadata(text: str) -> dict | None:
    """Parse and sanitize Claude's JSON metadata response."""
    if "{" not in text:
        return None
    text = text[text.find("{"):text.rfind("}") + 1]
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
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

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
QUEUE_URL = os.getenv("JOB_QUEUE_URL", "")
STREAMING_BUCKET = os.getenv("STREAMING_BUCKET", "")
VIDEOS_TABLE = os.getenv("VIDEOS_TABLE", "rabbithole-dev-videos")
POLL_WAIT_SECONDS = int(os.getenv("POLL_WAIT_SECONDS", "20"))

# AI auto-metadata (optional). When ANTHROPIC_API_KEY is set, a vision model
# names untitled uploads from their thumbnail. Absent key -> feature is dormant.
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "claude-opus-4-8")

# Speech-to-text (optional). When TRANSCRIBE_ROLE_ARN is set, the worker extracts
# audio and kicks off an AWS Transcribe job after transcode; a post-processor
# Lambda turns the result into caption cues. Absent the role -> feature dormant.
TRANSCRIBE_ROLE_ARN = os.getenv("TRANSCRIBE_ROLE_ARN", "")

_session = boto3.session.Session(region_name=AWS_REGION)
sqs = _session.client("sqs")
s3 = _session.client("s3")
transcribe = _session.client("transcribe")
_videos = _session.resource("dynamodb").Table(VIDEOS_TABLE)


def _ai_metadata(frames: list[Path], filename: str) -> dict | None:
    """Auto-generate title/description/tags from a few frames sampled across the
    clip, using Claude vision. Best-effort: any failure returns None and the
    pipeline proceeds untouched (the video still plays; just manually-titled)."""
    if not ANTHROPIC_API_KEY or not frames:
        return None
    try:
        import base64

        import anthropic

        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        hint = Path(filename).stem.replace("-", " ").replace("_", " ").strip()
        images = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": base64.standard_b64encode(f.read_bytes()).decode(),
                },
            }
            for f in frames
        ]
        resp = client.messages.create(
            model=AI_MODEL,
            max_tokens=400,
            system=AI_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        *images,
                        {
                            "type": "text",
                            "text": "Frames are in chronological order (start -> end). "
                            f"Filename hint (weak, may be meaningless): '{hint}'. "
                            "Write the metadata JSON.",
                        },
                    ],
                }
            ],
        )
        text = "".join(b.text for b in resp.content if b.type == "text").strip()
        return parse_ai_metadata(text)
    except Exception as exc:  # noqa: BLE001
        print(f"ai metadata skipped for {filename}: {exc}")
        return None


def _start_transcription(video_id: str, src: Path, workdir: Path) -> bool:
    """Extract a mono 16 kHz FLAC track and fire an async AWS Transcribe job.

    Best-effort: a clip with no speech (or no audio stream at all) just yields
    nothing useful, so any failure is swallowed and the video proceeds normally.
    The job writes its raw result to the streaming bucket; an EventBridge-driven
    Lambda turns that into caption cues (see lambdas/transcribe)."""
    if not TRANSCRIBE_ROLE_ARN:
        return False
    audio = workdir / "audio.flac"
    try:
        # -vn drop video, mono, 16 kHz — Transcribe's sweet spot and a tiny file.
        _ffmpeg(["-i", str(src), "-vn", "-ac", "1", "-ar", "16000",
                 "-c:a", "flac", str(audio)])
    except subprocess.CalledProcessError:
        print(f"no audio track for {video_id}; skipping transcription")
        return False
    if not audio.exists() or audio.stat().st_size == 0:
        return False
    try:
        audio_key = f"{video_id}/audio.flac"
        s3.upload_file(str(audio), STREAMING_BUCKET, audio_key,
                       ExtraArgs={"ContentType": "audio/flac"})
        job = f"rh-{video_id}-{int(time.time())}"
        # No DataAccessRoleArn: for same-account buckets Transcribe uses the
        # caller's (worker role's) S3 permissions, which already cover streaming.
        # (TRANSCRIBE_ROLE_ARN stays as the feature on/off flag, checked above.)
        transcribe.start_transcription_job(
            TranscriptionJobName=job,
            Media={"MediaFileUri": f"s3://{STREAMING_BUCKET}/{audio_key}"},
            MediaFormat="flac",
            IdentifyLanguage=True,
            OutputBucketName=STREAMING_BUCKET,
            OutputKey=f"{video_id}/transcribe-raw.json",
        )
        print(f"transcription started for {video_id}: job={job}")
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"transcription start skipped for {video_id}: {exc}")
        return False


def _resolve_video(key: str) -> tuple[str, dict] | None:
    """Parse video_id from the S3 key and look up the DynamoDB record.

    Returns (video_id, item) or None if the record is missing/deleted."""
    video_id = video_id_from_key(key)
    if not video_id:
        print(f"skip: unrecognized key {key}")
        return None
    item = _videos.get_item(Key={"video_id": video_id}).get("Item")
    if not item:
        print(f"skip: no record for {video_id} (deleted)")
        return None
    return video_id, item


def process_record(bucket: str, key: str) -> None:
    resolved = _resolve_video(key)
    if not resolved:
        return
    video_id, item = resolved

    print(f"processing video_id={video_id} key={key}")
    set_status(video_id, "processing")
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
            set_status(video_id, "failed")
            raise

        upload_tree(hls_dir, STREAMING_BUCKET, f"{video_id}/hls", s3_client=s3)
        s3.upload_file(
            str(thumb), STREAMING_BUCKET, f"{video_id}/thumb.jpg",
            ExtraArgs={"ContentType": "image/jpeg"},
        )

        # Timing covers transcode only — measure before the (network-bound) AI call.
        elapsed = time.monotonic() - started

        # Kick off speech-to-text while the source is still on local disk. The
        # job runs async; the post-processor Lambda flips has_transcript later.
        transcribing = _start_transcription(video_id, src, workdir)

        # Auto-name untitled uploads from the freshly-extracted frame.
        ai_extra: dict = {}
        if not (item.get("title") or "").strip():
            frames = sample_frames(src, workdir / "frames")
            meta = _ai_metadata(frames, Path(key).name)
            if meta:
                if meta.get("title"):
                    ai_extra["title"] = meta["title"]
                if meta.get("description") and not (item.get("description") or "").strip():
                    ai_extra["description"] = meta["description"]
                if meta.get("tags") and not item.get("tags"):
                    ai_extra["tags"] = meta["tags"]
                if ai_extra:
                    ai_extra["ai_generated"] = True
                    print(f"ai-titled {video_id}: {ai_extra.get('title')!r}")

    extra = {
        "hls_key": f"{video_id}/hls/master.m3u8",
        "thumb_key": f"{video_id}/thumb.jpg",
        # DynamoDB's resource API rejects native float -- round first (so the
        # string conversion doesn't carry binary-float noise), then Decimal.
        "duration_seconds": Decimal(str(round(elapsed, 2))),
        "cost_usd": f"{estimate_cost(elapsed):.4f}",
        # True until the post-processor Lambda writes cues (or gives up).
        "transcribing": transcribing,
    }
    extra.update(ai_extra)
    set_status(video_id, "ready", extra)
    emit_metrics(elapsed, estimate_cost(elapsed))
    print(f"ready video_id={video_id} ({elapsed:.1f}s, ~${estimate_cost(elapsed):.4f})")


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
