"""Smart-thumbnail API: cache-busting URL + admin frame-picker endpoints."""

import boto3
from conftest import auth, seed_video

STREAMING = "test-streaming"


def _put_candidate(video_id: str, index: int) -> None:
    boto3.client("s3", region_name="us-east-1").put_object(
        Bucket=STREAMING, Key=f"{video_id}/thumbs/cand_{index:02d}.jpg", Body=b"jpeg",
    )


def _with_candidates(table, video_id="v1", **over):
    """A ready video that has been through smart-thumbnail selection."""
    item = seed_video(
        table,
        video_id=video_id,
        thumbnail_source="auto",
        thumbnail_timestamp="30",
        thumbnail_updated_at=1_700_000_000,
        thumbnail_auto_index=1,
        thumbnail_candidates=[
            {"i": 0, "t": "3", "score": "0.10"},
            {"i": 1, "t": "30", "score": "0.80"},
            {"i": 2, "t": "57", "score": "0.40"},
        ],
        **over,
    )
    for i in range(3):
        _put_candidate(video_id, i)
    return item


# ── cache-busting thumbnail URL ─────────────────────────────────────

def test_thumbnail_url_is_cache_busted_by_updated_at(client, videos_table):
    seed_video(videos_table, video_id="v1", thumbnail_updated_at=1_700_000_000)
    url = client.get("/videos/v1").json()["thumbnail_url"]
    assert url.endswith("/v1/thumb.jpg?v=1700000000")


def test_legacy_record_thumbnail_url_has_no_version_param(client, videos_table):
    seed_video(videos_table, video_id="v1")  # no thumbnail_updated_at
    url = client.get("/videos/v1").json()["thumbnail_url"]
    assert url.endswith("/v1/thumb.jpg")
    assert "?v=" not in url


def test_legacy_record_thumbnail_source_reads_none(client, videos_table):
    seed_video(videos_table, video_id="v1")
    body = client.get("/videos/v1").json()
    assert body["thumbnail_source"] is None
    assert body["thumbnail_timestamp"] is None


# ── candidate listing (admin only) ─────────────────────────────────

def test_candidates_require_admin(client, videos_table):
    _with_candidates(videos_table)
    assert client.get("/videos/v1/thumbnail/candidates").status_code in (401, 403)
    assert (
        client.get("/videos/v1/thumbnail/candidates", headers=auth("alice")).status_code == 403
    )


def test_candidates_list_marks_auto_and_current(client, videos_table):
    _with_candidates(videos_table)
    body = client.get("/videos/v1/thumbnail/candidates", headers=auth("admin")).json()
    assert [c["index"] for c in body["candidates"]] == [0, 1, 2]
    assert body["auto_index"] == 1
    assert body["current_index"] == 1
    auto = next(c for c in body["candidates"] if c["index"] == 1)
    assert auto["is_auto"] and auto["is_current"]
    assert auto["url"].endswith("/v1/thumbs/cand_01.jpg?v=1700000000")


# ── manual selection ───────────────────────────────────────────────

def test_admin_picks_a_manual_frame(client, videos_table):
    _with_candidates(videos_table)
    r = client.post("/videos/v1/thumbnail", json={"mode": "manual", "index": 2}, headers=auth("admin"))
    assert r.status_code == 200
    assert r.json()["thumbnail_source"] == "manual"
    item = videos_table.get_item(Key={"video_id": "v1"})["Item"]
    assert item["thumbnail_source"] == "manual"
    assert int(item["thumbnail_manual_index"]) == 2
    assert float(item["thumbnail_timestamp"]) == 57
    # thumb.jpg was replaced from the chosen candidate
    obj = boto3.client("s3", region_name="us-east-1").get_object(Bucket=STREAMING, Key="v1/thumb.jpg")
    assert obj["Body"].read() == b"jpeg"


def test_manual_selection_bumps_cache_buster(client, videos_table):
    _with_candidates(videos_table)
    before = client.get("/videos/v1").json()["thumbnail_url"]
    client.post("/videos/v1/thumbnail", json={"mode": "manual", "index": 0}, headers=auth("admin"))
    after = client.get("/videos/v1").json()["thumbnail_url"]
    assert before != after


def test_manual_selection_rejects_unknown_index(client, videos_table):
    _with_candidates(videos_table)
    r = client.post("/videos/v1/thumbnail", json={"mode": "manual", "index": 9}, headers=auth("admin"))
    assert r.status_code == 400


def test_non_admin_cannot_select(client, videos_table):
    _with_candidates(videos_table)
    r = client.post("/videos/v1/thumbnail", json={"mode": "manual", "index": 1}, headers=auth("alice"))
    assert r.status_code == 403
    assert videos_table.get_item(Key={"video_id": "v1"})["Item"]["thumbnail_source"] == "auto"


# ── auto reset ─────────────────────────────────────────────────────

def test_auto_reset_restores_automatic_choice(client, videos_table):
    _with_candidates(videos_table)
    client.post("/videos/v1/thumbnail", json={"mode": "manual", "index": 2}, headers=auth("admin"))
    r = client.post("/videos/v1/thumbnail", json={"mode": "auto"}, headers=auth("admin"))
    assert r.status_code == 200
    assert r.json()["thumbnail_source"] == "auto"
    item = videos_table.get_item(Key={"video_id": "v1"})["Item"]
    assert item["thumbnail_source"] == "auto"
    assert "thumbnail_manual_index" not in item
    assert float(item["thumbnail_timestamp"]) == 30  # back to the auto pick's timestamp


def test_select_on_video_without_candidates_409(client, videos_table):
    seed_video(videos_table, video_id="v1")  # legacy, never selected
    r = client.post("/videos/v1/thumbnail", json={"mode": "manual", "index": 0}, headers=auth("admin"))
    assert r.status_code == 409


def test_select_missing_video_404(client):
    r = client.post("/videos/nope/thumbnail", json={"mode": "auto"}, headers=auth("admin"))
    assert r.status_code == 404
