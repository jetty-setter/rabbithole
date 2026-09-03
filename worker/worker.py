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

# Speech-to-text (optional). TRANSCRIBE_ROLE_ARN is the data-access role AWS
# Transcribe itself assumes to read the audio we upload and write its output --
# it is NOT just an on/off flag (see infra/transcribe.tf: the role has its own
# S3 read/write policy, and the worker's own role is granted iam:PassRole for
# exactly this ARN). It must actually be passed as DataAccessRoleArn below;
# omitting it makes Transcribe unable to read same-account buckets at all
# (BadRequestException: "The S3 URI that you provided can't be accessed"),
# which is what silently broke every transcription job. Absent the var ->
# feature dormant (e.g. an environment with no transcribe.tf applied).
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


def _start_transcription(video_id: str, src: Path, workdir: Path) -> tuple[str, str | None]:
    """Extract a mono 16 kHz FLAC track and fire an async AWS Transcribe job.

    Returns (transcript_status, transcript_error) where transcript_status is
    one of "transcribing" | "no_speech" | "failed" | "pending" (the last only
    when the feature is dormant -- TRANSCRIBE_ROLE_ARN unset). A clip with no
    audio stream is a normal, expected outcome (no_speech), not a failure --
    but a real error starting the job (bad permissions, throttling, etc.) is
    recorded as failed with a concise diagnostic reason instead of silently
    looking identical. The job writes its raw result to the streaming bucket;
    an EventBridge-driven Lambda turns that into caption cues (see
    lambdas/transcribe). The video itself is never blocked on any of this --
    the caller still marks the video ready regardless of transcript_status."""
    if not TRANSCRIBE_ROLE_ARN:
        return "pending", None
    audio = workdir / "audio.flac"
    try:
        # -vn drop video, mono, 16 kHz — Transcribe's sweet spot and a tiny file.
        _ffmpeg(["-i", str(src), "-vn", "-ac", "1", "-ar", "16000",
                 "-c:a", "flac", str(audio)])
    except subprocess.CalledProcessError as exc:
        tail = exc.stderr.decode(errors="ignore")[-300:] if exc.stderr else ""
        print(f"no audio track for {video_id}; skipping transcription ({tail})")
        return "no_speech", None
    if not audio.exists() or audio.stat().st_size == 0:
        print(f"empty audio extract for {video_id}; skipping transcription")
        return "no_speech", None
    try:
        audio_key = f"{video_id}/audio.flac"
        s3.upload_file(str(audio), STREAMING_BUCKET, audio_key,
                       ExtraArgs={"ContentType": "audio/flac"})
        job = f"rh-{video_id}-{int(time.time())}"
        # JobExecutionSettings.DataAccessRoleArn: Transcribe assumes this role
        # to read/write the streaming bucket. Without it, Transcribe does NOT
        # fall back to the calling (worker) identity's permissions -- it can't
        # read the audio at all, even same-account, and start_transcription_job
        # raises BadRequestException. infra/transcribe.tf already grants the
        # worker iam:PassRole for exactly this ARN; it just needs to be passed.
        # (DataAccessRoleArn is nested under JobExecutionSettings, not a
        # top-level param -- confirmed directly against the installed
        # botocore's service model; a top-level DataAccessRoleArn kwarg raises
        # a ParamValidationError, "Unknown parameter in input".)
        transcribe.start_transcription_job(
            TranscriptionJobName=job,
            Media={"MediaFileUri": f"s3://{STREAMING_BUCKET}/{audio_key}"},
            MediaFormat="flac",
            IdentifyLanguage=True,
            OutputBucketName=STREAMING_BUCKET,
            OutputKey=f"{video_id}/transcribe-raw.json",
            JobExecutionSettings={"DataAccessRoleArn": TRANSCRIBE_ROLE_ARN},
        )
        print(f"transcription started for {video_id}: job={job}")
        return "transcribing", None
    except Exception as exc:  # noqa: BLE001
        reason = str(exc)[:300]
        print(f"transcription start failed for {video_id}: {reason}")
        return "failed", reason


def _build_thumbnail(video_id: str, src: Path, thumb: Path, workdir: Path) -> dict:
    """Pick and render the production thumbnail, and upload the candidate frames
    the admin picker offers. Returns the DynamoDB fields to merge into the
    ready-state update. Never raises: on any failure it drops back to an early
    frame so the video still gets *a* thumbnail.

    Metadata written:
      thumbnail_source     "auto" (a manual admin choice later overrides this)
      thumbnail_timestamp  seconds into the source the frame was taken from
      thumbnail_score      0..1 usefulness score of the auto pick (debug only)
      thumbnail_updated_at epoch seconds -- the frontend cache-buster
      thumbnail_candidates [{i, t, score}, ...] for the admin frame picker
      thumbnail_auto_index index of the automatic pick within that list
    """
    now = int(time.time())
    t0 = time.monotonic()
    try:
        from thumbnails import render_thumbnail, select_thumbnail

        choice = select_thumbnail(src, workdir)
        rendered = render_thumbnail(src, choice.timestamp, thumb)
        cand_meta: list[dict] = []
        for c in choice.candidates:
            key = f"{video_id}/thumbs/cand_{c.index:02d}.jpg"
            s3.upload_file(str(c.path), STREAMING_BUCKET, key,
                           ExtraArgs={"ContentType": "image/jpeg"})
            cand_meta.append({
                "i": c.index,
                "t": Decimal(str(round(c.t, 2))),
                "score": Decimal(str(round(c.score.total, 4))),
            })
        print(
            f"thumbnail candidates: {len(choice.candidates)}  "
            f"selected: {choice.timestamp:.1f}s  "
            f"score: {choice.score if choice.score is not None else 'n/a'}  "
            f"source: {choice.source}  ({time.monotonic() - t0:.1f}s)"
        )
        extra: dict = {
            "thumbnail_source": "auto",
            "thumbnail_timestamp": Decimal(str(round(choice.timestamp, 2))),
            "thumbnail_updated_at": now,
        }
        if choice.score is not None:
            extra["thumbnail_score"] = Decimal(str(round(choice.score, 4)))
        if cand_meta:
            extra["thumbnail_candidates"] = cand_meta
            extra["thumbnail_auto_index"] = choice.best_index
        if rendered and thumb.exists() and thumb.stat().st_size > 0:
            return extra
        print(f"thumbnail render produced no file for {video_id}; using fallback frame")
    except Exception as exc:  # noqa: BLE001 - thumbnails never fail an ingest
        print(f"smart thumbnail failed for {video_id}: {exc!r}; using fallback frame")

    # Fallback: the old fixed early-frame behaviour.
    try:
        _ffmpeg(["-ss", "00:00:01", "-i", str(src), "-vframes", "1",
                 "-vf", "scale=640:-2", str(thumb)])
    except subprocess.CalledProcessError as exc:
        tail = exc.stderr.decode(errors="ignore")[-300:] if exc.stderr else ""
        print(f"fallback thumbnail also failed for {video_id}: {tail}")
        return {"thumbnail_source": "auto", "thumbnail_updated_at": now}
    return {
        "thumbnail_source": "auto",
        "thumbnail_timestamp": Decimal("1.0"),
        "thumbnail_updated_at": now,
    }


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
        except subprocess.CalledProcessError as exc:
            tail = exc.stderr.decode(errors="ignore")[-500:] if exc.stderr else ""
            print(f"ffmpeg failed for {video_id}: {tail}")
            set_status(video_id, "failed")
            raise

        # Smart thumbnail: sample frames across the clip, score them, pick the
        # most useful one. Best-effort -- a scoring/extraction failure falls
        # back to an early frame (the old fixed-timestamp behaviour) and never
        # fails an otherwise-playable video.
        thumb_extra = _build_thumbnail(video_id, src, thumb, workdir)

        upload_tree(hls_dir, STREAMING_BUCKET, f"{video_id}/hls", s3_client=s3)
        if thumb.exists() and thumb.stat().st_size > 0:
            s3.upload_file(
                str(thumb), STREAMING_BUCKET, f"{video_id}/thumb.jpg",
                ExtraArgs={"ContentType": "image/jpeg"},
            )

        # Timing covers transcode only — measure before the (network-bound) AI call.
        elapsed = time.monotonic() - started

        # Kick off speech-to-text while the source is still on local disk. The
        # job runs async; the post-processor Lambda sets transcript_status
        # (and has_transcript) to its final value later.
        transcript_status, transcript_error = _start_transcription(video_id, src, workdir)

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
        "transcript_status": transcript_status,
        **thumb_extra,
        # True only while a Transcribe job is actually in flight -- the
        # post-processor Lambda clears it (and sets the final transcript_status)
        # once the job completes, fails, or turns out to have no speech.
        "transcribing": transcript_status == "transcribing",
    }
    if transcript_error:
        extra["transcript_error"] = transcript_error
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
