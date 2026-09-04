"""Topics/Connections (P0) — capability derivation, topic/connection reads,
and backward compatibility with every video record that predates this model."""

from decimal import Decimal

from conftest import seed_video


# ── source_type / capabilities on existing (legacy) records ────────────────


def test_legacy_video_defaults_to_hosted_source_type(client, videos_table):
    seed_video(videos_table, video_id="legacy")  # no source_type at all
    body = client.get("/videos/legacy").json()
    assert body["source_type"] == "hosted"


def test_legacy_video_without_hls_key_is_still_hosted(client, videos_table):
    # A video mid-transcode: hosted, just not ready yet -- must NOT be
    # misclassified as "external" just because hls_key is absent.
    videos_table.put_item(
        Item={
            "video_id": "processing1",
            "filename": "clip.mp4",
            "status": "processing",
            "created_at": "2026-01-01T00:00:00+00:00",
            "visibility": "public",
        }
    )
    body = client.get("/videos/processing1").json()
    assert body["source_type"] == "hosted"
    assert body["capabilities"]["play_internal"] is False


def test_legacy_video_has_default_empty_topics(client, videos_table):
    seed_video(videos_table, video_id="legacy")
    body = client.get("/videos/legacy").json()
    assert body["topics"] == []


def test_capabilities_reflect_playable_transcribed_video(client, videos_table):
    seed_video(
        videos_table,
        video_id="v1",
        transcript_status="ready",
        has_transcript=True,
        tags=["space"],
    )
    caps = client.get("/videos/v1").json()["capabilities"]
    assert caps["play_internal"] is True
    assert caps["transcript"] is True
    assert caps["moment_search"] is True
    assert caps["ask_video"] is True
    assert caps["tunnels"] is True
    assert caps["map"] is True
    assert caps["tumble"] is True
    assert caps["embed_external"] is False
    assert caps["open_external"] is False


def test_capabilities_false_when_no_transcript_or_tags(client, videos_table):
    seed_video(videos_table, video_id="v2")  # no transcript_status, no tags
    caps = client.get("/videos/v2").json()["capabilities"]
    assert caps["transcript"] is False
    assert caps["moment_search"] is False
    assert caps["ask_video"] is False
    assert caps["tunnels"] is False
    assert caps["map"] is False


def test_capabilities_never_promise_search_without_ready_transcript(client, videos_table):
    seed_video(videos_table, video_id="v3", transcript_status="transcribing")
    caps = client.get("/videos/v3").json()["capabilities"]
    assert caps["transcript"] is False
    assert caps["moment_search"] is False


def test_content_topics_round_trip(client, videos_table):
    seed_video(
        videos_table,
        video_id="v4",
        topics=[{"topic_id": "lost-media", "relevance": Decimal("0.9"), "source": "editorial"}],
    )
    body = client.get("/videos/v4").json()
    assert body["topics"] == [{"topic_id": "lost-media", "relevance": 0.9, "source": "editorial"}]


def test_malformed_topics_entries_are_dropped_not_fatal(client, videos_table):
    seed_video(videos_table, video_id="v5", topics=["not-a-dict", {"no_topic_id": True}])
    body = client.get("/videos/v5").json()
    assert body["topics"] == []


def test_video_list_still_works_with_mixed_legacy_and_new_records(client, videos_table):
    seed_video(videos_table, video_id="old")
    seed_video(videos_table, video_id="new", source_type="hosted", topics=[])
    ids = {v["video_id"] for v in client.get("/videos").json()}
    assert ids == {"old", "new"}


# ── /topics ──────────────────────────────────────────────────────────────


def test_list_topics_empty_by_default(client):
    assert client.get("/topics").json() == []


def test_get_and_list_topics(client, topics_table):
    topics_table.put_item(
        Item={
            "slug": "lost-media",
            "topic_id": "lost-media",
            "name": "Lost Media",
            "short_description": "Media that has nearly disappeared.",
            "aliases": ["lost media"],
            "editorial_status": "published",
            "created_at": "2026-01-01T00:00:00+00:00",
        }
    )
    listed = client.get("/topics").json()
    assert len(listed) == 1
    assert listed[0]["slug"] == "lost-media"
    assert listed[0]["name"] == "Lost Media"

    fetched = client.get("/topics/lost-media").json()
    assert fetched["short_description"] == "Media that has nearly disappeared."


def test_draft_topics_excluded_from_list_but_directly_fetchable(client, topics_table):
    topics_table.put_item(
        Item={
            "slug": "draft-topic",
            "name": "Draft Topic",
            "editorial_status": "draft",
            "created_at": "2026-01-01T00:00:00+00:00",
        }
    )
    assert client.get("/topics").json() == []
    assert client.get("/topics/draft-topic").json()["slug"] == "draft-topic"


def test_get_missing_topic_404s(client):
    assert client.get("/topics/does-not-exist").status_code == 404


# ── /topics/{slug}/connections ──────────────────────────────────────────


def test_connections_empty_list_when_uncurated(client):
    # No error -- an empty list is exactly the signal the frontend uses to
    # fall back to tag co-occurrence.
    resp = client.get("/topics/some-tag/connections")
    assert resp.status_code == 200
    assert resp.json() == []


def test_connections_readable_from_either_side(client, connections_table):
    connections_table.put_item(
        Item={
            "from_topic": "early-film",
            "to_topic": "cultural-artifacts",
            "relationship_type": "historical record",
            "explanation": (
                "Early film captured ordinary life in a form that now functions "
                "as an accidental cultural time capsule."
            ),
            "strength": 3,
            "source": "editorial",
            "created_at": "2026-01-01T00:00:00+00:00",
        }
    )

    forward = client.get("/topics/early-film/connections").json()
    assert len(forward) == 1
    assert forward[0]["topic"] == "cultural-artifacts"
    assert forward[0]["relationship_type"] == "historical record"
    assert "time capsule" in forward[0]["explanation"]

    backward = client.get("/topics/cultural-artifacts/connections").json()
    assert len(backward) == 1
    assert backward[0]["topic"] == "early-film"
    assert backward[0]["relationship_type"] == "historical record"
