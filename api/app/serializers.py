"""Turn DynamoDB items into API response models."""

from __future__ import annotations


from .models import Capabilities, ContentTopic, Video
from .helpers import cdn_url, norm_visibility


def _thumb_url(item: dict) -> str | None:
    """The thumbnail CDN URL, cache-busted by thumbnail_updated_at.

    thumb.jpg keeps the same S3 key for the life of the video, so when the
    worker or an admin replaces the image, CloudFront/browsers would keep
    serving the stale one. Appending ?v=<epoch> (bumped on every write) makes
    each new thumbnail a distinct URL without renaming objects or issuing
    CloudFront invalidations. Legacy records with no thumbnail_updated_at get
    the plain URL, exactly as before."""
    url = cdn_url(item.get("thumb_key"))
    if not url:
        return None
    v = item.get("thumbnail_updated_at")
    return f"{url}?v={int(v)}" if v else url


def _transcript_status(item: dict) -> str | None:
    status = item.get("transcript_status")
    if status in ("pending", "transcribing", "ready", "no_speech", "failed"):
        return status
    # Legacy record from before transcript_status existed: fall back to the
    # older flags so it still reads as *something* sensible rather than None
    # everywhere. New writes always set transcript_status explicitly.
    if item.get("has_transcript"):
        return "ready"
    if item.get("transcribing"):
        return "transcribing"
    return None


def _source_type(item: dict) -> str:
    """"hosted" | "external". Every record ever created so far went through
    the upload pipeline, so the only safe default for a record with no
    explicit source_type is "hosted" -- NOT "derive from hls_key presence",
    which would misclassify a hosted video that simply hasn't finished
    transcoding yet (no hls_key != external). A future external-content
    creation path (P1-4, not built yet) sets source_type="external" itself
    at write time; nothing here ever needs to guess that."""
    value = item.get("source_type")
    return value if value in ("hosted", "external") else "hosted"


def _transcript_source(item: dict, transcript_status: str | None) -> str:
    """Where this record's transcript came from, independent of hosting.
    Explicit value wins; otherwise a legacy hosted record with a transcript
    is "transcribe" (that was the only path that existed), else "none"."""
    value = item.get("transcript_source")
    if value in ("transcribe", "provider", "imported", "none"):
        return value
    return "transcribe" if transcript_status == "ready" else "none"


def _capabilities(item: dict, transcript_status: str | None, source_type: str) -> Capabilities:
    """Derived fresh from the item's own fields on every read -- never stored
    independently, so a capability can never disagree with the state it
    describes (the same discipline has_transcript/transcribing already use).

    Every flag comes from concrete data (hls_key / embed_url / source_url /
    a ready transcript), never from source_type alone. See
    models.py::Capabilities for what each flag means."""
    hls = bool(item.get("hls_key"))
    is_external = source_type == "external"
    has_embed = is_external and bool(item.get("embed_url"))
    has_link = is_external and bool(item.get("source_url"))
    playable = hls or has_embed
    watchable = playable or has_link
    # Search only ever indexes transcribed content (api/app/search.py). A
    # ready transcript is a ready transcript whether AWS Transcribe, a
    # provider API, or an admin import produced it -- these flags track the
    # transcript, not how the video is hosted.
    transcript_ready = transcript_status == "ready"
    # Real cue timing? Hosted AWS-Transcribe output always has it (legacy
    # records have no flag -> True). An imported text-only transcript does not.
    transcript_timed = bool(item.get("transcript_timed", True))
    taggable = bool(item.get("tags")) or bool(item.get("topics"))
    public = norm_visibility(item.get("visibility")) == "public"
    return Capabilities(
        play_internal=hls,
        embed_external=has_embed,
        open_external=has_link and not has_embed,
        watch=watchable,
        transcript=transcript_ready,
        moment_search=transcript_ready,
        ask_video=transcript_ready,
        # Exact-moment jumps need a transcript with real timing AND a player
        # we can drive. An outbound-link-only item can never seek; neither
        # can a text-only imported transcript (every cue is at 0:00).
        seek=transcript_ready and transcript_timed and playable,
        tunnels=taggable,
        map=taggable,
        tumble=public and watchable,
    )


def _to_content_topics(item: dict) -> list[ContentTopic]:
    out = []
    for t in item.get("topics") or []:
        if isinstance(t, dict) and t.get("topic_id"):
            out.append(
                ContentTopic(
                    topic_id=str(t["topic_id"]),
                    relevance=float(t.get("relevance") or 1.0),
                    source=str(t.get("source") or "editorial"),
                )
            )
    return out


def _external_thumb_url(item: dict) -> str | None:
    """External records store the poster as a full URL (provider default or
    an admin-supplied one), not an S3 key -- so the hosted `_thumb_url`
    (which builds a CDN URL from thumb_key) doesn't apply."""
    url = item.get("thumbnail_url")
    return str(url) if url else None


def to_video(item: dict) -> Video:
    status = _transcript_status(item)
    source_type = _source_type(item)
    is_external = source_type == "external"
    return Video(
        video_id=item["video_id"],
        filename=item.get("filename") or "untitled",
        status=item.get("status") or "unknown",
        created_at=item.get("created_at") or "",
        playback_url=cdn_url(item.get("hls_key")),
        thumbnail_url=_external_thumb_url(item) if is_external else _thumb_url(item),
        duration_seconds=item.get("duration_seconds"),
        cost_usd=item.get("cost_usd"),
        owner=item.get("owner"),
        title=item.get("title"),
        description=item.get("description"),
        views=int(item.get("views") or 0),
        hops=int(item.get("hops") or 0),
        thumps=int(item.get("thumps") or 0),
        tags=[str(t) for t in (item.get("tags") or [])],
        ai_generated=bool(item.get("ai_generated") or False),
        thumbnail_source=item.get("thumbnail_source"),
        thumbnail_timestamp=(
            float(item["thumbnail_timestamp"])
            if item.get("thumbnail_timestamp") is not None
            else None
        ),
        featured=bool(item.get("featured") or False),
        transcript_status=status,
        # Derived, not independently trusted -- ready is the only status that
        # means "usable transcript exists," so has_transcript can never
        # disagree with transcript_status.
        has_transcript=status == "ready",
        transcribing=status == "transcribing",
        transcript_url=cdn_url(item.get("transcript_key")),
        captions_url=cdn_url(item.get("vtt_key")),
        visibility=norm_visibility(item.get("visibility")),
        source_type=source_type,
        provider=item.get("provider") if is_external else None,
        source_url=item.get("source_url") if is_external else None,
        provider_id=item.get("provider_id") if is_external else None,
        embed_url=item.get("embed_url") if is_external else None,
        source_name=item.get("source_name") if is_external else None,
        transcript_source=_transcript_source(item, status),
        capabilities=_capabilities(item, status, source_type),
        topics=_to_content_topics(item),
    )
