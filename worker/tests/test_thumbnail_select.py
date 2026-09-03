"""Unit tests for smart thumbnail selection (no AWS, no real video files).

Scoring is exercised with synthetic PIL images; selection/sampling with
monkeypatched frame extraction.
"""

import os
import random
from pathlib import Path

from PIL import Image

os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")

import thumbnails as tn  # noqa: E402


# ── synthetic frame builders ─────────────────────────────────────────

def _save(img: Image.Image, path: Path) -> Path:
    img.save(path, "JPEG", quality=92)
    return path


def _solid(luma: int, path: Path, size=(640, 360)) -> Path:
    return _save(Image.new("L", size, luma), path)


def _checker(a: int, b: int, path: Path, block=16, size=(640, 360)) -> Path:
    img = Image.new("L", size)
    px = img.load()
    for y in range(size[1]):
        for x in range(size[0]):
            px[x, y] = a if ((x // block) + (y // block)) % 2 else b
    return _save(img, path)


def _noise(mean: int, spread: int, path: Path, seed: int = 1, size=(640, 360)) -> Path:
    rnd = random.Random(seed)
    img = Image.new("L", size)
    px = img.load()
    for y in range(size[1]):
        for x in range(size[0]):
            px[x, y] = max(0, min(255, mean + rnd.randint(-spread, spread)))
    return _save(img, path)


def _title_card(path: Path, size=(640, 360)) -> Path:
    """Mostly white with a small block of 'text'."""
    img = Image.new("L", size, 250)
    px = img.load()
    for y in range(150, 210):
        for x in range(220, 420):
            px[x, y] = 40 if (x // 6) % 2 else 250
    return _save(img, path)


# ── scoring: black / white rejection ─────────────────────────────────

def test_pure_black_frame_scores_near_zero(tmp_path):
    s = tn.score_frame(_solid(0, tmp_path / "black.jpg"))
    assert s is not None
    assert s.total < 0.05
    assert s.black_ratio > 0.95


def test_near_black_frame_is_strongly_penalised(tmp_path):
    s = tn.score_frame(_noise(6, 5, tmp_path / "nearblack.jpg"))
    assert s.total < 0.15


def test_pure_white_frame_scores_near_zero(tmp_path):
    s = tn.score_frame(_solid(255, tmp_path / "white.jpg"))
    assert s.total < 0.05
    assert s.white_ratio > 0.95


def test_title_card_is_penalised(tmp_path):
    s = tn.score_frame(_title_card(tmp_path / "title.jpg"))
    assert s.total < 0.35


# ── scoring: detail beats blank, dark-but-rich beats bright-but-flat ──

def test_detailed_frame_beats_flat_grey_frame(tmp_path):
    rich = tn.score_frame(_checker(70, 175, tmp_path / "rich.jpg"))
    flat = tn.score_frame(_solid(128, tmp_path / "flat.jpg"))
    assert rich.total > flat.total
    assert rich.total > 0.5
    assert flat.total < 0.3


def test_moderately_dark_detailed_frame_beats_bright_flat_frame(tmp_path):
    dark_rich = tn.score_frame(_checker(30, 95, tmp_path / "darkrich.jpg"))
    bright_flat = tn.score_frame(_solid(240, tmp_path / "brightflat.jpg"))
    assert dark_rich.total > bright_flat.total


def test_score_is_deterministic(tmp_path):
    p = _noise(120, 60, tmp_path / "det.jpg", seed=7)
    assert tn.score_frame(p).total == tn.score_frame(p).total


def test_unreadable_file_scores_none(tmp_path):
    bad = tmp_path / "notimage.jpg"
    bad.write_bytes(b"definitely not a jpeg")
    assert tn.score_frame(bad) is None


# ── timestamp sampling ───────────────────────────────────────────────

def test_normal_duration_positions_spread_and_bounded():
    pos = tn.sample_positions(600.0)
    assert len(pos) == len(tn.FRACTIONS)
    assert all(0 < t < 600.0 for t in pos)
    assert pos == sorted(pos)
    assert pos[0] > 0.5 and pos[-1] < 599.5  # not the first/last frame


def test_short_video_uses_fewer_positions_still_bounded():
    pos = tn.sample_positions(5.0)
    assert 2 <= len(pos) <= len(tn.SHORT_FRACTIONS)
    assert all(0 < t < 5.0 for t in pos)


def test_very_short_video_positions_stay_valid():
    pos = tn.sample_positions(0.6)
    assert pos, "expected at least one candidate position"
    assert all(0 < t < 0.6 for t in pos)


def test_zero_or_unknown_duration_yields_no_positions():
    assert tn.sample_positions(0.0) == []
    assert tn.sample_positions(-1.0) == []


def test_positions_avoid_the_exact_end():
    for dur in (2.0, 12.0, 45.0, 3600.0):
        assert max(tn.sample_positions(dur)) < dur


# ── letterbox / pillarbox bar detection ────────────────────────────

def _framed(path: Path, *, pillar=0, letter=0, size=(640, 360)) -> Path:
    """A bright, detailed centre with solid black bars of the given width."""
    w, h = size
    img = Image.new("L", size, 0)
    px = img.load()
    for y in range(letter, h - letter):
        for x in range(pillar, w - pillar):
            px[x, y] = 70 if ((x // 12) + (y // 12)) % 2 else 190
    return _save(img, path)


def test_detects_pillarbox_common_to_all_frames(tmp_path):
    frames = [_framed(tmp_path / f"p{i}.jpg", pillar=96) for i in range(4)]
    crop = tn.detect_bars(frames)
    assert crop is not None and crop.startswith("iw*")
    # keeps ~448/640 of the width, offset ~96/640
    assert "0.70" in crop or "0.69" in crop or "0.71" in crop


def test_detects_letterbox(tmp_path):
    frames = [_framed(tmp_path / f"l{i}.jpg", letter=54) for i in range(3)]
    assert tn.detect_bars(frames) is not None


def test_no_crop_when_frames_are_full_bleed(tmp_path):
    frames = [_framed(tmp_path / f"f{i}.jpg") for i in range(3)]
    assert tn.detect_bars(frames) is None


def test_no_crop_when_bar_is_not_in_every_frame(tmp_path):
    frames = [
        _framed(tmp_path / "a.jpg", pillar=96),
        _framed(tmp_path / "b.jpg", pillar=0),  # this shot fills the frame
        _framed(tmp_path / "c.jpg", pillar=96),
    ]
    assert tn.detect_bars(frames) is None


def test_no_crop_from_empty_or_tiny_input(tmp_path):
    assert tn.detect_bars([]) is None
    # a 4px border is below the "worth it" threshold
    assert tn.detect_bars([_framed(tmp_path / "t.jpg", pillar=4)]) is None


# ── selection / fallback ─────────────────────────────────────────────

def _patch_extraction(monkeypatch, frames: list[tuple[float, Path]], dur: float):
    monkeypatch.setattr(tn, "duration_seconds", lambda _src: dur)
    monkeypatch.setattr(tn, "detect_bars", lambda *a, **k: None)

    def fake_extract(src, outdir, positions, width=tn.CANDIDATE_WIDTH, crop=None):
        outdir.mkdir(parents=True, exist_ok=True)
        out = []
        for i, (t, srcpath) in enumerate(frames):
            dest = outdir / f"cand_{i:02d}.jpg"
            dest.write_bytes(Path(srcpath).read_bytes())
            out.append((t, dest))
        return out

    monkeypatch.setattr(tn, "extract_candidates", fake_extract)


def test_selects_the_highest_scoring_candidate(tmp_path, monkeypatch):
    frames = [
        (3.0, _solid(0, tmp_path / "a.jpg")),               # black
        (30.0, _checker(35, 110, tmp_path / "b.jpg")),      # rich -> should win
        (57.0, _solid(245, tmp_path / "c.jpg")),            # blown
    ]
    _patch_extraction(monkeypatch, frames, dur=60.0)
    choice = tn.select_thumbnail(tmp_path / "src.mp4", tmp_path / "wd")
    assert choice.source == "auto"
    assert choice.timestamp == 30.0
    assert choice.best_index == choice.candidates[choice.best_index].index
    assert len(choice.candidates) == 3


def test_falls_back_when_no_candidates_can_be_extracted(tmp_path, monkeypatch):
    monkeypatch.setattr(tn, "duration_seconds", lambda _src: 42.0)
    monkeypatch.setattr(tn, "detect_bars", lambda *a, **k: None)
    monkeypatch.setattr(tn, "extract_candidates", lambda *a, **k: [])

    calls: list[float] = []

    def fake_single(src, t, dest, width, quality=3, crop=None):
        calls.append(t)
        dest.parent.mkdir(parents=True, exist_ok=True)
        _solid(120, dest)
        return True

    monkeypatch.setattr(tn, "_extract_frame", fake_single)
    choice = tn.select_thumbnail(tmp_path / "src.mp4", tmp_path / "wd")
    assert choice.source == "auto-fallback"
    assert choice.score is None
    assert calls and abs(calls[0] - 4.2) < 0.01  # 10% of 42s tried first


def test_fallback_when_duration_unknown_tries_one_second(tmp_path, monkeypatch):
    monkeypatch.setattr(tn, "duration_seconds", lambda _src: 0.0)
    monkeypatch.setattr(tn, "detect_bars", lambda *a, **k: None)

    def fake_single(src, t, dest, width, quality=3, crop=None):
        dest.parent.mkdir(parents=True, exist_ok=True)
        _solid(120, dest)
        return True

    monkeypatch.setattr(tn, "_extract_frame", fake_single)
    choice = tn.select_thumbnail(tmp_path / "src.mp4", tmp_path / "wd")
    assert choice.source == "auto-fallback"
    assert choice.timestamp == 1.0
