"""Unit tests for pure helpers in app.main (no AWS needed)."""

from app.main import _cdn_url, _norm_visibility, _safe_filename


def test_norm_visibility_valid():
    assert _norm_visibility("public") == "public"
    assert _norm_visibility("unlisted") == "unlisted"


def test_norm_visibility_falls_back_to_public():
    assert _norm_visibility(None) == "public"
    assert _norm_visibility("") == "public"
    assert _norm_visibility("private") == "public"
    assert _norm_visibility("PUBLIC") == "public"  # case-sensitive by design


def test_safe_filename_strips_unsafe_and_spaces():
    assert _safe_filename("my cool clip.mp4") == "my_cool_clip.mp4"
    assert _safe_filename("a/b\\c:*?.mp4") == "abc.mp4"


def test_safe_filename_empty_gets_default():
    assert _safe_filename("   ") == "video.mp4"
    assert _safe_filename("@@@") == "video.mp4"


def test_cdn_url_builds_https():
    assert _cdn_url("v/hls/master.m3u8") == "https://cdn.example.com/v/hls/master.m3u8"


def test_cdn_url_none_for_missing_key():
    assert _cdn_url(None) is None
    assert _cdn_url("") is None
