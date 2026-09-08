# RabbitHole — Engineering Schema (V1)

Translates the frozen V1 editorial model
([`RABBITHOLE_CONTENT_MODEL.md`](./RABBITHOLE_CONTENT_MODEL.md),
[`RABBITHOLE_CONTENT_MODEL_VALIDATION.md`](./RABBITHOLE_CONTENT_MODEL_VALIDATION.md))
into a durable data model, DynamoDB table design, API contract, and validation
rules.

**Scope:** schema/model design only. No migration code, no Terraform changes, no
application code, no seeding, no live-AWS changes in this pass.

**Design stance:** smallest robust schema that supports V1 cleanly, reuses proven
patterns already in the repo (`topics`, `topic_connections`, `embeddings`), keeps
the video pipeline untouched as a future evidence store, and reserves cheap
extension points — nothing speculative built now.

---

## 1. Recommended domain model

Six entities. Two are DynamoDB tables; one is a recommended third table; the rest
are embedded value objects.

| Entity | Storage | Why |
|---|---|---|
| **RabbitHole** | `rabbitholes` table, one item | The article. Prose + all bounded sub-sections embedded. |
| **What We Know bullet** | embedded array on the RabbitHole item | 4–8, bounded, always rendered with the page, edited as a unit, never queried alone. |
| **Contested / Open block** | embedded object on the RabbitHole item | Optional. Prose intro + 0–4 competing explanations + 0–n open questions. |
| **Timeline entry** | embedded array on the RabbitHole item | Optional. 4–8, bounded, always rendered with the page. |
| **Source** | embedded array on the RabbitHole item, each with a **stable local id** | 5–15, bounded, always rendered with the page. Not globally reusable in V1. |
| **Connection ("Keep Digging")** | `rabbithole_connections` table, one item per directed edge | A directed graph. Needs reverse lookup, independent lifecycle, coming-soon targets, integrity checks. This is the knowledge-graph substrate. |
| **Revision** *(recommended)* | `rabbithole_revisions` table, one item per publish | Append-only editorial history snapshots. ~30 lines to add; painful to reconstruct later. |
| **Media / evidence attachment** | embedded array `media[]` on the RabbitHole item — **field reserved, no V1 behaviour** | Optional. References an existing `videos` row or an external URL. |

### Why embedded-JSON-plus-one-edge-table, not child records or single-table

| Option | Verdict |
|---|---|
| **Everything as child records** (what-we-know rows, source rows, timeline rows under the RabbitHole partition) | Rejected. Adds write complexity and item sprawl for sub-sections that are small, bounded, always fetched together and edited as a unit. No independent query need. Pure overhead. |
| **Everything embedded as JSON on one item, including connections** | Rejected for connections only. Connections need reverse/inbound lookup ("what leads here"), can target unpublished/nonexistent RabbitHoles, and have a lifecycle independent of either endpoint's content revision. Embedding them makes reverse lookup a full scan and graph queries painful. |
| **Single-table design** (all entities in one table, overloaded keys) | Rejected. The brief explicitly discourages it "merely for sophistication." Two clear tables are safer and more legible. |
| **Hybrid: prose + bounded sub-sections embedded on `rabbitholes`; connections in `rabbithole_connections`; revisions in `rabbithole_revisions`** | **Recommended.** Full page = one `GetItem` + one `Query`. Editorial edits rewrite one item. The graph is a real table from day one. |

**Item-size check.** V1 caps (≤ 8 what-we-know, ≤ 4 competing explanations, ≤ 8
timeline, ≤ 15 sources, ~1,000 words prose) put a realistic item at **15–40 KB** —
well under the 400 KB DynamoDB limit. If a future format outgrows this, `sources`
and `timeline` promote to child items under the same partition (SK prefixes
`SRC#`, `TL#`); the read stays a single-partition `Query`.

---

## 2. Entity relationships

```
                    ┌─────────────────────────────┐
                    │        RabbitHole           │
                    │  (rabbitholes table item)   │
                    ├─────────────────────────────┤
                    │ title, subtitle, hook,      │
                    │ short_version               │
                    │                             │
                    │ what_we_know[]   ───────────┼──► cites Source.id (0..n)
                    │ contested_open{ items[] }  ─┼──► cites Source.id (0..n)
                    │ timeline[]       ───────────┼──► cites Source.id (0..n)
                    │ sources[]  (id = s1..sN)    │◄─── all inline citations resolve here
                    │ media[]  (reserved) ────────┼──► videos.video_id  |  external URL
                    │ revision, status, timestamps│
                    └───────────┬─────────────────┘
                                │ 1
                                │
                                │ N   (rabbithole_connections table)
                    ┌───────────▼─────────────────┐
                    │        Connection           │      directed edge
                    │ source_id  ────────────────►│  this RabbitHole
                    │ destination_id ────────────►│  another RabbitHole  (or a stub)
                    │ relationship_type (internal)│
                    │ why_care, display_order     │
                    └─────────────────────────────┘
                       inbound = GSI on destination_id  (reverse edges derived, not stored)

   rabbithole_revisions:  (id, rev) → full JSON snapshot, written on each publish

   NOT related to RabbitHoles in V1:
     topics / topic_connections   → retained for future taxonomy only (currently empty)
     videos / embeddings / transcripts → referenced only via media[]; otherwise untouched
```

- A **Source** is owned by exactly one RabbitHole (local, not shared).
- An inline **citation** is a many-to-many link between a claim (a what-we-know
  bullet, a competing explanation, or a timeline entry) and Sources, expressed as
  a list of stable Source ids on the claim.
- A **Connection** is a directed edge `RabbitHole → RabbitHole`. Reverse edges are
  derived via a GSI, never stored twice.
- **Media** references an existing `videos` row or an external URL; it never
  duplicates video metadata.

---

## 3. Required vs optional fields

### RabbitHole core

| Field | Req? | Notes |
|---|---|---|
| `id` | required | `rh_` + uuid4 hex. Immutable. |
| `schema_version` | required | Integer, starts at `1`. Cheapest future-proofing. |
| `slug` | required | `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 80 chars, globally unique. Mutable via a guarded transaction. |
| `lang` | required | `"en"` for all V1 items. Reserved so a later multi-language split is clean. |
| `status` | required | `draft` \| `in_review` \| `published` \| `archived`. |
| `origin` | required | `"editorial"` in V1. Reserved for `"generated"` (AI/search-generated). |
| `title` | required | ≤ 80 chars. Must be factually accurate (editorial rule; not machine-enforced). |
| `subtitle` | required | ≤ 140 chars, one sentence. |
| `hook` | required | Non-empty. Target 40–80 words (advisory). |
| `short_version` | required | Non-empty. Target 60–110 words (advisory). |
| `what_we_know` | required | 4–8 items (enforced at publish). |
| `contested_open` | **optional** | Omit entirely for settled topics. If present, must be non-empty. |
| `timeline` | **optional** | Omit unless ≥ 4 dated events and chronology matters. If present, ≥ 4 entries. |
| `sources` | required | ≥ 1 to publish (hard block); 5–15 normal (advisory warn outside range). |
| `media` | optional | Default `[]`. No V1 rendering. |
| `revision` | required | Integer, incremented on each write. |
| `created_at` / `updated_at` | required | ISO 8601 UTC. |
| `published_at` | required once published | ISO 8601 UTC. Absent while draft. |
| `created_by` / `updated_by` | required | Admin username (audit; not public). |
| `author_display` | optional | Byline shown publicly; defaults to a house string. Separate from the auth identity. |

### What We Know bullet

| Field | Req? | Notes |
|---|---|---|
| `id` | required | Stable within the RabbitHole (`wk1`…). Never reused. |
| `order` | required | Integer display order. |
| `text` | required | ≤ 25 words (advisory). |
| `citations` | optional | List of Source ids. Required in practice for numeric/surprising/contested claims (editorial + publish check for non-established). |
| `state` | optional | `null` ⇒ **Established** (no visible label). Else `contested` \| `unsupported` \| `debunked`. |
| `why` | conditional | Required (non-empty) whenever `state` is not null/established. |
| `editorial_note` | optional | Internal only, never in public responses. |

### Competing explanation (inside `contested_open.items[]`)

| Field | Req? | Notes |
|---|---|---|
| `id` | required | `co1`… stable. |
| `order` | required | Integer. |
| `claim` | required | One-line statement of the explanation/position/myth. |
| `state` | required here | `established` \| `contested` \| `unsupported` \| `debunked`. |
| `body` | required | The explanation prose. |
| `why` | conditional | Required whenever `state` ≠ `established` — the "why it's incomplete / what it can't explain" line. |
| `citations` | optional | List of Source ids. |

### Timeline entry

| Field | Req? | Notes |
|---|---|---|
| `id` | required | `tl1`… stable. |
| `order` | required | Author-set display order (normally chronological, but authored). |
| `label` | required | Human-readable date string, authored, never derived ("Summer 1954", "c. 44 BCE", "Early Bronze Age", "1518–c. 1520"). |
| `start` | required | `{ year: int, month: int\|null, day: int\|null }`. `year` negative = BCE. |
| `end` | optional | Same shape or `null`. Non-null = a range/period. |
| `precision` | required | `day` \| `month` \| `year` \| `decade` \| `century` \| `era`. Communicates uncertainty; drives rendering. |
| `sort` | required (derived) | Numeric ordering scalar (see §8). Computed on write. |
| `text` | required | The event, ≤ 15 words (advisory). |
| `citations` | optional | List of Source ids. |

### Source

| Field | Req? | Notes |
|---|---|---|
| `id` | required | `s1`… stable, monotonic (`_source_seq` on the item). **Never reused, never renumbered.** |
| `order` | required | Display order in the Sources list. Changing it does **not** affect citations. |
| `type` | required | `primary` \| `peer-reviewed` \| `institutional` \| `journalism` \| `secondary` \| `reference` \| `archival`. Drives the "prioritize primary sources" editorial rule. |
| `classification` | optional | `primary` \| `secondary` — primary vs secondary *evidence* (distinct from `type`). |
| `title` | required | — |
| `authors` | optional | Freeform display string ("Withey, P. A."; "Ministry of Transport"). Not normalized in V1. |
| `publisher` | optional | Journal / publisher / institution. |
| `year` | optional | Integer, for sorting/filtering. |
| `date` | optional | Human-readable ("1955", "March 2015"). |
| `url` | optional | — |
| `doi` | optional | — |
| `archive_url` | optional | Wayback/Perma link. |
| `accessed` | optional | Only when `url` is the sole locator and volatile. |
| `note` | optional | ≤ ~12 words of context ("the authoritative first-person account"). |
| `citation_override` | optional | Freeform citation string for sources that don't fit the structured mold (museum object file, personal communication). Normal rendering is derived from the fields. |

### Connection

| Field | Req? | Notes |
|---|---|---|
| `source_id` | required | The RabbitHole this connection is authored on. (PK) |
| `dest_key` | required | `<destination_id>` or `stub#<planned_slug>`. (SK — also prevents duplicate A→B.) |
| `destination_id` | conditional | RabbitHole id when the target exists; `null` for a stub. |
| `destination_stub` | conditional | `{ title, planned_slug }` when `destination_id` is null. |
| `relationship_type` | required | `involved` \| `same-kind` \| `bigger-picture` \| `what-came-next` \| `competing-explanation`. **Internal metadata — never in public responses in V1.** |
| `why_care` | required | ≤ 25 words. "Why would someone who just read the source care about the destination?" |
| `reverse_why_care` | optional | For future inbound-display polish. |
| `display_order` | required | Integer, 1–5. |
| `status` | required (maintained) | `active` \| `coming_soon` \| `target_unavailable`. |
| `created_at` / `updated_at` | required | — |

---

## 4. DynamoDB table design

All tables: `PAY_PER_REQUEST`, `point_in_time_recovery` enabled, no streams
(RabbitHole has no real-time surface). Naming follows the repo convention
`${local.name}-<table>` (e.g. `rabbithole-dev-rabbitholes`).

### Table `rabbitholes`

| | |
|---|---|
| **PK** | `id` (S) — `rh_<uuid4hex>` |
| **SK** | none |
| **Item** | full RabbitHole (see §"Example JSON") — prose + `what_we_know[]` + `contested_open{}` + `timeline[]` + `sources[]` + `media[]` + metadata. Plus a hidden `_source_seq` counter and `_slug_lower` for the slug GSI. |
| **GSI1 `by-slug`** | PK `slug` (S). Projection **ALL**. → *get RabbitHole by slug* (1 item). |
| **GSI2 `by-status`** | PK `status` (S), SK `updated_at` (S). Projection: summary attrs only (`id, slug, title, subtitle, status, published_at, updated_at, source_count, connection_count`). → *editorial listing by status, newest first*. |
| **GSI3 `published-feed`** | PK `gsi3pk` (S, constant `"PUB"`, **only written when status = published** → sparse), SK `published_at` (S). Projection: summary attrs. → *public list of published RabbitHoles, newest first*. |
| **Slug uniqueness** | A sentinel item `{ id: "SLUG#<slug>" }` written in the same `TransactWriteItems` as the RabbitHole, with `attribute_not_exists(id)`. Slug rename = transactional delete-old-sentinel + put-new-sentinel + update item. |
| **Lifecycle** | `draft`/`in_review` items are private. `archived` items stay (not deleted) so inbound connections can be repaired. Hard delete is an explicit admin action: removes the item, its slug sentinel, its outbound connections; flags inbound connections `target_unavailable`. |

### Table `rabbithole_connections`

| | |
|---|---|
| **PK** | `source_id` (S) |
| **SK** | `dest_key` (S) — `<destination_id>` or `stub#<planned_slug>` |
| **Item** | see §3 Connection + §"Example JSON" |
| **GSI1 `inbound`** | PK `destination_id` (S, sparse — absent for stubs), SK `source_id` (S). Projection: `why_care, relationship_type, display_order, status`. → *what leads here*. |
| **Access** | *outbound* = `Query PK = source_id` (≤ 5 items, sort by `display_order` client-side). *inbound* = `Query GSI1 PK = destination_id`. |
| **Lifecycle** | Deleted with the source RabbitHole on hard delete. `status` set to `target_unavailable` when the destination is archived/hard-deleted. `status = coming_soon` while `destination_id` is null. |

### Table `rabbithole_revisions` *(recommended for V1)*

| | |
|---|---|
| **PK** | `id` (S) — the RabbitHole id |
| **SK** | `rev` (S) — zero-padded, e.g. `"rev#0004"` (lexical desc = newest first with `ScanIndexForward=false`) |
| **Item** | `{ id, rev, revision:int, snapshot: <full RabbitHole JSON>, published_at, editor }` |
| **Write** | On each successful `:publish`. Append-only, never updated. |
| **GSI** | none |
| **Lifecycle** | Retain all (small) or TTL after N months / keep last 20 — team choice. |

### Table `rabbithole_embeddings` *(NOT V1 — listed for completeness)*

Mirrors the existing `embeddings` table: PK `rabbithole_id` (S), SK `chunk` (S),
vector as a base64 float32 blob. Built when semantic search is turned on; `search.py`
helpers (`_scan_all`, `pack_vector`, `cosine`) are directly reusable.

### Terraform footprint (for the later implementation task, not now)

`infra/dynamodb.tf` gains `rabbitholes` (3 GSIs), `rabbithole_connections`
(1 GSI), `rabbithole_revisions` (0 GSI). IAM: the API Lambda role and the deploy
role need `dynamodb:*Item`, `Query`, `Scan`, `BatchGetItem`, `TransactWriteItems`
on the three tables + their indexes.

---

## 5. Access patterns

| # | Pattern | Table / index | Operation | Cost |
|---|---|---|---|---|
| 1 | Get RabbitHole by id | `rabbitholes` | `GetItem` PK=id | 1 read |
| 2 | Get RabbitHole by slug | `rabbitholes` GSI1 | `Query` PK=slug | 1 read |
| 3 | Fetch complete page (prose + what-we-know + contested + timeline + sources) | `rabbitholes` | comes with #1 / #2 (all embedded) | — |
| 4 | Fetch Keep Digging (outbound) connections | `rabbithole_connections` | `Query` PK=source_id | 1 query (≤5 items) |
| 5 | Resolve outbound destinations to cards | `rabbitholes` | `BatchGetItem` on dest ids, project summary | 1 batch |
| 6 | Fetch inbound ("leads here") connections | `rabbithole_connections` GSI1 | `Query` PK=destination_id | 1 query |
| 7 | Resolve inbound sources to cards | `rabbitholes` | `BatchGetItem` | 1 batch |
| 8 | List published RabbitHoles (public feed, paginated) | `rabbitholes` GSI3 | `Query` PK="PUB" desc, `ExclusiveStartKey` cursor | 1 query/page |
| 9 | Editorial list by status, newest first | `rabbitholes` GSI2 | `Query` PK=status desc updated_at | 1 query/page |
| 10 | Resolve an inline citation → source | in-memory | id lookup in the item's `sources[]` | 0 |
| 11 | Fetch timeline | `rabbitholes` | embedded (comes with #1/#2) | — |
| 12 | Slug uniqueness on create/rename | `rabbitholes` | `TransactWriteItems` w/ `SLUG#` sentinel + `attribute_not_exists` | 1 txn |
| 13 | Revision history | `rabbithole_revisions` | `Query` PK=id, `ScanIndexForward=false` | 1 query |
| 14 | Embedding/index job input | `rabbitholes` GSI3 | `Query`/paginated scan of published | later |
| 15 | Integrity sweep: connections → missing/unpublished target | `rabbithole_connections` + `rabbitholes` | scan + `BatchGetItem` (admin, infrequent) | rare |

**A full public RabbitHole page = `GetItem`(slug via GSI) + `Query`(outbound
connections) + `BatchGetItem`(destination cards)** — 3 round trips, all
O(1)/single-partition. Inbound connections are an optional 4th.

---

## 6. Source / citation model

### Sources: RabbitHole-local, embedded, stable-id

**Not** global reusable records, **not** a `RabbitHoleSource` join table.

| Option | Verdict |
|---|---|
| Global `sources` table + `rabbithole_sources` join | Rejected for V1. Adds a join to every page read, a source-dedup problem ("is this the same paper?"), and an orphan-GC problem. No evidence yet that cross-RabbitHole source reuse is worth it. |
| RabbitHole-local, embedded array, each with a stable local id | **Recommended.** Whole page is one read. Citations reference the stable id, not array position. |

**Extension point:** each source object may later carry `global_ref` (a DOI or a
future `source_catalog_id`). If "show every RabbitHole citing this paper" becomes
valuable, build a `source_catalog` table and backfill `global_ref` without moving
the per-RabbitHole citation data.

### Inline citations: id lists, position-independent

- Each source has a stable `id` (`s1`, `s2`, … from a monotonic `_source_seq` on
  the item). **Ids are never reused and never renumbered.** Deleting a source
  leaves its id retired; the publish gate then flags any claim still citing it.
- A claim (what-we-know bullet, competing explanation, timeline entry) carries
  `citations: ["s3", "s7"]` — an unordered list of source ids. This gives
  **one claim → many sources** and **one source → many claims** for free.
- **Display numbers are derived at render time**, not stored. The API assigns
  `[1..N]` in `sources[].order` and maps each cited id to its number. Reordering
  the `sources` array changes the visible numbers but never breaks a citation.

**Render-time transform (API `_to_detail`):**

```
sources sorted by order → [ {s1 → 1}, {s5 → 2}, {s3 → 3}, ... ]
wk4.citations ["s3"]  →  wk4.citations [ { "source_id": "s3", "number": 3 } ]
```

There is **no standalone citation table and no standalone Evidence section** —
citations live on the claims; the "why a source matters" note lives on the source
(`note`, ≤ ~12 words).

---

## 7. Connection model

### Directional

Connections are **directed edges**. `A —[what-came-next]→ B` is authored from A's
point of view; the `why_care` sentence is written for a reader who just finished
A. Storing an edge does not imply the reverse.

### Reverse connections: derived, not stored

Inbound edges come from **GSI1 on `destination_id`** — one `Query`. Storing both
directions would double writes and invite drift (update one, forget the other).

Inbound display uses the forward `why_care` as written ("*X → this RabbitHole:*
&lt;why X leads here&gt;"), which reads acceptably. `reverse_why_care` is an
optional field for later polish; not needed for V1.

### Targets that don't exist yet

Two cases, both allowed:

1. **Destination RabbitHole exists but is not published.** Connection is stored
   with a real `destination_id`; the public API hides it (or shows "coming soon"
   without a link) until the destination publishes. Editorial views show it.
2. **Destination RabbitHole doesn't exist yet.** `destination_id: null`,
   `destination_stub: { title, planned_slug }`, `status: "coming_soon"`. Rendered
   as un-linked "coming soon" text. Per the editorial rule, **at most one** of a
   RabbitHole's 3–5 connections may be a stub. When a real RabbitHole is later
   created with `planned_slug`, an editor tool rebinds the connection
   (`dest_key` `stub#…` → the new id).

### Preventing orphan / invalid relationships

- **On connection write:** `destination_id` must resolve to an existing RabbitHole
  **or** `destination_stub` must be present. Enforced in the service layer.
- **On archive / hard-delete of a RabbitHole:** the service queries the inbound
  GSI for edges pointing at it and sets them `status = target_unavailable` (hidden from public,
  kept for repair). Hard delete also removes the RabbitHole's own outbound edges
  and its slug sentinel.
- **Publish gate** re-checks that every outbound connection's target is either
  published or an intentional stub.
- **Integrity sweep** (admin tool, infrequent): lists connections whose target is
  missing, archived, or perpetually unpublished.

### Reuse `topics` / `topic_connections`? — No.

| Question | Answer |
|---|---|
| Can `topic_connections` be the RabbitHole graph? | **No.** It models `Topic ↔ Topic` (slug ↔ slug) — concept labels, not articles. Different entity, different keys, has `strength` for Map-spoke ranking, has no per-direction `why_care`, no `display_order`, no coming-soon concept. |
| Adapt it (add a "kind" discriminator, store both edge types)? | **No.** Overloading one table with two edge semantics is exactly the "reuse because it exists" the brief warns against. It would make every query filter on `kind` and every index ambiguous. |
| Keep it? | **Yes — for future taxonomy only.** A RabbitHole may later carry `topics: [slug]` tags for browse/faceting, reusing the `topics` table. The `topic_connections` table stays for topic-to-topic relationships if a taxonomy layer is built. Both are **currently empty** (purged). Don't build V1 on them. |
| What do we take from them? | The **pattern**: natural-ish keys, an `explanation`/`why` text field, an editorial `source` marker, PITR on. And we **fix their known flaw** — `topic_connections` has no reverse GSI, so its inbound lookup is a full scan. `rabbithole_connections` gets the inbound GSI from day one. |

Connections are **authored, never derived from shared tags.** There is no
tag-cooccurrence path into `rabbithole_connections`.

---

## 8. Optional timeline design

### Date representation

Requirements: exact dates, month/year, year-only, approximate periods, BCE,
ranges — and it must **sort correctly** while **preserving human labels and
uncertainty**.

Each entry stores three things:

1. **`label`** — an authored human string, always displayed, never derived.
   `"10 January 1954"`, `"Summer 1954"`, `"c. 44 BCE"`, `"Early Bronze Age"`,
   `"1518–c. 1520"`.
2. **`start` / `end` structured** — `{ year: int, month: int|null, day: int|null }`.
   `year` is a signed integer where **`-44` means "44 BCE"** (there is no year 0;
   the display always comes from `label`, so the off-by-one that trips up
   astronomical year numbering never reaches a reader). `end` is `null` unless
   the entry is a range/period.
3. **`precision`** — `day | month | year | decade | century | era`. Communicates
   how firm the date is and drives rendering (e.g. `era` → no month shown).

**`sort`** — a derived **numeric** scalar for ordering, computed on write:

```
sort = year + (month ?? 1)/13 + (day ?? 1)/400
```

The `/13` and `/400` divisors keep the month and day contributions from ever
spilling into the next larger unit. Adding a positive fraction always moves a
date *later*, so BCE years — stored negative — order correctly with the same
formula.

- Numeric comparison sorts BCE before CE correctly:
  `-752.92 (≈753 BCE) < -43.73 (≈44 BCE) < 79.08 < 1518.06 < 1954.10`.
- Variable precision is fine — a year-only 1949 (`1949.079`) sorts before a
  dated 10 Jan 1954 (`1954.102`) without special-casing.
- Ranges sort by `start`.
- Computed on every write; the API just does `sorted(timeline, key=…["sort"])`.
  (Authors set `order` for the rare case where they want a non-chronological
  presentation; default tooling sets `order` = chronological rank.)

No GSI is needed — timeline is embedded and sorted in memory (≤ 8 entries).

The section is **omitted entirely** when it doesn't apply — there is no empty
timeline object, no "over time" filler entry. Publish gate: if `timeline` is
present it must have ≥ 4 entries each with a `label` and a `sort`.

---

## 9. Optional media / evidence attachment design

`media` is an **embedded array on the RabbitHole item**, default `[]`, **no V1
rendering or validation** — a reserved extension point.

```json
{
  "id": "m1",
  "kind": "video",            // video | audio | image | document | archival
  "role": "primary-source",   // evidence | illustration | primary-source
  "caption": "…",
  "credit": "…",
  "ref_type": "video_id",     // video_id | url | s3_key
  "ref": "d0b96a5d5f944a979170870b18e68d3d",
  "source_id": "s4"           // optional link to a Sources entry
}
```

- `ref_type: "video_id"` points at an existing row in the **`videos` table** —
  reusing all hosted/external/transcript/capability machinery with **zero changes
  to the Video model**. RabbitHole never copies video metadata; it holds a
  reference.
- `ref_type: "url"` / `"s3_key"` covers external media and documents.
- Media is never required. Zero media is a normal, complete RabbitHole. There is
  **no standalone Evidence section** (editorial rule) — media, when present, is an
  inline attachment.

**Promotion path:** if a media asset needs its own lifecycle, permissions, or
sharing across RabbitHoles, promote `media[]` to a `rabbithole_media` table
(PK `rabbithole_id`, SK `media_id`) — the object shape is unchanged.

---

## 10. Publication workflow

### States

```
draft ──submit──► in_review ──publish──► published ──archive──► archived
  ▲                    │                     │                     │
  └────────────────────┴──── (edit) ─────────┘   unpublish ────────┘
                                              (published → draft/archived)
```

- **draft** — freely editable, private.
- **in_review** — flagged for editorial review, still private.
- **published** — public; `published_at` set. Admin-only edits go live
  immediately (single-editor V1); each write snapshots a revision.
- **archived** — was public, withdrawn; private; inbound connections flagged
  `target_unavailable`.

Transitions are explicit admin API actions (`:submit`, `:publish`, `:unpublish`,
`:archive`), each JWT + `is_admin` gated.

### Publish gate (`validate_for_publish(rabbithole) → list[Failure]`)

`:publish` refuses with `422` + the full failure list unless **all** hold:

- `title` present, ≤ 80 chars; `slug` present, valid pattern, unique.
- `subtitle` present, ≤ 140 chars.
- `hook`, `short_version` present and non-empty.
- `what_we_know`: **≥ 4 and ≤ 8** items, each with non-empty `text`.
- Every claim/explanation with `state ∈ {contested, unsupported, debunked}` has a
  non-empty `why`.
- If `contested_open` present: has prose intro **or** ≥ 1 item (no empty shell).
- If `timeline` present: **≥ 4** entries, each with `label` + `sort`.
- **Connections: ≥ 3 and ≤ 5**, each with non-empty `why_care`; **≤ 1** is a stub;
  every non-stub target exists and is published-or-will-be.
- **Sources: ≥ 1** (hard block — "zero sources is a publish blocker").
  `< 5` or `> 15` → **warning**, not a block.
- **Every citation id referenced anywhere resolves** to a source in `sources[]`.
- No outbound connection in `status = target_unavailable`.

### Which layer enforces what

| Rule | Layer | Why |
|---|---|---|
| Attribute types; core fields present on write | pydantic (API) | Basic shape. |
| `slug` pattern + length; `title` ≤ 80; `subtitle` ≤ 140 | API | **Structural** (layout-breaking), not stylistic. |
| `slug` global uniqueness | **DB** (`TransactWriteItems` + `attribute_not_exists` sentinel) | The only real constraint DynamoDB can enforce. |
| Full publish gate (counts, citation resolution, connection integrity, `why` presence) | **API service** (`validate_for_publish`, run by `:publish`) | Authoritative. Shared as a library function so any bulk-import tool calls the same check. |
| Connection target exists / is a stub | API service (on connection write) | Referential integrity. |
| Inbound-connection cascade on archive/delete | API service | — |
| Hook 40–80 words; short_version 60–110; `why_care` ≤ 25 words; `text` ≤ 25/15 words; **title factually accurate**; **no manufactured mystery**; **What-We-Know and Timeline don't duplicate events**; "larger-context" connection quality; relationship-type sanity | **Editorial tooling only** — authoring-UI warnings + pre-publish checklist. **Never DB, never API-blocking.** | Per the brief: word-count/style rules don't belong in the database — and an 82-word hook should not be un-publishable. |

---

## 11. API contract proposal

*(Proposal only — not implemented in this pass. FastAPI on Lambda, same stack as
today.)*

### Public

| Method + path | Returns |
|---|---|
| `GET /rabbitholes?cursor=&limit=` | **Summary list** of published RabbitHoles, newest first. Cursor pagination. |
| `GET /rabbitholes/{slug}` | **Detail** representation (below). 404 if not published (unless admin token). |
| `GET /rabbitholes/{slug}/connections` | `{ keep_digging: [...], leads_here: [...] }` — lets a client load connections lazily. |
| `GET /rabbitholes/{slug}/related` | *(later)* semantic neighbours. |

### Admin (JWT + `is_admin`)

| Method + path | Purpose |
|---|---|
| `POST /rabbitholes` | Create a `draft` (title + slug minimum). |
| `GET /admin/rabbitholes?status=&cursor=` | Editorial list (any status), newest-updated first. |
| `GET /admin/rabbitholes/{id}` | **Authoring** representation (all metadata). |
| `PATCH /rabbitholes/{id}` | Partial update of content fields; bumps `revision`. |
| `PUT /rabbitholes/{id}/connections` | Replace the whole connection set (authored as a unit). |
| `POST/DELETE /rabbitholes/{id}/connections/{destKey}` | Single-edge edits. |
| `POST /rabbitholes/{id}:submit` \| `:publish` \| `:unpublish` \| `:archive` | Lifecycle. `:publish` runs the gate; `422` + failures on fail. |
| `GET /admin/rabbitholes/{id}/revisions` \| `/revisions/{rev}` | History. |
| `POST /admin/rabbitholes/{id}:validate` | Dry-run the publish gate; returns failures + warnings without publishing. |

### Summary representation (list)

```
{ id, slug, title, subtitle, status, published_at, updated_at,
  source_count, connection_count, reading_time_min }
```

No hook, no body, **no author/editorial metadata**.

### Detail representation (public)

Everything a reader needs, and nothing else:

- `title, subtitle, hook, short_version`
- `what_we_know`: `[{ id, text, state?, why?, citations:[{source_id, number}] }]`
  ordered. `state` omitted when Established.
- `contested_open`: `{ intro?, items: [{ claim, state, body, why?, citations:[…] }], open_questions:[…] }` — omitted if absent.
- `timeline`: `[{ label, text, precision, citations:[…] }]` ordered by `sort` — omitted if absent.
- `keep_digging`: `[{ destination:{slug,title,subtitle} | null, coming_soon:{title}?, why_care, order }]` — **`relationship_type` stripped**.
- `sources`: `[{ number, type, title, authors?, publisher?, date?, url?, doi?, archive_url?, note?, citation }]` ordered; `citation` = the rendered string.
- `author_display`, `published_at`, `updated_at`.

**Excluded from public:** `id` (optional to include), `revision`, `created_by`,
`updated_by`, `editorial_note` on claims, `relationship_type`, `status` internals,
`_source_seq`, stub `planned_slug`, integrity flags, `origin`, `schema_version`.

### Authoring representation (admin)

Detail + `id, revision, status, origin, schema_version, created_by, updated_by,
created_at`; `state`/`why` shown even when Established; `editorial_note`;
`relationship_type` and stub details on connections; `validate` results
(failures + warnings).

---

## 12. Reuse vs replacement — current Topic / Connection & related infra

| Existing entity | Verdict | Reason |
|---|---|---|
| `videos` table + `Video` model + transcode / HLS / thumbnail / transcript / `Capabilities` pipeline | **Reuse untouched, as a referenced media store.** | The brief keeps video as a future evidence type. `media[]` entries reference `video_id`. Dormant until an editor attaches one. No model changes. |
| `embeddings` table + `search.py` (`_scan_all`, `pack_vector`, `cosine`, brute-force) | **Reuse the *pattern*; add a parallel `rabbithole_embeddings` table when search is turned on.** | Same brute-force-cosine approach is right at this scale. Don't cram RabbitHole vectors into the video table — different entity, and video embeddings may themselves be re-scoped. |
| Transcripts (S3 `cues.json` / `captions.vtt`), AWS Transcribe, ECS worker, SQS/EventBridge | **Reuse untouched.** Not part of the RabbitHole schema — reachable only through an attached video. | Video-internal. |
| External/hosted media (`source_type`, `provider`, `providers.py`, `EmbedPlayer`) | **Reuse untouched** for attached media. | Same as videos. |
| `topics` table + `Topic` model + `/topics` endpoints | **Retain for future taxonomy only. Not the RabbitHole graph.** Currently empty. | A Topic is a concept label; a RabbitHole is an article. A RabbitHole may later carry `topics: [slug]` tags for browse/faceting, reusing this table. Keep the empty table + endpoints; don't build V1 on them. |
| `topic_connections` table + `Connection` / `TopicConnection` models + `topicGraph.ts` / `mergeConnections` | **Retain the table for future topic-taxonomy relationships; do NOT extend it for RabbitHole connections.** Copy its proven pattern into `rabbithole_connections`; fix its missing reverse GSI. | Topic↔Topic ≠ RabbitHole↔RabbitHole. Overloading one table with both is the "reuse because it exists" anti-pattern. `topicGraph.ts` is frontend Map logic tied to tag co-occurrence — not reused. |
| `comments` table | **Out of scope / dormant.** | No comments on V1 RabbitHoles. |
| `users` table + single-admin JWT (`is_admin`, `auth.py`) | **Reuse as-is.** | Editorial writes are admin-only — exactly the current model. `created_by`/`updated_by` = the admin username. `author_display` is separate so bylines ≠ logins. Multi-editor later needs the real user store already flagged in `auth.py`. |
| DynamoDB Streams on `videos` → broadcaster Lambda → WebSocket | **Not used for RabbitHole V1.** No streams on the new tables. | RabbitHole has no real-time status. Cheap to add later if live-publish notifications are wanted. |
| Homepage `featured` flag, `_clear_featured`, `LibraryPage`, hop/thump reactions, favorites, votes, views, Tunnels-as-tag-cloud, Map-as-cooccurrence, Fresh/Trending/Tumble | **Conceptually obsolete** from the old video-discovery model. Not part of this schema. | Not deleted here (some UI still references them; that was the purge task's call). Simply not modelled. "Saved RabbitHoles" may revive the favorites *pattern* later. |

**Guiding rule applied:** reuse is chosen only where it is the best fit (video as
media, embeddings *pattern*, admin auth), never merely because the entity exists.

---

## 13. Validation rules (consolidated)

| Rule | Layer | Blocking? |
|---|---|---|
| Field types; `title`/`slug` present on create | pydantic (API) | yes (write) |
| `slug` `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 80 | API | yes (write) |
| `slug` globally unique | DB transaction | yes (write) |
| `subtitle` ≤ 140; `title` ≤ 80 | API | yes (write) |
| `what_we_know` 4–8 items | API `:publish` | yes (publish) |
| Every non-Established `state` has non-empty `why` | API `:publish` | yes (publish) |
| `contested_open` non-empty if present | API `:publish` | yes (publish) |
| `timeline` ≥ 4 entries if present; each has `label` + `sort` | API `:publish` | yes (publish) |
| Connections 3–5; each has `why_care`; ≤ 1 stub | API `:publish` | yes (publish) |
| Every non-stub connection target exists | API service (write + publish) | yes |
| ≥ 1 source | API `:publish` | yes (publish) |
| 5–15 sources | API `:publish` | **warning only** |
| Every citation id resolves to a source | API `:publish` | yes (publish) |
| No connection `target_unavailable` | API `:publish` | yes (publish) |
| Inbound-connection cascade on archive/delete | API service | n/a (side effect) |
| Hook 40–80 words; short_version 60–110; `why_care` ≤ 25 words; bullet ≤ 25 words; timeline text ≤ 15 words | Editorial tooling | warning only |
| Title factually accurate; no manufactured mystery; What-We-Know ↔ Timeline no duplicate events; "larger-context" connection states what the reader now understands | Editorial tooling | warning / checklist |
| `relationship_type` in enum | pydantic `Literal` | soft (unknown → warn) |

---

## 14. Schema evolution considerations

Each is a **cheap extension of the V1 shape**, not a migration:

| Future capability | How V1 already accommodates it |
|---|---|
| **Richer media evidence** | `media[]` field reserved; promote to `rabbithole_media` table (same object shape) if independent lifecycle/sharing is needed. |
| **User search-generated RabbitHoles** | `origin` field (`editorial` → `generated`) + a `generation_meta` object (prompt, model, source query). Generated items are `draft`, pass the same publish gate. |
| **AI-assisted drafting** | Same as generated — the schema is indifferent to how prose was authored. Optional per-field `ai_assisted: bool` later. |
| **Editorial revisions** | `rabbithole_revisions` table (recommended for V1). Add diff/restore tooling later. |
| **Claim-level provenance** | Every what-we-know bullet and competing explanation already has a stable `id` + `citations` + optional `state`/`why`. Promote these embedded objects — unchanged — to a `claims` table if cross-referencing or claim search becomes real. The stable `id` is what makes that safe. |
| **Graph visualization** | `rabbithole_connections` + its inbound GSI **is** the graph. Add a `weight` attribute (mirrors `topic_connections.strength`) if edge ranking is wanted. |
| **Personalized trails / saved RabbitHoles** | New per-user tables (`user_saved`, `user_trail`) keyed by user — additive, don't touch the RabbitHole schema (mirrors the existing favorites pattern). |
| **Additional languages** | `lang: "en"` reserved on every V1 item. A translation is a sibling item sharing a `translation_group_id`; slug namespace is per-lang. Split is clean because `lang` already exists. |
| **Shape migrations generally** | `schema_version` on every item from day one; migrations bump it and backfill lazily on read or in a batch. |

---

## 15. Explicit V1 non-goals

- No single-table design.
- No global/shared Source catalog or `RabbitHoleSource` join table.
- No generalized `Claim` entity/table (embedded objects with stable ids instead).
- No standalone Evidence section or entity.
- No page-level credibility score, and no confidence percentages anywhere.
- No stored reverse connections (derived via GSI).
- No auto-generated / tag-cooccurrence connections.
- No DynamoDB Streams / real-time surface on RabbitHole tables.
- No `rabbithole_embeddings` / semantic search / `/related` (schema noted, not built).
- No media rendering, no Evidence UI, no `rabbithole_media` table (field reserved only).
- No multi-editor identity model (single admin; `author_display` decoupled).
- No comments, reactions, favorites, views, votes on RabbitHoles.
- No word-count or style rules in the database or the publish gate (editorial tooling only).
- No homepage / frontend / Terraform / seeding work in this pass.
- No reuse of `topics` / `topic_connections` as the RabbitHole graph.

---

## 16. Risks / tradeoffs

1. **Embedded sub-sections vs. child records.** A pathological RabbitHole could
   approach the 400 KB item limit. V1 caps put realistic items at 15–40 KB.
   *Mitigation:* if a future format outgrows this, `sources`/`timeline` become
   child items under the same partition (SK prefixes); the read stays one
   `Query`. Tradeoff accepted.
2. **Citation stability depends on discipline.** Stable, never-reused source ids
   are the mechanism; an editor tool that renumbers sources would break
   citations. *Mitigation:* ids come from a monotonic `_source_seq`; the publish
   gate verifies every referenced id resolves; the authoring UI never exposes id
   assignment.
3. **Reverse connections derived, not stored.** Inbound rendering costs an extra
   `Query` + `BatchGetItem`. Negligible at V1 scale (hundreds of RabbitHoles,
   ≤ 5 edges each). *Mitigation if the graph grows large:* denormalise source
   summaries onto the GSI projection.
4. **Slug uniqueness needs a sentinel + transaction.** Forgetting to clean the
   sentinel on rename/delete leaks. *Mitigation:* one service method owns all
   slug changes and always does the paired write transactionally.
5. **Two edge tables (`topic_connections` + `rabbithole_connections`) look
   redundant.** Deliberate — different entities. *Mitigation:* documented here so
   a future reviewer doesn't "simplify" them into one overloaded table.
6. **`status` as a GSI partition key** could hot-partition if one status
   dominates. Irrelevant at V1 volume. *Mitigation later:* shard the PK
   (`status#<shard>`).
7. **Publish gate lives only in the API.** A direct DynamoDB write bypasses it
   (as the old seed scripts did). *Mitigation:* editorial writes go through the
   API; `validate_for_publish()` is a shared library function any import tool must
   call.
8. **Single-admin authorship.** `created_by`/`updated_by` is one username.
   *Mitigation:* `author_display` is already decoupled; multi-editor needs the
   real user store `auth.py` already flags.
9. **`rabbithole_revisions` is "recommended", not "required".** If it slips to
   V1.1, nothing else changes — but editorial history before that point is
   unrecoverable. Recommendation stands: include it.
10. **Timeline `sort` is a lossy derived scalar.** Two events in the same month
    with unknown days sort by insertion-ish order. *Mitigation:* authors control
    `order` explicitly; `sort` is only the default. Acceptable — timelines are
    ≤ 8 entries and human-checked.

---

## 17. Recommended implementation sequence

1. **Terraform** — add `rabbitholes` (GSIs: by-slug, by-status, published-feed),
   `rabbithole_connections` (GSI: inbound), `rabbithole_revisions`. PITR on, no
   streams. IAM for the API + deploy roles. `plan` → `apply`.
2. **Models** — `api/app/rabbithole_models.py`: pydantic models for the item and
   every embedded object, plus summary / detail / authoring response shapes.
3. **Store layer** — `api/app/rabbithole_store.py`: CRUD, slug transaction, GSI
   queries, revision snapshotting. Mirrors `aws.py` accessor style.
4. **Validation** — `validate_for_publish()` pure function + pydantic shape checks.
   Shared, importable.
5. **Rendering helpers** — citation id→number mapping, timeline sort, public-field
   projection, in `_to_summary()` / `_to_detail()` / `_to_authoring()`.
6. **API routes** — public `GET /rabbitholes`, `/rabbitholes/{slug}`,
   `/rabbitholes/{slug}/connections`; admin CRUD + lifecycle + `:validate`.
7. **Tests** — moto-backed, mirroring `api/tests/` style: create → publish-gate
   (every rule) → get-by-slug → outbound/inbound connections → revision → archive
   cascade. Cover every access pattern in §5.
8. **Seed one reference RabbitHole *through the API*** (not a direct write) — e.g.
   the QWERTY draft from the validation doc — to prove the path end-to-end.
   *(Deferred — this is the next task after schema sign-off.)*
9. *(Later)* `rabbithole_embeddings` + indexing job + `GET /rabbitholes/{slug}/related`.
10. *(Later)* Admin authoring UI with the editorial-warning checklist from §13.

---

## Example JSON

### A complete RabbitHole (storage / authoring shape)

```json
{
  "id": "rh_7f3a9c2e8b1d4f60a5e2c9d7b4a1f8e3",
  "schema_version": 1,
  "slug": "why-airplane-windows-are-round",
  "lang": "en",
  "status": "published",
  "origin": "editorial",

  "title": "Why Airplane Windows Are Round",
  "subtitle": "Airliner cabin windows are small ovals with rounded corners rather than squares, a design standard set by the earliest jet airliners.",
  "hook": "A pressurized airliner is essentially a balloon. At cruising altitude the cabin holds roughly eight pounds per square inch more pressure than the thin air outside, so the aluminium skin stretches slightly on every flight and relaxes on landing. Do that a few thousand times and any sharp corner in the structure — including a square window corner — becomes the place a fatigue crack quietly begins.",
  "short_version": "Cabin windows have generously rounded corners because a sharp corner concentrates stress into a small area, and repeated pressurization cycles turn that spot into a fatigue crack. The lesson was learned expensively. In 1954 two de Havilland Comets — the first jet airliners — broke apart in flight. Investigators pressurized a whole fuselage underwater until it failed, and traced the crack to the corner of a roughly rectangular cabin opening and the rivet holes around it. Every pressurized aircraft since has used openings with large corner radii and lower working stresses.",

  "what_we_know": [
    { "id": "wk1", "order": 1,
      "text": "The de Havilland Comet entered service in 1952 as the first jet airliner; two came apart in flight within three months of each other in early 1954.",
      "citations": ["s1"], "state": null, "editorial_note": null },
    { "id": "wk4", "order": 4,
      "text": "In the water-tank test the crack started at the corner of a cabin-roof aperture and nearby rivet and bolt holes — not at a passenger window.",
      "citations": ["s3"], "state": null,
      "editorial_note": "Common simplification says 'the windows'; addressed in contested_open." }
  ],

  "contested_open": {
    "intro": "The popular version — \"the Comet's passenger windows were square, and that's what failed\" — is a simplification.",
    "items": [
      { "id": "co1", "order": 1,
        "claim": "The Comet 1's passenger windows were square and were the direct failure point.",
        "state": "unsupported",
        "body": "The Comet 1's passenger windows were more squared-off than today's but were already given rounded corners. The reproduced fatigue crack originated at a different, roughly rectangular cabin-roof opening and the fastener holes around it.",
        "why": "No investigation finding places the initiating crack at a passenger window; the tank test and wreckage analysis point to the roof aperture and rivet/bolt holes.",
        "citations": ["s1", "s3"] },
      { "id": "co2", "order": 2,
        "claim": "Corners and holes in a cyclically pressurized skin are where fatigue cracks start, and corner radius, hole finishing and working stress must all be controlled together.",
        "state": "established",
        "body": "This principle is not disputed and reshaped how every later airframe is designed and inspected.",
        "why": null,
        "citations": ["s1", "s4"] }
    ],
    "open_questions": []
  },

  "timeline": [
    { "id": "tl1", "order": 1, "label": "1949",
      "start": { "year": 1949, "month": null, "day": null }, "end": null,
      "precision": "year", "sort": 1949.0794,
      "text": "The Comet prototype makes its first flight.", "citations": [] },
    { "id": "tl3", "order": 3, "label": "10 January 1954",
      "start": { "year": 1954, "month": 1, "day": 10 }, "end": null,
      "precision": "day", "sort": 1954.1019,
      "text": "BOAC Flight 781 breaks up near Elba; the fleet is briefly grounded, then returns to service.",
      "citations": ["s1"] }
  ],

  "sources": [
    { "id": "s1", "order": 1, "type": "primary", "classification": "primary",
      "title": "Report of the Court of Inquiry into the Accidents to Comet G-ALYP on 10th January, 1954, and Comet G-ALYY on 8th April, 1954",
      "authors": "Ministry of Transport and Civil Aviation", "publisher": "HMSO",
      "year": 1955, "date": "1955",
      "url": "https://reports.aviation-safety.net/1954/19540110-0_COMET_G-ALYP.pdf",
      "doi": null, "archive_url": null, "accessed": null,
      "note": "The official UK inquiry.", "citation_override": null },
    { "id": "s3", "order": 3, "type": "peer-reviewed", "classification": "secondary",
      "title": "Fatigue Failure of the de Havilland Comet I",
      "authors": "Withey, P. A.", "publisher": "Engineering Failure Analysis",
      "year": 1997, "date": "1997", "url": null,
      "doi": "10.1016/S1350-6307(97)00005-8", "archive_url": null,
      "accessed": null, "note": null, "citation_override": null }
  ],

  "media": [],

  "revision": 4,
  "created_at": "2026-09-06T18:22:10Z", "created_by": "admin",
  "updated_at": "2026-09-08T14:03:55Z", "updated_by": "admin",
  "published_at": "2026-09-08T14:04:12Z",
  "author_display": "RabbitHole Editorial",

  "_source_seq": 9,
  "_slug_lower": "why-airplane-windows-are-round"
}
```

### One What We Know item

```json
{
  "id": "wk4",
  "order": 4,
  "text": "In the water-tank test the crack started at the corner of a cabin-roof aperture and nearby rivet and bolt holes — not at a passenger window.",
  "citations": ["s3"],
  "state": null,
  "editorial_note": "Common simplification says 'the windows'; addressed in contested_open."
}
```
`state: null` ⇒ Established ⇒ no visible label.

### One contested / open explanation

```json
{
  "id": "co1",
  "order": 1,
  "claim": "The Comet 1's passenger windows were square and were the direct failure point.",
  "state": "unsupported",
  "body": "The Comet 1's passenger windows were more squared-off than today's but were already given rounded corners. The reproduced fatigue crack originated at a roughly rectangular cabin-roof opening and the fastener holes around it.",
  "why": "No investigation finding places the initiating crack at a passenger window.",
  "citations": ["s1", "s3"]
}
```

### One timeline entry (and the hard cases)

```json
{
  "id": "tl3", "order": 3, "label": "10 January 1954",
  "start": { "year": 1954, "month": 1, "day": 10 }, "end": null,
  "precision": "day", "sort": 1954.1019,
  "text": "BOAC Flight 781 breaks up near Elba.", "citations": ["s1"]
}
```
```json
{ "id": "tlX", "label": "c. 44 BCE", "order": 1,
  "start": { "year": -44, "month": 3, "day": 15 }, "end": null,
  "precision": "day", "sort": -43.7317, "text": "…", "citations": [] }
```
```json
{ "id": "tlY", "label": "Early Bronze Age", "order": 1,
  "start": { "year": -3300, "month": null, "day": null },
  "end":   { "year": -2100, "month": null, "day": null },
  "precision": "era", "sort": -3299.9206, "text": "…", "citations": [] }
```

*(`sort = year + (month ?? 1)/13 + (day ?? 1)/400`, computed on write; `/13` and
`/400` keep the month and day contributions from spilling into the next unit.
Adding a positive fraction always moves a date later, so BCE years — stored as
negative — order correctly too.)*

### One source

```json
{
  "id": "s3", "order": 3,
  "type": "peer-reviewed", "classification": "secondary",
  "title": "Fatigue Failure of the de Havilland Comet I",
  "authors": "Withey, P. A.",
  "publisher": "Engineering Failure Analysis",
  "year": 1997, "date": "1997",
  "url": null, "doi": "10.1016/S1350-6307(97)00005-8",
  "archive_url": null, "accessed": null,
  "note": null, "citation_override": null
}
```

### One citation link

Citations are **embedded id lists on claims**, not standalone rows. Stored:

```json
{ "citations": ["s3"] }          // on wk4
```

Conceptual model (many-to-many):

```json
{ "claim_id": "wk4", "source_ids": ["s3"] }
```

Rendered by the API (numbers derived from source order):

```json
{ "citations": [ { "source_id": "s3", "number": 2 } ] }
```

### One Keep Digging connection

Stored (`rabbithole_connections` item):

```json
{
  "source_id": "rh_7f3a9c2e8b1d4f60a5e2c9d7b4a1f8e3",
  "dest_key": "rh_2b9d1e4a7c6f8021b3e5d9a4c7f1028e",
  "destination_id": "rh_2b9d1e4a7c6f8021b3e5d9a4c7f1028e",
  "destination_stub": null,
  "relationship_type": "what-came-next",
  "why_care": "In 1988 a 737 lost a large section of its upper fuselage to widespread fatigue cracking, forcing today's structural inspection rules.",
  "reverse_why_care": null,
  "display_order": 2,
  "status": "active",
  "created_at": "2026-09-06T18:40:00Z",
  "updated_at": "2026-09-06T18:40:00Z"
}
```

Stub (target not yet written):

```json
{
  "source_id": "rh_7f3a9c2e8b1d4f60a5e2c9d7b4a1f8e3",
  "dest_key": "stub#stress-concentration",
  "destination_id": null,
  "destination_stub": { "title": "Stress concentration", "planned_slug": "stress-concentration" },
  "relationship_type": "related-mechanism",
  "why_care": "Why engineers care so much about fillet radii, notch shapes and hole placement: these are where almost all parts break.",
  "display_order": 3,
  "status": "coming_soon",
  "created_at": "2026-09-06T18:41:00Z",
  "updated_at": "2026-09-06T18:41:00Z"
}
```

Rendered in the public detail response (`relationship_type` stripped):

```json
{
  "keep_digging": [
    { "order": 2,
      "destination": { "slug": "aloha-airlines-flight-243", "title": "Aloha Airlines Flight 243", "subtitle": "A 1988 accident that rewrote fatigue-inspection rules." },
      "why_care": "In 1988 a 737 lost a large section of its upper fuselage to widespread fatigue cracking, forcing today's structural inspection rules." },
    { "order": 3,
      "destination": null,
      "coming_soon": { "title": "Stress concentration" },
      "why_care": "Why engineers care so much about fillet radii, notch shapes and hole placement: these are where almost all parts break." }
  ]
}
```

---

## Recommendation

### Ready to implement.

The schema is small — **2 required tables + 1 recommended** (`rabbitholes`,
`rabbithole_connections`, `rabbithole_revisions`) — and every V1 access pattern is
a `GetItem` or a single-partition `Query`. A full public page is 2–3 round trips.

It satisfies the design goals without over-engineering:

- **Editorial RabbitHoles, factual claims, inline citations** — one item, stable
  source ids, position-independent citations, no Evidence section, no credibility
  score.
- **Optional uncertainty and timeline sections** — genuinely optional (omitted, not
  emptied); timeline dates sort correctly across BCE/CE with one derived scalar
  while keeping authored human labels.
- **Authored Keep Digging connections** — a real directed graph from day one, with
  inbound lookup, coming-soon targets, and integrity rules; never derived from
  tags.
- **Future knowledge-graph, media/evidence, publishing workflow, revisions,
  search/indexing** — each has a concrete, cheap extension point already in the
  V1 shape (`rabbithole_connections` is the graph; `media[]` and `lang` and
  `schema_version` and `origin` are reserved; `rabbithole_revisions` and
  `rabbithole_embeddings` are drop-in parallel tables).
- **Reuse is deliberate, not incidental** — video as referenced media, the
  `embeddings`/`search.py` pattern, admin auth. `topics`/`topic_connections` are
  explicitly *not* reused as the graph.
- **Publish validation is one shared pure function** enforced at the API; word
  count and style stay in editorial tooling, per the brief.

**One open decision for the team, not a blocker:** whether `rabbithole_revisions`
ships in V1 or V1.1. Recommendation: V1 — it is ~30 lines, append-only, zero
read-path cost, and editorial history is unrecoverable if deferred.

Nothing in the design needs another pass before engineering formalises it in
Terraform and code.
