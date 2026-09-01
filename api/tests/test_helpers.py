"""Unit tests for pure helpers in app.main (no AWS needed)."""

import pytest

from app.main import (
    _cdn_url,
    _norm_visibility,
    _safe_filename,
    clean_tags,
    normalize_tag,
)


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


# ── Tag normalization (mechanical only) ───────────────────────────────────

@pytest.mark.parametrize(
    "raw,expected",
    [
        ("Space", "space"),
        ("  space  ", "space"),
        ("#space", "space"),
        ("##  Space Flight ", "space-flight"),
        ("true crime", "true-crime"),
        ("True-Crime", "true-crime"),
        ("true   crime", "true-crime"),
        ("cold_case", "cold-case"),
        ("cold - case", "cold-case"),
        ("-weird-", "weird"),
        ("", ""),
        ("#", ""),
        ("   ", ""),
    ],
)
def test_normalize_tag_mechanical(raw, expected):
    assert normalize_tag(raw) == expected


def test_normalize_tag_does_not_merge_different_spellings():
    # Spacing/casing converge, but genuinely different spellings stay distinct.
    assert normalize_tag("true crime") == normalize_tag("true-crime") == "true-crime"
    assert normalize_tag("truecrime") == "truecrime"
    assert normalize_tag("space") != normalize_tag("spaceflight")


def test_normalize_tag_caps_length_at_30():
    assert normalize_tag("a" * 50) == "a" * 30


def test_clean_tags_dedupes_and_caps():
    assert clean_tags(["Space", "space", " space "]) == ["space"]
    assert clean_tags(["true crime", "true-crime"]) == ["true-crime"]
    assert clean_tags([f"tag{i}" for i in range(20)]) == [f"tag{i}" for i in range(8)]
    assert clean_tags(["a", "", "  ", "#", "b"], limit=5) == ["a", "b"]
    assert clean_tags(None) == []
