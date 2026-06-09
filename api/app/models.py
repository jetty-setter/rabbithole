from pydantic import BaseModel, Field


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=6, max_length=128)


class UploadRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = "video/mp4"
    title: str | None = None
    description: str | None = None


class UpdateVideo(BaseModel):
    title: str | None = None
    description: str | None = None


class UploadResponse(BaseModel):
    video_id: str
    upload_url: str
    key: str


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
    likes: int = 0
