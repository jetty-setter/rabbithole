"""Shared boto3 clients. Created at import time — no AWS calls happen here,
so this is safe to import without credentials (e.g. in CI)."""

import boto3

from . import config

_session = boto3.session.Session(region_name=config.AWS_REGION)

s3 = _session.client("s3")
_dynamodb = _session.resource("dynamodb")


def videos_table():
    return _dynamodb.Table(config.VIDEOS_TABLE)
