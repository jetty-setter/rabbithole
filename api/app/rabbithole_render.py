"""Projection of a stored RabbitHole into the three public/admin shapes.

Public responses must never leak: created_by, updated_by, editorial_note,
relationship_type, `_`-prefixed storage keys, a stub's planned_slug, or any
authoring-only integrity metadata. That discipline lives here.
"""

from __future__ import annotations

from .rabbithole_models import (
    RabbitHoleAuthoring,
    RabbitHoleConnection,
    RabbitHoleDetail,
    RabbitHoleSummary,
)


# ── citations ────────────────────────────────────────────────────────


def _number_map(sources: list[dict]) -> dict[str, int]:
    ordered = sorted(sources, key=lambda s: int(s.get("order", 0)))
    return {s["id"]: i + 1 for i, s in enumerate(ordered)}


def _cites(ids: list[str] | None, numbers: dict[str, int]) -> list[dict]:
    return [{"source_id": i, "number": numbers[i]} for i in (ids or []) if i in numbers]


def _render_citation(source: dict) -> str:
    if source.get("citation_override"):
        return str(source["citation_override"])
    parts: list[str] = []
    if source.get("authors"):
        parts.append(str(source["authors"]).rstrip("."))
    title = source.get("title")
    if title:
        end = "" if str(title).endswith((".", "?", "!")) else "."
        parts.append(f"“{title}{end}”")
    tail: list[str] = []
    if source.get("publisher"):
        tail.append(str(source["publisher"]))
    if source.get("date"):
        tail.append(str(source["date"]))
    elif source.get("year") is not None:
        tail.append(str(int(source["year"])))
    if tail:
        parts.append(", ".join(tail) + ".")
    if source.get("doi"):
        parts.append(f"doi:{source['doi']}")
    elif source.get("url"):
        parts.append(str(source["url"]))
    return " ".join(p for p in parts if p).strip()


# ── keep digging ─────────────────────────────────────────────────────


def render_keep_digging(conns: list[dict], dest_cards: dict[str, dict]) -> list[dict]:
    """Outbound connections as public reader entries. `relationship_type` is
    dropped; a stub's planned_slug is never exposed; a link is only rendered
    when the destination is a published RabbitHole."""
    out: list[dict] = []
    for conn in sorted(conns, key=lambda c: int(c.get("display_order", 0))):
        entry: dict = {
            "order": int(conn.get("display_order", 0)),
            "why_care": conn.get("why_care", ""),
        }
        did = conn.get("destination_id")
        card = dest_cards.get(did) if did else None
        if did and card and card.get("status") == "published":
            entry["destination"] = {
                "slug": card["slug"],
                "title": card["title"],
                "subtitle": card.get("subtitle"),
            }
        else:
            stub_title = (conn.get("destination_stub") or {}).get("title")
            title = stub_title or (card or {}).get("title") or "More coming soon"
            entry["coming_soon"] = {"title": title}
        out.append(entry)
    return out


def render_inbound(inbound_conns: list[dict], source_cards: dict[str, dict]) -> list[dict]:
    """Inbound connections ('leads here'). Only surfaces edges whose SOURCE is a
    published RabbitHole, so drafts never leak."""
    out: list[dict] = []
    for conn in inbound_conns:
        card = source_cards.get(conn.get("source_id"))
        if not card or card.get("status") != "published":
            continue
        out.append(
            {
                "from": {
                    "slug": card["slug"],
                    "title": card["title"],
                    "subtitle": card.get("subtitle"),
                },
                "why_care": conn.get("why_care", ""),
            }
        )
    return out


# ── the three views ──────────────────────────────────────────────────


def to_detail(rh: dict, outbound_conns: list[dict], dest_cards: dict[str, dict]) -> RabbitHoleDetail:
    sources = sorted(rh.get("sources", []), key=lambda s: int(s.get("order", 0)))
    numbers = _number_map(sources)

    wk = [
        {
            "text": b["text"],
            "state": b.get("state") if b.get("state") not in (None, "established") else None,
            "why": b.get("why"),
            "citations": _cites(b.get("citations"), numbers),
        }
        for b in sorted(rh.get("what_we_know", []), key=lambda x: int(x.get("order", 0)))
    ]

    co = rh.get("contested_open")
    detail_co = None
    if co:
        detail_co = {
            "intro": co.get("intro"),
            "items": [
                {
                    "claim": it["claim"],
                    "state": it["state"],
                    "body": it["body"],
                    "why": it.get("why"),
                    "citations": _cites(it.get("citations"), numbers),
                }
                for it in sorted(co.get("items", []), key=lambda x: int(x.get("order", 0)))
            ],
            "open_questions": co.get("open_questions", []),
        }

    timeline = rh.get("timeline")
    detail_tl = None
    if timeline:
        entries = sorted(
            timeline, key=lambda e: (float(e.get("sort", 0)), int(e.get("order", 0)))
        )
        detail_tl = [
            {
                "label": e["label"],
                "text": e["text"],
                "precision": e["precision"],
                "citations": _cites(e.get("citations"), numbers),
            }
            for e in entries
        ]

    detail_sources = [
        {
            "number": i + 1,
            "type": s["type"],
            "classification": s.get("classification"),
            "title": s["title"],
            "authors": s.get("authors"),
            "publisher": s.get("publisher"),
            "date": s.get("date"),
            "year": int(s["year"]) if s.get("year") is not None else None,
            "url": s.get("url"),
            "doi": s.get("doi"),
            "archive_url": s.get("archive_url"),
            "note": s.get("note"),
            "citation": _render_citation(s),
        }
        for i, s in enumerate(sources)
    ]

    return RabbitHoleDetail(
        slug=rh["slug"],
        title=rh["title"],
        subtitle=rh.get("subtitle"),
        hook=rh.get("hook"),
        short_version=rh.get("short_version"),
        what_we_know=wk,
        contested_open=detail_co,
        timeline=detail_tl,
        keep_digging=render_keep_digging(outbound_conns, dest_cards),
        sources=detail_sources,
        author_display=rh.get("author_display"),
        published_at=rh.get("published_at"),
        updated_at=rh.get("updated_at"),
    )


def to_summary(rh: dict) -> RabbitHoleSummary:
    return RabbitHoleSummary(
        id=rh["id"],
        slug=rh["slug"],
        title=rh["title"],
        subtitle=rh.get("subtitle"),
        status=rh["status"],
        published_at=rh.get("published_at"),
        updated_at=rh["updated_at"],
        source_count=len(rh.get("sources", [])),
    )


def to_authoring(rh: dict, connections: list[dict]) -> RabbitHoleAuthoring:
    data = {k: v for k, v in rh.items() if not k.startswith("_")}
    data.setdefault("contested_open", None)
    data.setdefault("timeline", None)
    data["connections"] = [
        RabbitHoleConnection(**{k: v for k, v in c.items() if not k.startswith("_")})
        for c in connections
    ]
    return RabbitHoleAuthoring(**data)
