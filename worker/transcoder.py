"""ffmpeg transcoding and thumbnail extraction."""

from __future__ import annotations

import subprocess
from pathlib import Path

# HLS rendition ladder. (width/resolution are advertised in the master playlist
# for the player's ABR logic; -2 height scaling preserves the real aspect ratio.)
RENDITIONS = [
    {"name": "480p", "height": 480, "width": 854, "bv": "1400k", "maxrate": "1498k", "bufsize": "2100k", "bandwidth": 1400000},
    {"name": "720p", "height": 720, "width": 1280, "bv": "2800k", "maxrate": "2996k", "bufsize": "4200k", "bandwidth": 2800000},
    {"name": "1080p", "height": 1080, "width": 1920, "bv": "5000k", "maxrate": "5350k", "bufsize": "7500k", "bandwidth": 5000000},
]


def _ffmpeg(args: list[str]) -> None:
    subprocess.run(["ffmpeg", "-y", *args], check=True, capture_output=True)


def transcode_hls(src: Path, outdir: Path) -> None:
    """Build an HLS ladder: one playlist + segments per rendition, plus a master."""
    for r in RENDITIONS:
        rendition_dir = outdir / r["name"]
        rendition_dir.mkdir(parents=True, exist_ok=True)
        _ffmpeg([
            "-i", str(src),
            "-vf", f"scale=-2:{r['height']}",
            "-c:v", "libx264", "-preset", "veryfast",
            "-b:v", r["bv"], "-maxrate", r["maxrate"], "-bufsize", r["bufsize"],
            "-c:a", "aac", "-b:a", "128k", "-ac", "2",
            # closed GOP every 2s (48 frames @ 24fps) so renditions are segment-aligned
            "-g", "48", "-keyint_min", "48", "-sc_threshold", "0",
            "-hls_time", "4", "-hls_playlist_type", "vod",
            "-hls_segment_filename", str(rendition_dir / "seg_%03d.ts"),
            str(rendition_dir / "index.m3u8"),
        ])
    _write_master(outdir)


def _write_master(outdir: Path) -> None:
    lines = ["#EXTM3U", "#EXT-X-VERSION:3"]
    for r in RENDITIONS:
        lines.append(
            f"#EXT-X-STREAM-INF:BANDWIDTH={r['bandwidth']},"
            f"RESOLUTION={r['width']}x{r['height']}"
        )
        lines.append(f"{r['name']}/index.m3u8")
    (outdir / "master.m3u8").write_text("\n".join(lines) + "\n")


def _content_type(path: Path) -> str:
    return {
        ".m3u8": "application/vnd.apple.mpegurl",
        ".ts": "video/mp2t",
        ".jpg": "image/jpeg",
    }.get(path.suffix, "application/octet-stream")


def duration_seconds(src: Path) -> float:
    """Probe the source duration (seconds). 0.0 if it can't be read."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(src)],
            capture_output=True, text=True, check=True,
        )
        return float(out.stdout.strip())
    except Exception:  # noqa: BLE001
        return 0.0


def sample_frames(src: Path, outdir: Path, n: int = 4) -> list[Path]:
    """Grab N frames spread across the clip so the AI sees the action and the
    payoff — not just a static opening frame. Falls back to one early frame."""
    outdir.mkdir(parents=True, exist_ok=True)
    dur = duration_seconds(src)
    fracs = [0.1, 0.37, 0.63, 0.9][:n] if dur > 0 else [0.0]
    frames: list[Path] = []
    for i, fr in enumerate(fracs):
        f = outdir / f"f{i}.jpg"
        ts = f"{dur * fr:.2f}" if dur > 0 else "00:00:01"
        try:
            _ffmpeg(["-ss", ts, "-i", str(src), "-vframes", "1",
                     "-vf", "scale=512:-2", str(f)])
            if f.exists():
                frames.append(f)
        except subprocess.CalledProcessError:
            pass
    return frames
