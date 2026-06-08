"""Runtime configuration, sourced from environment variables."""

import os

from dotenv import load_dotenv

load_dotenv()

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
UPLOADS_BUCKET = os.getenv("UPLOADS_BUCKET", "")
VIDEOS_TABLE = os.getenv("VIDEOS_TABLE", "rabbithole-dev-videos")
CLOUDFRONT_DOMAIN = os.getenv("CLOUDFRONT_DOMAIN", "")
PRESIGN_EXPIRY_SECONDS = int(os.getenv("PRESIGN_EXPIRY_SECONDS", "900"))
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]
