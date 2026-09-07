"""External-content provider helpers.

Deliberately tiny and explicit: RabbitHole only knows about a short,
named list of providers, not "any URL". The first provider is YouTube
(embeddable where the uploader allows it); everything else is `generic`
(metadata + an outbound "watch at source" link, no inline player).

Nothing here downloads, caches, or extracts provider media. YouTube
support is limited to parsing the canonical video id out of a URL the
admin pasted and deriving the *official* privacy-enhanced embed URL from
it. Provider-authorized caption import is a separate, later concern — see
docs and main.py::create_external.
"""

from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

# 11-char YouTube ids: [A-Za-z0-9_-]. Kept strict so a mangled paste fails
# loudly at creation time rather than producing a dead embed.
_YT_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
_YT_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "www.youtu.be",
}

PROVIDERS = ("youtube", "generic")


def parse_youtube_id(url: str) -> str | None:
    """Canonical YouTube video id from any common URL form, or None.

    Handles: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID,
    youtube.com/shorts/ID, youtube.com/live/ID, and a bare 11-char id.
    """
    if not url:
        return None
    raw = url.strip()
    if _YT_ID.match(raw):
        return raw

    try:
        parsed = urlparse(raw if "//" in raw else f"https://{raw}")
    except ValueError:
        return None

    host = (parsed.hostname or "").lower()
    if host not in _YT_HOSTS:
        return None

    if host == "youtu.be" or host == "www.youtu.be":
        candidate = parsed.path.lstrip("/").split("/")[0]
        return candidate if _YT_ID.match(candidate) else None

    # youtube.com/watch?v=ID
    if parsed.path == "/watch":
        vals = parse_qs(parsed.query).get("v", [])
        return vals[0] if vals and _YT_ID.match(vals[0]) else None

    # /embed/ID, /shorts/ID, /live/ID, /v/ID
    parts = [p for p in parsed.path.split("/") if p]
    if len(parts) >= 2 and parts[0] in {"embed", "shorts", "live", "v"}:
        return parts[1] if _YT_ID.match(parts[1]) else None

    return None


def youtube_embed_url(video_id: str) -> str:
    """Official privacy-enhanced embed URL. `enablejsapi=1` lets the Watch
    page drive play/seek through the postMessage IFrame API (used for
    exact-moment jumps when a transcript is present)."""
    return f"https://www.youtube-nocookie.com/embed/{video_id}?enablejsapi=1&rel=0"


def youtube_watch_url(video_id: str) -> str:
    return f"https://www.youtube.com/watch?v={video_id}"


def youtube_thumbnail_url(video_id: str) -> str:
    """A stable YouTube-hosted poster so an admin need not supply one.
    hqdefault always exists for a public video."""
    return f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"


def detect_provider(url: str) -> str:
    """Which named provider a URL belongs to. Unknown hosts -> 'generic'."""
    return "youtube" if parse_youtube_id(url) else "generic"


def resolve_external(url: str, provider: str | None = None) -> dict:
    """Normalize an admin-supplied external URL into the fields stored on
    the content record. Never raises for a 'generic' URL; raises ValueError
    only when the URL was explicitly claimed to be YouTube but has no id.

    Returns a dict with: provider, source_url, provider_id, embed_url,
    thumbnail_url (provider default, may be None).
    """
    url = (url or "").strip()
    if not url:
        raise ValueError("a source URL is required")

    prov = provider or detect_provider(url)

    if prov == "youtube":
        vid = parse_youtube_id(url)
        if not vid:
            raise ValueError("could not find a YouTube video id in that URL")
        return {
            "provider": "youtube",
            "source_url": youtube_watch_url(vid),
            "provider_id": vid,
            "embed_url": youtube_embed_url(vid),
            "thumbnail_url": youtube_thumbnail_url(vid),
        }

    # generic: keep the URL exactly as given, no embed.
    return {
        "provider": "generic",
        "source_url": url,
        "provider_id": None,
        "embed_url": None,
        "thumbnail_url": None,
    }
