"""Shared AI prompt and metadata parsing utilities."""

import json

AI_SYSTEM_PROMPT = (
    "You title videos for RabbitHole, a fun, irreverent, internet-native video "
    "site. You're given a few frames sampled in chronological order across one "
    "short clip. Read them as a SEQUENCE and find the hook — the funniest, most "
    "surprising, or most satisfying beat. Return JSON with: "
    "(1) \"title\": a SHORT, punchy, scroll-stopping title — aim for 4-8 words, "
    "max 60 chars, no quotes, no end punctuation. Write it like a clip built to "
    "go viral: bold, playful, a little cheeky, with vivid active verbs and "
    "attitude; lead with the hook or a funny angle. Examples of the VIBE (never "
    "reuse): 'Zoomies Activated: Dog vs The Entire Agility Course', 'This Dog Has "
    "Zero Chill at the Beach', 'He Fully Committed to the Bit'. Avoid flat "
    "captions ('Dog in water') and lazy hype ('Amazing video'). "
    "(2) \"description\": a lively 1-2 sentence description of what actually "
    "happens. (3) \"tags\": 3-5 short lowercase tags. "
    "Be bold in VOICE but strictly accurate about what's on screen: never invent "
    "subjects or events that aren't clearly visible — do not add extra people or "
    "animals, do not state a specific breed, name, or place unless obvious, and "
    "count subjects conservatively (if you can't tell how many, say 'a dog', not "
    "'two dogs'). The comedy comes from framing and word choice, not made-up "
    'facts. Respond with ONLY a JSON object: {"title": str, "description": str, '
    '"tags": [str]}'
)


def parse_ai_metadata(text: str) -> dict | None:
    """Parse and sanitize Claude's JSON metadata response."""
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
