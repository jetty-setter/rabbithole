"""Comments on a video."""

from __future__ import annotations

import uuid
from boto3.dynamodb.conditions import Key
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Response

from .. import aws
from ..auth import is_admin, require_auth
from ..models import Comment, CommentCreate

router = APIRouter()


def _to_comment(item: dict) -> Comment:
    return Comment(
        video_id=item["video_id"],
        comment_id=item["comment_id"],
        author=item.get("author") or "someone",
        text=item.get("text") or "",
        created_at=item.get("created_at") or "",
    )


def delete_comments(video_id: str) -> None:
    table = aws.comments_table()
    resp = table.query(KeyConditionExpression=Key("video_id").eq(video_id))
    items = resp.get("Items", [])
    if not items:
        return
    with table.batch_writer() as batch:
        for it in items:
            batch.delete_item(
                Key={"video_id": video_id, "comment_id": it["comment_id"]}
            )


@router.get("/videos/{video_id}/comments", response_model=list[Comment])
def list_comments(video_id: str) -> list[Comment]:
    resp = aws.comments_table().query(
        KeyConditionExpression=Key("video_id").eq(video_id),
        ScanIndexForward=False,  # newest first (comment_id is timestamp-prefixed)
        Limit=200,
    )
    return [_to_comment(i) for i in resp.get("Items", [])]


@router.post("/videos/{video_id}/comments", response_model=Comment, status_code=201)
def add_comment(
    video_id: str, body: CommentCreate, user: str = Depends(require_auth)
) -> Comment:
    if not aws.videos_table().get_item(Key={"video_id": video_id}).get("Item"):
        raise HTTPException(status_code=404, detail="video not found")
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="empty comment")
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "video_id": video_id,
        "comment_id": f"{now}#{uuid.uuid4().hex[:8]}",
        "author": user,
        "text": text[:1000],
        "created_at": now,
    }
    aws.comments_table().put_item(Item=item)
    return _to_comment(item)


@router.delete("/videos/{video_id}/comments/{comment_id}", status_code=204)
def delete_comment(
    video_id: str, comment_id: str, user: str = Depends(require_auth)
) -> Response:
    item = (
        aws.comments_table()
        .get_item(Key={"video_id": video_id, "comment_id": comment_id})
        .get("Item")
    )
    if not item:
        return Response(status_code=204)
    if not (is_admin(user) or item.get("author") == user):
        raise HTTPException(status_code=403, detail="not allowed")
    aws.comments_table().delete_item(Key={"video_id": video_id, "comment_id": comment_id})
    return Response(status_code=204)
