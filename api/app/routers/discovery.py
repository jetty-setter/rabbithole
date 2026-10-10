"""Cross-video transcript search."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from .. import aws
from ..auth import is_admin, require_auth
from ..helpers import norm_visibility
from ..serializers import to_video

router = APIRouter()


@router.get("/search")
def semantic_search(q: str = "") -> dict:
    """Cross-video semantic search — returns the best moment per matching video,
    each with a start time so the player can jump straight to it. Public-only."""
    q = (q or "").strip()
    if not q:
        return {"query": "", "results": []}
    from .. import search as search_mod  # lazy: keeps the model off non-search paths

    results = []
    for hit in search_mod.search(q):
        item = aws.videos_table().get_item(Key={"video_id": hit["video_id"]}).get("Item")
        if not item or norm_visibility(item.get("visibility")) != "public":
            continue
        results.append(
            {
                "video": to_video(item),
                "start": hit["start"],
                "snippet": hit["text"],
                "score": hit["score"],
                "match_type": hit["match_type"],
            }
        )
    return {"query": q, "results": results}


@router.post("/search/reindex")
def search_reindex(user: str = Depends(require_auth)) -> dict:
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="not allowed")
    from .. import search as search_mod

    return {"indexed_chunks": search_mod.reindex_all()}
