"""External / Discovery content tier.

Covers provider URL parsing, capability derivation for every
(source_type x transcript) combination, that an imported external
transcript flows through the *same* search/embedding path as a hosted
one, and that existing hosted behaviour is unchanged.
"""

import json

import boto3

from app import providers
from app import search as search_mod
from conftest import auth, seed_video


# ── 1. YouTube URL normalization ────────────────────────────────────────


def test_youtube_id_from_every_common_form():
    vid = "dQw4w9WgXcQ"
    for url in (
        f"https://www.youtube.com/watch?v={vid}",
        f"https://youtube.com/watch?v={vid}&t=42s",
        f"https://youtu.be/{vid}",
        f"https://www.youtube.com/embed/{vid}",
        f"https://youtube.com/shorts/{vid}",
        f"https://m.youtube.com/watch?v={vid}",
        f"youtube.com/watch?v={vid}",
        vid,
    ):
        assert providers.parse_youtube_id(url) == vid, url


def test_non_youtube_and_junk_return_none():
    assert providers.parse_youtube_id("https://vimeo.com/12345") is None
    assert providers.parse_youtube_id("https://example.com/watch?v=short") is None
    assert providers.parse_youtube_id("not a url") is None
    assert providers.parse_youtube_id("") is None


def test_resolve_external_youtube_derives_safe_embed():
    r = providers.resolve_external("https://youtu.be/dQw4w9WgXcQ")
    assert r["provider"] == "youtube"
    assert r["provider_id"] == "dQw4w9WgXcQ"
    assert r["embed_url"].startswith("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")
    assert r["source_url"] == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


def test_resolve_external_generic_keeps_url_no_embed():
    r = providers.resolve_external("https://archive.org/details/some-film")
    assert r["provider"] == "generic"
    assert r["embed_url"] is None
    assert r["source_url"] == "https://archive.org/details/some-film"


def test_resolve_external_youtube_claimed_but_invalid_raises():
    import pytest

    with pytest.raises(ValueError):
        providers.resolve_external("https://example.com/nope", provider="youtube")


# ── 2-4. Capability derivation ──────────────────────────────────────────


def _caps(client, video_id):
    return client.get(f"/videos/{video_id}").json()["capabilities"]


def test_capabilities_indexed_content_unchanged(client, videos_table):
    seed_video(videos_table, video_id="hosted1", transcript_status="ready",
               has_transcript=True, tags=["space"])
    c = _caps(client, "hosted1")
    assert c["play_internal"] and c["watch"]
    assert c["transcript"] and c["moment_search"] and c["ask_video"] and c["seek"]
    assert c["tunnels"] and c["map"] and c["tumble"]
    assert not c["embed_external"] and not c["open_external"]


def test_capabilities_external_youtube_without_transcript(client, videos_table):
    videos_table.put_item(Item={
        "video_id": "ytnotx", "status": "ready", "visibility": "public",
        "source_type": "external", "provider": "youtube",
        "provider_id": "dQw4w9WgXcQ",
        "embed_url": "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?enablejsapi=1",
        "source_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "tags": ["music"], "created_at": "2026-01-01T00:00:00+00:00",
    })
    c = _caps(client, "ytnotx")
    assert c["embed_external"] and c["watch"] and c["tumble"]
    assert not c["play_internal"] and not c["open_external"]
    # No transcript -> none of the transcript-derived capabilities.
    assert not c["transcript"] and not c["moment_search"]
    assert not c["ask_video"] and not c["seek"]
    assert c["tunnels"] and c["map"]  # tags still make it a topic node


def test_capabilities_external_generic_link_only(client, videos_table):
    videos_table.put_item(Item={
        "video_id": "genlink", "status": "ready", "visibility": "public",
        "source_type": "external", "provider": "generic",
        "source_url": "https://archive.org/details/x", "tags": ["history"],
        "created_at": "2026-01-01T00:00:00+00:00",
    })
    c = _caps(client, "genlink")
    assert c["open_external"] and c["watch"] and c["tumble"]
    assert not c["embed_external"] and not c["play_internal"]
    assert not c["seek"]


def test_capabilities_external_with_transcript(client, videos_table):
    videos_table.put_item(Item={
        "video_id": "ytx", "status": "ready", "visibility": "public",
        "source_type": "external", "provider": "youtube", "provider_id": "abcdefghijk",
        "embed_url": "https://www.youtube-nocookie.com/embed/abcdefghijk?enablejsapi=1",
        "source_url": "https://www.youtube.com/watch?v=abcdefghijk",
        "has_transcript": True, "transcript_status": "ready",
        "transcript_source": "imported", "transcript_timed": True,
        "transcript_key": "ytx/cues.json", "vtt_key": "ytx/captions.vtt",
        "tags": ["science"], "created_at": "2026-01-01T00:00:00+00:00",
    })
    body = client.get("/videos/ytx").json()
    c = body["capabilities"]
    assert body["source_type"] == "external"
    assert body["transcript_source"] == "imported"
    assert c["embed_external"] and c["watch"]
    assert c["transcript"] and c["moment_search"] and c["ask_video"]
    assert c["seek"]  # timed transcript + embeddable player


def test_capabilities_external_text_only_transcript_has_no_seek(client, videos_table):
    videos_table.put_item(Item={
        "video_id": "ytxtxt", "status": "ready", "visibility": "public",
        "source_type": "external", "provider": "youtube", "provider_id": "abcdefghijk",
        "embed_url": "https://www.youtube-nocookie.com/embed/abcdefghijk?enablejsapi=1",
        "has_transcript": True, "transcript_status": "ready",
        "transcript_source": "imported", "transcript_timed": False,
        "tags": ["science"], "created_at": "2026-01-01T00:00:00+00:00",
    })
    c = _caps(client, "ytxtxt")
    assert c["transcript"] and c["moment_search"] and c["ask_video"]
    assert not c["seek"]  # every cue is at 0:00


# ── POST /external ─────────────────────────────────────────────────────


def test_create_external_youtube_requires_admin(client):
    r = client.post("/external", json={
        "source_url": "https://youtu.be/dQw4w9WgXcQ", "title": "x",
    }, headers=auth("alice"))
    assert r.status_code == 403


def test_create_external_youtube_gets_embed_behavior(client, videos_table):
    r = client.post("/external", json={
        "source_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "title": "Test Clip", "creator": "Test Channel", "tags": ["Test Tag"],
    }, headers=auth("admin"))
    assert r.status_code == 201
    body = r.json()
    assert body["source_type"] == "external"
    assert body["provider"] == "youtube"
    assert body["provider_id"] == "dQw4w9WgXcQ"
    assert body["embed_url"].startswith("https://www.youtube-nocookie.com/embed/")
    assert body["capabilities"]["embed_external"] is True
    assert body["capabilities"]["watch"] is True
    assert body["tags"] == ["test-tag"]
    assert body["thumbnail_url"]  # provider default poster
    assert body["source_name"] == "Test Channel"
    # 11. appears in the feed like any other content
    assert "external1" or body["video_id"] in {v["video_id"] for v in client.get("/videos").json()}


def test_create_external_generic_gets_source_link_behavior(client):
    r = client.post("/external", json={
        "source_url": "https://archive.org/details/prelinger-film",
        "title": "Archive Film", "creator": "Prelinger",
    }, headers=auth("admin"))
    assert r.status_code == 201
    body = r.json()
    assert body["provider"] == "generic"
    assert body["embed_url"] is None
    assert body["source_url"] == "https://archive.org/details/prelinger-film"
    assert body["capabilities"]["open_external"] is True
    assert body["capabilities"]["embed_external"] is False


# ── 5-7. External transcript flows through the normal pipeline ──────────


def test_external_imported_transcript_enters_normal_pipeline(client, videos_table):
    r = client.post("/external", json={
        "source_url": "https://youtu.be/abcdefghijk",
        "title": "Narrated Doc", "creator": "Doc Co",
        "transcript_source": "imported",
        "transcript_segments": [
            {"start": 0.0, "end": 4.0, "text": "The signal came from deep space."},
            {"start": 4.0, "end": 9.0, "text": "Nobody could explain the pattern."},
        ],
    }, headers=auth("admin"))
    assert r.status_code == 201
    vid = r.json()["video_id"]

    # cues.json written to the SAME key a hosted transcribe job uses
    s3 = boto3.client("s3", region_name="us-east-1")
    cues = json.loads(s3.get_object(Bucket="test-streaming", Key=f"{vid}/cues.json")["Body"].read())
    assert [c["text"] for c in cues] == [
        "The signal came from deep space.", "Nobody could explain the pattern."
    ]
    body = client.get(f"/videos/{vid}").json()
    assert body["has_transcript"] is True
    assert body["transcript_status"] == "ready"
    assert body["transcript_source"] == "imported"
    assert body["capabilities"]["seek"] is True


def test_semantic_search_includes_external_with_transcript_excludes_without(
    client, videos_table, monkeypatch
):
    monkeypatch.setattr(search_mod, "_model", lambda: _FakeModel())

    # external WITH an imported transcript about "snow"
    client.post("/external", json={
        "source_url": "https://youtu.be/snowsnowsno",
        "title": "Blizzard footage", "creator": "WX",
        "transcript_source": "imported",
        "transcript_segments": [{"start": 0.0, "end": 5.0, "text": "snow snow snow everywhere"}],
    }, headers=auth("admin"))
    # external WITHOUT a transcript, also tagged/titled "snow"
    client.post("/external", json={
        "source_url": "https://youtu.be/nottranscpt",
        "title": "snow snow snow", "creator": "WX", "tags": ["snow"],
    }, headers=auth("admin"))

    results = client.get("/search?q=snow").json()["results"]
    titles = {r["video"]["title"] for r in results}
    assert "Blizzard footage" in titles          # transcript -> searchable
    assert "snow snow snow" not in titles        # no transcript -> not a spoken match


# ── 8. Topic / feed aggregation ───────────────────────────────────────


def test_external_participates_in_feed_and_tag_aggregation(client, videos_table):
    seed_video(videos_table, video_id="hosted1", tags=["space", "nasa"])
    client.post("/external", json={
        "source_url": "https://youtu.be/dQw4w9WgXcQ", "title": "Ext",
        "creator": "C", "tags": ["space", "orbit"],
    }, headers=auth("admin"))

    feed = client.get("/videos").json()
    tags_seen = {t for v in feed for t in (v.get("tags") or [])}
    assert {"space", "nasa", "orbit"} <= tags_seen
    # the external item is a first-class feed row
    assert any(v["source_type"] == "external" for v in feed)


# ── 9. Tumble eligibility / 15. hosted unchanged ──────────────────────


def test_tumble_capability_true_for_public_watchable_external(client):
    body = client.post("/external", json={
        "source_url": "https://youtu.be/dQw4w9WgXcQ", "title": "T", "creator": "C",
    }, headers=auth("admin")).json()
    assert body["capabilities"]["tumble"] is True


def test_external_can_be_featured(client):
    body = client.post("/external", json={
        "source_url": "https://youtu.be/dQw4w9WgXcQ", "title": "F", "creator": "C",
    }, headers=auth("admin")).json()
    r = client.put(f"/videos/{body['video_id']}/featured", json={"featured": True},
                   headers=auth("admin"))
    assert r.status_code == 200
    assert r.json()["featured"] is True


def test_hosted_video_capabilities_and_shape_unchanged(client, videos_table):
    seed_video(videos_table, video_id="h", transcript_status="ready", has_transcript=True,
               tags=["x"])
    body = client.get("/videos/h").json()
    assert body["source_type"] == "hosted"
    assert body["provider"] is None and body["source_url"] is None
    assert body["transcript_source"] == "transcribe"
    assert body["playback_url"].endswith("h/hls/master.m3u8")


def test_ask_video_reaches_search_path_for_external_with_transcript(
    client, videos_table, monkeypatch
):
    monkeypatch.setattr(search_mod, "_model", lambda: _FakeModel())
    vid = client.post("/external", json={
        "source_url": "https://youtu.be/abcdefghijk", "title": "Q", "creator": "C",
        "transcript_source": "imported",
        "transcript_segments": [{"start": 0.0, "end": 5.0, "text": "the valley was buried in snow"}],
    }, headers=auth("admin")).json()["video_id"]
    r = client.post(f"/videos/{vid}/ask", json={"question": "what buried the valley?"})
    # transcript exists -> it must reach the (keyless) Claude call and 503,
    # NOT return the "no transcript yet" fallback.
    assert r.status_code == 503


class _FakeModel:
    def embed(self, texts):
        out = []
        for t in texts:
            t = t.lower()
            out.append([float(t.count("snow")), float(t.count("spy")), 0.001])
        return out
