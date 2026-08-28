"""Unit tests for the worker's pure helpers (no AWS calls)."""

import os
import subprocess
from pathlib import Path
from unittest.mock import MagicMock

from botocore.stub import Stubber

os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")

import status as worker_status  # noqa: E402
import metrics as worker_metrics  # noqa: E402
import worker as worker_mod  # noqa: E402


def test_video_id_from_key_valid():
    assert worker_status.video_id_from_key("uploads/abc123/clip.mp4") == "abc123"


def test_video_id_from_key_ignores_non_uploads():
    assert worker_status.video_id_from_key("other/abc/clip.mp4") is None
    assert worker_status.video_id_from_key("clip.mp4") is None


def test_estimate_cost_scales_with_time():
    # Defaults: 512 cpu units (0.5 vCPU), 1024 MiB (1 GB).
    one_hour = worker_metrics.estimate_cost(3600)
    assert one_hour == 0.0 or one_hour > 0
    # Linear in duration.
    assert abs(worker_metrics.estimate_cost(7200) - 2 * one_hour) < 1e-9


def test_estimate_cost_zero_for_zero_seconds():
    assert worker_metrics.estimate_cost(0) == 0.0


def test_estimate_cost_known_value():
    # 1h at 0.5 vCPU + 1 GB: 0.5*0.04048 + 1*0.004445 = 0.024685
    assert abs(worker_metrics.estimate_cost(3600) - 0.024685) < 1e-6


# ── _start_transcription (mocked ffmpeg/S3/Transcribe, no real AWS calls) ──


def _fake_ffmpeg_writes_audio(monkeypatch, tmp_path):
    """Patch worker._ffmpeg so it "extracts" audio by writing a small non-empty
    file at the destination path _start_transcription expects (last arg)."""

    def fake_ffmpeg(args):
        dest = Path(args[-1])
        dest.write_bytes(b"fake-flac-bytes")

    monkeypatch.setattr(worker_mod, "_ffmpeg", fake_ffmpeg)


def test_start_transcription_disabled_without_role_arn(monkeypatch, tmp_path):
    monkeypatch.setattr(worker_mod, "TRANSCRIBE_ROLE_ARN", "")
    status, error = worker_mod._start_transcription("vid1", tmp_path / "src.mp4", tmp_path)
    assert (status, error) == ("pending", None)


def test_start_transcription_starts_job_and_passes_data_access_role(monkeypatch, tmp_path):
    monkeypatch.setattr(worker_mod, "TRANSCRIBE_ROLE_ARN", "arn:aws:iam::123:role/transcribe")
    monkeypatch.setattr(worker_mod, "STREAMING_BUCKET", "test-streaming")
    monkeypatch.setattr(worker_mod.time, "time", lambda: 1700000000)
    _fake_ffmpeg_writes_audio(monkeypatch, tmp_path)

    fake_s3 = MagicMock()
    monkeypatch.setattr(worker_mod, "s3", fake_s3)

    # A real client wrapped in Stubber, not a bare MagicMock: boto3 validates
    # parameters against the actual service model before Stubber ever hands
    # back its canned response, so an unknown/misplaced parameter raises
    # ParamValidationError here exactly like it would against the real API.
    # A MagicMock would have silently accepted the WRONG shape this test
    # guards against -- a top-level DataAccessRoleArn kwarg, which is what
    # actually shipped and broke every transcription job in production
    # (real error: "Unknown parameter in input: DataAccessRoleArn" --
    # botocore expects it nested under JobExecutionSettings).
    stubber = Stubber(worker_mod.transcribe)
    stubber.add_response(
        "start_transcription_job",
        {"TranscriptionJob": {"TranscriptionJobName": "rh-vid1-1700000000", "TranscriptionJobStatus": "IN_PROGRESS"}},
        expected_params={
            "TranscriptionJobName": "rh-vid1-1700000000",
            "Media": {"MediaFileUri": "s3://test-streaming/vid1/audio.flac"},
            "MediaFormat": "flac",
            "IdentifyLanguage": True,
            "OutputBucketName": "test-streaming",
            "OutputKey": "vid1/transcribe-raw.json",
            "JobExecutionSettings": {"DataAccessRoleArn": "arn:aws:iam::123:role/transcribe"},
        },
    )
    with stubber:
        status, error = worker_mod._start_transcription("vid1", tmp_path / "src.mp4", tmp_path)
        stubber.assert_no_pending_responses()

    assert (status, error) == ("transcribing", None)
    fake_s3.upload_file.assert_called_once()


def test_start_transcription_no_audio_track(monkeypatch, tmp_path):
    monkeypatch.setattr(worker_mod, "TRANSCRIBE_ROLE_ARN", "arn:aws:iam::123:role/transcribe")

    def boom(args):
        raise subprocess.CalledProcessError(1, args, stderr=b"no audio stream")

    monkeypatch.setattr(worker_mod, "_ffmpeg", boom)

    status, error = worker_mod._start_transcription("vid1", tmp_path / "src.mp4", tmp_path)
    assert (status, error) == ("no_speech", None)


def test_start_transcription_aws_start_failure_is_reported_not_swallowed(monkeypatch, tmp_path):
    monkeypatch.setattr(worker_mod, "TRANSCRIBE_ROLE_ARN", "arn:aws:iam::123:role/transcribe")
    monkeypatch.setattr(worker_mod, "STREAMING_BUCKET", "test-streaming")
    _fake_ffmpeg_writes_audio(monkeypatch, tmp_path)

    fake_s3 = MagicMock()
    fake_transcribe = MagicMock()
    fake_transcribe.start_transcription_job.side_effect = Exception(
        "BadRequestException: The S3 URI that you provided can't be accessed."
    )
    monkeypatch.setattr(worker_mod, "s3", fake_s3)
    monkeypatch.setattr(worker_mod, "transcribe", fake_transcribe)

    status, error = worker_mod._start_transcription("vid1", tmp_path / "src.mp4", tmp_path)
    assert status == "failed"
    assert error and "BadRequestException" in error
