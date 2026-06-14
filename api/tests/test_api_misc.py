"""Coverage for the remaining endpoints: auth, favorites, reactions, votes,
comments, views, and delete."""

from conftest import auth, seed_video


def test_health(client):
    assert client.get("/health").status_code == 200


# ── Auth ────────────────────────────────────────────────────────────
def test_signup_then_login_then_me(client):
    r = client.post("/auth/signup", json={"username": "alice", "password": "secret123"})
    assert r.status_code == 200
    tok = r.json()["token"]
    assert r.json()["username"] == "alice"
    assert r.json()["is_admin"] is False

    r2 = client.post("/auth/login", json={"username": "alice", "password": "secret123"})
    assert r2.status_code == 200

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {tok}"})
    assert me.json() == {"username": "alice", "is_admin": False}


def test_duplicate_signup_conflicts(client):
    client.post("/auth/signup", json={"username": "dup", "password": "secret123"})
    r = client.post("/auth/signup", json={"username": "dup", "password": "secret123"})
    assert r.status_code == 409


def test_login_wrong_password(client):
    client.post("/auth/signup", json={"username": "bob", "password": "secret123"})
    r = client.post("/auth/login", json={"username": "bob", "password": "wrongpass"})
    assert r.status_code == 401


def test_cannot_signup_as_reserved_admin(client):
    # The creator name is reserved — nobody can register it to gain admin.
    r = client.post("/auth/signup", json={"username": "admin", "password": "secret123"})
    assert r.status_code == 409


def test_admin_token_is_admin(client):
    # is_admin is name-based; a token for the creator name reports admin.
    me = client.get("/auth/me", headers=auth("admin"))
    assert me.json()["is_admin"] is True


# ── Favorites ───────────────────────────────────────────────────────
def test_favorites_add_list_remove(client):
    h = auth("alice")
    assert client.get("/favorites", headers=h).json()["favorites"] == []
    client.post("/favorites/vid-9", headers=h)
    assert client.get("/favorites", headers=h).json()["favorites"] == ["vid-9"]
    client.delete("/favorites/vid-9", headers=h)
    assert client.get("/favorites", headers=h).json()["favorites"] == []


# ── Reactions (per-user) ────────────────────────────────────────────
def test_set_reaction_records_hop(client, videos_table):
    seed_video(videos_table, video_id="r1")
    client.put("/videos/r1/reaction", json={"reaction": "hop"}, headers=auth("alice"))
    assert client.get("/reactions", headers=auth("alice")).json()["hopped"] == ["r1"]


def test_set_reaction_rejects_garbage(client, videos_table):
    seed_video(videos_table, video_id="r2")
    r = client.put("/videos/r2/reaction", json={"reaction": "explode"}, headers=auth("alice"))
    assert r.status_code == 400


# ── Anonymous votes (public counters) ───────────────────────────────
def test_anonymous_vote_increments_hops(client, videos_table):
    seed_video(videos_table, video_id="v1", hops=0)
    r = client.post("/videos/v1/vote", json={"from": None, "to": "hop"})
    assert r.status_code == 204
    assert client.get("/videos/v1").json()["hops"] == 1


# ── Views ───────────────────────────────────────────────────────────
def test_add_view_increments(client, videos_table):
    seed_video(videos_table, video_id="w1", views=0)
    client.post("/videos/w1/view")
    assert client.get("/videos/w1").json()["views"] == 1


# ── Comments ────────────────────────────────────────────────────────
def test_comment_add_list_delete(client, videos_table):
    seed_video(videos_table, video_id="c1")
    r = client.post("/videos/c1/comments", json={"text": "nice clip"}, headers=auth("alice"))
    assert r.status_code == 201
    cid = r.json()["comment_id"]
    assert r.json()["author"] == "alice"

    listed = client.get("/videos/c1/comments").json()
    assert any(c["comment_id"] == cid for c in listed)

    d = client.delete(f"/videos/c1/comments/{cid}", headers=auth("alice"))
    assert d.status_code == 204


def test_comment_requires_auth(client, videos_table):
    seed_video(videos_table, video_id="c2")
    assert client.post("/videos/c2/comments", json={"text": "hi"}).status_code in (401, 403)


# ── Delete ──────────────────────────────────────────────────────────
def test_owner_can_delete_video(client, videos_table):
    seed_video(videos_table, video_id="d1", owner="alice")
    assert client.delete("/videos/d1", headers=auth("alice")).status_code == 204
    assert client.get("/videos/d1").status_code == 404


def test_non_owner_cannot_delete(client, videos_table):
    seed_video(videos_table, video_id="d2", owner="alice")
    assert client.delete("/videos/d2", headers=auth("bob")).status_code == 403
