"""Unit tests for the smart-thumbnail backfill (no AWS, no ffmpeg).

Frame selection itself is covered by worker/tests/test_thumbnails.py; here we
only exercise the script's eligibility rules and its write/skip behaviour.
"""

import importlib.util
import os
import sys
import types
from pathlib import Path
from unittest.mock import MagicMock

os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

_spec = importlib.util.spec_from_file_location(
    "backfill_smart_thumbnails",
    Path(__file__).resolve().parents[1] / "backfill-smart-thumbnails.py",
)
backfill = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(backfill)


def _video(**over):
    item = {
        "video_id": "vid1",
        "filename": "clip.mp4",
        "status": "ready",
        "hls_key": "vid1/hls/master.m3u8",
        "key": "uploads/vid1/clip.mp4",
    }
    item.update(over)
    return item


# ── eligibility ─────────────────────────────────────────────────────

def test_eligible_ready_with_playback():
    assert backfill.eligible(_video()) is True


def test_not_eligible_when_not_ready():
    assert backfill.eligible(_video(status="processing")) is False


def test_not_eligible_without_hls_key():
    item = _video()
    del item["hls_key"]
    assert backfill.eligible(item) is False


def test_is_manual():
    assert backfill.is_manual(_video(thumbnail_source="manual")) is True
    assert backfill.is_manual(_video(thumbnail_source="auto")) is False
    assert backfill.is_manual(_video()) is False


def test_original_key_prefers_stored_key():
    assert backfill._original_key(_video(key="uploads/x/y.mp4")) == "uploads/x/y.mp4"


def test_original_key_falls_back_to_convention():
    item = _video(video_id="abc", filename="movie.mp4")
    del item["key"]
    assert backfill._original_key(item) == "uploads/abc/movie.mp4"


def test_original_key_none_without_filename_or_key():
    item = _video()
    del item["key"]
    del item["filename"]
    assert backfill._original_key(item) is None


# ── write / skip behaviour ─────────────────────────────────────────

def _fake_choice(**over):
    c = types.SimpleNamespace(
        timestamp=12.0, source="auto", score=0.66, best_index=None, candidates=[], crop=None
    )
    for k, v in over.items():
        setattr(c, k, v)
    return c


def _patch_selection(monkeypatch, choice=None):
    monkeypatch.setattr(backfill, "select_thumbnail", lambda *a, **k: choice or _fake_choice())

    def fake_render(src, ts, dest, *a, **k):
        Path(dest).write_bytes(b"jpegdata")
        return True

    monkeypatch.setattr(backfill, "render_thumbnail", fake_render)
    monkeypatch.setattr(backfill, "score_frame", lambda *a, **k: types.SimpleNamespace(black_ratio=0.9))


def _fake_s3():
    s3 = MagicMock()

    def download(bucket, key, dest):
        Path(dest).write_bytes(b"srcbytes")

    s3.download_file.side_effect = download
    return s3


def test_dry_run_performs_no_writes(monkeypatch):
    _patch_selection(monkeypatch)
    s3, table = _fake_s3(), MagicMock()
    result, _ = backfill.process(table, s3, _video(), dry_run=True, force=False)
    assert result == "dry-run"
    table.update_item.assert_not_called()
    s3.upload_file.assert_not_called()


def test_manual_thumbnail_is_skipped(monkeypatch):
    _patch_selection(monkeypatch)
    s3, table = _fake_s3(), MagicMock()
    result, _ = backfill.process(
        table, s3, _video(thumbnail_source="manual"), dry_run=False, force=False
    )
    assert result == "skipped-manual"
    s3.download_file.assert_not_called()
    table.update_item.assert_not_called()


def test_force_overrides_manual_skip(monkeypatch):
    _patch_selection(monkeypatch)
    s3, table = _fake_s3(), MagicMock()
    result, _ = backfill.process(
        table, s3, _video(thumbnail_source="manual"), dry_run=False, force=True
    )
    assert result == "updated"
    table.update_item.assert_called_once()


def test_update_writes_auto_metadata_and_bumps_timestamp(monkeypatch):
    _patch_selection(monkeypatch)
    s3, table = _fake_s3(), MagicMock()
    result, _ = backfill.process(table, s3, _video(), dry_run=False, force=False)
    assert result == "updated"
    kwargs = table.update_item.call_args.kwargs
    written = kwargs["ExpressionAttributeValues"]
    assert written[":thumbnail_source"] == "auto"
    assert ":thumbnail_updated_at" in written


def test_force_on_manual_removes_manual_index(monkeypatch):
    _patch_selection(monkeypatch)
    s3, table = _fake_s3(), MagicMock()
    backfill.process(
        table, s3, _video(thumbnail_source="manual", thumbnail_manual_index=3),
        dry_run=False, force=True,
    )
    expr = table.update_item.call_args.kwargs["UpdateExpression"]
    assert "REMOVE" in expr


def test_one_video_mode_uses_get_item():
    table = MagicMock()
    table.get_item.return_value = {"Item": _video()}
    out = backfill._iter_videos(table, "vid1")
    table.get_item.assert_called_once_with(Key={"video_id": "vid1"})
    assert out == [_video()]


def test_one_video_mode_missing_returns_empty():
    table = MagicMock()
    table.get_item.return_value = {}
    assert backfill._iter_videos(table, "nope") == []


def test_repeat_run_is_safe(monkeypatch):
    """A second pass over an already-updated record still just re-selects and
    re-writes -- no crash, deterministic result."""
    _patch_selection(monkeypatch)
    s3, table = _fake_s3(), MagicMock()
    first, _ = backfill.process(table, s3, _video(thumbnail_source="auto"), dry_run=False, force=False)
    second, _ = backfill.process(table, s3, _video(thumbnail_source="auto"), dry_run=False, force=False)
    assert first == second == "updated"
