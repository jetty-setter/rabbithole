"""RabbitHole API — presigned uploads + job status.

Runs locally as a normal FastAPI app (uvicorn) and on AWS Lambda via Mangum.
"""

from __future__ import annotations

import functools
import json
import re
import uuid
from datetime import datetime, timezone

AI_SYSTEM_PROMPT = (
    "You title videos for RabbitHole, a fun, irreverent, internet-native video "
    "site. You're given a few frames sampled in chronological order across one "
    "short clip. Read them as a SEQUENCE and find the hook — the funniest, most "
    "surprising, or most satisfying beat. Return JSON with: "
    "(1) \"title\": a SHORT, punchy, scroll-stopping title — aim for 4-8 words, "
    "max 60 chars, no quotes, no end punctuation. "
    "(2) \"description\": a lively 1-2 sentence description of what actually "
    "happens. (3) \"tags\": 3-5 short lowercase tags. "
    'Respond with ONLY a JSON object: {"title": str, "description": str, "tags": [str]}'
)


def parse_ai_metadata(text: str) -> dict | None:
    if "{" not in text:
        return None
    text = text[text.find("{"):text.rfind("}") + 1]
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    title = (data.get("title") or "").strip().strip('"')[:120]
    description = (data.get("description") or "").strip()[:1000]
    tags = [str(t).strip().lower()[:30] for t in (data.get("tags") or []) if str(t).strip()][:5]
    out: dict = {}
    if title:
        out["title"] = title
    if description:
        out["description"] = description
    if tags:
        out["tags"] = tags
    return out or None

from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError
from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from . import aws, config
from .auth import (
    create_token,
    hash_password,
    is_admin,
    optional_auth,
    require_auth,
    verify_password,
)

# Allowed visibility states. Anything else is treated as "public".
_VISIBILITIES = {"public", "unlisted"}


def _norm_visibility(value: str | None) -> str:
    return value if value in _VISIBILITIES else "public"
from .models import (
    AskRequest,
    Comment,
    CommentCreate,
    Creator,
    Credentials,
    ReactionRequest,
    SuggestRequest,
    UpdateVideo,
    UploadRequest,
    UploadResponse,
    Video,
    VoteRequest,
)

app = FastAPI(title="RabbitHole API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

_UNSAFE = re.compile(r"[^A-Za-z0-9._-]+")


def _safe_filename(name: str) -> str:
    cleaned = _UNSAFE.sub("", name.strip().replace(" ", "_"))
    return cleaned or "video.mp4"



@functools.lru_cache(maxsize=1)
def _anthropic_key() -> str:
    """Fetch the Anthropic key from SSM once per warm Lambda (cached)."""
    if not config.ANTHROPIC_KEY_PARAM:
        return ""
    try:
        resp = aws.ssm.get_parameter(Name=config.ANTHROPIC_KEY_PARAM, WithDecryption=True)
        return resp["Parameter"]["Value"]
    except Exception:  # noqa: BLE001
        return ""


@app.post("/ai/suggest")
def ai_suggest(body: SuggestRequest, user: str = Depends(require_auth)) -> dict:
    """Suggest a title/description/tags from browser-extracted frames so the
    uploader can see and tweak the AI's take before publishing."""
    key = _anthropic_key()
    frames = [f for f in (body.frames or []) if f][:5]
    if not key or not frames:
        raise HTTPException(status_code=503, detail="AI suggestions unavailable")

    import anthropic

    client = anthropic.Anthropic(api_key=key)
    images = [
        {
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": f},
        }
        for f in frames
    ]
    try:
        resp = client.messages.create(
            model=config.AI_MODEL,
            max_tokens=400,
            system=AI_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        *images,
                        {
                            "type": "text",
                            "text": "Frames are in chronological order (start -> end). "
                            "Write the metadata JSON.",
                        },
                    ],
                }
            ],
        )
        text = "".join(b.text for b in resp.content if b.type == "text").strip()
        meta = parse_ai_metadata(text)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="AI suggestion failed") from exc

    return meta or {}


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/auth/signup")
def signup(req: Credentials) -> dict:
    username = req.username.strip().lower()
    # The creator account is provisioned out-of-band
    if username == config.CREATOR_USERNAME.strip().lower():
        raise HTTPException(status_code=409, detail="username already taken")
    item = {
        "username": username,
        "password_hash": hash_password(req.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        aws.users_table().put_item(
            Item=item, ConditionExpression="attribute_not_exists(username)"
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise HTTPException(status_code=409, detail="username already taken") from exc
        raise
    return {"token": create_token(username), "username": username, "is_admin": is_admin(username)}


@app.post("/auth/login")
def login(req: Credentials) -> dict:
    username = req.username.strip().lower()
    user = aws.users_table().get_item(Key={"username": username}).get("Item")
    if not user or not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="invalid credentials")
    return {"token": create_token(username), "username": username, "is_admin": is_admin(username)}


@app.get("/auth/me")
def me(user: str = Depends(require_auth)) -> dict:
    return {"username": user, "is_admin": is_admin(user)}


@app.get("/auth/demo")
def demo_login() -> dict:
    """Return a read-only viewer token for the demo/portfolio user.

    The token is a normal short-lived JWT — it grants the same access as any
    signed-in viewer (favorites, reactions) but not admin/upload privileges.
    Called automatically by the frontend on first load so visitors arrive
    already signed in as the demo account.
    """
    username = config.DEMO_USERNAME
    return {"token": create_token(username), "username": username, "is_admin": False}


@app.get("/favorites")
def list_favorites(user: str = Depends(require_auth)) -> dict:
    item = aws.users_table().get_item(Key={"username": user}).get("Item") or {}
    return {"favorites": sorted(item.get("favorites") or set())}


@app.post("/favorites/{video_id}", status_code=204)
def add_favorite(video_id: str, user: str = Depends(require_auth)) -> Response:
    aws.users_table().update_item(
        Key={"username": user},
        UpdateExpression="ADD favorites :v",
        ExpressionAttributeValues={":v": {video_id}},
    )
    return Response(status_code=204)


@app.delete("/favorites/{video_id}", status_code=204)
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


@app.get("/reactions")
def list_reactions(user: str = Depends(require_auth)) -> dict:
    item = aws.users_table().get_item(Key={"username": user}).get("Item") or {}
    return {
        "hopped": sorted(item.get("hopped") or set()),
        "thumped": sorted(item.get("thumped") or set()),
    }


@app.put("/videos/{video_id}/reaction", status_code=204)
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


@app.post("/videos/{video_id}/vote", status_code=204)
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


@app.post("/uploads", response_model=UploadResponse)
def create_upload(req: UploadRequest, user: str = Depends(require_auth)) -> UploadResponse:
    if not req.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="content_type must be video/*")
    if not config.UPLOADS_BUCKET:
        raise HTTPException(status_code=500, detail="UPLOADS_BUCKET not configured")

    video_id = uuid.uuid4().hex
    filename = _safe_filename(req.filename)
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
        "visibility": _norm_visibility(req.visibility),
    }
    if req.title and req.title.strip():
        item["title"] = req.title.strip()[:200]
    if req.description and req.description.strip():
        item["description"] = req.description.strip()[:5000]
    if req.tags:
        clean = [
            t2 for t in req.tags
            if (t2 := str(t).strip().lstrip("#").lower()[:30])
        ][:8]
        if clean:
            item["tags"] = clean
    aws.videos_table().put_item(Item=item)

    return UploadResponse(video_id=video_id, upload_url=upload_url, key=key)


def _cdn_url(key: str | None) -> str | None:
    if not key or not config.CLOUDFRONT_DOMAIN:
        return None
    return f"https://{config.CLOUDFRONT_DOMAIN}/{key}"


def _to_video(item: dict) -> Video:
    return Video(
        video_id=item["video_id"],
        filename=item.get("filename") or "untitled",
        status=item.get("status") or "unknown",
        created_at=item.get("created_at") or "",
        playback_url=_cdn_url(item.get("hls_key")),
        thumbnail_url=_cdn_url(item.get("thumb_key")),
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
        has_transcript=bool(item.get("has_transcript") or False),
        transcribing=bool(item.get("transcribing") or False),
        transcript_url=_cdn_url(item.get("transcript_key")),
        captions_url=_cdn_url(item.get("vtt_key")),
        visibility=_norm_visibility(item.get("visibility")),
    )


@app.get("/videos", response_model=list[Video])
def list_videos(viewer: str | None = Depends(optional_auth)) -> list[Video]:
    # Scan is fine at portfolio scale; a GSI on created_at would be the
    # production move once the table grows
    resp = aws.videos_table().scan(Limit=100)
    items = [i for i in resp.get("Items", []) if "video_id" in i]
    # Unlisted videos are hidden from the feed for everyone except their owner
    # (and the admin). Direct links still work.
    can_see_all = bool(viewer) and is_admin(viewer)
    items = [
        i for i in items
        if _norm_visibility(i.get("visibility")) == "public"
        or can_see_all
        or (viewer is not None and i.get("owner") == viewer)
    ]
    items.sort(key=lambda i: i.get("created_at", ""), reverse=True)
    return [_to_video(item) for item in items]


@app.get("/videos/{video_id}", response_model=Video)
def get_video(video_id: str) -> Video:
    resp = aws.videos_table().get_item(Key={"video_id": video_id})
    item = resp.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="video not found")
    return _to_video(item)


@app.get("/creators/{username}", response_model=Creator)
def get_creator(username: str) -> Creator:
    """A creator's public profile: their videos, aggregate stats, and an
    "expertise" topic list built by counting tags across their own videos --
    no separate topic model needed, since tags are already curated (by the
    creator or by AI suggestion) per video."""
    from collections import Counter

    username = username.strip().lower()
    resp = aws.videos_table().scan(FilterExpression=Attr("owner").eq(username))
    videos = [
        _to_video(item)
        for item in resp.get("Items", [])
        if _norm_visibility(item.get("visibility")) == "public"
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


@app.get("/search")
def semantic_search(q: str = "") -> dict:
    """Cross-video semantic search — returns the best moment per matching video,
    each with a start time so the player can jump straight to it. Public-only."""
    q = (q or "").strip()
    if not q:
        return {"query": "", "results": []}
    from . import search as search_mod  # lazy: keeps the model off non-search paths

    results = []
    for hit in search_mod.search(q):
        item = aws.videos_table().get_item(Key={"video_id": hit["video_id"]}).get("Item")
        if not item or _norm_visibility(item.get("visibility")) != "public":
            continue
        results.append(
            {
                "video": _to_video(item),
                "start": hit["start"],
                "snippet": hit["text"],
                "score": hit["score"],
            }
        )
    return {"query": q, "results": results}


@app.post("/search/reindex")
def search_reindex(user: str = Depends(require_auth)) -> dict:
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="not allowed")
    from . import search as search_mod

    return {"indexed_chunks": search_mod.reindex_all()}


@app.post("/videos/{video_id}/ask")
def ask_video(video_id: str, body: AskRequest) -> dict:
    """Answer a question about ONE video, grounded only in its own transcript.
    Retrieval-augmented: reuses the same embedding search that powers cross-
    video search, scoped to this video, then asks Claude to answer using only
    those passages -- with citations back to the timestamp they came from."""
    item = aws.videos_table().get_item(Key={"video_id": video_id}).get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="video not found")
    if not item.get("has_transcript"):
        return {
            "answer": "This video doesn't have a transcript yet, so there's nothing to ask about.",
            "citations": [],
        }

    from . import search as search_mod

    passages = search_mod.search_within_video(video_id, body.question)
    if not passages:
        return {"answer": "No transcript is available for this video yet.", "citations": []}

    key = _anthropic_key()
    if not key:
        raise HTTPException(status_code=503, detail="AI answers unavailable")

    import anthropic

    client = anthropic.Anthropic(api_key=key)
    excerpts = "\n\n".join(f"[{p['start']:.0f}s] {p['text']}" for p in passages)
    system = (
        "You answer questions about a single video using ONLY the transcript excerpts "
        "provided below -- each tagged with its start time in seconds. Never use outside "
        "knowledge or guess at content not in the excerpts. If the excerpts don't contain "
        "the answer, say so plainly instead of guessing. Respond with ONLY a JSON object: "
        '{"answer": str, "citations": [number, ...]} where citations are the start-time '
        "seconds (as numbers) of the excerpts that support the answer."
    )
    try:
        resp = client.messages.create(
            model=config.AI_MODEL,
            max_tokens=400,
            system=system,
            messages=[
                {
                    "role": "user",
                    "content": f"Transcript excerpts:\n\n{excerpts}\n\nQuestion: {body.question}",
                }
            ],
        )
        text = "".join(b.text for b in resp.content if b.type == "text").strip()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="AI answer failed") from exc

    if "{" not in text:
        return {"answer": text[:800], "citations": []}
    raw = text[text.find("{") : text.rfind("}") + 1]
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {"answer": text[:800], "citations": []}

    answer = (data.get("answer") or "").strip()[:1200]
    cited_starts = {
        round(float(c), 2) for c in (data.get("citations") or []) if isinstance(c, (int, float))
    }
    citations = [
        {"start": p["start"], "text": p["text"][:200]}
        for p in passages
        if any(abs(p["start"] - c) < 1.0 for c in cited_starts)
    ]
    return {"answer": answer or text[:800], "citations": citations}


@app.patch("/videos/{video_id}", response_model=Video)
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
        updates["tags"] = [
            t2 for t in body.tags if (t2 := str(t).strip().lstrip("#").lower()[:30])
        ][:8]
    if body.visibility is not None:
        updates["visibility"] = _norm_visibility(body.visibility)
    if updates:
        expr = "SET " + ", ".join(f"#{k} = :{k}" for k in updates)
        aws.videos_table().update_item(
            Key={"video_id": video_id},
            UpdateExpression=expr,
            ExpressionAttributeNames={f"#{k}": k for k in updates},
            ExpressionAttributeValues={f":{k}": v for k, v in updates.items()},
        )
    return get_video(video_id)


@app.post("/videos/{video_id}/view", status_code=204)
def add_view(video_id: str) -> Response:
    aws.videos_table().update_item(
        Key={"video_id": video_id},
        UpdateExpression="ADD #v :one",
        ExpressionAttributeNames={"#v": "views"},
        ExpressionAttributeValues={":one": 1},
    )
    return Response(status_code=204)


def _delete_prefix(bucket: str, prefix: str) -> None:
    if not bucket:
        return
    paginator = aws.s3.get_paginator("list_objects_v2")
    keys: list[dict] = []
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        keys.extend({"Key": o["Key"]} for o in page.get("Contents", []))
    for i in range(0, len(keys), 1000):
        aws.s3.delete_objects(Bucket=bucket, Delete={"Objects": keys[i : i + 1000]})


def _delete_comments(video_id: str) -> None:
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


@app.delete("/videos/{video_id}", status_code=204)
def delete_video(video_id: str, user: str = Depends(require_auth)) -> Response:
    item = aws.videos_table().get_item(Key={"video_id": video_id}).get("Item")
    allowed = is_admin(user) or (item is not None and item.get("owner") == user)
    if not allowed:
        raise HTTPException(status_code=403, detail="not allowed")
    _delete_prefix(config.UPLOADS_BUCKET, f"uploads/{video_id}/")
    _delete_prefix(config.STREAMING_BUCKET, f"{video_id}/")
    _delete_comments(video_id)
    aws.videos_table().delete_item(Key={"video_id": video_id})
    return Response(status_code=204)


def _to_comment(item: dict) -> Comment:
    return Comment(
        video_id=item["video_id"],
        comment_id=item["comment_id"],
        author=item.get("author") or "someone",
        text=item.get("text") or "",
        created_at=item.get("created_at") or "",
    )


@app.get("/videos/{video_id}/comments", response_model=list[Comment])
def list_comments(video_id: str) -> list[Comment]:
    resp = aws.comments_table().query(
        KeyConditionExpression=Key("video_id").eq(video_id),
        ScanIndexForward=False,  # newest first (comment_id is timestamp-prefixed)
        Limit=200,
    )
    return [_to_comment(i) for i in resp.get("Items", [])]


@app.post("/videos/{video_id}/comments", response_model=Comment, status_code=201)
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


@app.delete("/videos/{video_id}/comments/{comment_id}", status_code=204)
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


# Lambda entrypoint
handler = Mangum(app)
