"""Shared boto3 clients. Created at import time (no AWS calls happen),
Safe to import without credentials (e.g. in CI)."""

import boto3

from . import config

_session = boto3.session.Session(region_name=config.AWS_REGION)

s3 = _session.client("s3")
ssm = _session.client("ssm")
_dynamodb = _session.resource("dynamodb")


def videos_table():
    return _dynamodb.Table(config.VIDEOS_TABLE)


def users_table():
    return _dynamodb.Table(config.USERS_TABLE)


def comments_table():
    return _dynamodb.Table(config.COMMENTS_TABLE)


def embeddings_table():
    return _dynamodb.Table(config.EMBEDDINGS_TABLE)


def topics_table():
    return _dynamodb.Table(config.TOPICS_TABLE)


def topic_connections_table():
    """The curated Topic<->Topic relationship table -- deliberately not named
    connections_table(): that name is already the WebSocket connection-id
    table's table (see infra/websocket.tf)."""
    return _dynamodb.Table(config.TOPIC_CONNECTIONS_TABLE)
