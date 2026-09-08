"""Persistence + lifecycle for RabbitHoles.

All DynamoDB access for the RabbitHole domain lives here so route handlers stay
thin. Three tables (see docs/RABBITHOLE_SCHEMA.md):

  rabbitholes             one item per RabbitHole + SLUG#<slug> sentinels
  rabbithole_connections  one item per directed Keep Digging edge
  rabbithole_revisions    append-only snapshot per publish

Slug uniqueness uses a transactional sentinel item written in the same
TransactWriteItems as the RabbitHole.
"""

from __future__ import annotations

import base64
import json
import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from boto3.dynamodb.conditions import Attr, Key
from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import ClientError

from . import aws, config
from .rabbithole_models import (
    DEFAULT_LANG,
    DEFAULT_ORIGIN,
    SCHEMA_VERSION,
    SLUG_RE,
    ConnectionInput,
    RabbitHoleUpdate,
)

_SER = TypeSerializer()
SLUG_PREFIX = "SLUG#"
ID_PREFIX = "rh_"


class StoreError(Exception):
    """Base for expected store errors (routes map these to HTTP codes)."""


class NotFound(StoreError):
    pass


class SlugTaken(StoreError):
    pass


class ConflictError(StoreError):
    pass


class BadRequest(StoreError):
    pass


# ── small helpers ────────────────────────────────────────────────────


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return ID_PREFIX + uuid.uuid4().hex


def _norm_slug(raw: str) -> str:
    s = (raw or "").strip().lower()
    if not SLUG_RE.match(s) or len(s) > 80:
        raise BadRequest("slug must be lowercase words separated by hyphens, <= 80 chars")
    return s


def _decimalize(obj: Any) -> Any:
    """floats -> Decimal (DynamoDB rejects floats); everything else untouched."""
    return json.loads(json.dumps(obj, default=str), parse_float=Decimal)


def _clean(obj: Any) -> Any:
    """Drop None values recursively so stored items stay tidy. Empty lists and
    empty strings are kept (they can be meaningful)."""
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items() if v is not None}
    if isinstance(obj, list):
        return [_clean(v) for v in obj]
    return obj


def _low(item: dict) -> dict:
    """Python dict -> low-level DynamoDB AttributeValue map (for transactions)."""
    return {k: _SER.serialize(v) for k, v in _decimalize(_clean(item)).items()}


def _public_item(item: dict) -> dict:
    """Strip storage-only ('_'-prefixed) keys."""
    return {k: v for k, v in item.items() if not k.startswith("_")}


def _encode_cursor(key: dict | None) -> str | None:
    if not key:
        return None
    return base64.urlsafe_b64encode(json.dumps(key, default=str).encode()).decode()


def _decode_cursor(cursor: str | None) -> dict | None:
    if not cursor:
        return None
    try:
        return json.loads(base64.urlsafe_b64decode(cursor.encode()))
    except Exception as exc:  # noqa: BLE001
        raise BadRequest("invalid cursor") from exc


def timeline_sort(start: dict) -> float:
    """Derived ordering scalar: year + month/13 + day/400. Adding a positive
    fraction always moves a date later, so BCE years (stored negative) order
    correctly with the same formula. /13 and /400 stop month and day from ever
    spilling into the next larger unit."""
    year = int(start["year"])
    month = start.get("month") or 1
    day = start.get("day") or 1
    return year + month / 13.0 + day / 400.0


# ── id assignment for embedded sub-items ──────────────────────────────


def _assign_embedded_ids(
    prefix: str, incoming: list[dict], seq: int, *, known_ids: set[str] | None = None
) -> tuple[list[dict], int]:
    """Give every incoming sub-item a stable id + an order.

    - no id            -> assign f"{prefix}{seq+1}" and bump seq
    - id already known -> keep it
    - id unknown       -> keep it, unless `known_ids` is provided (Sources),
                          in which case reject (protects citation integrity)
    """
    out: list[dict] = []
    for i, raw in enumerate(incoming):
        item = {k: v for k, v in dict(raw).items() if v is not None}
        sid = item.get("id")
        if not sid:
            seq += 1
            sid = f"{prefix}{seq}"
        elif known_ids is not None and sid not in known_ids:
            raise BadRequest(f"unknown source id {sid!r}; omit id for a new source")
        item["id"] = sid
        item["order"] = item.get("order") if item.get("order") is not None else i + 1
        out.append(item)
    return out, seq


# ── RabbitHole CRUD ──────────────────────────────────────────────────


def _put_with_slug(item: dict, old_slug: str | None) -> None:
    """Write the RabbitHole item, transactionally reserving its slug via a
    SLUG#<slug> sentinel. If the slug changed, the old sentinel is released in
    the same transaction."""
    table = config.RABBITHOLES_TABLE
    slug = item["slug"]
    txn: list[dict] = []
    if old_slug != slug:
        txn.append(
            {
                "Put": {
                    "TableName": table,
                    "Item": _low(
                        {
                            "id": f"{SLUG_PREFIX}{slug}",
                            "rabbithole_id": item["id"],
                            "created_at": _now(),
                        }
                    ),
                    "ConditionExpression": "attribute_not_exists(id)",
                }
            }
        )
        if old_slug:
            txn.append(
                {
                    "Delete": {
                        "TableName": table,
                        "Key": {"id": {"S": f"{SLUG_PREFIX}{old_slug}"}},
                    }
                }
            )
    txn.append({"Put": {"TableName": table, "Item": _low(item)}})
    try:
        aws.dynamodb_client.transact_write_items(TransactItems=txn)
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code")
        reasons = exc.response.get("CancellationReasons") or []
        if code == "TransactionCanceledException" and any(
            r.get("Code") == "ConditionalCheckFailed" for r in reasons
        ):
            raise SlugTaken(f"slug {slug!r} is already in use") from exc
        raise


def create_draft(*, title: str, slug: str, subtitle: str | None, editor: str) -> dict:
    slug = _norm_slug(slug)
    now = _now()
    item = {
        "id": _new_id(),
        "schema_version": SCHEMA_VERSION,
        "slug": slug,
        "lang": DEFAULT_LANG,
        "status": "draft",
        "origin": DEFAULT_ORIGIN,
        "title": title.strip(),
        "subtitle": (subtitle or "").strip() or None,
        "hook": None,
        "short_version": None,
        "what_we_know": [],
        "contested_open": None,
        "timeline": None,
        "sources": [],
        "media": [],
        "revision": 1,
        "created_at": now,
        "created_by": editor,
        "updated_at": now,
        "updated_by": editor,
        "published_at": None,
        "author_display": None,
        "_source_seq": 0,
        "_wk_seq": 0,
        "_co_seq": 0,
        "_tl_seq": 0,
    }
    _put_with_slug(item, None)
    return _public_item(item)


def get_by_id(rid: str) -> dict | None:
    if not rid or not rid.startswith(ID_PREFIX):
        return None
    resp = aws.rabbitholes_table().get_item(Key={"id": rid})
    return resp.get("Item")


def get_by_slug(slug: str) -> dict | None:
    resp = aws.rabbitholes_table().query(
        IndexName="by-slug",
        KeyConditionExpression=Key("slug").eq(slug),
        Limit=1,
    )
    items = resp.get("Items", [])
    return items[0] if items else None


def get_cards(ids: list[str]) -> dict[str, dict]:
    """Batch-fetch summary attributes for a set of RabbitHole ids."""
    wanted = sorted({i for i in ids if i and i.startswith(ID_PREFIX)})
    if not wanted:
        return {}
    table = config.RABBITHOLES_TABLE
    out: dict[str, dict] = {}
    for i in range(0, len(wanted), 100):
        chunk = wanted[i : i + 100]
        resp = aws.dynamodb.batch_get_item(
            RequestItems={
                table: {
                    "Keys": [{"id": x} for x in chunk],
                    "ProjectionExpression": "id, slug, title, subtitle, #s",
                    "ExpressionAttributeNames": {"#s": "status"},
                }
            }
        )
        for row in resp.get("Responses", {}).get(table, []):
            out[row["id"]] = row
    return out


def list_published(*, limit: int = 25, cursor: str | None = None) -> tuple[list[dict], str | None]:
    kwargs: dict = {
        "IndexName": "published-feed",
        "KeyConditionExpression": Key("gsi_pub").eq("PUB"),
        "ScanIndexForward": False,  # newest published first
        "Limit": limit,
    }
    start = _decode_cursor(cursor)
    if start:
        kwargs["ExclusiveStartKey"] = start
    resp = aws.rabbitholes_table().query(**kwargs)
    return resp.get("Items", []), _encode_cursor(resp.get("LastEvaluatedKey"))


def list_by_status(
    status: str, *, limit: int = 25, cursor: str | None = None
) -> tuple[list[dict], str | None]:
    kwargs: dict = {
        "IndexName": "by-status",
        "KeyConditionExpression": Key("status").eq(status),
        "ScanIndexForward": False,  # newest updated first
        "Limit": limit,
    }
    start = _decode_cursor(cursor)
    if start:
        kwargs["ExclusiveStartKey"] = start
    resp = aws.rabbitholes_table().query(**kwargs)
    return resp.get("Items", []), _encode_cursor(resp.get("LastEvaluatedKey"))


def list_all(*, limit: int = 25, cursor: str | None = None) -> tuple[list[dict], str | None]:
    """Editorial listing across every status. Scan + filter out slug sentinels
    -- fine at portfolio scale, same call already made for videos elsewhere."""
    kwargs: dict = {
        "FilterExpression": Attr("id").begins_with(ID_PREFIX),
        "Limit": limit,
    }
    start = _decode_cursor(cursor)
    if start:
        kwargs["ExclusiveStartKey"] = start
    resp = aws.rabbitholes_table().scan(**kwargs)
    items = sorted(resp.get("Items", []), key=lambda i: i.get("updated_at", ""), reverse=True)
    return items, _encode_cursor(resp.get("LastEvaluatedKey"))


def update(rid: str, patch: RabbitHoleUpdate, *, editor: str) -> dict:
    item = get_by_id(rid)
    if not item:
        raise NotFound("rabbithole not found")
    if item["status"] == "archived":
        raise ConflictError("archived rabbitholes are read-only; unpublish is not applicable")

    data = patch.model_dump(exclude_unset=True)
    old_slug = item["slug"]

    if "slug" in data and data["slug"] is not None:
        item["slug"] = _norm_slug(data["slug"])

    for field in ("title", "subtitle", "hook", "short_version", "author_display"):
        if field in data:
            value = data[field].strip() if isinstance(data[field], str) else data[field]
            if field == "title":
                item["title"] = value or item["title"]
            else:
                item[field] = value or None

    if data.get("what_we_know") is not None:
        wk, item["_wk_seq"] = _assign_embedded_ids(
            "wk", data["what_we_know"], int(item.get("_wk_seq", 0))
        )
        item["what_we_know"] = wk

    if data.get("clear_contested_open"):
        item["contested_open"] = None
    elif data.get("contested_open") is not None:
        co = dict(data["contested_open"])
        co_items, item["_co_seq"] = _assign_embedded_ids(
            "co", co.get("items", []), int(item.get("_co_seq", 0))
        )
        co["items"] = co_items
        item["contested_open"] = co

    if data.get("clear_timeline"):
        item["timeline"] = None
    elif data.get("timeline") is not None:
        tl, item["_tl_seq"] = _assign_embedded_ids(
            "tl", data["timeline"], int(item.get("_tl_seq", 0))
        )
        for entry in tl:
            entry["sort"] = timeline_sort(entry["start"])
        item["timeline"] = tl

    if data.get("media") is not None:
        item["media"] = [dict(m) for m in data["media"]]

    if data.get("sources") is not None:
        existing_ids = {s["id"] for s in item.get("sources", [])}
        srcs, item["_source_seq"] = _assign_embedded_ids(
            "s", data["sources"], int(item.get("_source_seq", 0)), known_ids=existing_ids
        )
        item["sources"] = srcs

    item["revision"] = int(item.get("revision", 1)) + 1
    item["updated_at"] = _now()
    item["updated_by"] = editor
    _put_with_slug(item, old_slug)
    return _public_item(get_by_id(rid))


# ── lifecycle ────────────────────────────────────────────────────────


def _write_status(item: dict, *, editor: str, bump_revision: bool = False) -> dict:
    if bump_revision:
        item["revision"] = int(item.get("revision", 1)) + 1
    item["updated_at"] = _now()
    item["updated_by"] = editor
    _put_with_slug(item, item["slug"])
    return _public_item(get_by_id(item["id"]))


def submit(rid: str, *, editor: str) -> dict:
    item = get_by_id(rid)
    if not item:
        raise NotFound("rabbithole not found")
    if item["status"] not in ("draft", "in_review"):
        raise ConflictError(f"cannot submit a {item['status']} rabbithole")
    item["status"] = "in_review"
    return _write_status(item, editor=editor)


def publish(rid: str, *, editor: str):
    """Returns (public_item | None, ValidationResult). On a failed gate the
    item is None and the result carries the failures."""
    from .rabbithole_validation import validate_for_publish

    item = get_by_id(rid)
    if not item:
        raise NotFound("rabbithole not found")

    conns = enrich_connections(outbound(rid))
    result = validate_for_publish(item, conns)
    if not result.ok:
        return None, result

    now = _now()
    item["status"] = "published"
    item["published_at"] = now
    item["gsi_pub"] = "PUB"
    item["revision"] = int(item.get("revision", 1)) + 1
    item["updated_at"] = now
    item["updated_by"] = editor
    _put_with_slug(item, item["slug"])
    _snapshot_revision(get_by_id(rid), editor=editor)
    return _public_item(get_by_id(rid)), result


def unpublish(rid: str, *, editor: str) -> dict:
    item = get_by_id(rid)
    if not item:
        raise NotFound("rabbithole not found")
    if item["status"] != "published":
        raise ConflictError(f"cannot unpublish a {item['status']} rabbithole")
    item["status"] = "draft"
    item.pop("gsi_pub", None)
    item["published_at"] = None
    return _write_status(item, editor=editor)


def archive(rid: str, *, editor: str) -> dict:
    item = get_by_id(rid)
    if not item:
        raise NotFound("rabbithole not found")
    if item["status"] == "archived":
        raise ConflictError("already archived")
    item["status"] = "archived"
    item.pop("gsi_pub", None)
    item["published_at"] = None
    result = _write_status(item, editor=editor)
    _mark_inbound_unavailable(rid)
    return result


def hard_delete(rid: str) -> None:
    """Admin/maintenance only -- not exposed as a route in V1. Removes the item,
    its slug sentinel and its outbound connections; flags inbound connections."""
    item = get_by_id(rid)
    if not item:
        return
    table = aws.rabbitholes_table()
    table.delete_item(Key={"id": rid})
    table.delete_item(Key={"id": f"{SLUG_PREFIX}{item['slug']}"})
    ctbl = aws.rabbithole_connections_table()
    for conn in outbound(rid):
        ctbl.delete_item(Key={"source_id": rid, "dest_key": conn["dest_key"]})
    _mark_inbound_unavailable(rid)


# ── revisions ────────────────────────────────────────────────────────


def _snapshot_revision(item: dict, *, editor: str) -> None:
    rev = int(item["revision"])
    payload = {
        "id": item["id"],
        "rev": f"rev#{rev:06d}",
        "revision": rev,
        "snapshot": _public_item(item),
        "published_at": item.get("published_at"),
        "editor": editor,
        "created_at": _now(),
    }
    try:
        aws.rabbithole_revisions_table().put_item(
            Item=_decimalize(_clean(payload)),
            ConditionExpression=Attr("id").not_exists(),
        )
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return  # revision already recorded; snapshots are append-only
        raise


def revisions_list(rid: str) -> list[dict]:
    resp = aws.rabbithole_revisions_table().query(
        KeyConditionExpression=Key("id").eq(rid),
        ScanIndexForward=False,  # newest first
    )
    return [
        {
            "revision": int(r["revision"]),
            "published_at": r.get("published_at"),
            "editor": r.get("editor"),
            "created_at": r.get("created_at"),
        }
        for r in resp.get("Items", [])
    ]


def revision_get(rid: str, rev: str | int) -> dict | None:
    try:
        rev_num = int(str(rev).replace("rev#", "").lstrip("0") or "0")
    except ValueError as exc:
        raise BadRequest("invalid revision number") from exc
    resp = aws.rabbithole_revisions_table().get_item(
        Key={"id": rid, "rev": f"rev#{rev_num:06d}"}
    )
    return resp.get("Item")


# ── connections ──────────────────────────────────────────────────────

_STUB_RE = re.compile(r"^stub#(?P<slug>[a-z0-9]+(?:-[a-z0-9]+)*)$")


def _conn_fields(row: dict) -> dict:
    return {k: v for k, v in row.items() if not k.startswith("_")}


def _resolve_destination(
    destination_id: str | None, stub: dict | None
) -> tuple[str, dict]:
    if destination_id:
        target = get_by_id(destination_id)
        if not target or target.get("status") == "archived":
            raise BadRequest(f"destination {destination_id!r} does not resolve")
        return destination_id, {"destination_id": destination_id, "status": "active"}
    if stub:
        planned = _norm_slug(stub["planned_slug"])
        return (
            f"stub#{planned}",
            {
                "destination_stub": {"title": stub["title"].strip(), "planned_slug": planned},
                "status": "coming_soon",
            },
        )
    raise BadRequest("a connection needs destination_id or destination_stub")


def put_connection(source_id: str, inp: ConnectionInput) -> dict:
    if not get_by_id(source_id):
        raise NotFound("rabbithole not found")
    stub = inp.destination_stub.model_dump() if inp.destination_stub else None
    dest_key, extra = _resolve_destination(inp.destination_id, stub)
    now = _now()
    existing = (
        aws.rabbithole_connections_table()
        .get_item(Key={"source_id": source_id, "dest_key": dest_key})
        .get("Item")
    )
    row = {
        "source_id": source_id,
        "dest_key": dest_key,
        "relationship_type": inp.relationship_type,
        "why_care": inp.why_care.strip(),
        "reverse_why_care": (inp.reverse_why_care or "").strip() or None,
        "display_order": int(inp.display_order or 0),
        "created_at": existing["created_at"] if existing else now,
        "updated_at": now,
        **extra,
    }
    aws.rabbithole_connections_table().put_item(Item=_decimalize(_clean(row)))
    return row


def replace_connections(source_id: str, inputs: list[ConnectionInput]) -> list[dict]:
    if not get_by_id(source_id):
        raise NotFound("rabbithole not found")
    table = aws.rabbithole_connections_table()
    with table.batch_writer() as batch:
        for conn in outbound(source_id):
            batch.delete_item(Key={"source_id": source_id, "dest_key": conn["dest_key"]})
    written: list[dict] = []
    for i, inp in enumerate(inputs):
        if not inp.display_order:
            inp.display_order = i + 1
        written.append(put_connection(source_id, inp))
    return written


def delete_connection(source_id: str, dest_key: str) -> None:
    aws.rabbithole_connections_table().delete_item(
        Key={"source_id": source_id, "dest_key": dest_key}
    )


def outbound(source_id: str) -> list[dict]:
    resp = aws.rabbithole_connections_table().query(
        KeyConditionExpression=Key("source_id").eq(source_id)
    )
    items = resp.get("Items", [])
    items.sort(key=lambda c: int(c.get("display_order", 0)))
    return items


def inbound(destination_id: str) -> list[dict]:
    resp = aws.rabbithole_connections_table().query(
        IndexName="inbound",
        KeyConditionExpression=Key("destination_id").eq(destination_id),
    )
    return resp.get("Items", [])


def _mark_inbound_unavailable(destination_id: str) -> None:
    table = aws.rabbithole_connections_table()
    for conn in inbound(destination_id):
        table.update_item(
            Key={"source_id": conn["source_id"], "dest_key": conn["dest_key"]},
            UpdateExpression="SET #s = :u, updated_at = :t",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":u": "target_unavailable", ":t": _now()},
        )


def enrich_connections(conns: list[dict]) -> list[dict]:
    """Attach a transient `_target_state` to each connection for the publish
    gate: 'missing' | 'draft' | 'in_review' | 'published' | None (stub)."""
    out: list[dict] = []
    for conn in conns:
        conn = dict(conn)
        did = conn.get("destination_id")
        if did:
            target = get_by_id(did)
            if not target or target.get("status") == "archived":
                conn["_target_state"] = "missing"
            else:
                conn["_target_state"] = target.get("status")
        out.append(conn)
    return out
