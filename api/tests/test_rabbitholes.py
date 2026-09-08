"""RabbitHole V1 backend — end-to-end coverage (moto-backed).

Covers the access patterns and publish-gate rules from
docs/RABBITHOLE_SCHEMA.md.
"""

import pytest
from conftest import auth

# ── fixtures / helpers ───────────────────────────────────────────────

ADMIN = auth("admin")
STRANGER = auth("someone")


def _draft(client, slug="why-x", title="Why X"):
    r = client.post(
        "/rabbitholes", json={"title": title, "slug": slug, "subtitle": "A plain subtitle."}, headers=ADMIN
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


HOOK = " ".join(["hook"] * 55)
SHORT = " ".join(["short"] * 80)


def _wk(n=4):
    return [{"text": f"Established fact number {i}.", "citations": ["s1"]} for i in range(n)]


def _sources(n=6):
    return [
        {"type": "primary", "title": f"Source {i}", "url": f"https://example.com/{i}"}
        for i in range(n)
    ]


def _publishable_patch():
    return {
        "hook": HOOK,
        "short_version": SHORT,
        "what_we_know": _wk(4),
        "sources": _sources(6),
    }


@pytest.fixture
def targets(client):
    """Three published 'filler' RabbitHoles, and the 3-connection list a
    RabbitHole under test can use to satisfy the Keep Digging gate.

    The fillers connect to each other in a ring; the first publishes with
    `unpublished_target` warnings (which don't block), so no bootstrap
    problem.
    """
    ids = [_draft(client, slug=f"filler-{i}", title=f"Filler {i}") for i in range(3)]
    for i, sid in enumerate(ids):
        others = [ids[j] for j in range(3) if j != i]
        conns = [
            {"destination_id": others[0], "relationship_type": "involved",
             "why_care": "One filler leads to another that matters to you here."},
            {"destination_id": others[1], "relationship_type": "same-kind-of-thing",
             "why_care": "A sibling filler case worth a look right about now."},
            {"destination_stub": {"title": f"Filler stub {i}", "planned_slug": f"filler-stub-{i}"},
             "relationship_type": "bigger-picture",
             "why_care": "Context that becomes interesting once this idea lands."},
        ]
        client.patch(f"/rabbitholes/{sid}", json=_publishable_patch(), headers=ADMIN)
        client.put(f"/rabbitholes/{sid}/connections", json=conns, headers=ADMIN)
    for sid in ids:
        r = client.post(f"/rabbitholes/{sid}:publish", headers=ADMIN)
        assert r.status_code == 200, r.text
    return [
        {"destination_id": ids[0], "relationship_type": "involved",
         "why_care": "Because you now understand this, that becomes clearer."},
        {"destination_id": ids[1], "relationship_type": "same-kind-of-thing",
         "why_care": "A sibling case that shows the same pattern playing out."},
        {"destination_id": ids[2], "relationship_type": "bigger-picture",
         "why_care": "The larger context this particular story sits inside."},
    ]


# ── create / list / visibility ──────────────────────────────────────


def test_list_empty(client):
    assert client.get("/rabbitholes").json() == {"items": [], "next_cursor": None}


def test_create_draft_defaults(client):
    r = client.post(
        "/rabbitholes",
        json={"title": "Why Airplane Windows Are Round", "slug": "why-airplane-windows-are-round"},
        headers=ADMIN,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "draft"
    assert body["schema_version"] == 1
    assert body["lang"] == "en"
    assert body["origin"] == "editorial"
    assert body["revision"] == 1
    assert body["created_by"] == "admin"


def test_create_requires_admin(client):
    r = client.post("/rabbitholes", json={"title": "x", "slug": "x"}, headers=STRANGER)
    assert r.status_code == 403
    r = client.post("/rabbitholes", json={"title": "x", "slug": "x"})
    assert r.status_code == 401


def test_duplicate_slug_rejected(client):
    _draft(client, slug="dupe")
    r = client.post("/rabbitholes", json={"title": "other", "slug": "dupe"}, headers=ADMIN)
    assert r.status_code == 409


def test_invalid_slug_rejected(client):
    r = client.post("/rabbitholes", json={"title": "x", "slug": "Not A Slug"}, headers=ADMIN)
    assert r.status_code == 400


def test_draft_not_publicly_visible(client):
    _draft(client, slug="hidden")
    assert client.get("/rabbitholes/hidden").status_code == 404
    # admin can see it
    assert client.get("/rabbitholes/hidden", headers=ADMIN).status_code == 200
    assert client.get("/rabbitholes").json()["items"] == []


def test_slug_rename_transaction(client):
    rid = _draft(client, slug="old-slug")
    r = client.patch(f"/rabbitholes/{rid}", json={"slug": "new-slug"}, headers=ADMIN)
    assert r.status_code == 200
    assert r.json()["slug"] == "new-slug"
    # old slug is free again
    r = client.post("/rabbitholes", json={"title": "reuse", "slug": "old-slug"}, headers=ADMIN)
    assert r.status_code == 201
    # new slug is taken
    r = client.post("/rabbitholes", json={"title": "clash", "slug": "new-slug"}, headers=ADMIN)
    assert r.status_code == 409


# ── publish gate ────────────────────────────────────────────────────


def test_publish_gate_reports_all_failures(client):
    rid = _draft(client, slug="bare")
    r = client.post(f"/admin/rabbitholes/{rid}:validate", headers=ADMIN)
    assert r.status_code == 200
    codes = {i["code"] for i in r.json()["failures"]}
    assert {"hook.missing", "short_version.missing", "what_we_know.count",
            "connections.count", "sources.missing"} <= codes
    assert r.json()["ok"] is False


def test_publish_gate_blocks_publish(client):
    rid = _draft(client, slug="bare2")
    r = client.post(f"/rabbitholes/{rid}:publish", headers=ADMIN)
    assert r.status_code == 422
    assert r.json()["validation"]["ok"] is False


def test_publish_success(client, targets):
    rid = _draft(client, slug="why-real", title="Why Real Things Happen")
    conns = targets
    client.patch(f"/rabbitholes/{rid}", json=_publishable_patch(), headers=ADMIN)
    client.put(f"/rabbitholes/{rid}/connections", json=conns, headers=ADMIN)
    r = client.post(f"/rabbitholes/{rid}:publish", headers=ADMIN)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "published"
    assert r.json()["published_at"]
    # now public
    assert client.get("/rabbitholes/why-real").status_code == 200
    assert any(i["slug"] == "why-real" for i in client.get("/rabbitholes").json()["items"])


@pytest.mark.parametrize(
    "mutate,expect_code",
    [
        (lambda p: p.update(what_we_know=[{"text": "only one"}]), "what_we_know.count"),
        (lambda p: p.update(what_we_know=[{"text": f"f{i}"} for i in range(9)]), "what_we_know.count"),
        (
            lambda p: p.update(
                what_we_know=[{"text": "disputed thing", "state": "contested"}] + _wk(3)
            ),
            "what_we_know.missing_why",
        ),
        (lambda p: p.update(sources=[]), "sources.missing"),
        (
            lambda p: p.update(
                what_we_know=[{"text": "cited", "citations": ["s99"]}] + _wk(3)
            ),
            "citations.unresolved",
        ),
        (lambda p: p.update(subtitle=""), "subtitle.missing"),
        (lambda p: p.update(hook=""), "hook.missing"),
    ],
)
def test_each_publish_failure(client, targets, mutate, expect_code):
    rid = _draft(client, slug=f"gate-{expect_code}".replace(".", "-").replace("_", "-"))
    patch = _publishable_patch()
    mutate(patch)
    client.patch(f"/rabbitholes/{rid}", json=patch, headers=ADMIN)
    client.put(f"/rabbitholes/{rid}/connections", json=targets, headers=ADMIN)
    r = client.post(f"/admin/rabbitholes/{rid}:validate", headers=ADMIN)
    codes = {i["code"] for i in r.json()["failures"]}
    assert expect_code in codes, codes


def test_source_count_warning(client):
    rid = _draft(client, slug="few-sources")
    patch = _publishable_patch()
    patch["sources"] = _sources(2)
    patch["what_we_know"] = [{"text": f"f{i}", "citations": ["s0"]} for i in range(4)]
    client.patch(f"/rabbitholes/{rid}", json=patch, headers=ADMIN)
    r = client.post(f"/admin/rabbitholes/{rid}:validate", headers=ADMIN)
    warn_codes = {i["code"] for i in r.json()["warnings"]}
    assert "sources.count_unusual" in warn_codes


# ── citations ───────────────────────────────────────────────────────


def test_citation_resolution_and_reorder_stability(client, targets, rabbitholes_table):
    rid = _draft(client, slug="cites")
    patch = _publishable_patch()
    patch["sources"] = [
        {"type": "primary", "title": "Alpha", "url": "https://a"},
        {"type": "primary", "title": "Beta", "url": "https://b"},
    ]
    patch["what_we_know"] = [
        {"text": "cites beta", "citations": ["s2"]},
        {"text": "cites alpha", "citations": ["s1"]},
        {"text": "cites both", "citations": ["s1", "s2"]},
        {"text": "no cite"},
    ]
    conns = targets
    client.patch(f"/rabbitholes/{rid}", json=patch, headers=ADMIN)
    client.put(f"/rabbitholes/{rid}/connections", json=conns, headers=ADMIN)
    assert client.post(f"/rabbitholes/{rid}:publish", headers=ADMIN).status_code == 200

    detail = client.get("/rabbitholes/cites").json()
    # s1 renders as [1], s2 as [2]
    assert detail["what_we_know"][0]["citations"] == [{"source_id": "s2", "number": 2}]
    assert detail["what_we_know"][1]["citations"] == [{"source_id": "s1", "number": 1}]

    # reorder the sources -> numbers flip, but the s1/s2 identity is unchanged
    author = client.get(f"/admin/rabbitholes/{rid}", headers=ADMIN).json()
    reordered = [dict(author["sources"][1]), dict(author["sources"][0])]
    reordered[0]["order"] = 1
    reordered[1]["order"] = 2
    client.patch(f"/rabbitholes/{rid}", json={"sources": reordered}, headers=ADMIN)
    detail = client.get("/rabbitholes/cites").json()
    # "cites beta" still points at Beta, now numbered [1]
    beta_num = next(s["number"] for s in detail["sources"] if s["title"] == "Beta")
    assert detail["what_we_know"][0]["citations"] == [{"source_id": "s2", "number": beta_num}]


def test_unknown_source_id_rejected_on_update(client):
    rid = _draft(client, slug="badsrc")
    r = client.patch(
        f"/rabbitholes/{rid}",
        json={"sources": [{"id": "s7", "type": "primary", "title": "ghost"}]},
        headers=ADMIN,
    )
    assert r.status_code == 400


# ── optional sections ───────────────────────────────────────────────


def test_contested_open_omitted_by_default(client, targets):
    rid = _draft(client, slug="no-co")
    client.patch(f"/rabbitholes/{rid}", json=_publishable_patch(), headers=ADMIN)
    client.put(f"/rabbitholes/{rid}/connections", json=targets, headers=ADMIN)
    assert client.post(f"/rabbitholes/{rid}:publish", headers=ADMIN).status_code == 200
    detail = client.get("/rabbitholes/no-co").json()
    assert "contested_open" not in detail
    assert "timeline" not in detail


def test_timeline_omitted_and_can_be_added_then_cleared(client):
    rid = _draft(client, slug="tl")
    client.patch(f"/rabbitholes/{rid}", json=_publishable_patch(), headers=ADMIN)
    tl = [
        {"label": f"{1949 + i}", "start": {"year": 1949 + i}, "precision": "year", "text": f"event {i}"}
        for i in range(4)
    ]
    r = client.patch(f"/rabbitholes/{rid}", json={"timeline": tl}, headers=ADMIN)
    assert r.status_code == 200
    assert len(r.json()["timeline"]) == 4
    assert r.json()["timeline"][0]["sort"] != 0
    r = client.patch(f"/rabbitholes/{rid}", json={"clear_timeline": True}, headers=ADMIN)
    assert r.json()["timeline"] is None


def test_timeline_needs_four_entries(client):
    rid = _draft(client, slug="tl-short")
    client.patch(f"/rabbitholes/{rid}", json=_publishable_patch(), headers=ADMIN)
    client.patch(
        f"/rabbitholes/{rid}",
        json={"timeline": [{"label": "1949", "start": {"year": 1949}, "precision": "year", "text": "x"}]},
        headers=ADMIN,
    )
    r = client.post(f"/admin/rabbitholes/{rid}:validate", headers=ADMIN)
    assert "timeline.count" in {i["code"] for i in r.json()["failures"]}


def test_timeline_bce_and_ce_sort(client, targets):
    rid = _draft(client, slug="tl-bce")
    tl = [
        {"label": "1954", "start": {"year": 1954, "month": 1, "day": 10}, "precision": "day", "text": "modern"},
        {"label": "c. 44 BCE", "start": {"year": -44, "month": 3, "day": 15}, "precision": "day", "text": "ides"},
        {"label": "753 BCE", "start": {"year": -753}, "precision": "year", "text": "rome"},
        {"label": "79", "start": {"year": 79, "month": 8}, "precision": "month", "text": "vesuvius"},
        {"label": "1518", "start": {"year": 1518, "month": 7}, "precision": "month", "text": "strasbourg"},
    ]
    client.patch(f"/rabbitholes/{rid}", json={"timeline": tl}, headers=ADMIN)
    client.patch(f"/rabbitholes/{rid}", json=_publishable_patch(), headers=ADMIN)
    client.put(f"/rabbitholes/{rid}/connections", json=targets, headers=ADMIN)
    assert client.post(f"/rabbitholes/{rid}:publish", headers=ADMIN).status_code == 200
    labels = [e["label"] for e in client.get("/rabbitholes/tl-bce").json()["timeline"]]
    assert labels == ["753 BCE", "c. 44 BCE", "79", "1518", "1954"]


def test_timeline_label_not_derived(client):
    rid = _draft(client, slug="tl-label")
    client.patch(
        f"/rabbitholes/{rid}",
        json={
            "timeline": [
                {"label": "Summer of 1518", "start": {"year": 1518, "month": 7}, "precision": "month", "text": "e1"},
                {"label": "Early Bronze Age", "start": {"year": -3300}, "end": {"year": -2100}, "precision": "era", "text": "e2"},
                {"label": "1954", "start": {"year": 1954}, "precision": "year", "text": "e3"},
                {"label": "1958", "start": {"year": 1958}, "precision": "year", "text": "e4"},
            ]
        },
        headers=ADMIN,
    )
    author = client.get(f"/admin/rabbitholes/{rid}", headers=ADMIN).json()
    assert author["timeline"][0]["label"] == "Summer of 1518"
    assert author["timeline"][1]["label"] == "Early Bronze Age"


# ── connections ─────────────────────────────────────────────────────


def test_create_and_lookup_outbound_connection(client):
    src = _draft(client, slug="src")
    dst = _draft(client, slug="dst")
    r = client.post(
        f"/rabbitholes/{src}/connections",
        json={
            "destination_id": dst,
            "relationship_type": "what-came-next",
            "why_care": "The downstream consequence you would want to read next.",
        },
        headers=ADMIN,
    )
    assert r.status_code == 201
    conns = client.get(f"/admin/rabbitholes/{src}", headers=ADMIN).json()["connections"]
    assert len(conns) == 1 and conns[0]["destination_id"] == dst
    assert conns[0]["status"] == "active"


def test_inbound_gsi_lookup(client, targets):
    src = _draft(client, slug="in-src")
    dst = _draft(client, slug="in-dst")
    client.patch(f"/rabbitholes/{src}", json=_publishable_patch(), headers=ADMIN)
    client.patch(f"/rabbitholes/{dst}", json=_publishable_patch(), headers=ADMIN)
    # give dst valid connections + publish
    client.put(f"/rabbitholes/{dst}/connections", json=targets, headers=ADMIN)
    assert client.post(f"/rabbitholes/{dst}:publish", headers=ADMIN).status_code == 200
    # src -> dst, plus 2 more so src can publish
    conns = [
        {"destination_id": dst, "relationship_type": "involved", "why_care": "why one matters here for you"},
    ] + targets[:2]
    client.put(f"/rabbitholes/{src}/connections", json=conns, headers=ADMIN)
    assert client.post(f"/rabbitholes/{src}:publish", headers=ADMIN).status_code == 200

    leads_here = client.get("/rabbitholes/in-dst/connections").json()["leads_here"]
    assert any(x["from"]["slug"] == "in-src" for x in leads_here)


def test_stub_connection_and_public_shape(client, targets):
    rid = _draft(client, slug="with-stub")
    client.patch(f"/rabbitholes/{rid}", json=_publishable_patch(), headers=ADMIN)
    conns = targets[:2] + [
        {
            "destination_stub": {"title": "Stress concentration", "planned_slug": "stress-concentration"},
            "relationship_type": "bigger-picture",
            "why_care": "Where notches and holes matter, once you know why parts crack.",
            "display_order": 3,
        }
    ]
    client.put(f"/rabbitholes/{rid}/connections", json=conns, headers=ADMIN)
    assert client.post(f"/rabbitholes/{rid}:publish", headers=ADMIN).status_code == 200
    kd = client.get("/rabbitholes/with-stub").json()["keep_digging"]
    stub_entry = [e for e in kd if "coming_soon" in e][0]
    assert stub_entry["coming_soon"] == {"title": "Stress concentration"}
    assert "planned_slug" not in str(stub_entry)
    # relationship_type never exposed
    assert "relationship_type" not in str(kd)


def test_max_one_stub_on_publish(client, targets):
    rid = _draft(client, slug="two-stubs")
    client.patch(f"/rabbitholes/{rid}", json=_publishable_patch(), headers=ADMIN)
    conns = targets[:1] + [
        {
            "destination_stub": {"title": f"Stub {i}", "planned_slug": f"stub-{i}"},
            "relationship_type": "bigger-picture",
            "why_care": "Context worth reading once the idea has landed for you now.",
            "display_order": i + 2,
        }
        for i in range(2)
    ]
    client.put(f"/rabbitholes/{rid}/connections", json=conns, headers=ADMIN)
    r = client.post(f"/admin/rabbitholes/{rid}:validate", headers=ADMIN)
    assert "connections.too_many_stubs" in {i["code"] for i in r.json()["failures"]}


def test_unpublished_destination_is_a_warning(client, targets):
    rid = _draft(client, slug="unpub-dest")
    draft_dst = _draft(client, slug="still-a-draft")
    client.patch(f"/rabbitholes/{rid}", json=_publishable_patch(), headers=ADMIN)
    conns = targets[:2] + [
        {"destination_id": draft_dst, "relationship_type": "involved", "why_care": "matters to you once you read this"}
    ]
    client.put(f"/rabbitholes/{rid}/connections", json=conns, headers=ADMIN)
    r = client.post(f"/admin/rabbitholes/{rid}:validate", headers=ADMIN)
    assert r.json()["ok"] is True
    assert "connections.unpublished_target" in {i["code"] for i in r.json()["warnings"]}


def test_archive_destination_flags_inbound(client):
    src = _draft(client, slug="arc-src")
    dst = _draft(client, slug="arc-dst")
    client.post(
        f"/rabbitholes/{src}/connections",
        json={"destination_id": dst, "relationship_type": "involved", "why_care": "this leads to that for you"},
        headers=ADMIN,
    )
    client.post(f"/rabbitholes/{dst}:archive", headers=ADMIN)
    conns = client.get(f"/admin/rabbitholes/{src}", headers=ADMIN).json()["connections"]
    assert conns[0]["status"] == "target_unavailable"
    # and it now blocks publish of the source
    client.patch(f"/rabbitholes/{src}", json=_publishable_patch(), headers=ADMIN)
    r = client.post(f"/admin/rabbitholes/{src}:validate", headers=ADMIN)
    assert "connections.target_unavailable" in {i["code"] for i in r.json()["failures"]}


def test_connection_to_missing_destination_rejected(client):
    src = _draft(client, slug="miss-src")
    r = client.post(
        f"/rabbitholes/{src}/connections",
        json={"destination_id": "rh_doesnotexist", "relationship_type": "involved", "why_care": "x"},
        headers=ADMIN,
    )
    assert r.status_code == 400


# ── lifecycle + revisions ───────────────────────────────────────────


def test_submit_transitions_to_in_review(client):
    rid = _draft(client, slug="sub")
    r = client.post(f"/rabbitholes/{rid}:submit", headers=ADMIN)
    assert r.status_code == 200 and r.json()["status"] == "in_review"


def test_revision_created_on_publish_and_append_only(client, targets):
    rid = _draft(client, slug="rev", title="Revision Test")
    client.patch(f"/rabbitholes/{rid}", json=_publishable_patch(), headers=ADMIN)
    client.put(f"/rabbitholes/{rid}/connections", json=targets, headers=ADMIN)
    assert client.post(f"/rabbitholes/{rid}:publish", headers=ADMIN).status_code == 200

    revs = client.get(f"/admin/rabbitholes/{rid}/revisions", headers=ADMIN).json()["revisions"]
    assert len(revs) == 1
    first_rev = revs[0]["revision"]

    # edit + republish -> a second, distinct revision; the first is unchanged
    client.patch(f"/rabbitholes/{rid}", json={"hook": HOOK + " more"}, headers=ADMIN)
    assert client.post(f"/rabbitholes/{rid}:publish", headers=ADMIN).status_code == 200
    revs = client.get(f"/admin/rabbitholes/{rid}/revisions", headers=ADMIN).json()["revisions"]
    assert len(revs) == 2
    assert revs[0]["revision"] > revs[1]["revision"]

    snap = client.get(
        f"/admin/rabbitholes/{rid}/revisions/{first_rev}", headers=ADMIN
    ).json()
    assert snap["hook"] == HOOK  # original, not the edited one


def test_unpublish_removes_from_feed(client, targets):
    rid = _draft(client, slug="unpub")
    client.patch(f"/rabbitholes/{rid}", json=_publishable_patch(), headers=ADMIN)
    client.put(f"/rabbitholes/{rid}/connections", json=targets, headers=ADMIN)
    client.post(f"/rabbitholes/{rid}:publish", headers=ADMIN)
    assert any(i["slug"] == "unpub" for i in client.get("/rabbitholes").json()["items"])
    client.post(f"/rabbitholes/{rid}:unpublish", headers=ADMIN)
    assert client.get("/rabbitholes/unpub").status_code == 404
    assert not any(i["slug"] == "unpub" for i in client.get("/rabbitholes").json()["items"])


# ── listing ─────────────────────────────────────────────────────────


def test_published_feed_pagination_and_order(client, targets):
    ids = []
    for i in range(3):
        rid = _draft(client, slug=f"feed-{i}", title=f"Feed {i}")
        client.patch(f"/rabbitholes/{rid}", json=_publishable_patch(), headers=ADMIN)
        client.put(f"/rabbitholes/{rid}/connections", json=targets, headers=ADMIN)
        assert client.post(f"/rabbitholes/{rid}:publish", headers=ADMIN).status_code == 200
        ids.append(rid)
    page1 = client.get("/rabbitholes?limit=2").json()
    assert len(page1["items"]) == 2
    assert page1["next_cursor"]
    page2 = client.get(f"/rabbitholes?limit=2&cursor={page1['next_cursor']}").json()
    seen = [i["slug"] for i in page1["items"] + page2["items"]]
    assert set(seen) >= {"feed-0", "feed-1", "feed-2"}
    # newest published first
    assert page1["items"][0]["slug"] == "feed-2"


def test_editorial_status_listing(client):
    d = _draft(client, slug="ed-draft")
    r = _draft(client, slug="ed-review")
    client.post(f"/rabbitholes/{r}:submit", headers=ADMIN)
    drafts = client.get("/admin/rabbitholes?status=draft", headers=ADMIN).json()["items"]
    reviews = client.get("/admin/rabbitholes?status=in_review", headers=ADMIN).json()["items"]
    assert "ed-draft" in {i["slug"] for i in drafts}
    assert "ed-review" in {i["slug"] for i in reviews}
    all_items = client.get("/admin/rabbitholes", headers=ADMIN).json()["items"]
    assert {"ed-draft", "ed-review"} <= {i["slug"] for i in all_items}
    # admin listing requires admin
    assert client.get("/admin/rabbitholes", headers=STRANGER).status_code == 403


# ── public response discipline ──────────────────────────────────────


def test_public_detail_strips_internal_fields(client, targets):
    rid = _draft(client, slug="clean-out")
    patch = _publishable_patch()
    patch["what_we_know"] = [
        {"text": "a fact", "citations": ["s1"], "editorial_note": "internal only"}
    ] + _wk(3)
    client.patch(f"/rabbitholes/{rid}", json=patch, headers=ADMIN)
    client.put(f"/rabbitholes/{rid}/connections", json=targets, headers=ADMIN)
    client.post(f"/rabbitholes/{rid}:publish", headers=ADMIN)
    raw = client.get("/rabbitholes/clean-out").text
    for leak in ("editorial_note", "internal only", "created_by", "updated_by",
                 "relationship_type", "_source_seq", "schema_version"):
        assert leak not in raw, leak


def test_existing_video_api_untouched(client):
    assert client.get("/videos").json() == []
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/topics").json() == []
