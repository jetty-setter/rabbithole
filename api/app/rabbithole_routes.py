"""RabbitHole V1 API surface.

Public reads + admin authoring/lifecycle. Mounted on the main app via
`app.include_router(rabbithole_routes.router)`.

Lifecycle actions use the `POST /rabbitholes/{id}:action` form from the schema
doc; a single dispatcher handles them so the `{id}` path param never swallows
the action.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import JSONResponse

from . import rabbithole_store as store
from .auth import is_admin, optional_auth, require_auth
from .rabbithole_models import (
    RELATIONSHIP_TYPES,
    SOURCE_TYPES,
    ConnectionInput,
    RabbitHoleConnection,
    RabbitHoleCreate,
    RabbitHoleUpdate,
)
from .rabbithole_render import render_inbound, render_keep_digging, to_authoring, to_detail, to_summary
from .rabbithole_validation import validate_for_publish

router = APIRouter(tags=["rabbitholes"])

_LIFECYCLE_ACTIONS = ("submit", "publish", "unpublish", "archive")


def require_admin(user: str = Depends(require_auth)) -> str:
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="not allowed")
    return user


def _store_error(exc: store.StoreError) -> HTTPException:
    if isinstance(exc, store.NotFound):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, store.SlugTaken):
        return HTTPException(status_code=409, detail=str(exc))
    if isinstance(exc, store.ConflictError):
        return HTTPException(status_code=409, detail=str(exc))
    return HTTPException(status_code=400, detail=str(exc))


def _validate_inputs(*, connections: list[ConnectionInput] | None = None, sources=None) -> None:
    for conn in connections or []:
        if conn.relationship_type not in RELATIONSHIP_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"unknown relationship_type {conn.relationship_type!r}",
            )
    for src in sources or []:
        if getattr(src, "type", None) not in SOURCE_TYPES:
            raise HTTPException(status_code=400, detail=f"unknown source type {src.type!r}")


def _can_see(rh: dict | None, viewer: str | None) -> bool:
    if not rh:
        return False
    if rh.get("status") == "published":
        return True
    return bool(viewer) and is_admin(viewer)


# ── public reads ─────────────────────────────────────────────────────


@router.get("/rabbitholes")
def list_rabbitholes(
    cursor: str | None = None, limit: int = Query(default=25, ge=1, le=50)
):
    try:
        items, next_cursor = store.list_published(limit=limit, cursor=cursor)
    except store.StoreError as exc:
        raise _store_error(exc) from exc
    return {
        "items": [to_summary(i).model_dump(exclude_none=True) for i in items],
        "next_cursor": next_cursor,
    }


@router.get("/rabbitholes/{slug}")
def get_rabbithole(slug: str, viewer: str | None = Depends(optional_auth)):
    rh = store.get_by_slug(slug)
    if not _can_see(rh, viewer):
        raise HTTPException(status_code=404, detail="rabbithole not found")
    conns = store.outbound(rh["id"])
    cards = store.get_cards([c.get("destination_id") for c in conns])
    return to_detail(rh, conns, cards).model_dump(exclude_none=True)


@router.get("/rabbitholes/{slug}/connections")
def get_rabbithole_connections(slug: str, viewer: str | None = Depends(optional_auth)):
    rh = store.get_by_slug(slug)
    if not _can_see(rh, viewer):
        raise HTTPException(status_code=404, detail="rabbithole not found")
    out = store.outbound(rh["id"])
    inb = store.inbound(rh["id"])
    out_cards = store.get_cards([c.get("destination_id") for c in out])
    in_cards = store.get_cards([c.get("source_id") for c in inb])
    return {
        "keep_digging": render_keep_digging(out, out_cards),
        "leads_here": render_inbound(inb, in_cards),
    }


# ── admin: create / read / update ────────────────────────────────────


@router.post("/rabbitholes", status_code=201)
def create_rabbithole(body: RabbitHoleCreate, user: str = Depends(require_admin)):
    try:
        item = store.create_draft(
            title=body.title, slug=body.slug, subtitle=body.subtitle, editor=user
        )
    except store.StoreError as exc:
        raise _store_error(exc) from exc
    return to_authoring(item, []).model_dump()


@router.get("/admin/rabbitholes")
def admin_list_rabbitholes(
    status: str | None = None,
    cursor: str | None = None,
    limit: int = Query(default=25, ge=1, le=50),
    user: str = Depends(require_admin),
):
    try:
        if status:
            items, next_cursor = store.list_by_status(status, limit=limit, cursor=cursor)
        else:
            items, next_cursor = store.list_all(limit=limit, cursor=cursor)
    except store.StoreError as exc:
        raise _store_error(exc) from exc
    return {
        "items": [to_summary(i).model_dump(exclude_none=True) for i in items],
        "next_cursor": next_cursor,
    }


@router.get("/admin/rabbitholes/{rid}")
def admin_get_rabbithole(rid: str, user: str = Depends(require_admin)):
    rh = store.get_by_id(rid)
    if not rh:
        raise HTTPException(status_code=404, detail="rabbithole not found")
    return to_authoring(rh, store.outbound(rid)).model_dump()


@router.patch("/rabbitholes/{rid}")
def update_rabbithole(rid: str, body: RabbitHoleUpdate, user: str = Depends(require_admin)):
    _validate_inputs(sources=body.sources)
    try:
        rh = store.update(rid, body, editor=user)
    except store.StoreError as exc:
        raise _store_error(exc) from exc
    return to_authoring(rh, store.outbound(rid)).model_dump()


# ── admin: connections ───────────────────────────────────────────────


@router.put("/rabbitholes/{rid}/connections")
def replace_connections(
    rid: str, body: list[ConnectionInput], user: str = Depends(require_admin)
):
    _validate_inputs(connections=body)
    try:
        conns = store.replace_connections(rid, body)
    except store.StoreError as exc:
        raise _store_error(exc) from exc
    return {
        "connections": [
            RabbitHoleConnection(**store._conn_fields(c)).model_dump(exclude_none=True)
            for c in conns
        ]
    }


@router.post("/rabbitholes/{rid}/connections", status_code=201)
def add_connection(rid: str, body: ConnectionInput, user: str = Depends(require_admin)):
    _validate_inputs(connections=[body])
    try:
        conn = store.put_connection(rid, body)
    except store.StoreError as exc:
        raise _store_error(exc) from exc
    return RabbitHoleConnection(**store._conn_fields(conn)).model_dump(exclude_none=True)


@router.delete("/rabbitholes/{rid}/connections/{dest_key}", status_code=204)
def remove_connection(rid: str, dest_key: str, user: str = Depends(require_admin)):
    store.delete_connection(rid, dest_key)
    return Response(status_code=204)


# ── admin: lifecycle (POST /rabbitholes/{id}:action) ─────────────────


@router.post("/rabbitholes/{spec}")
def rabbithole_lifecycle(spec: str, user: str = Depends(require_admin)):
    if ":" not in spec:
        raise HTTPException(status_code=404, detail="not found")
    rid, _, action = spec.partition(":")
    if action not in _LIFECYCLE_ACTIONS:
        raise HTTPException(status_code=404, detail=f"unknown action {action!r}")
    try:
        if action == "submit":
            rh = store.submit(rid, editor=user)
        elif action == "publish":
            rh, result = store.publish(rid, editor=user)
            if rh is None:
                return JSONResponse(
                    status_code=422,
                    content={
                        "detail": "publish validation failed",
                        "validation": result.model_dump(),
                    },
                )
        elif action == "unpublish":
            rh = store.unpublish(rid, editor=user)
        else:  # archive
            rh = store.archive(rid, editor=user)
    except store.StoreError as exc:
        raise _store_error(exc) from exc
    return to_authoring(rh, store.outbound(rid)).model_dump()


# ── admin: validate + revisions ──────────────────────────────────────


@router.post("/admin/rabbitholes/{spec}")
def admin_rabbithole_action(spec: str, user: str = Depends(require_admin)):
    rid, _, action = spec.partition(":")
    if action != "validate":
        raise HTTPException(status_code=404, detail=f"unknown action {action!r}")
    rh = store.get_by_id(rid)
    if not rh:
        raise HTTPException(status_code=404, detail="rabbithole not found")
    conns = store.enrich_connections(store.outbound(rid))
    return validate_for_publish(rh, conns).model_dump()


@router.get("/admin/rabbitholes/{rid}/revisions")
def list_revisions(rid: str, user: str = Depends(require_admin)):
    if not store.get_by_id(rid):
        raise HTTPException(status_code=404, detail="rabbithole not found")
    return {"revisions": store.revisions_list(rid)}


@router.get("/admin/rabbitholes/{rid}/revisions/{rev}")
def get_revision(rid: str, rev: str, user: str = Depends(require_admin)):
    try:
        snapshot = store.revision_get(rid, rev)
    except store.StoreError as exc:
        raise _store_error(exc) from exc
    if not snapshot:
        raise HTTPException(status_code=404, detail="revision not found")
    return snapshot.get("snapshot") or {}
