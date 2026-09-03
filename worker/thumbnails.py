"""Smart thumbnail frame selection.

The old pipeline grabbed the frame at a fixed ``00:00:01`` and hoped for the
best -- which on a lot of real footage is a black frame, a fade-in, an
archival leader, or a title card. This module instead samples a handful of
frames spread across the clip, scores each one for how *useful* it is as a
thumbnail (detail, contrast, brightness -- with black screens and blown-out
frames strongly penalised), and picks the best.

Kept deliberately separate from the worker orchestration so the ingest flow
stays readable, and so the backfill script and the tests can drive exactly
the same logic.

Frame extraction is FFmpeg (already in the image). Scoring is Pillow only --
no OpenCV, no external CV service, no ML.
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass, field
from pathlib import Path

from transcoder import _ffmpeg, duration_seconds

try:  # Pillow is an image-analysis dependency, not needed to import the worker.
    from PIL import Image, ImageFilter, ImageStat
except Exception:  # pragma: no cover - exercised only in a broken install
    Image = None  # type: ignore


# ── Tuning constants ─────────────────────────────────────────────────
# Every threshold here was tuned against the synthetic + real-media tests in
# worker/tests/test_thumbnails.py rather than guessed -- adjust them there.

CANDIDATE_WIDTH = 512   # candidate frames extracted (and shown in the admin picker) at this width
OUTPUT_WIDTH = 640      # the final production thumb.jpg
SCORE_WIDTH = 128       # frames are downscaled to this before scoring (cheap + stable)

# Evenly spread across the clip, skipping the extreme head/tail.
FRACTIONS = (0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95)
SHORT_FRACTIONS = (0.12, 0.28, 0.44, 0.60, 0.76, 0.90)
SHORT_CLIP_SECONDS = 8.0
EDGE_GUARD_SECONDS = 0.15   # never sample within this many seconds of either end when there's room

# A pixel at/under BLACK_LUMA (0-255) counts as "black"; at/over WHITE_LUMA, "blown".
BLACK_LUMA = 24
WHITE_LUMA = 232
# Black/white pixel fraction at which a frame is treated as essentially a
# black screen / blank card and pushed to the bottom of the ranking.
BLACK_REJECT_RATIO = 0.82
WHITE_REJECT_RATIO = 0.78
BLACK_OK_RATIO = 0.45      # below this, no black penalty at all (dark-but-real footage stays eligible)
WHITE_OK_RATIO = 0.42
REJECT_FLOOR = 0.03        # score multiplier a fully-rejected frame is pinned to

# Saturation points for the positive signals (value that scores a full 1.0).
DETAIL_FULL = 34.0         # mean per-tile standard deviation
EDGE_FULL = 26.0           # mean edge magnitude (FIND_EDGES)
CONTRAST_FULL = 55.0       # global standard deviation


@dataclass(frozen=True)
class FrameScore:
    """A single frame's usefulness as a thumbnail. ``total`` is 0..1."""

    total: float
    brightness: float      # mean luma, 0-255
    black_ratio: float     # fraction of near-black pixels
    white_ratio: float     # fraction of near-white pixels
    contrast: float        # global standard deviation
    detail: float          # mean local (tiled) standard deviation
    edges: float           # mean edge magnitude

    def summary(self) -> str:
        return (
            f"score={self.total:.2f} luma={self.brightness:.0f} "
            f"black={self.black_ratio:.2f} detail={self.detail:.1f}"
        )


@dataclass
class Candidate:
    index: int
    t: float
    path: Path
    score: FrameScore


@dataclass
class ThumbnailChoice:
    """The outcome of :func:`select_thumbnail`."""

    timestamp: float
    source: str                       # "auto" | "auto-fallback"
    score: float | None
    best_index: int | None
    candidates: list[Candidate] = field(default_factory=list)


# ── Timestamp sampling ───────────────────────────────────────────────

def sample_positions(duration: float) -> list[float]:
    """Candidate timestamps (seconds) spread across a clip of ``duration``.

    Returns ``[]`` when the duration is unknown/zero -- the caller then uses a
    safe fallback extraction path. Timestamps never land on the exact first or
    last frame when there is any room to avoid them, and are always strictly
    inside ``(0, duration)``.
    """
    if not duration or duration <= 0:
        return []
    fracs = SHORT_FRACTIONS if duration < SHORT_CLIP_SECONDS else FRACTIONS
    guard = min(EDGE_GUARD_SECONDS, duration * 0.1)
    lo, hi = guard, duration - guard
    out: list[float] = []
    for fr in fracs:
        t = round(min(hi, max(lo, duration * fr)), 2)
        if not out or abs(t - out[-1]) > 0.05:
            out.append(t)
    return out


# ── Frame extraction ─────────────────────────────────────────────────

def _extract_frame(src: Path, t: float, dest: Path, width: int, quality: int = 3) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        _ffmpeg([
            "-ss", f"{max(0.0, t):.2f}", "-i", str(src), "-vframes", "1",
            "-vf", f"scale={width}:-2", "-q:v", str(quality), str(dest),
        ])
    except subprocess.CalledProcessError:
        return False
    return dest.exists() and dest.stat().st_size > 0


def extract_candidates(
    src: Path, outdir: Path, positions: list[float], width: int = CANDIDATE_WIDTH
) -> list[tuple[float, Path]]:
    """Pull one small frame per timestamp. Frames that fail to extract are
    simply skipped -- a few missing candidates don't matter."""
    outdir.mkdir(parents=True, exist_ok=True)
    got: list[tuple[float, Path]] = []
    for i, t in enumerate(positions):
        dest = outdir / f"cand_{i:02d}.jpg"
        if _extract_frame(src, t, dest, width):
            got.append((t, dest))
    return got


def render_thumbnail(
    src: Path, timestamp: float, dest: Path, width: int = OUTPUT_WIDTH
) -> bool:
    """Extract the final production thumbnail from the original source at the
    chosen timestamp, at output quality. Source aspect ratio is preserved
    (``scale=W:-2``); the image is never stretched."""
    return _extract_frame(src, timestamp, dest, width, quality=2)


# ── Scoring ──────────────────────────────────────────────────────────

def _sat(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x


def _prep(path: Path | str) -> "Image.Image":
    im = Image.open(path).convert("L")
    w, h = im.size
    if w > SCORE_WIDTH:
        im = im.resize((SCORE_WIDTH, max(1, round(h * SCORE_WIDTH / w))), Image.BILINEAR)
    return im


def _tile_detail(im: "Image.Image", grid: int = 6) -> float:
    """Mean of per-tile standard deviation: high for a busy frame, ~0 for a
    flat one (black screen, blank card, clear sky)."""
    w, h = im.size
    if w < grid or h < grid:
        return ImageStat.Stat(im).stddev[0]
    vals: list[float] = []
    for gy in range(grid):
        for gx in range(grid):
            box = (w * gx // grid, h * gy // grid, w * (gx + 1) // grid, h * (gy + 1) // grid)
            vals.append(ImageStat.Stat(im.crop(box)).stddev[0])
    return sum(vals) / len(vals)


def _brightness_plateau(luma: float) -> float:
    """1.0 across a comfortable mid-range, ramping to 0 at the extremes.
    Brightness is a gate, not a quality signal -- a well-exposed frame gets no
    bonus over a slightly dark one, but a pitch-black or pure-white frame is
    pushed down."""
    if 45 <= luma <= 205:
        return 1.0
    if luma < 45:
        return _sat((luma - 8) / 37)
    return _sat((247 - luma) / 42)


def _reject_curve(ratio: float, ok: float, bad: float, floor: float) -> float:
    if ratio <= ok:
        return 1.0
    if ratio >= bad:
        return floor
    return 1.0 - (ratio - ok) / (bad - ok) * (1.0 - floor)


def score_frame(path: Path | str) -> FrameScore | None:
    """Score one extracted frame for thumbnail usefulness. Deterministic:
    the same image always yields the same score. Returns ``None`` if the file
    can't be read as an image."""
    if Image is None:
        return None
    try:
        im = _prep(path)
    except Exception:  # noqa: BLE001 - unreadable/corrupt frame
        return None
    n = im.width * im.height
    if n == 0:
        return None

    hist = im.histogram()
    black_ratio = sum(hist[: BLACK_LUMA + 1]) / n
    white_ratio = sum(hist[WHITE_LUMA:]) / n

    stat = ImageStat.Stat(im)
    brightness = stat.mean[0]
    contrast = stat.stddev[0]
    detail = _tile_detail(im)

    edges_im = im.filter(ImageFilter.FIND_EDGES)
    if edges_im.width > 6 and edges_im.height > 6:
        # FIND_EDGES always lights up the outer border -- trim it before measuring.
        edges_im = edges_im.crop((2, 2, edges_im.width - 2, edges_im.height - 2))
    edges = ImageStat.Stat(edges_im).mean[0]

    detail_score = _sat(detail / DETAIL_FULL)
    edge_score = _sat(edges / EDGE_FULL)
    contrast_score = _sat(contrast / CONTRAST_FULL)
    bright_score = _brightness_plateau(brightness)

    base = (
        0.44 * detail_score
        + 0.22 * edge_score
        + 0.18 * contrast_score
        + 0.16 * bright_score
    )

    black_mult = _reject_curve(black_ratio, BLACK_OK_RATIO, BLACK_REJECT_RATIO, REJECT_FLOOR)
    if brightness < 10:
        black_mult = min(black_mult, REJECT_FLOOR)
    white_mult = _reject_curve(white_ratio, WHITE_OK_RATIO, WHITE_REJECT_RATIO, 0.08)
    if brightness > 240 and contrast < 12:
        white_mult = min(white_mult, 0.1)

    total = base * black_mult * white_mult
    return FrameScore(
        total=round(total, 4),
        brightness=round(brightness, 2),
        black_ratio=round(black_ratio, 4),
        white_ratio=round(white_ratio, 4),
        contrast=round(contrast, 2),
        detail=round(detail, 3),
        edges=round(edges, 3),
    )


# ── Orchestration ────────────────────────────────────────────────────

def select_thumbnail(src: Path, workdir: Path) -> ThumbnailChoice:
    """Probe -> sample -> score -> choose. Never raises for ordinary media
    problems: if smart selection can't run, it falls back to a safe early
    frame and marks the choice ``auto-fallback``."""
    dur = duration_seconds(src)
    positions = sample_positions(dur)
    cand_dir = workdir / "cand"
    raw = extract_candidates(src, cand_dir, positions) if positions else []

    candidates: list[Candidate] = []
    for t, p in raw:
        s = score_frame(p)
        if s is not None:
            candidates.append(Candidate(index=len(candidates), t=t, path=p, score=s))
    # Frames that failed to score leave gaps -- renumber the survivors so the
    # on-disk cand_NN.jpg names stay dense and match Candidate.index (the admin
    # picker and the record's stored candidate list both key off that index).
    for c in candidates:
        target = cand_dir / f"cand_{c.index:02d}.jpg"
        if c.path != target:
            c.path.rename(target)
            c.path = target

    if candidates:
        # Rank by score; when several frames score alike (common on footage
        # that's detailed throughout), prefer the one nearest the middle of
        # the clip -- more likely to be representative than an intro/outro shot.
        mid = dur / 2 if dur > 0 else 0.0
        best = max(candidates, key=lambda c: (c.score.total, -abs(c.t - mid)))
        return ThumbnailChoice(
            timestamp=best.t,
            source="auto",
            score=best.score.total,
            best_index=best.index,
            candidates=candidates,
        )

    # Smart selection produced nothing usable -- fall back to safe timestamps.
    fallbacks: list[tuple[str, float]] = []
    if dur > 0:
        fallbacks.append(("10%", round(dur * 0.1, 2)))
    fallbacks.append(("1s", 1.0))
    for label, t in fallbacks:
        dest = cand_dir / "fallback.jpg"
        if _extract_frame(src, t, dest, CANDIDATE_WIDTH):
            print(f"thumbnail: smart selection unavailable for this clip, using {label} frame")
            return ThumbnailChoice(timestamp=t, source="auto-fallback", score=None, best_index=None)

    print("thumbnail: no frame could be extracted; leaving the video without a thumbnail")
    return ThumbnailChoice(timestamp=0.0, source="auto-fallback", score=None, best_index=None)
