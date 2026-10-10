"""Presigned uploads and external (embedded) video ingestion."""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from .. import aws, config, providers
from ..auth import is_admin, require_auth
from ..helpers import clean_tags, norm_visibility, safe_filename
from ..models import ExternalCreate, UploadRequest, UploadResponse, Video
from ..serializers import to_video

router = APIRouter()


@router.post("/uploads", response_model=UploadResponse)
def create_upload(req: UploadRequest, user: str = Depends(require_auth)) -> UploadResponse:
    if not req.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="content_type must be video/*")
    if not config.UPLOADS_BUCKET:
        raise HTTPException(status_code=500, detail="UPLOADS_BUCKET not configured")

    video_id = uuid.uuid4().hex
    filename = safe_filename(req.filename)
    key = f"uploads/{video_id}/{filename}"

    try:
        upload_url = aws.s3.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": config.UPLOADS_BUCKET,
                "Key": key,
                "ContentType": req.content_type,
            },
            ExpiresIn=config.PRESIGN_EXPIRY_SECONDS,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"presign failed: {exc}") from exc

    item = {
        "video_id": video_id,
        "filename": filename,
        "key": key,
        "content_type": req.content_type,
        "status": "pending_upload",
        "owner": user,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "visibility": norm_visibility(req.visibility),
    }
    if req.title and req.title.strip():
        item["title"] = req.title.strip()[:200]
    if req.description and req.description.strip():
        item["description"] = req.description.strip()[:5000]
    if req.tags:
        clean = clean_tags(req.tags)
        if clean:
            item["tags"] = clean
    aws.videos_table().put_item(Item=item)

    return UploadResponse(video_id=video_id, upload_url=upload_url, key=key)


# ── External-content transcript ingestion ────────────────────────────────
# An imported/provider transcript is written to the SAME S3 keys and sets
# the SAME record fields a hosted AWS-Transcribe job would (see
# lambdas/transcribe/handler.py), so search indexing, chunking, embeddings,
# "Ask this video", and the Watch transcript UI all reuse the hosted path
# with zero branching. The only thing that differs is transcript_source
# (provenance) and transcript_timed (whether cue start times are real).

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


def _vtt_ts(seconds: float) -> str:
    ms = int(round(max(0.0, seconds) * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def _cues_to_vtt(cues: list[dict]) -> str:
    lines = ["WEBVTT", ""]
    for c in cues:
        lines.append(f"{_vtt_ts(c['start'])} --> {_vtt_ts(c.get('end') or c['start'])}")
        lines.append(c["text"])
        lines.append("")
    return "\n".join(lines)


def _build_external_cues(body: ExternalCreate) -> tuple[list[dict], bool]:
    """(cues, timed). `timed` is False when we only had plain text and had
    to synthesize zero-start cues -- callers use it to withhold exact-moment
    seeking even though the transcript is fully searchable."""
    if body.transcript_segments:
        cues = [
            {
                "start": round(float(s.start), 2),
                "end": round(float(s.end if s.end is not None else s.start), 2),
                "text": s.text.strip(),
            }
            for s in body.transcript_segments
            if s.text.strip()
        ]
        return cues, True
    text = (body.transcript_text or "").strip()
    if not text:
        return [], False
    parts = [p.strip() for p in _SENTENCE_SPLIT.split(text) if p.strip()]
    return [{"start": 0.0, "end": 0.0, "text": p[:2000]} for p in parts], False


def _ingest_external_transcript(video_id: str, body: ExternalCreate) -> dict:
    """Write cues.json + captions.vtt for an external item and return the
    record fields to persist. Returns {} when there's nothing to ingest."""
    if body.transcript_source not in ("imported", "provider"):
        return {}
    cues, timed = _build_external_cues(body)
    if not cues:
        return {}
    aws.s3.put_object(
        Bucket=config.STREAMING_BUCKET,
        Key=f"{video_id}/cues.json",
        Body=json.dumps(cues).encode("utf-8"),
        ContentType="application/json",
    )
    aws.s3.put_object(
        Bucket=config.STREAMING_BUCKET,
        Key=f"{video_id}/captions.vtt",
        Body=_cues_to_vtt(cues).encode("utf-8"),
        ContentType="text/vtt",
    )
    return {
        "transcript_status": "ready",
        "has_transcript": True,
        "transcribing": False,
        "transcript_key": f"{video_id}/cues.json",
        "vtt_key": f"{video_id}/captions.vtt",
        "transcript_source": body.transcript_source,
        "transcript_timed": timed,
    }


@router.post("/external", response_model=Video, status_code=201)
def create_external(body: ExternalCreate, user: str = Depends(require_auth)) -> Video:
    """Register a piece of External content. Admin only. The media is never
    uploaded -- RabbitHole stores metadata, a provider-safe embed URL (when
    embeddable), and optionally an imported transcript that flows through the
    normal search/embedding pipeline."""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="not allowed")
    if body.transcript_source not in ("none", "imported", "provider"):
        raise HTTPException(status_code=400, detail="invalid transcript_source")
    if body.provider is not None and body.provider not in providers.PROVIDERS:
        raise HTTPException(status_code=400, detail="unknown provider")

    try:
        resolved = providers.resolve_external(body.source_url, body.provider)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    video_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    source_name = (body.creator or "").strip()[:120] or "External"
    thumb = (body.thumbnail_url or "").strip() or resolved["thumbnail_url"]

    item: dict = {
        "video_id": video_id,
        "filename": f"{resolved['provider']}-{resolved.get('provider_id') or video_id[:8]}",
        "status": "ready",
        "created_at": now,
        "source_type": "external",
        "provider": resolved["provider"],
        "source_url": resolved["source_url"],
        "owner": source_name,          # existing card/watch code reads `owner`
        "source_name": source_name,
        "created_by": user,            # audit only; not surfaced
        "title": body.title.strip()[:200],
        "visibility": norm_visibility(body.visibility),
        "views": 0,
        "hops": 0,
        "thumps": 0,
    }
    if resolved.get("provider_id"):
        item["provider_id"] = resolved["provider_id"]
    if resolved.get("embed_url"):
        item["embed_url"] = resolved["embed_url"]
    if thumb:
        item["thumbnail_url"] = thumb
    if body.description and body.description.strip():
        item["description"] = body.description.strip()[:5000]
    clean = clean_tags(body.tags)
    if clean:
        item["tags"] = clean

    item.update(_ingest_external_transcript(video_id, body))

    aws.videos_table().put_item(Item=item)
    return to_video(item)
