"""AI-assisted routes: upload metadata suggestions and per-video Q&A."""

from __future__ import annotations

import functools
import json
from fastapi import APIRouter, Depends, HTTPException

from .. import aws, config
from ..auth import require_auth
from ..helpers import clean_tags
from ..models import AskRequest, SuggestRequest

router = APIRouter()


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
    tags = clean_tags(data.get("tags"), limit=5)
    out: dict = {}
    if title:
        out["title"] = title
    if description:
        out["description"] = description
    if tags:
        out["tags"] = tags
    return out or None


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


@router.post("/ai/suggest")
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


@router.post("/videos/{video_id}/ask")
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

    from .. import search as search_mod

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
