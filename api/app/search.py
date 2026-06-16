"""Cross-video semantic search over transcript chunks.

Embeddings come from a small local model (fastembed / bge-small) baked into the
image — no external API, no managed vector DB. At portfolio scale a brute-force
cosine over a few hundred chunks is instant and ~free; OpenSearch or pgvector
would be the move at a much larger corpus. Indexing is lazy and idempotent:
the first search after a new transcript embeds that video's passages and caches
the vectors in DynamoDB.
"""

from __future__ import annotations

import base64
import functools
import json
import struct

from boto3.dynamodb.conditions import Attr, Key

from . import aws, config


# ── Embedding model (lazy: never loaded by tests or non-search calls) ──
@functools.lru_cache(maxsize=1)
def _model():
    from fastembed import TextEmbedding

    return TextEmbedding(model_name=config.EMBED_MODEL, cache_dir=config.EMBED_CACHE_DIR)


def _embed(texts: list[str]) -> list[list[float]]:
    return [list(map(float, v)) for v in _model().embed(texts)]


# ── Vector (de)serialization — compact float32 blob in a String attr ───
def pack_vector(vec: list[float]) -> str:
    return base64.b64encode(struct.pack(f"{len(vec)}f", *vec)).decode()


def unpack_vector(blob: str) -> list[float]:
    raw = base64.b64decode(blob)
    return list(struct.unpack(f"{len(raw) // 4}f", raw))


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(y * y for y in b) ** 0.5
    return dot / (na * nb) if na and nb else 0.0


# ── Chunking: group caption cues into searchable passages ──────────────
def chunk_cues(cues: list[dict], max_chars: int = 350) -> list[dict]:
    """Group consecutive cues into ~few-sentence passages, each tagged with the
    start time of its first cue so a hit can jump straight to the moment."""
    passages: list[dict] = []
    buf: list[str] = []
    start: float | None = None
    for c in cues:
        text = (c.get("text") or "").strip()
        if not text:
            continue
        if start is None:
            start = float(c.get("start") or 0.0)
        buf.append(text)
        if sum(len(t) for t in buf) >= max_chars:
            passages.append({"start": start, "text": " ".join(buf)})
            buf, start = [], None
    if buf:
        passages.append({"start": start or 0.0, "text": " ".join(buf)})
    return passages


# ── Indexing ───────────────────────────────────────────────────────────
def _load_cues(video_id: str) -> list[dict]:
    try:
        obj = aws.s3.get_object(Bucket=config.STREAMING_BUCKET, Key=f"{video_id}/cues.json")
        data = json.loads(obj["Body"].read())
        return data if isinstance(data, list) else []
    except Exception as exc:  # noqa: BLE001
        print(f"could not load cues for {video_id}: {exc}")
        return []


def _is_indexed(video_id: str) -> bool:
    r = aws.embeddings_table().query(KeyConditionExpression=Key("video_id").eq(video_id), Limit=1)
    return r.get("Count", 0) > 0


def index_video(video_id: str) -> int:
    """Embed a video's transcript passages and upsert them. Idempotent."""
    passages = chunk_cues(_load_cues(video_id))
    if not passages:
        return 0
    vectors = _embed([p["text"] for p in passages])
    table = aws.embeddings_table()
    with table.batch_writer() as bw:
        for i, (p, vec) in enumerate(zip(passages, vectors)):
            bw.put_item(
                Item={
                    "video_id": video_id,
                    "chunk": f"{i:04d}",
                    "start": str(round(p["start"], 2)),
                    "text": p["text"][:500],
                    "vector": pack_vector(vec),
                }
            )
    return len(passages)


def _ensure_indexed() -> None:
    """Index any ready video that has a transcript but no chunks yet."""
    resp = aws.videos_table().scan(
        FilterExpression=Attr("has_transcript").eq(True),
        ProjectionExpression="video_id",
    )
    for item in resp.get("Items", []):
        vid = item.get("video_id")
        if vid and not _is_indexed(vid):
            try:
                n = index_video(vid)
                print(f"indexed {vid}: {n} chunks")
            except Exception as exc:  # noqa: BLE001
                print(f"index failed for {vid}: {exc}")


def reindex_all() -> int:
    """Force a rebuild of every transcript's embeddings (admin/backfill)."""
    resp = aws.videos_table().scan(
        FilterExpression=Attr("has_transcript").eq(True),
        ProjectionExpression="video_id",
    )
    return sum(index_video(i["video_id"]) for i in resp.get("Items", []) if i.get("video_id"))


# ── Search ─────────────────────────────────────────────────────────────
def _all_chunks() -> list[dict]:
    table = aws.embeddings_table()
    resp = table.scan()
    items = resp.get("Items", [])
    while "LastEvaluatedKey" in resp:
        resp = table.scan(ExclusiveStartKey=resp["LastEvaluatedKey"])
        items += resp.get("Items", [])
    return items


def search(query: str, k: int = 12) -> list[dict]:
    """Top moments across the library — the single best moment per video."""
    _ensure_indexed()
    qv = _embed([query])[0]

    scored = sorted(
        ((cosine(qv, unpack_vector(it["vector"])), it) for it in _all_chunks()),
        key=lambda x: x[0],
        reverse=True,
    )

    results: list[dict] = []
    seen: set[str] = set()
    for score, it in scored:
        vid = it["video_id"]
        if vid in seen:
            continue
        seen.add(vid)
        results.append(
            {
                "video_id": vid,
                "start": float(it.get("start") or 0.0),
                "text": it.get("text", ""),
                "score": round(score, 4),
            }
        )
        if len(results) >= k:
            break
    return results
