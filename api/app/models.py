from pydantic import BaseModel, Field


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=6, max_length=128)


class UploadRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = "video/mp4"
    title: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    visibility: str | None = None  # "public" | "unlisted"


class UpdateVideo(BaseModel):
    title: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    visibility: str | None = None  # "public" | "unlisted"


class UploadResponse(BaseModel):
    video_id: str
    upload_url: str
    key: str


class FeatureRequest(BaseModel):
    # Admin-only: designate (or clear) the single homepage Featured video.
    featured: bool = True


class ThumbnailSelectRequest(BaseModel):
    # Admin-only thumbnail override.
    #   mode="manual" + index -> make that generated candidate frame the thumbnail
    #   mode="auto"           -> restore the automatic best-frame choice
    mode: str = "manual"
    index: int | None = None


class ReactionRequest(BaseModel):
    # "hop" (approve), "thump" (disapprove), or null to clear.
    reaction: str | None = None


class VoteRequest(BaseModel):
    # Anonymous vote: move the counters from one reaction to another.
    # "from"/"to" are each "hop", "thump", or null.
    model_config = {"populate_by_name": True}
    from_: str | None = Field(default=None, alias="from")
    to: str | None = None


class SuggestRequest(BaseModel):
    # base64-encoded JPEG frames (no data: prefix), chronological order.
    frames: list[str] = Field(default_factory=list)


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)


class CommentCreate(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


class Comment(BaseModel):
    video_id: str
    comment_id: str
    author: str
    text: str
    created_at: str


class Capabilities(BaseModel):
    """What a content item can actually do, derived fresh from its own fields
    every time a Video is built (see main.py::_capabilities) -- never stored
    independently, so a capability can never drift from the state it
    describes. This is the same discipline has_transcript/transcribing
    already used before this field existed; it just generalizes it.

    play_internal   -- RabbitHole's own player can stream this (has hls_key)
    embed_external  -- can be embedded from its original host
    open_external   -- only makes sense as an outbound link (no player, no embed)
    transcript      -- a transcript exists at all
    moment_search   -- indexed for cross-video semantic transcript search
    ask_video       -- "Ask This Video" can answer questions about it
    tunnels         -- has at least one tag/topic, so it can sit in a Tunnel
    map             -- has at least one tag/topic, so it can be a Map node
    tumble          -- public and actually playable (internally or via embed)
    """

    play_internal: bool = False
    embed_external: bool = False
    open_external: bool = False
    transcript: bool = False
    moment_search: bool = False
    ask_video: bool = False
    tunnels: bool = False
    map: bool = False
    tumble: bool = False


class ContentTopic(BaseModel):
    """One curated (or AI-suggested, editor-reviewed) association between a
    piece of content and a Topic. Lives as a `topics` list attribute directly
    on the video item -- same shape as the existing `tags`/`thumbnail_candidates`
    list attributes, not a separate join table (see
    docs/RABBITHOLE_IMPLEMENTATION_GAP.md, P0-5)."""

    topic_id: str
    relevance: float = 1.0
    source: str = "editorial"  # "editorial" | "ai" | "derived"


class Video(BaseModel):
    video_id: str
    filename: str
    status: str
    created_at: str
    playback_url: str | None = None
    thumbnail_url: str | None = None
    duration_seconds: float | None = None
    cost_usd: str | None = None
    owner: str | None = None
    title: str | None = None
    description: str | None = None
    views: int = 0
    hops: int = 0
    thumps: int = 0
    tags: list[str] = []
    ai_generated: bool = False
    # Smart-thumbnail provenance. "auto" = frame chosen by the scoring pass,
    # "manual" = an admin picked a specific candidate frame. Absent on legacy
    # records (they predate smart thumbnails) -> reads as None, treated as
    # legacy/auto. thumbnail_timestamp is the point in the source the frame
    # was taken from. Internal scoring detail is not exposed here.
    thumbnail_source: str | None = None
    thumbnail_timestamp: float | None = None
    # Curated homepage Featured slot. Exactly one video is featured at a time
    # (enforced server-side); legacy records with no `featured` attribute read
    # as False.
    featured: bool = False
    # Authoritative transcript state. has_transcript is kept for existing
    # frontend code that already branches on it, but is always derived from
    # this field (ready -> true, everything else -> false) so the two can
    # never disagree. Legacy records with no transcript_status at all read
    # as None, which the frontend treats the same as "unavailable".
    transcript_status: str | None = None
    has_transcript: bool = False
    transcribing: bool = False
    transcript_url: str | None = None
    captions_url: str | None = None
    visibility: str = "public"
    # "hosted" (transcoded + stored by RabbitHole) | "external" (embedded or
    # linked from its original host). Legacy records with no source_type at
    # all derive to "hosted" whenever hls_key is present, else "external" --
    # see main.py::_to_video. Never requires a backfill.
    source_type: str = "hosted"
    # Derived capability set -- see Capabilities above. Always computed, never
    # independently trusted.
    capabilities: Capabilities = Capabilities()
    # Curated topic associations. Empty on every existing record until an
    # editor (or the one-off network seed script) adds some; `tags` remains
    # the uncurated fallback layer and is never replaced by this.
    topics: list[ContentTopic] = []


# A tag and how many (ready, public) videos carry it -- the lightweight
# "expertise" summary shown on a creator's profile. Renamed from the
# original `Topic` to free that name for the curated Topic/Concept entity
# below; the JSON shape ({"tag", "count"}) is unchanged.
class TagCount(BaseModel):
    tag: str
    count: int


class Creator(BaseModel):
    username: str
    joined: str | None = None
    video_count: int
    total_views: int
    total_hops: int
    topics: list[TagCount]
    videos: list[Video]


class Topic(BaseModel):
    """A curated concept -- the semantic layer above raw tags. Tags remain the
    unstructured fallback (still what Tunnels/Map use for anything that
    hasn't been curated yet); a Topic is what lets RabbitHole say something a
    bare tag never could: a real name, a short description, and a place in a
    Connection. See docs/RABBITHOLE_PRODUCT_MODEL.md, section 4."""

    topic_id: str
    slug: str
    name: str
    short_description: str | None = None
    aliases: list[str] = []
    # "published" is the only status this pass renders; "draft" exists so an
    # editor can stage a topic before it's ready to appear anywhere public.
    editorial_status: str = "published"
    created_at: str


class Connection(BaseModel):
    """A first-class, persisted relationship between two Topics -- what lets
    Map answer "why does following this make sense?" instead of just "these
    two tags co-occurred N times." See docs/RABBITHOLE_PRODUCT_MODEL.md,
    section 5."""

    from_topic: str
    to_topic: str
    relationship_type: str
    # The one field this whole feature exists for: 1-2 concise sentences
    # answering "why does this connect?"
    explanation: str
    strength: int = 1
    source: str = "editorial"  # "editorial" | "ai" | "derived"
    created_at: str


class TopicConnection(BaseModel):
    """One edge from the perspective of the topic you asked about -- `topic`
    is always the OTHER side, regardless of which of from_topic/to_topic that
    was in storage, so the caller never has to care about edge direction."""

    topic: str
    relationship_type: str
    explanation: str
    strength: int = 1
    source: str = "editorial"
