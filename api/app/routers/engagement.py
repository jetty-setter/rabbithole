"""Favorites, hop/thump reactions, votes and view counts."""

from __future__ import annotations

from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, Response

from .. import aws
from ..auth import require_auth
from ..models import ReactionRequest, VoteRequest

router = APIRouter()


@router.get("/favorites")
def list_favorites(user: str = Depends(require_auth)) -> dict:
    item = aws.users_table().get_item(Key={"username": user}).get("Item") or {}
    return {"favorites": sorted(item.get("favorites") or set())}


@router.post("/favorites/{video_id}", status_code=204)
def add_favorite(video_id: str, user: str = Depends(require_auth)) -> Response:
    aws.users_table().update_item(
        Key={"username": user},
        UpdateExpression="ADD favorites :v",
        ExpressionAttributeValues={":v": {video_id}},
    )
    return Response(status_code=204)


@router.delete("/favorites/{video_id}", status_code=204)
def remove_favorite(video_id: str, user: str = Depends(require_auth)) -> Response:
    aws.users_table().update_item(
        Key={"username": user},
        UpdateExpression="DELETE favorites :v",
        ExpressionAttributeValues={":v": {video_id}},
    )
    return Response(status_code=204)


# ── Rabbit reactions: Hop (approve) / Thump (disapprove) ───
# One reaction per user per video; switching sides moves the counts atomically.

def _bump(video_id: str, attr: str, delta: int) -> None:
    kwargs: dict = dict(
        Key={"video_id": video_id},
        UpdateExpression="ADD #a :d",
        ExpressionAttributeNames={"#a": attr},
        ExpressionAttributeValues={":d": delta},
    )
    if delta < 0:
        kwargs["ConditionExpression"] = "attribute_exists(#a) AND #a > :zero"
        kwargs["ExpressionAttributeValues"][":zero"] = 0
    try:
        aws.videos_table().update_item(**kwargs)
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise


@router.get("/reactions")
def list_reactions(user: str = Depends(require_auth)) -> dict:
    item = aws.users_table().get_item(Key={"username": user}).get("Item") or {}
    return {
        "hopped": sorted(item.get("hopped") or set()),
        "thumped": sorted(item.get("thumped") or set()),
    }


@router.put("/videos/{video_id}/reaction", status_code=204)
def set_reaction(
    video_id: str, body: ReactionRequest, user: str = Depends(require_auth)
) -> Response:
    new = body.reaction
    if new not in (None, "hop", "thump"):
        raise HTTPException(status_code=400, detail="reaction must be hop, thump, or null")

    item = aws.users_table().get_item(Key={"username": user}).get("Item") or {}
    hopped = item.get("hopped") or set()
    thumped = item.get("thumped") or set()
    current = "hop" if video_id in hopped else "thump" if video_id in thumped else None
    if current == new:
        return Response(status_code=204)

    users = aws.users_table()
    # Clear the existing reaction (set + counter).
    if current == "hop":
        users.update_item(
            Key={"username": user},
            UpdateExpression="DELETE hopped :v",
            ExpressionAttributeValues={":v": {video_id}},
        )
        _bump(video_id, "hops", -1)
    elif current == "thump":
        users.update_item(
            Key={"username": user},
            UpdateExpression="DELETE thumped :v",
            ExpressionAttributeValues={":v": {video_id}},
        )
        _bump(video_id, "thumps", -1)

    # Apply the new one.
    if new == "hop":
        users.update_item(
            Key={"username": user},
            UpdateExpression="ADD hopped :v",
            ExpressionAttributeValues={":v": {video_id}},
        )
        _bump(video_id, "hops", 1)
    elif new == "thump":
        users.update_item(
            Key={"username": user},
            UpdateExpression="ADD thumped :v",
            ExpressionAttributeValues={":v": {video_id}},
        )
        _bump(video_id, "thumps", 1)

    return Response(status_code=204)


_ATTR = {"hop": "hops", "thump": "thumps"}


@router.post("/videos/{video_id}/vote", status_code=204)
def vote(video_id: str, body: VoteRequest) -> Response:
    """Anonymous, no-auth vote. The browser tracks its own prior choice and
    sends the transition; we just move the public counters."""
    if body.from_ not in (None, "hop", "thump") or body.to not in (None, "hop", "thump"):
        raise HTTPException(status_code=400, detail="from/to must be hop, thump, or null")
    if body.from_ == body.to:
        return Response(status_code=204)
    if body.from_:
        _bump(video_id, _ATTR[body.from_], -1)
    if body.to:
        _bump(video_id, _ATTR[body.to], 1)
    return Response(status_code=204)


@router.post("/videos/{video_id}/view", status_code=204)
def add_view(video_id: str) -> Response:
    aws.videos_table().update_item(
        Key={"video_id": video_id},
        UpdateExpression="ADD #v :one",
        ExpressionAttributeNames={"#v": "views"},
        ExpressionAttributeValues={":one": 1},
    )
    return Response(status_code=204)
