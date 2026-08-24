"""End-to-end-ish API tests against a moto-faked AWS backend."""

from conftest import auth, seed_video


def test_feed_hides_unlisted_from_anonymous(client, videos_table):
    seed_video(videos_table, video_id="pub", visibility="public")
    seed_video(videos_table, video_id="unl", visibility="unlisted", owner="alice")

    ids = {v["video_id"] for v in client.get("/videos").json()}
    assert ids == {"pub"}


def test_feed_shows_owner_their_own_unlisted(client, videos_table):
    seed_video(videos_table, video_id="pub", visibility="public")
    seed_video(videos_table, video_id="unl", visibility="unlisted", owner="alice")

    ids = {v["video_id"] for v in client.get("/videos", headers=auth("alice")).json()}
    assert ids == {"pub", "unl"}  # alice sees her own unlisted


def test_feed_hides_other_users_unlisted(client, videos_table):
    seed_video(videos_table, video_id="unl", visibility="unlisted", owner="alice")

    ids = {v["video_id"] for v in client.get("/videos", headers=auth("bob")).json()}
    assert ids == set()  # bob can't see alice's unlisted


def test_admin_sees_all_unlisted(client, videos_table):
    seed_video(videos_table, video_id="unl", visibility="unlisted", owner="alice")

    ids = {v["video_id"] for v in client.get("/videos", headers=auth("admin")).json()}
    assert ids == {"unl"}


def test_legacy_record_without_visibility_is_public(client, videos_table):
    # A record predating the visibility feature has no `visibility` attribute.
    videos_table.put_item(
        Item={
            "video_id": "legacy",
            "filename": "old.mp4",
            "status": "ready",
            "created_at": "2025-01-01T00:00:00+00:00",
            "hls_key": "legacy/hls/master.m3u8",
        }
    )
    body = client.get("/videos").json()
    assert body[0]["video_id"] == "legacy"
    assert body[0]["visibility"] == "public"


def test_unlisted_direct_link_still_works(client, videos_table):
    seed_video(videos_table, video_id="unl", visibility="unlisted", owner="alice")
    # get_video is intentionally open — "unlisted", not "private".
    r = client.get("/videos/unl")
    assert r.status_code == 200
    assert r.json()["video_id"] == "unl"


def test_get_missing_video_404(client):
    assert client.get("/videos/nope").status_code == 404


def test_create_upload_defaults_public(client, videos_table):
    r = client.post(
        "/uploads",
        json={"filename": "my clip.mp4", "content_type": "video/mp4"},
        headers=auth("alice"),
    )
    assert r.status_code == 200
    vid = r.json()["video_id"]
    item = videos_table.get_item(Key={"video_id": vid}).get("Item")
    assert item["owner"] == "alice"
    assert item["visibility"] == "public"
    assert "upload_url" in r.json()


def test_create_upload_unlisted(client, videos_table):
    r = client.post(
        "/uploads",
        json={"filename": "draft.mp4", "content_type": "video/mp4", "visibility": "unlisted"},
        headers=auth("alice"),
    )
    vid = r.json()["video_id"]
    item = videos_table.get_item(Key={"video_id": vid}).get("Item")
    assert item["visibility"] == "unlisted"


def test_create_upload_rejects_non_video(client):
    r = client.post(
        "/uploads",
        json={"filename": "x.txt", "content_type": "text/plain"},
        headers=auth("alice"),
    )
    assert r.status_code == 400


def test_create_upload_requires_auth(client):
    assert client.post("/uploads", json={"filename": "x.mp4"}).status_code in (401, 403)


def test_owner_can_toggle_visibility(client, videos_table):
    seed_video(videos_table, video_id="v", visibility="public", owner="alice")
    r = client.patch("/videos/v", json={"visibility": "unlisted"}, headers=auth("alice"))
    assert r.status_code == 200
    assert r.json()["visibility"] == "unlisted"


def test_non_owner_cannot_edit(client, videos_table):
    seed_video(videos_table, video_id="v", visibility="public", owner="alice")
    r = client.patch("/videos/v", json={"visibility": "unlisted"}, headers=auth("bob"))
    assert r.status_code == 403


def test_invalid_visibility_normalizes_to_public(client, videos_table):
    seed_video(videos_table, video_id="v", visibility="public", owner="alice")
    r = client.patch("/videos/v", json={"visibility": "haxor"}, headers=auth("alice"))
    assert r.json()["visibility"] == "public"


# ── /creators/{username} ──────────────────────────────────────────────
def test_creator_profile_aggregates_stats_and_topics(client, videos_table):
    seed_video(
        videos_table,
        video_id="v1",
        owner="alice",
        views=10,
        hops=3,
        tags=["dogs", "beach"],
        created_at="2026-01-01T00:00:00+00:00",
    )
    seed_video(
        videos_table,
        video_id="v2",
        owner="alice",
        views=5,
        hops=2,
        tags=["dogs"],
        created_at="2026-01-02T00:00:00+00:00",
    )
    r = client.get("/creators/alice")
    assert r.status_code == 200
    body = r.json()
    assert body["video_count"] == 2
    assert body["total_views"] == 15
    assert body["total_hops"] == 5
    assert body["topics"][0] == {"tag": "dogs", "count": 2}
    # Most-recent video first.
    assert [v["video_id"] for v in body["videos"]] == ["v2", "v1"]


def test_creator_profile_excludes_unlisted_and_other_owners(client, videos_table):
    seed_video(videos_table, video_id="pub", owner="alice", visibility="public")
    seed_video(videos_table, video_id="unl", owner="alice", visibility="unlisted")
    seed_video(videos_table, video_id="bobs", owner="bob", visibility="public")
    body = client.get("/creators/alice").json()
    assert [v["video_id"] for v in body["videos"]] == ["pub"]


def test_creator_profile_not_found(client):
    assert client.get("/creators/nobody").status_code == 404


def test_creator_profile_uses_username_case_insensitively(client, videos_table):
    seed_video(videos_table, video_id="v1", owner="alice", visibility="public")
    assert client.get("/creators/ALICE").json()["username"] == "alice"
