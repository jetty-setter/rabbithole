"""Shared boto3 clients. Created at import time (no AWS calls happen),
Safe to import without credentials (e.g. in CI)."""

import boto3

from . import config

_session = boto3.session.Session(region_name=config.AWS_REGION)

s3 = _session.client("s3")
ssm = _session.client("ssm")
_dynamodb = _session.resource("dynamodb")
# Resource handle for high-level access (auto-marshalling), plus a *separate*
# low-level client for the few operations the resource API doesn't cover
# cleanly -- TransactWriteItems needs raw AttributeValue maps, and the
# resource's own meta.client double-marshals them.
dynamodb = _dynamodb
dynamodb_client = _session.client("dynamodb")


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


def rabbitholes_table():
    return _dynamodb.Table(config.RABBITHOLES_TABLE)


def rabbithole_connections_table():
    return _dynamodb.Table(config.RABBITHOLE_CONNECTIONS_TABLE)


def rabbithole_revisions_table():
    return _dynamodb.Table(config.RABBITHOLE_REVISIONS_TABLE)
