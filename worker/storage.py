"""S3 upload and download helpers."""

from __future__ import annotations

from pathlib import Path

import boto3

from transcoder import _content_type

_s3 = None


def _get_s3():
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3")
    return _s3


def upload_tree(local_dir: Path, bucket: str, prefix: str, s3_client=None) -> None:
    """Recursively upload a local directory tree to S3 under prefix."""
    client = s3_client or _get_s3()
    for path in local_dir.rglob("*"):
        if path.is_file():
            rel = path.relative_to(local_dir).as_posix()
            client.upload_file(
                str(path), bucket, f"{prefix}/{rel}",
                ExtraArgs={"ContentType": _content_type(path)},
            )
