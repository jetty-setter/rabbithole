"""Turn a finished AWS Transcribe job into caption cues.

Triggered by EventBridge on "Transcribe Job State Change". On COMPLETED we read
the raw Transcribe output the worker pointed at the streaming bucket, group the
word-level items into readable caption cues, and write two artifacts back:

    {video_id}/cues.json     — [{start, end, text}]  (the searchable transcript)
    {video_id}/captions.vtt  — WebVTT track for the <video> element

then flip the DynamoDB record to has_transcript=true. On FAILED (or no speech)
we just clear the `transcribing` flag so the UI stops waiting. Either way we tidy
up the throwaway audio + raw JSON. Everything is keyed off the video_id parsed
from the job's input media URI, so a deleted record can never be resurrected.
"""

import json
import os

import boto3
from botocore.exceptions import ClientError

STREAMING_BUCKET = os.environ["STREAMING_BUCKET"]
VIDEOS_TABLE = os.environ["VIDEOS_TABLE"]

s3 = boto3.client("s3")
transcribe = boto3.client("transcribe")
_videos = boto3.resource("dynamodb").Table(VIDEOS_TABLE)

# Cue shaping: start a fresh line on a sentence end, a noticeable pause, or once
# a line gets long enough to read comfortably on screen.
MAX_CHARS = 42
MAX_WORDS = 12
PAUSE_GAP = 0.8  # seconds of silence that forces a new cue
SENTENCE_END = {".", "!", "?"}


def handler(event, _context):
    detail = event.get("detail", {})
    job_name = detail.get("TranscriptionJobName", "")
    status = detail.get("TranscriptionJobStatus", "")
    if not job_name:
        print(f"no job name in event: {json.dumps(event)[:300]}")
        return {"ok": False}

    video_id = _video_id_for_job(job_name)
    if not video_id:
        print(f"could not resolve video_id for job {job_name}")
        return {"ok": False}

    if status != "COMPLETED":
        print(f"job {job_name} ended {status}; clearing transcribing flag")
        _mark(video_id, has_transcript=False)
        _cleanup(video_id)
        return {"ok": True, "status": status}

    raw = _read_json(f"{video_id}/transcribe-raw.json")
    cues = _build_cues(raw) if raw else []

    if not cues:
        print(f"{video_id}: no speech detected")
        _mark(video_id, has_transcript=False)
        _cleanup(video_id)
        return {"ok": True, "cues": 0}

    _put(f"{video_id}/cues.json", json.dumps(cues), "application/json")
    _put(f"{video_id}/captions.vtt", _to_vtt(cues), "text/vtt")
    _mark(
        video_id,
        has_transcript=True,
        transcript_key=f"{video_id}/cues.json",
        vtt_key=f"{video_id}/captions.vtt",
    )
    _cleanup(video_id)
    print(f"{video_id}: wrote {len(cues)} cues")
    return {"ok": True, "cues": len(cues)}


def _video_id_for_job(job_name: str) -> str | None:
    """Authoritative video_id from the job's input URI: s3://bucket/{id}/audio.flac."""
    try:
        job = transcribe.get_transcription_job(TranscriptionJobName=job_name)
        uri = job["TranscriptionJob"]["Media"]["MediaFileUri"]
        # s3://<bucket>/<video_id>/audio.flac
        return uri.split("/")[3]
    except (ClientError, KeyError, IndexError) as exc:
        print(f"get_transcription_job failed for {job_name}: {exc}")
        # Fallback: job name is rh-{video_id}-{epoch}; epoch is the last segment.
        if job_name.startswith("rh-"):
            return job_name[3:].rsplit("-", 1)[0] or None
        return None


def _read_json(key: str) -> dict | None:
    try:
        obj = s3.get_object(Bucket=STREAMING_BUCKET, Key=key)
        return json.loads(obj["Body"].read())
    except ClientError as exc:
        print(f"could not read {key}: {exc}")
        return None


def _build_cues(raw: dict) -> list[dict]:
    items = raw.get("results", {}).get("items", [])
    cues: list[dict] = []
    words: list[str] = []
    start: float | None = None
    end: float | None = None
    last_end: float | None = None

    def flush():
        nonlocal words, start, end
        if words and start is not None:
            cues.append({
                "start": round(start, 2),
                "end": round(end if end is not None else start, 2),
                "text": " ".join(words).strip(),
            })
        words = []
        start = end = None

    for it in items:
        kind = it.get("type")
        content = (it.get("alternatives") or [{}])[0].get("content", "")
        if not content:
            continue

        if kind == "punctuation":
            if words:
                words[-1] = words[-1] + content
            if content in SENTENCE_END:
                flush()
            continue

        s = _f(it.get("start_time"))
        e = _f(it.get("end_time"))
        # Force a break on a long silence before this word.
        if last_end is not None and s is not None and s - last_end > PAUSE_GAP:
            flush()

        if start is None:
            start = s
        words.append(content)
        end = e if e is not None else end
        last_end = e if e is not None else last_end

        line = " ".join(words)
        if len(words) >= MAX_WORDS or len(line) >= MAX_CHARS:
            flush()

    flush()
    return cues


def _f(v) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _ts(seconds: float) -> str:
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def _to_vtt(cues: list[dict]) -> str:
    lines = ["WEBVTT", ""]
    for c in cues:
        lines.append(f"{_ts(c['start'])} --> {_ts(c['end'])}")
        lines.append(c["text"])
        lines.append("")
    return "\n".join(lines)


def _put(key: str, body: str, content_type: str) -> None:
    s3.put_object(
        Bucket=STREAMING_BUCKET, Key=key,
        Body=body.encode("utf-8"), ContentType=content_type,
    )


def _mark(video_id: str, *, has_transcript: bool, transcript_key: str | None = None,
          vtt_key: str | None = None) -> None:
    expr = "SET has_transcript = :h, transcribing = :f"
    values: dict = {":h": has_transcript, ":f": False}
    if transcript_key:
        expr += ", transcript_key = :t"
        values[":t"] = transcript_key
    if vtt_key:
        expr += ", vtt_key = :v"
        values[":v"] = vtt_key
    try:
        _videos.update_item(
            Key={"video_id": video_id},
            UpdateExpression=expr,
            ExpressionAttributeValues=values,
            ConditionExpression="attribute_exists(video_id)",
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            print(f"record {video_id} gone; skipping mark")
            return
        raise


def _cleanup(video_id: str) -> None:
    for key in (f"{video_id}/audio.flac", f"{video_id}/transcribe-raw.json"):
        try:
            s3.delete_object(Bucket=STREAMING_BUCKET, Key=key)
        except ClientError:
            pass
