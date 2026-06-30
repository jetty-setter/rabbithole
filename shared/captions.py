"""Shared caption cue building and formatting utilities."""

# Cue shaping: start a fresh line on a sentence end, a noticeable pause, or once
# a line gets long enough to read comfortably on screen.
MAX_CHARS = 42
MAX_WORDS = 12
PAUSE_GAP = 0.8  # seconds of silence that forces a new cue
SENTENCE_END = {".", "!", "?"}


def _f(v) -> float | None:
    """Safely parse a float from a Transcribe item field."""
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _ts(seconds: float) -> str:
    """Format seconds as WebVTT timestamp HH:MM:SS.mmm."""
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def build_cues(raw: dict) -> list[dict]:
    """Convert raw AWS Transcribe output into caption cues [{start, end, text}]."""
    items = raw.get("results", {}).get("items", [])
    cues: list[dict] = []
    words: list[str] = []
    start: float | None = None
    end: float | None = None
    last_end: float | None = None

    def flush():
        nonlocal words, start, end
        if words and start is not None:
            cues.append({
                "start": round(start, 2),
                "end": round(end if end is not None else start, 2),
                "text": " ".join(words).strip(),
            })
        words = []
        start = end = None

    for it in items:
        kind = it.get("type")
        content = (it.get("alternatives") or [{}])[0].get("content", "")
        if not content:
            continue

        if kind == "punctuation":
            if words:
                words[-1] = words[-1] + content
            if content in SENTENCE_END:
                flush()
            continue

        s = _f(it.get("start_time"))
        e = _f(it.get("end_time"))
        # Force a break on a long silence before this word.
        if last_end is not None and s is not None and s - last_end > PAUSE_GAP:
            flush()

        if start is None:
            start = s
        words.append(content)
        end = e if e is not None else end
        last_end = e if e is not None else last_end

        line = " ".join(words)
        if len(words) >= MAX_WORDS or len(line) >= MAX_CHARS:
            flush()

    flush()
    return cues


def to_vtt(cues: list[dict]) -> str:
    """Format cues as a WebVTT string."""
    lines = ["WEBVTT", ""]
    for c in cues:
        lines.append(f"{_ts(c['start'])} --> {_ts(c['end'])}")
        lines.append(c["text"])
        lines.append("")
    return "\n".join(lines)


def chunk_cues(cues: list[dict], max_chars: int = 350) -> list[dict]:
    """Group consecutive cues into ~few-sentence passages, each tagged with the
    start time of its first cue so a hit can jump straight to the moment."""
    passages: list[dict] = []
    buf: list[str] = []
    start: float | None = None
    for c in cues:
        text = (c.get("text") or "").strip()
        if not text:
            continue
        if start is None:
            start = float(c.get("start") or 0.0)
        buf.append(text)
        if sum(len(t) for t in buf) >= max_chars:
            passages.append({"start": start, "text": " ".join(buf)})
            buf, start = [], None
    if buf:
        passages.append({"start": start or 0.0, "text": " ".join(buf)})
    return passages
