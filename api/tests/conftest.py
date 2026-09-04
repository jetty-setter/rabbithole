"""Shared test fixtures.

Config is read from the environment at import time (config.py), so we set it
*before* the app is imported — which is why these os.environ writes live at module
top, ahead of any `app` import. AWS is faked with moto, so the suite needs no
real credentials and makes no network calls.
"""

import os

import boto3
import pytest

# ── Environment (must be set before app/config import) ──────────────
os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")
os.environ.setdefault("AWS_SESSION_TOKEN", "testing")
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
os.environ["AWS_REGION"] = "us-east-1"
os.environ["VIDEOS_TABLE"] = "test-videos"
os.environ["USERS_TABLE"] = "test-users"
os.environ["COMMENTS_TABLE"] = "test-comments"
os.environ["EMBEDDINGS_TABLE"] = "test-embeddings"
os.environ["TOPICS_TABLE"] = "test-topics"
os.environ["TOPIC_CONNECTIONS_TABLE"] = "test-connections"
os.environ["UPLOADS_BUCKET"] = "test-uploads"
os.environ["STREAMING_BUCKET"] = "test-streaming"
os.environ["CLOUDFRONT_DOMAIN"] = "cdn.example.com"
os.environ["JWT_SECRET"] = "test-secret"
os.environ["CREATOR_USERNAME"] = "admin"
os.environ["ALLOWED_ORIGINS"] = "*"

from moto import mock_aws  # noqa: E402


@pytest.fixture
def aws_stack():
    """Active moto backend with the three tables + two buckets created."""
    with mock_aws():
        ddb = boto3.resource("dynamodb", region_name="us-east-1")
        ddb.create_table(
            TableName="test-videos",
            KeySchema=[{"AttributeName": "video_id", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "video_id", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )
        ddb.create_table(
            TableName="test-users",
            KeySchema=[{"AttributeName": "username", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "username", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )
        ddb.create_table(
            TableName="test-comments",
            KeySchema=[
                {"AttributeName": "video_id", "KeyType": "HASH"},
                {"AttributeName": "comment_id", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "video_id", "AttributeType": "S"},
                {"AttributeName": "comment_id", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        ddb.create_table(
            TableName="test-embeddings",
            KeySchema=[
                {"AttributeName": "video_id", "KeyType": "HASH"},
                {"AttributeName": "chunk", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "video_id", "AttributeType": "S"},
                {"AttributeName": "chunk", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        ddb.create_table(
            TableName="test-topics",
            KeySchema=[{"AttributeName": "slug", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "slug", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )
        ddb.create_table(
            TableName="test-connections",
            KeySchema=[
                {"AttributeName": "from_topic", "KeyType": "HASH"},
                {"AttributeName": "to_topic", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "from_topic", "AttributeType": "S"},
                {"AttributeName": "to_topic", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket="test-uploads")
        s3.create_bucket(Bucket="test-streaming")
        yield


@pytest.fixture
def client(aws_stack):
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


@pytest.fixture
def videos_table(aws_stack):
    return boto3.resource("dynamodb", region_name="us-east-1").Table("test-videos")


@pytest.fixture
def topics_table(aws_stack):
    return boto3.resource("dynamodb", region_name="us-east-1").Table("test-topics")


@pytest.fixture
def connections_table(aws_stack):
    return boto3.resource("dynamodb", region_name="us-east-1").Table("test-connections")


def token(username: str) -> str:
    """Mint a valid bearer token for any username (require_auth only decodes it)."""
    from app.auth import create_token

    return create_token(username)


def auth(username: str) -> dict:
    return {"Authorization": f"Bearer {token(username)}"}


def seed_video(table, **over):
    item = {
        "video_id": over.get("video_id", "vid-1"),
        "filename": "clip.mp4",
        "status": "ready",
        "created_at": "2026-01-01T00:00:00+00:00",
        "owner": "alice",
        "visibility": "public",
        "hls_key": f"{over.get('video_id', 'vid-1')}/hls/master.m3u8",
        "thumb_key": f"{over.get('video_id', 'vid-1')}/thumb.jpg",
    }
    item.update(over)
    table.put_item(Item=item)
    return item
