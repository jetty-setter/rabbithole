from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class UploadRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = "video/mp4"


class UploadResponse(BaseModel):
    video_id: str
    upload_url: str
    key: str


class Video(BaseModel):
    video_id: str
    filename: str
    status: str
    created_at: str
    playback_url: str | None = None
    thumbnail_url: str | None = None
    duration_seconds: str | None = None
    cost_usd: str | None = None
