"""Admin curation: thumbnail overrides and the featured video."""

from __future__ import annotations

from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from .. import aws, config
from ..auth import is_admin, require_auth
from ..helpers import cdn_url, norm_visibility
from ..models import FeatureRequest, ThumbnailSelectRequest, Video
from .videos import get_video

router = APIRouter()


# ── Thumbnail override (admin) ───────────────────────────────────────
# The worker pre-generates ~8-10 candidate frames per video (at
# {video_id}/thumbs/cand_NN.jpg) and records their timestamps/scores. The
# admin picker just displays those; selecting one server-side copies that
# object over {video_id}/thumb.jpg -- no ffmpeg in the API, no new keys.

def _thumb_candidates(item: dict) -> dict[int, dict]:
    return {int(c["i"]): c for c in (item.get("thumbnail_candidates") or [])}


def _cand_url(video_id: str, index: int, updated_at) -> str | None:
    url = cdn_url(f"{video_id}/thumbs/cand_{index:02d}.jpg")
    if url and updated_at:
        url = f"{url}?v={int(updated_at)}"
    return url


@router.get("/videos/{video_id}/thumbnail/candidates")
def thumbnail_candidates(video_id: str, user: str = Depends(require_auth)) -> dict:
    """The generated candidate frames for the admin frame picker."""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="not allowed")
    item = aws.videos_table().get_item(Key={"video_id": video_id}).get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="video not found")

    updated_at = item.get("thumbnail_updated_at")
    auto_index = item.get("thumbnail_auto_index")
    auto_index = int(auto_index) if auto_index is not None else None
    source = item.get("thumbnail_source") or "auto"
    manual_index = item.get("thumbnail_manual_index")
    current_index = (
        int(manual_index) if source == "manual" and manual_index is not None else auto_index
    )

    cands = sorted(_thumb_candidates(item).values(), key=lambda c: int(c["i"]))
    out = [
        {
            "index": int(c["i"]),
            "timestamp": float(c.get("t") or 0),
            "score": float(c.get("score") or 0),
            "url": _cand_url(video_id, int(c["i"]), updated_at),
            "is_auto": int(c["i"]) == auto_index,
            "is_current": int(c["i"]) == current_index,
        }
        for c in cands
    ]
    return {
        "candidates": out,
        "source": source,
        "current_index": current_index,
        "auto_index": auto_index,
    }


@router.post("/videos/{video_id}/thumbnail", response_model=Video)
def select_video_thumbnail(
    video_id: str, body: ThumbnailSelectRequest, user: str = Depends(require_auth)
) -> Video:
    """Admin thumbnail override. mode="manual" pins a specific candidate frame
    (and marks the thumbnail so automatic reprocessing won't touch it);
    mode="auto" restores the automatic best-frame choice."""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="not allowed")
    item = aws.videos_table().get_item(Key={"video_id": video_id}).get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="video not found")

    by_index = _thumb_candidates(item)
    if not by_index:
        raise HTTPException(
            status_code=409,
            detail="no candidate frames were generated for this video",
        )

    if body.mode == "auto":
        auto_index = item.get("thumbnail_auto_index")
        if auto_index is None or int(auto_index) not in by_index:
            raise HTTPException(status_code=409, detail="no automatic choice is available")
        target, source = int(auto_index), "auto"
    elif body.mode == "manual":
        if body.index is None or int(body.index) not in by_index:
            raise HTTPException(
                status_code=400,
                detail="index must identify one of the generated candidate frames",
            )
        target, source = int(body.index), "manual"
    else:
        raise HTTPException(status_code=400, detail="mode must be 'manual' or 'auto'")

    cand = by_index[target]
    src_key = f"{video_id}/thumbs/cand_{target:02d}.jpg"
    try:
        aws.s3.copy_object(
            Bucket=config.STREAMING_BUCKET,
            CopySource={"Bucket": config.STREAMING_BUCKET, "Key": src_key},
            Key=f"{video_id}/thumb.jpg",
            ContentType="image/jpeg",
            MetadataDirective="REPLACE",
        )
    except ClientError as exc:
        raise HTTPException(status_code=502, detail="could not update the thumbnail") from exc

    now = int(datetime.now(timezone.utc).timestamp())
    set_map = {
        "thumb_key": f"{video_id}/thumb.jpg",
        "thumbnail_source": source,
        "thumbnail_timestamp": cand.get("t"),
        "thumbnail_score": cand.get("score"),
        "thumbnail_updated_at": now,
    }
    expr = "SET " + ", ".join(f"#{k} = :{k}" for k in set_map)
    names = {f"#{k}": k for k in set_map}
    values = {f":{k}": v for k, v in set_map.items()}
    if source == "manual":
        expr += ", #mi = :mi"
        names["#mi"] = "thumbnail_manual_index"
        values[":mi"] = target
    else:
        expr += " REMOVE #mi"
        names["#mi"] = "thumbnail_manual_index"
    aws.videos_table().update_item(
        Key={"video_id": video_id},
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )
    return get_video(video_id)


def _featurable(item: dict) -> bool:
    """Can this record legitimately sit in the homepage Featured slot?
    A curator can only feature a usable, public, ready item -- hosted
    (transcoded) OR external (embeddable / linkable). Mirrors the `watch`
    capability rather than assuming an hls_key."""
    if item.get("status") != "ready":
        return False
    if norm_visibility(item.get("visibility")) != "public":
        return False
    return bool(
        item.get("hls_key") or item.get("embed_url") or item.get("source_url")
    )


def _clear_featured(except_id: str | None = None) -> list[str]:
    """Set featured=False on every video currently flagged featured, except
    `except_id`. Returns the ids cleared. This is what keeps "only one
    Featured video" true server-side regardless of prior (or racey) state."""
    cleared: list[str] = []
    scan_kwargs: dict = {"FilterExpression": Attr("featured").eq(True)}
    while True:
        resp = aws.videos_table().scan(**scan_kwargs)
        for it in resp.get("Items", []):
            vid = it["video_id"]
            if vid == except_id:
                continue
            aws.videos_table().update_item(
                Key={"video_id": vid},
                UpdateExpression="SET #f = :false",
                ExpressionAttributeNames={"#f": "featured"},
                ExpressionAttributeValues={":false": False},
            )
            cleared.append(vid)
        if "LastEvaluatedKey" not in resp:
            return cleared
        scan_kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]


@router.put("/videos/{video_id}/featured", response_model=Video)
def set_featured(video_id: str, body: FeatureRequest, user: str = Depends(require_auth)) -> Video:
    """Designate (or clear) the single homepage Featured video. Admin only.

    Marking a video featured atomically-enough clears any other featured
    record: the target is set first, then every other featured row is
    unset, so the invariant ("at most one featured") holds even if the UI
    is stale or two requests race. Idempotent."""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="not allowed")
    item = aws.videos_table().get_item(Key={"video_id": video_id}).get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="video not found")

    if body.featured:
        if not _featurable(item):
            raise HTTPException(
                status_code=409,
                detail="only a public, ready video can be featured on the homepage",
            )
        aws.videos_table().update_item(
            Key={"video_id": video_id},
            UpdateExpression="SET #f = :true",
            ExpressionAttributeNames={"#f": "featured"},
            ExpressionAttributeValues={":true": True},
        )
        _clear_featured(except_id=video_id)
    else:
        aws.videos_table().update_item(
            Key={"video_id": video_id},
            UpdateExpression="SET #f = :false",
            ExpressionAttributeNames={"#f": "featured"},
            ExpressionAttributeValues={":false": False},
        )

    return get_video(video_id)
