"""Pydantic models for the RabbitHole V1 content type.

Mirrors docs/RABBITHOLE_SCHEMA.md. A RabbitHole is stored as one DynamoDB item
(prose + bounded sub-sections embedded); Keep Digging connections live in a
separate table; each publish snapshots a revision.

Three "views":
  - RabbitHoleAuthoring  -> the full stored shape, admin only
  - RabbitHoleDetail     -> public reader payload, internal fields stripped
  - RabbitHoleSummary    -> list-item payload
"""

from __future__ import annotations

import re

from pydantic import BaseModel, Field

SCHEMA_VERSION = 1
DEFAULT_LANG = "en"
DEFAULT_ORIGIN = "editorial"

# "established" is represented by state == None on a What We Know bullet (no
# visible label). Inside the contested/open section every item carries an
# explicit state, including "established".
CREDIBILITY_STATES = ("established", "contested", "unsupported", "debunked")

# Internal editorial metadata only -- never rendered in a public response.
RELATIONSHIP_TYPES = (
    "involved",
    "same-kind-of-thing",
    "bigger-picture",
    "what-came-next",
    "competing-explanation",
)

STATUSES = ("draft", "in_review", "published", "archived")

SOURCE_TYPES = (
    "primary",
    "peer-reviewed",
    "institutional",
    "journalism",
    "secondary",
    "reference",
    "archival",
)

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


# ── embedded value objects (stored shape) ─────────────────────────────


class WhatWeKnowItem(BaseModel):
    id: str
    order: int
    text: str
    citations: list[str] = []
    state: str | None = None  # None => Established
    why: str | None = None
    editorial_note: str | None = None


class ContestedOpenItem(BaseModel):
    id: str
    order: int
    claim: str
    state: str  # one of CREDIBILITY_STATES (established allowed here, explicit)
    body: str
    why: str | None = None
    citations: list[str] = []


class ContestedOpen(BaseModel):
    intro: str | None = None
    items: list[ContestedOpenItem] = []
    open_questions: list[str] = []


class TimelinePoint(BaseModel):
    year: int  # negative == BCE, "-44" == "44 BCE"
    month: int | None = Field(default=None, ge=1, le=12)
    day: int | None = Field(default=None, ge=1, le=31)


class TimelineEntry(BaseModel):
    id: str
    order: int
    label: str  # authored, always displayed, never derived
    start: TimelinePoint
    end: TimelinePoint | None = None
    precision: str  # day | month | year | decade | century | era
    sort: float = 0.0  # derived; recomputed by the store on every write
    text: str
    citations: list[str] = []


class Source(BaseModel):
    id: str  # stable within the RabbitHole (s1..), never reused/renumbered
    order: int
    type: str
    classification: str | None = None  # primary | secondary
    title: str
    authors: str | None = None
    publisher: str | None = None
    year: int | None = None
    date: str | None = None
    url: str | None = None
    doi: str | None = None
    archive_url: str | None = None
    accessed: str | None = None
    note: str | None = None
    citation_override: str | None = None


class MediaReference(BaseModel):
    """Reserved extension point. No V1 rendering or validation."""

    id: str
    kind: str  # video | audio | image | document | archival
    role: str = "evidence"  # evidence | illustration | primary-source
    caption: str | None = None
    credit: str | None = None
    ref_type: str  # video_id | url | s3_key
    ref: str
    source_id: str | None = None


class DestinationStub(BaseModel):
    title: str
    planned_slug: str


# ── input variants (what an editor supplies) ──────────────────────────


class WhatWeKnowInput(BaseModel):
    id: str | None = None  # absent => store assigns wk<n>
    order: int | None = None
    text: str
    citations: list[str] = []
    state: str | None = None
    why: str | None = None
    editorial_note: str | None = None


class ContestedOpenItemInput(BaseModel):
    id: str | None = None
    order: int | None = None
    claim: str
    state: str
    body: str
    why: str | None = None
    citations: list[str] = []


class ContestedOpenInput(BaseModel):
    intro: str | None = None
    items: list[ContestedOpenItemInput] = []
    open_questions: list[str] = []


class TimelineEntryInput(BaseModel):
    id: str | None = None
    order: int | None = None
    label: str
    start: TimelinePoint
    end: TimelinePoint | None = None
    precision: str
    text: str
    citations: list[str] = []


class SourceInput(BaseModel):
    """`id` present => keep it stable; absent => the store assigns the next
    stable id. A present id that is not already on the record is rejected, so a
    typo can never silently re-point a citation."""

    id: str | None = None
    order: int | None = None
    type: str
    classification: str | None = None
    title: str
    authors: str | None = None
    publisher: str | None = None
    year: int | None = None
    date: str | None = None
    url: str | None = None
    doi: str | None = None
    archive_url: str | None = None
    accessed: str | None = None
    note: str | None = None
    citation_override: str | None = None


class ConnectionInput(BaseModel):
    destination_id: str | None = None
    destination_stub: DestinationStub | None = None
    relationship_type: str
    why_care: str
    display_order: int = 0
    reverse_why_care: str | None = None


# ── stored connection row ─────────────────────────────────────────────


class RabbitHoleConnection(BaseModel):
    source_id: str
    dest_key: str
    destination_id: str | None = None
    destination_stub: DestinationStub | None = None
    relationship_type: str
    why_care: str
    reverse_why_care: str | None = None
    display_order: int = 0
    status: str = "active"  # active | coming_soon | target_unavailable
    created_at: str
    updated_at: str


# ── create / update ──────────────────────────────────────────────────


class RabbitHoleCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=80)
    subtitle: str | None = Field(default=None, max_length=400)


class RabbitHoleUpdate(BaseModel):
    """PATCH body. Any provided scalar replaces its stored value; any provided
    list/object replaces wholesale (sections are authored as a unit). Use the
    clear_* flags to remove an optional section."""

    title: str | None = Field(default=None, max_length=200)
    slug: str | None = Field(default=None, max_length=80)
    subtitle: str | None = Field(default=None, max_length=400)
    hook: str | None = None
    short_version: str | None = None
    author_display: str | None = None
    what_we_know: list[WhatWeKnowInput] | None = None
    contested_open: ContestedOpenInput | None = None
    timeline: list[TimelineEntryInput] | None = None
    sources: list[SourceInput] | None = None
    media: list[MediaReference] | None = None
    clear_contested_open: bool = False
    clear_timeline: bool = False


# ── authoring view (full stored shape) ───────────────────────────────


class RabbitHoleAuthoring(BaseModel):
    id: str
    schema_version: int
    slug: str
    lang: str
    status: str
    origin: str
    title: str
    subtitle: str | None = None
    hook: str | None = None
    short_version: str | None = None
    what_we_know: list[WhatWeKnowItem] = []
    contested_open: ContestedOpen | None = None
    timeline: list[TimelineEntry] | None = None
    sources: list[Source] = []
    media: list[MediaReference] = []
    revision: int
    created_at: str
    created_by: str
    updated_at: str
    updated_by: str
    published_at: str | None = None
    author_display: str | None = None
    connections: list[RabbitHoleConnection] = []


# ── public detail view ───────────────────────────────────────────────


class RenderedCitation(BaseModel):
    source_id: str
    number: int


class DetailWhatWeKnow(BaseModel):
    text: str
    state: str | None = None  # only present when not Established
    why: str | None = None
    citations: list[RenderedCitation] = []


class DetailContestedItem(BaseModel):
    claim: str
    state: str
    body: str
    why: str | None = None
    citations: list[RenderedCitation] = []


class DetailContestedOpen(BaseModel):
    intro: str | None = None
    items: list[DetailContestedItem] = []
    open_questions: list[str] = []


class DetailTimelineEntry(BaseModel):
    label: str
    text: str
    precision: str
    citations: list[RenderedCitation] = []


class DetailConnectionTarget(BaseModel):
    slug: str
    title: str
    subtitle: str | None = None


class DetailComingSoon(BaseModel):
    title: str


class DetailConnection(BaseModel):
    order: int
    why_care: str
    destination: DetailConnectionTarget | None = None
    coming_soon: DetailComingSoon | None = None


class DetailInbound(BaseModel):
    from_: DetailConnectionTarget = Field(alias="from")
    why_care: str

    model_config = {"populate_by_name": True}


class DetailSource(BaseModel):
    number: int
    type: str
    classification: str | None = None
    title: str
    authors: str | None = None
    publisher: str | None = None
    date: str | None = None
    year: int | None = None
    url: str | None = None
    doi: str | None = None
    archive_url: str | None = None
    note: str | None = None
    citation: str  # rendered display string


class RabbitHoleDetail(BaseModel):
    slug: str
    title: str
    subtitle: str | None = None
    hook: str | None = None
    short_version: str | None = None
    what_we_know: list[DetailWhatWeKnow] = []
    contested_open: DetailContestedOpen | None = None
    timeline: list[DetailTimelineEntry] | None = None
    keep_digging: list[DetailConnection] = []
    sources: list[DetailSource] = []
    author_display: str | None = None
    published_at: str | None = None
    updated_at: str | None = None


# ── list view ────────────────────────────────────────────────────────


class RabbitHoleSummary(BaseModel):
    id: str
    slug: str
    title: str
    subtitle: str | None = None
    status: str
    published_at: str | None = None
    updated_at: str
    source_count: int = 0


# ── validation result ────────────────────────────────────────────────


class ValidationIssue(BaseModel):
    code: str
    field: str | None = None
    message: str


class ValidationResult(BaseModel):
    ok: bool
    failures: list[ValidationIssue] = []
    warnings: list[ValidationIssue] = []
