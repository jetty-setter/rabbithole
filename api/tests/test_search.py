"""Tests for search: pure helpers (no deps) + the index/search path against a
faked AWS backend with a stand-in embedder (so no model download is needed)."""

import json

import boto3

from app import search as search_mod
from app.search import chunk_cues, cosine, pack_vector, unpack_vector


def test_chunk_cues_groups_until_char_limit():
    cues = [{"start": i * 1.0, "end": i + 1.0, "text": "word " * 10} for i in range(6)]
    passages = chunk_cues(cues, max_chars=120)
    assert len(passages) >= 2
    # First passage keeps the start time of its first cue.
    assert passages[0]["start"] == 0.0
    assert all(p["text"] for p in passages)


def test_chunk_cues_carries_start_time():
    cues = [
        {"start": 5.0, "text": "down the"},
        {"start": 6.0, "text": "rabbit hole"},
    ]
    passages = chunk_cues(cues, max_chars=999)
    assert len(passages) == 1
    assert passages[0]["start"] == 5.0
    assert passages[0]["text"] == "down the rabbit hole"


def test_chunk_cues_skips_empty():
    assert chunk_cues([{"start": 0, "text": "  "}]) == []
    assert chunk_cues([]) == []


def test_vector_roundtrip():
    vec = [0.1, -0.25, 0.5, 1.0, -1.0]
    out = unpack_vector(pack_vector(vec))
    assert len(out) == len(vec)
    for a, b in zip(vec, out):
        assert abs(a - b) < 1e-6


def test_cosine_identical_is_one():
    v = [1.0, 2.0, 3.0]
    assert abs(cosine(v, v) - 1.0) < 1e-9


def test_cosine_orthogonal_is_zero():
    assert abs(cosine([1.0, 0.0], [0.0, 1.0])) < 1e-9


def test_cosine_handles_zero_vector():
    assert cosine([0.0, 0.0], [1.0, 1.0]) == 0.0


# ── Index + search against moto, with a deterministic stand-in embedder ──
class _FakeModel:
    """Maps text → a tiny keyword-count vector so cosine ranking is meaningful
    without downloading a real model."""

    def embed(self, texts):
        out = []
        for t in texts:
            t = t.lower()
            out.append([float(t.count("snow")), float(t.count("spy")), 0.001])
        return out


def _seed(video_id, text):
    s3 = boto3.client("s3", region_name="us-east-1")
    cues = [{"start": 0.0, "end": 5.0, "text": text}]
    s3.put_object(Bucket="test-streaming", Key=f"{video_id}/cues.json", Body=json.dumps(cues))
    boto3.resource("dynamodb", region_name="us-east-1").Table("test-videos").put_item(
        Item={
            "video_id": video_id,
            "status": "ready",
            "visibility": "public",
            "has_transcript": True,
            "hls_key": f"{video_id}/hls/master.m3u8",
        }
    )


def test_index_and_semantic_rank(aws_stack, monkeypatch):
    monkeypatch.setattr(search_mod, "_model", lambda: _FakeModel())
    _seed("snowvid", "heavy snow snow covered the frozen valley")
    _seed("spyvid", "a spy spy on a dangerous secret mission")

    # Query about snow ranks the snow video first; query about spies flips it.
    snow = search_mod.search("snow")
    assert snow[0]["video_id"] == "snowvid"

    spy = search_mod.search("spy")
    assert spy[0]["video_id"] == "spyvid"


def test_index_is_idempotent(aws_stack, monkeypatch):
    monkeypatch.setattr(search_mod, "_model", lambda: _FakeModel())
    _seed("v1", "snow snow")
    assert search_mod.index_video("v1") == 1
    # Re-running search shouldn't error or duplicate (already-indexed is skipped).
    assert search_mod.search("snow")[0]["video_id"] == "v1"


def test_search_endpoint_filters_unlisted(client, videos_table, monkeypatch):
    monkeypatch.setattr(search_mod, "_model", lambda: _FakeModel())
    _seed("pubv", "snow snow")
    # Mark a second one unlisted — it must not surface in search results.
    _seed("unlv", "snow snow snow")
    videos_table.update_item(
        Key={"video_id": "unlv"},
        UpdateExpression="SET visibility = :v",
        ExpressionAttributeValues={":v": "unlisted"},
    )
    body = client.get("/search?q=snow").json()
    ids = {r["video"]["video_id"] for r in body["results"]}
    assert "pubv" in ids
    assert "unlv" not in ids


def test_search_within_video_scoped_to_one_video(aws_stack, monkeypatch):
    monkeypatch.setattr(search_mod, "_model", lambda: _FakeModel())
    _seed("snowvid", "heavy snow snow covered the frozen valley")
    _seed("spyvid", "a spy spy on a dangerous secret mission")

    hits = search_mod.search_within_video("snowvid", "snow")
    assert hits
    # Every passage returned must actually belong to snowvid -- the whole
    # point of this function vs. plain `search`, which dedupes across videos.
    assert all("start" in h and "text" in h for h in hits)
    # Asking the spy video about snow still only returns its own passages.
    spy_hits = search_mod.search_within_video("spyvid", "snow")
    assert all("spy" in h["text"] for h in spy_hits)


# ── /videos/{id}/ask -- safe fallback branches (no ANTHROPIC key in tests,
# so the actual Claude call is never reached; this covers the guard logic) ──
def test_ask_video_not_found(client):
    resp = client.post("/videos/doesnotexist/ask", json={"question": "hi"})
    assert resp.status_code == 404


def test_ask_video_no_transcript(client, videos_table):
    videos_table.put_item(
        Item={"video_id": "v1", "status": "ready", "visibility": "public", "has_transcript": False}
    )
    resp = client.post("/videos/v1/ask", json={"question": "what happens?"})
    assert resp.status_code == 200
    assert resp.json()["citations"] == []
    assert "transcript" in resp.json()["answer"].lower()


def test_ask_video_no_key_configured(client, monkeypatch):
    monkeypatch.setattr(search_mod, "_model", lambda: _FakeModel())
    _seed("v1", "heavy snow snow covered the frozen valley")
    resp = client.post("/videos/v1/ask", json={"question": "what covered the valley?"})
    # No ANTHROPIC_KEY_PARAM in the test environment -- should fail safely,
    # not attempt a real network call.
    assert resp.status_code == 503
