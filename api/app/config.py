"""Runtime configuration, sourced from environment variables."""

import os

from dotenv import load_dotenv

load_dotenv()

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
UPLOADS_BUCKET = os.getenv("UPLOADS_BUCKET", "")
STREAMING_BUCKET = os.getenv("STREAMING_BUCKET", "")
VIDEOS_TABLE = os.getenv("VIDEOS_TABLE", "rabbithole-dev-videos")
USERS_TABLE = os.getenv("USERS_TABLE", "rabbithole-dev-users")
COMMENTS_TABLE = os.getenv("COMMENTS_TABLE", "rabbithole-dev-comments")
# AI title/description suggestions at upload time.
ANTHROPIC_KEY_PARAM = os.getenv("ANTHROPIC_KEY_PARAM", "")
AI_MODEL = os.getenv("AI_MODEL", "claude-opus-4-8")
CLOUDFRONT_DOMAIN = os.getenv("CLOUDFRONT_DOMAIN", "")
PRESIGN_EXPIRY_SECONDS = int(os.getenv("PRESIGN_EXPIRY_SECONDS", "900"))

# Auth (single creator account)
CREATOR_USERNAME = os.getenv("CREATOR_USERNAME", "admin")
CREATOR_PASSWORD = os.getenv("CREATOR_PASSWORD", "")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_TTL = int(os.getenv("JWT_TTL", "86400"))
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]
