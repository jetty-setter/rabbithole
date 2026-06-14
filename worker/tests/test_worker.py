"""Unit tests for the worker's pure helpers (no AWS calls)."""

import os

os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")

import worker  # noqa: E402


def test_video_id_from_key_valid():
    assert worker._video_id_from_key("uploads/abc123/clip.mp4") == "abc123"


def test_video_id_from_key_ignores_non_uploads():
    assert worker._video_id_from_key("other/abc/clip.mp4") is None
    assert worker._video_id_from_key("clip.mp4") is None


def test_estimate_cost_scales_with_time():
    # Defaults: 512 cpu units (0.5 vCPU), 1024 MiB (1 GB).
    one_hour = worker._estimate_cost(3600)
    assert one_hour == 0.0 or one_hour > 0
    # Linear in duration.
    assert abs(worker._estimate_cost(7200) - 2 * one_hour) < 1e-9


def test_estimate_cost_zero_for_zero_seconds():
    assert worker._estimate_cost(0) == 0.0


def test_estimate_cost_known_value():
    # 1h at 0.5 vCPU + 1 GB: 0.5*0.04048 + 1*0.004445 = 0.024685
    assert abs(worker._estimate_cost(3600) - 0.024685) < 1e-6
