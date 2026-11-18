"""Video listing, detail, edit and delete."""

from __future__ import annotations

import logging

from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, Response

from .. import aws, config
from ..auth import is_admin, optional_auth, require_auth
from ..helpers import FEED_PARTITION, clean_tags, norm_visibility
from ..models import UpdateVideo, Video
from ..serializers import to_video
from .comments import delete_comments

logger = logging.getLogger(__name__)
router = APIRouter()

FEED_LIMIT = 100


def _index_unavailable(exc: ClientError) -> bool:
    """True while the feed index (or the IAM permission to query it) isn't deployed yet."""
    error = exc.response.get("Error", {})
    code = error.get("Code")
    if code in ("AccessDeniedException", "ResourceNotFoundException"):
        return True
    return code == "ValidationException" and "specified index" in error.get("Message", "")


def _feed_from_index(is_visible) -> list[dict]:
    items: list[dict] = []
    kwargs: dict = {
        "IndexName": "feed-by-created",
        "KeyConditionExpression": Key("gsi_feed").eq(FEED_PARTITION),
        "ScanIndexForward": False,  # newest first
        "Limit": FEED_LIMIT,
    }
    # Page until the feed is full: hidden (unlisted) videos use up part of each page
    while len(items) < FEED_LIMIT:
        resp = aws.videos_table().query(**kwargs)
        for item in resp.get("Items", []):
            if is_visible(item):
                items.append(item)
        if "LastEvaluatedKey" not in resp:
            break
        kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
    return items[:FEED_LIMIT]


def _feed_from_scan(is_visible) -> list[dict]:
    """Slower path used only while the feed index does not exist yet."""
    items: list[dict] = []
    kwargs: dict = {}
    while True:
        resp = aws.videos_table().scan(**kwargs)
        for item in resp.get("Items", []):
            if "video_id" in item and is_visible(item):
                items.append(item)
        if "LastEvaluatedKey" not in resp:
            break
        kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
    items.sort(key=lambda i: i.get("created_at", ""), reverse=True)
    return items[:FEED_LIMIT]


@router.get("/videos", response_model=list[Video])
def list_videos(viewer: str | None = Depends(optional_auth)) -> list[Video]:
    # Unlisted videos are hidden from the feed for everyone except their owner
    # (and the admin). Direct links still work.
    can_see_all = bool(viewer) and is_admin(viewer)

    def is_visible(item: dict) -> bool:
        return (
            norm_visibility(item.get("visibility")) == "public"
            or can_see_all
            or (viewer is not None and item.get("owner") == viewer)
        )

    try:
        items = _feed_from_index(is_visible)
    except ClientError as exc:
        # The API can deploy before Terraform applies the index and its IAM permission; keep the feed up.
        if not _index_unavailable(exc):
            raise
        logger.warning("feed-by-created index unavailable (%s); falling back to Scan", exc)
        items = _feed_from_scan(is_visible)
    return [to_video(item) for item in items]


@router.get("/videos/{video_id}", response_model=Video)
def get_video(video_id: str) -> Video:
    resp = aws.videos_table().get_item(Key={"video_id": video_id})
    item = resp.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="video not found")
    return to_video(item)


@router.patch("/videos/{video_id}", response_model=Video)
def update_video(video_id: str, body: UpdateVideo, user: str = Depends(require_auth)) -> Video:
    item = aws.videos_table().get_item(Key={"video_id": video_id}).get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="video not found")
    if not (is_admin(user) or item.get("owner") == user):
        raise HTTPException(status_code=403, detail="not allowed")

    updates: dict = {}
    if body.title is not None:
        updates["title"] = body.title.strip()[:200]
    if body.description is not None:
        updates["description"] = body.description.strip()[:5000]
    if body.tags is not None:
        updates["tags"] = clean_tags(body.tags)
    if body.visibility is not None:
        updates["visibility"] = norm_visibility(body.visibility)
    if updates:
        expr = "SET " + ", ".join(f"#{k} = :{k}" for k in updates)
        aws.videos_table().update_item(
            Key={"video_id": video_id},
            UpdateExpression=expr,
            ExpressionAttributeNames={f"#{k}": k for k in updates},
            ExpressionAttributeValues={f":{k}": v for k, v in updates.items()},
        )
    return get_video(video_id)


def _delete_prefix(bucket: str, prefix: str) -> None:
    if not bucket:
        return
    paginator = aws.s3.get_paginator("list_objects_v2")
    keys: list[dict] = []
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        keys.extend({"Key": o["Key"]} for o in page.get("Contents", []))
    for i in range(0, len(keys), 1000):
        aws.s3.delete_objects(Bucket=bucket, Delete={"Objects": keys[i : i + 1000]})


@router.delete("/videos/{video_id}", status_code=204)
def delete_video(video_id: str, user: str = Depends(require_auth)) -> Response:
    item = aws.videos_table().get_item(Key={"video_id": video_id}).get("Item")
    allowed = is_admin(user) or (item is not None and item.get("owner") == user)
    if not allowed:
        raise HTTPException(status_code=403, detail="not allowed")
    _delete_prefix(config.UPLOADS_BUCKET, f"uploads/{video_id}/")
    _delete_prefix(config.STREAMING_BUCKET, f"{video_id}/")
    delete_comments(video_id)
    aws.videos_table().delete_item(Key={"video_id": video_id})
    return Response(status_code=204)
