"""Topics, topic connections and creator pages."""

from __future__ import annotations

from boto3.dynamodb.conditions import Attr
from fastapi import APIRouter, HTTPException

from .. import aws
from ..helpers import norm_visibility
from ..models import Creator, Topic, TopicConnection
from ..serializers import to_video

router = APIRouter()


def _to_topic(item: dict) -> Topic:
    return Topic(
        topic_id=item.get("topic_id") or item["slug"],
        slug=item["slug"],
        name=item.get("name") or item["slug"],
        short_description=item.get("short_description"),
        aliases=[str(a) for a in (item.get("aliases") or [])],
        editorial_status=item.get("editorial_status") or "published",
        created_at=item.get("created_at") or "",
    )


@router.get("/topics", response_model=list[Topic])
def list_topics() -> list[Topic]:
    """The curated concept layer -- tags remain the uncurated fallback
    everywhere else (Tunnels/Map keep working over bare tags with zero
    topics rows present; see the Connections endpoint below for the same
    fallback discipline)."""
    resp = aws.topics_table().scan()
    items = [
        i for i in resp.get("Items", [])
        if (i.get("editorial_status") or "published") == "published"
    ]
    items.sort(key=lambda i: (i.get("name") or i.get("slug") or "").lower())
    return [_to_topic(i) for i in items]


@router.get("/topics/{slug}", response_model=Topic)
def get_topic(slug: str) -> Topic:
    item = aws.topics_table().get_item(Key={"slug": slug}).get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="topic not found")
    return _to_topic(item)


@router.get("/topics/{slug}/connections", response_model=list[TopicConnection])
def get_topic_connections(slug: str) -> list[TopicConnection]:
    """This topic's curated connections, from either side of the edge (a
    Connection is authored from_topic -> to_topic, but Map can centre on
    either one). `topic` in the response is always the OTHER side, so the
    caller never has to reason about storage direction.

    A handful of dozens-to-low-hundreds of rows across all curated networks
    -- a full scan+filter is the same "fine at this scale" call already made
    for videos/embeddings elsewhere in this file. A GSI on to_topic would be
    the move if this ever needs to serve a much larger connection graph.
    Callers with no curated connections for this topic (the overwhelming
    majority of tags today) get an empty list back, not an error -- that's
    exactly the signal the frontend uses to fall back to the existing
    tag-co-occurrence Map behaviour."""
    resp = aws.topic_connections_table().scan(
        FilterExpression=Attr("from_topic").eq(slug) | Attr("to_topic").eq(slug)
    )
    out = [
        TopicConnection(
            topic=it["to_topic"] if it.get("from_topic") == slug else it["from_topic"],
            relationship_type=it.get("relationship_type") or "related",
            explanation=it.get("explanation") or "",
            strength=int(it.get("strength") or 1),
            source=it.get("source") or "editorial",
        )
        for it in resp.get("Items", [])
    ]
    out.sort(key=lambda c: (-c.strength, c.topic))
    return out


@router.get("/creators/{username}", response_model=Creator)
def get_creator(username: str) -> Creator:
    """A creator's public profile: their videos, aggregate stats, and an
    "expertise" topic list built by counting tags across their own videos --
    no separate topic model needed, since tags are already curated (by the
    creator or by AI suggestion) per video."""
    from collections import Counter

    username = username.strip().lower()
    resp = aws.videos_table().scan(FilterExpression=Attr("owner").eq(username))
    videos = [
        to_video(item)
        for item in resp.get("Items", [])
        if norm_visibility(item.get("visibility")) == "public"
    ]
    user_item = aws.users_table().get_item(Key={"username": username}).get("Item")
    if not videos and not user_item:
        raise HTTPException(status_code=404, detail="creator not found")

    videos.sort(key=lambda v: v.created_at, reverse=True)
    tag_counts = Counter(t for v in videos for t in v.tags)
    topics = [{"tag": tag, "count": n} for tag, n in tag_counts.most_common(8)]

    return Creator(
        username=username,
        joined=(user_item or {}).get("created_at"),
        video_count=len(videos),
        total_views=sum(v.views for v in videos),
        total_hops=sum(v.hops for v in videos),
        topics=topics,
        videos=videos,
    )
