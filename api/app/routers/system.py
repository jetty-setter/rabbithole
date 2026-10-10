"""Health check and authentication routes."""

from __future__ import annotations

from botocore.exceptions import ClientError
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from .. import aws, config
from ..auth import create_token, hash_password, is_admin, require_auth, verify_password
from ..models import Credentials

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.post("/auth/signup")
def signup(req: Credentials) -> dict:
    username = req.username.strip().lower()
    # The creator account is provisioned out-of-band
    if username == config.CREATOR_USERNAME.strip().lower():
        raise HTTPException(status_code=409, detail="username already taken")
    item = {
        "username": username,
        "password_hash": hash_password(req.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        aws.users_table().put_item(
            Item=item, ConditionExpression="attribute_not_exists(username)"
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise HTTPException(status_code=409, detail="username already taken") from exc
        raise
    return {"token": create_token(username), "username": username, "is_admin": is_admin(username)}


@router.post("/auth/login")
def login(req: Credentials) -> dict:
    username = req.username.strip().lower()
    user = aws.users_table().get_item(Key={"username": username}).get("Item")
    if not user or not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="invalid credentials")
    return {"token": create_token(username), "username": username, "is_admin": is_admin(username)}


@router.get("/auth/me")
def me(user: str = Depends(require_auth)) -> dict:
    return {"username": user, "is_admin": is_admin(user)}


@router.get("/auth/demo")
def demo_login() -> dict:
    """Return a read-only viewer token for the demo/portfolio user.

    The token is a normal short-lived JWT — it grants the same access as any
    signed-in viewer (favorites, reactions) but not admin/upload privileges.
    Called automatically by the frontend on first load so visitors arrive
    already signed in as the demo account.
    """
    username = config.DEMO_USERNAME
    return {"token": create_token(username), "username": username, "is_admin": False}
