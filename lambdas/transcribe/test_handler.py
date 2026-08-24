"""Unit tests for the Transcribe post-processor's pure logic."""

import json
import os

# handler reads these at import time.
os.environ.setdefault("STREAMING_BUCKET", "test-streaming")
os.environ.setdefault("VIDEOS_TABLE", "test-videos")
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")

import boto3  # noqa: E402
import pytest  # noqa: E402
from botocore.exceptions import ClientError  # noqa: E402
from moto import mock_aws  # noqa: E402

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[2]))  # repo root for shared/

import handler  # noqa: E402
from shared.captions import build_cues, to_vtt, _ts


def _word(content, start, end):
    return {
        "type": "pronunciation",
        "start_time": str(start),
        "end_time": str(end),
        "alternatives": [{"content": content}],
    }


def _punc(content):
    return {"type": "punctuation", "alternatives": [{"content": content}]}


def test_build_cues_groups_and_breaks_on_sentence_end():
    raw = {
        "results": {
            "items": [
                _word("Hello", 0.0, 0.4),
                _word("there", 0.5, 0.9),
                _punc("."),
                _word("Next", 1.0, 1.3),
                _word("line", 1.4, 1.7),
                _punc("."),
            ]
        }
    }
    cues = build_cues(raw)
    assert len(cues) == 2
    assert cues[0]["text"] == "Hello there."
    assert cues[0]["start"] == 0.0
    assert cues[0]["end"] == 0.9
    assert cues[1]["text"] == "Next line."


def test_build_cues_breaks_on_long_pause():
    raw = {
        "results": {
            "items": [
                _word("before", 0.0, 0.5),
                _word("after", 5.0, 5.4),  # >0.8s gap → new cue
            ]
        }
    }
    cues = build_cues(raw)
    assert len(cues) == 2
    assert cues[0]["text"] == "before"
    assert cues[1]["text"] == "after"


def test_build_cues_empty_when_no_speech():
    assert build_cues({"results": {"items": []}}) == []
    assert build_cues({}) == []


def test_punctuation_attaches_without_leading_space():
    raw = {"results": {"items": [_word("Hi", 0.0, 0.3), _punc(",")]}}
    cues = build_cues(raw)
    assert cues[0]["text"] == "Hi,"


def test_ts_formats_webvtt_timestamp():
    assert _ts(0) == "00:00:00.000"
    assert _ts(65.5) == "00:01:05.500"
    assert _ts(3661.25) == "01:01:01.250"


def test_to_vtt_has_header_and_cues():
    vtt = to_vtt([{"start": 0.0, "end": 1.0, "text": "hi"}])
    assert vtt.startswith("WEBVTT")
    assert "00:00:00.000 --> 00:00:01.000" in vtt
    assert "hi" in vtt


def test_video_id_from_media_uri(monkeypatch):
    monkeypatch.setattr(
        handler.transcribe,
        "get_transcription_job",
        lambda **_: {"TranscriptionJob": {"Media": {"MediaFileUri": "s3://b/myvid/audio.flac"}}},
    )
    assert handler._video_id_for_job("rh-myvid-123") == "myvid"


def test_video_id_falls_back_to_job_name(monkeypatch):
    def boom(**_):
        raise ClientError({"Error": {"Code": "BadRequestException", "Message": "x"}}, "Get")

    monkeypatch.setattr(handler.transcribe, "get_transcription_job", boom)
    # job name is rh-{video_id}-{epoch}; epoch is the final hyphen segment.
    assert handler._video_id_for_job("rh-abc-123-1700000000") == "abc-123"


# ── handler() end-to-end against a faked AWS backend ─────────────────
@pytest.fixture
def stack():
    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket="test-streaming")
        ddb = boto3.resource("dynamodb", region_name="us-east-1")
        ddb.create_table(
            TableName="test-videos",
            KeySchema=[{"AttributeName": "video_id", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "video_id", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )
        ddb.Table("test-videos").put_item(
            Item={"video_id": "vid7", "status": "ready", "transcribing": True}
        )
        yield s3, ddb.Table("test-videos")


def _raw():
    return {
        "results": {
            "items": [
                _word("Down", 0.0, 0.3),
                _word("the", 0.4, 0.6),
                _word("hole", 0.7, 1.0),
                _punc("."),
            ]
        }
    }


def test_handler_completed_writes_cues_and_flips_flag(stack, monkeypatch):
    s3, table = stack
    s3.put_object(Bucket="test-streaming", Key="vid7/transcribe-raw.json", Body=json.dumps(_raw()))
    monkeypatch.setattr(
        handler.transcribe,
        "get_transcription_job",
        lambda **_: {"TranscriptionJob": {"Media": {"MediaFileUri": "s3://test-streaming/vid7/audio.flac"}}},
    )

    out = handler.handler(
        {"detail": {"TranscriptionJobName": "rh-vid7-1", "TranscriptionJobStatus": "COMPLETED"}},
        None,
    )
    assert out["ok"] and out["cues"] == 1

    # cues.json + captions.vtt written
    cues = json.loads(s3.get_object(Bucket="test-streaming", Key="vid7/cues.json")["Body"].read())
    assert cues[0]["text"] == "Down the hole."
    assert s3.get_object(Bucket="test-streaming", Key="vid7/captions.vtt")["Body"].read().startswith(b"WEBVTT")

    # DynamoDB flipped
    item = table.get_item(Key={"video_id": "vid7"})["Item"]
    assert item["has_transcript"] is True
    assert item["transcribing"] is False
    assert item["transcript_key"] == "vid7/cues.json"


def test_handler_failed_clears_transcribing(stack, monkeypatch):
    _, table = stack
    monkeypatch.setattr(
        handler.transcribe,
        "get_transcription_job",
        lambda **_: {"TranscriptionJob": {"Media": {"MediaFileUri": "s3://test-streaming/vid7/audio.flac"}}},
    )
    out = handler.handler(
        {"detail": {"TranscriptionJobName": "rh-vid7-1", "TranscriptionJobStatus": "FAILED"}},
        None,
    )
    assert out["ok"]
    item = table.get_item(Key={"video_id": "vid7"})["Item"]
    assert item["has_transcript"] is False
    assert item["transcribing"] is False
