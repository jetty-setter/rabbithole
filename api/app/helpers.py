"""Pure helpers shared across routes: visibility, filenames, tags, CDN URLs."""

from __future__ import annotations

import re

from . import config


# Allowed visibility states. Anything else is treated as "public".
_VISIBILITIES = {"public", "unlisted"}


def norm_visibility(value: str | None) -> str:
    return value if value in _VISIBILITIES else "public"


_UNSAFE = re.compile(r"[^A-Za-z0-9._-]+")


def safe_filename(name: str) -> str:
    cleaned = _UNSAFE.sub("", name.strip().replace(" ", "_"))
    return cleaned or "video.mp4"


_TAG_SEP = re.compile(r"[\s_]+")


_TAG_HYPHEN_RUN = re.compile(r"-{2,}")


def normalize_tag(raw: object) -> str:
    """Canonical form for a single tag / tunnel label.

    Mechanical normalization only, so the same concept typed slightly
    differently lands in one tunnel instead of several:
      * lowercase
      * strip surrounding whitespace and any leading '#'
      * collapse internal whitespace / underscore runs to a single hyphen
      * collapse repeated hyphens, trim leading/trailing hyphens
      * cap length at 30 chars

    Different *spellings* are deliberately left alone -- "True Crime",
    "true crime" and "true-crime" converge, but "truecrime" stays its own
    tag. No synonym mapping. Returns "" for junk input.
    """
    s = str(raw).strip().lstrip("#").strip().lower()
    s = _TAG_SEP.sub("-", s)
    s = _TAG_HYPHEN_RUN.sub("-", s).strip("-")
    return s[:30]


def clean_tags(raw: object, limit: int = 8) -> list[str]:
    """Normalize a list of raw tag inputs: canonicalize each via
    ``normalize_tag``, drop blanks, dedupe (order-preserving), cap the count.
    This is the single point every write path funnels tags through."""
    out: list[str] = []
    for t in raw or []:
        tag = normalize_tag(t)
        if tag and tag not in out:
            out.append(tag)
    return out[:limit]


def cdn_url(key: str | None) -> str | None:
    if not key or not config.CLOUDFRONT_DOMAIN:
        return None
    return f"https://{config.CLOUDFRONT_DOMAIN}/{key}"
