"""The RabbitHole publish gate.

`validate_for_publish` is a pure function: it takes the stored RabbitHole item
and its (connection-status-enriched) connections and returns every failure and
warning in one pass. The `:publish` route refuses on any failure; the
`:validate` route just returns the result.

Deliberately NOT machine-enforced (editorial checklist only):
  - whether the title is factually accurate
  - whether mystery is being manufactured
  - whether a connection is editorially compelling
  - whether What We Know and Timeline describe the same event
"""

from __future__ import annotations

from .rabbithole_models import SLUG_RE, ValidationIssue, ValidationResult

HOOK_WORDS = (40, 80)
SHORT_VERSION_WORDS = (60, 110)
WHAT_WE_KNOW_ITEM_MAX_WORDS = 25
TIMELINE_TEXT_MAX_WORDS = 15
WHY_CARE_MAX_WORDS = 25
SOURCES_NORMAL_RANGE = (5, 15)


def _wc(text: str | None) -> int:
    return len((text or "").split())


def validate_for_publish(rh: dict, connections: list[dict]) -> ValidationResult:
    failures: list[ValidationIssue] = []
    warnings: list[ValidationIssue] = []

    def fail(code: str, message: str, field: str | None = None) -> None:
        failures.append(ValidationIssue(code=code, field=field, message=message))

    def warn(code: str, message: str, field: str | None = None) -> None:
        warnings.append(ValidationIssue(code=code, field=field, message=message))

    # ── core prose ──────────────────────────────────────────────────
    title = (rh.get("title") or "").strip()
    if not title:
        fail("title.missing", "title is required", "title")
    elif len(title) > 80:
        fail("title.too_long", "title must be 80 characters or fewer", "title")

    slug = rh.get("slug") or ""
    if not slug:
        fail("slug.missing", "slug is required", "slug")
    elif not SLUG_RE.match(slug):
        fail("slug.invalid", "slug must be lowercase words separated by hyphens", "slug")
    elif len(slug) > 80:
        fail("slug.too_long", "slug must be 80 characters or fewer", "slug")

    subtitle = (rh.get("subtitle") or "").strip()
    if not subtitle:
        fail("subtitle.missing", "subtitle is required", "subtitle")
    elif len(subtitle) > 140:
        fail("subtitle.too_long", "subtitle must be 140 characters or fewer", "subtitle")

    hook = (rh.get("hook") or "").strip()
    if not hook:
        fail("hook.missing", "hook is required", "hook")
    else:
        n = _wc(hook)
        if not (HOOK_WORDS[0] <= n <= HOOK_WORDS[1]):
            warn("hook.word_count", f"hook is {n} words; target {HOOK_WORDS[0]}-{HOOK_WORDS[1]}", "hook")

    short_version = (rh.get("short_version") or "").strip()
    if not short_version:
        fail("short_version.missing", "the short version is required", "short_version")
    else:
        n = _wc(short_version)
        if not (SHORT_VERSION_WORDS[0] <= n <= SHORT_VERSION_WORDS[1]):
            warn(
                "short_version.word_count",
                f"the short version is {n} words; target {SHORT_VERSION_WORDS[0]}-{SHORT_VERSION_WORDS[1]}",
                "short_version",
            )

    # ── what we know ────────────────────────────────────────────────
    wk = rh.get("what_we_know") or []
    if not (4 <= len(wk) <= 8):
        fail("what_we_know.count", f"'What we know' has {len(wk)} items; needs 4-8", "what_we_know")
    for i, bullet in enumerate(wk):
        field = f"what_we_know[{i}]"
        text = (bullet.get("text") or "").strip()
        if not text:
            fail("what_we_know.item_empty", f"'What we know' item {i + 1} has no text", field)
        elif _wc(text) > WHAT_WE_KNOW_ITEM_MAX_WORDS:
            warn(
                "what_we_know.item_long",
                f"'What we know' item {i + 1} is {_wc(text)} words; target <= {WHAT_WE_KNOW_ITEM_MAX_WORDS}",
                field,
            )
        state = bullet.get("state")
        if state and state != "established" and not (bullet.get("why") or "").strip():
            fail(
                "what_we_know.missing_why",
                f"'What we know' item {i + 1} is '{state}' but has no 'why'",
                field,
            )

    # ── contested / open (optional) ────────────────────────────────
    co = rh.get("contested_open")
    if co is not None:
        items = co.get("items") or []
        if not (co.get("intro") or "").strip() and not items:
            fail(
                "contested_open.empty",
                "'What's contested or still open' is present but empty; omit it or fill it",
                "contested_open",
            )
        for i, item in enumerate(items):
            field = f"contested_open.items[{i}]"
            if not (item.get("claim") or "").strip() or not (item.get("body") or "").strip():
                fail(
                    "contested_open.item_incomplete",
                    f"contested/open item {i + 1} needs both a claim and a body",
                    field,
                )
            state = item.get("state")
            if state and state != "established" and not (item.get("why") or "").strip():
                fail(
                    "contested_open.missing_why",
                    f"contested/open item {i + 1} is '{state}' but has no 'why'",
                    field,
                )

    # ── timeline (optional) ────────────────────────────────────────
    timeline = rh.get("timeline")
    if timeline is not None:
        if len(timeline) < 4:
            fail(
                "timeline.count",
                f"Timeline has {len(timeline)} entries; needs at least 4 (or omit it)",
                "timeline",
            )
        for i, entry in enumerate(timeline):
            field = f"timeline[{i}]"
            year = (entry.get("start") or {}).get("year")
            if (
                not (entry.get("label") or "").strip()
                or entry.get("sort") is None
                or year in (None, 0)
            ):
                fail(
                    "timeline.entry_invalid",
                    f"Timeline entry {i + 1} needs a label, a start year, and a sort value",
                    field,
                )
            if entry.get("text") and _wc(entry["text"]) > TIMELINE_TEXT_MAX_WORDS:
                warn(
                    "timeline.entry_long",
                    f"Timeline entry {i + 1} text is {_wc(entry['text'])} words; target <= {TIMELINE_TEXT_MAX_WORDS}",
                    field,
                )

    # ── sources ────────────────────────────────────────────────────
    sources = rh.get("sources") or []
    source_ids = {s.get("id") for s in sources}
    if len(sources) < 1:
        fail("sources.missing", "a RabbitHole needs at least one source to publish", "sources")
    elif not (SOURCES_NORMAL_RANGE[0] <= len(sources) <= SOURCES_NORMAL_RANGE[1]):
        warn(
            "sources.count_unusual",
            f"{len(sources)} sources; normal range is {SOURCES_NORMAL_RANGE[0]}-{SOURCES_NORMAL_RANGE[1]}",
            "sources",
        )
    for i, source in enumerate(sources):
        if not any(source.get(k) for k in ("url", "doi", "archive_url", "citation_override")):
            warn(
                "sources.no_locator",
                f"source {i + 1} has no url, doi, archive url or citation override",
                f"sources[{i}]",
            )

    # ── inline citations resolve ───────────────────────────────────
    def check_citations(cite_ids: list[str] | None, where: str) -> None:
        for cid in cite_ids or []:
            if cid not in source_ids:
                fail(
                    "citations.unresolved",
                    f"citation {cid!r} in {where} does not match any source",
                    where,
                )

    for i, bullet in enumerate(wk):
        check_citations(bullet.get("citations"), f"what_we_know[{i}]")
    if co is not None:
        for i, item in enumerate(co.get("items") or []):
            check_citations(item.get("citations"), f"contested_open.items[{i}]")
    if timeline is not None:
        for i, entry in enumerate(timeline):
            check_citations(entry.get("citations"), f"timeline[{i}]")

    # ── keep digging connections ───────────────────────────────────
    conns = connections or []
    unavailable = [c for c in conns if c.get("status") == "target_unavailable"]
    stubs = [c for c in conns if str(c.get("dest_key", "")).startswith("stub#") or c.get("destination_stub")]
    active = [c for c in conns if c.get("status") != "target_unavailable"]

    if unavailable:
        fail(
            "connections.target_unavailable",
            f"{len(unavailable)} Keep Digging connection(s) point to unavailable content",
            "connections",
        )
    if not (3 <= len(active) <= 5):
        fail(
            "connections.count",
            f"'Keep digging' has {len(active)} usable connections; needs 3-5",
            "connections",
        )
    if len(stubs) > 1:
        fail(
            "connections.too_many_stubs",
            f"{len(stubs)} 'coming soon' connections; at most 1 is allowed",
            "connections",
        )
    for i, conn in enumerate(conns):
        field = f"connections[{i}]"
        why_care = (conn.get("why_care") or "").strip()
        if not why_care:
            fail("connections.missing_why_care", f"connection {i + 1} has no 'why_care'", field)
        elif _wc(why_care) > WHY_CARE_MAX_WORDS:
            warn(
                "connections.why_care_long",
                f"connection {i + 1} 'why_care' is {_wc(why_care)} words; target <= {WHY_CARE_MAX_WORDS}",
                field,
            )
        target_state = conn.get("_target_state")
        if conn.get("destination_id") and target_state == "missing":
            fail(
                "connections.dangling_target",
                f"connection {i + 1} points to a RabbitHole that no longer exists",
                field,
            )
        elif target_state in ("draft", "in_review"):
            warn(
                "connections.unpublished_target",
                f"connection {i + 1} points to an unpublished RabbitHole; it will appear once that publishes",
                field,
            )

    return ValidationResult(ok=not failures, failures=failures, warnings=warnings)
