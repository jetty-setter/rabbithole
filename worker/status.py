"""DynamoDB video status management."""

from __future__ import annotations

import os

import boto3
from botocore.exceptions import ClientError

VIDEOS_TABLE = os.getenv("VIDEOS_TABLE", "rabbithole-dev-videos")

_videos = None


def _get_videos():
    global _videos
    if _videos is None:
        _videos = boto3.resource("dynamodb").Table(VIDEOS_TABLE)
    return _videos


def video_id_from_key(key: str) -> str | None:
    """Parse video_id from an S3 key like uploads/{video_id}/{filename}."""
    parts = key.split("/")
    if len(parts) >= 3 and parts[0] == "uploads":
        return parts[1]
    return None


def set_status(video_id: str, status: str, extra: dict | None = None) -> None:
    """Update the video's status field (and optional extra fields) in DynamoDB.

    Uses a conditional write to prevent ghost records — if the video was deleted
    before the worker finished, the update is silently dropped."""
    expr = "SET #s = :s"
    names = {"#s": "status"}
    values: dict = {":s": status}
    for i, (field, value) in enumerate((extra or {}).items()):
        expr += f", #k{i} = :v{i}"
        names[f"#k{i}"] = field
        values[f":v{i}"] = value
    try:
        _get_videos().update_item(
            Key={"video_id": video_id},
            UpdateExpression=expr,
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            # Never create a record — only update an existing one. Prevents the
            # "phantom untitled video" bug when a job runs for a deleted video.
            ConditionExpression="attribute_exists(video_id)",
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            print(f"record {video_id} no longer exists; skipping status update")
            return
        raise
