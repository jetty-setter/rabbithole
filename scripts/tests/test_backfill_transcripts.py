"""Unit tests for the backfill script's pure eligibility logic (no AWS calls)."""

import os
import sys
from pathlib import Path

os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import importlib.util

_spec = importlib.util.spec_from_file_location(
    "backfill_transcripts", Path(__file__).resolve().parents[1] / "backfill-transcripts.py"
)
backfill = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(backfill)


def _video(**over):
    item = {
        "video_id": "vid1",
        "filename": "clip.mp4",
        "status": "ready",
        "hls_key": "vid1/hls/master.m3u8",
    }
    item.update(over)
    return item


def test_eligible_when_transcript_status_missing():
    assert backfill.eligible(_video()) is True


def test_eligible_when_transcript_status_failed():
    assert backfill.eligible(_video(transcript_status="failed")) is True


def test_eligible_when_transcript_status_pending():
    assert backfill.eligible(_video(transcript_status="pending")) is True


def test_not_eligible_when_already_ready():
    assert backfill.eligible(_video(transcript_status="ready")) is False


def test_not_eligible_when_already_transcribing():
    # A job is already in flight -- retrying would double-start it.
    assert backfill.eligible(_video(transcript_status="transcribing")) is False


def test_not_eligible_when_no_speech():
    # Legitimate terminal state; retrying wastes a job on a genuinely silent clip.
    assert backfill.eligible(_video(transcript_status="no_speech")) is False


def test_not_eligible_when_not_ready_status():
    assert backfill.eligible(_video(status="processing")) is False


def test_not_eligible_without_playback():
    item = _video()
    del item["hls_key"]
    assert backfill.eligible(item) is False


def test_original_key_matches_upload_convention():
    assert backfill._original_key(_video(video_id="abc123", filename="clip.mp4")) == "uploads/abc123/clip.mp4"


def test_original_key_none_without_filename():
    item = _video()
    del item["filename"]
    assert backfill._original_key(item) is None
