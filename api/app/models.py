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


class CommentCreate(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


class Comment(BaseModel):
    video_id: str
    comment_id: str
    author: str
    text: str
    created_at: str


class Video(BaseModel):
    video_id: str
    filename: str
    status: str
    created_at: str
    playback_url: str | None = None
    thumbnail_url: str | None = None
    duration_seconds: str | None = None
    cost_usd: str | None = None
    owner: str | None = None
    title: str | None = None
    description: str | None = None
    views: int = 0
    hops: int = 0
    thumps: int = 0
    tags: list[str] = []
    ai_generated: bool = False
    has_transcript: bool = False
    transcribing: bool = False
    transcript_url: str | None = None
    captions_url: str | None = None
    visibility: str = "public"
