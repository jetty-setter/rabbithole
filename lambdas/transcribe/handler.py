"""Turn a finished AWS Transcribe job into caption cues.

Triggered by EventBridge on "Transcribe Job State Change". On COMPLETED we read
the raw Transcribe output the worker pointed at the streaming bucket, group the
word-level items into readable caption cues, and write two artifacts back:

    {video_id}/cues.json     — [{start, end, text}]  (the searchable transcript)
    {video_id}/captions.vtt  — WebVTT track for the <video> element

then set transcript_status="ready" (and has_transcript=true) on the DynamoDB
record. Every other outcome sets a DISTINCT transcript_status instead of
collapsing into one generic "no transcript" state:

    COMPLETED, cues found        -> ready
    COMPLETED, no cues (no raw
      speech content)            -> no_speech
    FAILED                       -> failed (+ transcript_error from the job)
    raw output missing/malformed -> failed (NOT no_speech -- the job may have
                                     genuinely succeeded; we just couldn't read
                                     our own output, which is our bug to chase,
                                     not "this clip has no speech")

Successful and no_speech jobs have their throwaway audio/raw-JSON cleaned up
immediately. Failed jobs (including unreadable raw output) keep those artifacts
so they can actually be debugged, instead of deleting the only evidence at the
same moment we discover something went wrong.

Everything is keyed off the video_id parsed from the job's input media URI, so
a deleted record can never be resurrected.
"""

import json
import os
import sys
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

# In the repo, shared/ lives two directory levels up from this file
# (rabbithole/shared). But the DEPLOYED Lambda zip is flat -- terraform
# bundles shared/ as a sibling of handler.py at the zip root (see
# infra/transcribe.tf), not nested inside lambdas/transcribe/ two levels
# down -- so the two-levels-up path that works in local dev/tests resolves
# to "/" inside the Lambda runtime and silently can't find shared at all.
# This was never caught because no Transcribe job had ever successfully
# started (see worker.py's DataAccessRoleArn fix) to actually invoke this
# Lambda in production. Try the deployed (sibling) layout first, then fall
# back to the repo layout, so both actually work.
_here = Path(__file__).resolve().parent
for _candidate in (_here, _here.parent.parent):
    if (_candidate / "shared").is_dir():
        sys.path.insert(0, str(_candidate))
        break
from shared.captions import build_cues, to_vtt  # noqa: E402

STREAMING_BUCKET = os.environ["STREAMING_BUCKET"]
VIDEOS_TABLE = os.environ["VIDEOS_TABLE"]

s3 = boto3.client("s3")
transcribe = boto3.client("transcribe")
_videos = boto3.resource("dynamodb").Table(VIDEOS_TABLE)


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

    if status == "FAILED":
        reason = (detail.get("FailureReason") or "")[:300]
        print(f"job {job_name} FAILED for {video_id}: {reason}")
        _mark(video_id, transcript_status="failed", has_transcript=False, transcript_error=reason or None)
        # Retained (not cleaned up): a genuine job failure is exactly the case
        # worth being able to inspect afterward.
        return {"ok": True, "status": status}

    if status != "COMPLETED":
        # EventBridge only fires this rule for COMPLETED/FAILED, but don't
        # assume — treat anything else as non-terminal and leave the record
        # alone rather than guessing a final state for it.
        print(f"job {job_name} in unexpected non-terminal status {status}; ignoring")
        return {"ok": True, "status": status}

    raw = _read_json(f"{video_id}/transcribe-raw.json")
    if raw is None:
        # The job itself reported COMPLETED -- this is OUR failure to read our
        # own output (missing key, bad permissions, malformed JSON), not
        # evidence the clip has no speech. Keep the artifacts; don't guess.
        print(f"{video_id}: transcribe-raw.json missing or unreadable after COMPLETED status")
        _mark(video_id, transcript_status="failed", has_transcript=False,
              transcript_error="raw transcript output missing or unreadable")
        return {"ok": True, "status": "raw_missing"}

    cues = build_cues(raw)

    if not cues:
        print(f"{video_id}: no speech detected")
        _mark(video_id, transcript_status="no_speech", has_transcript=False)
        _cleanup(video_id)
        return {"ok": True, "cues": 0}

    _put(f"{video_id}/cues.json", json.dumps(cues), "application/json")
    _put(f"{video_id}/captions.vtt", to_vtt(cues), "text/vtt")
    _mark(
        video_id,
        transcript_status="ready",
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


def _put(key: str, body: str, content_type: str) -> None:
    s3.put_object(
        Bucket=STREAMING_BUCKET, Key=key,
        Body=body.encode("utf-8"), ContentType=content_type,
    )


def _mark(video_id: str, *, transcript_status: str, has_transcript: bool,
          transcript_key: str | None = None, vtt_key: str | None = None,
          transcript_error: str | None = None) -> None:
    expr = "SET transcript_status = :ts, has_transcript = :h, transcribing = :f"
    values: dict = {":ts": transcript_status, ":h": has_transcript, ":f": False}
    if transcript_key:
        expr += ", transcript_key = :t"
        values[":t"] = transcript_key
    if vtt_key:
        expr += ", vtt_key = :v"
        values[":v"] = vtt_key
    if transcript_error:
        expr += ", transcript_error = :e"
        values[":e"] = transcript_error
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
