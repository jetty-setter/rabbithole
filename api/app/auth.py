"""Minimal JWT auth for the single creator account.

The video feed is public; uploading and managing require a signed-in creator.
(Production upgrade: swap this for Cognito / a real user store + multi-user.)
"""

import time

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import config

_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:  # noqa: BLE001
        return False


def is_admin(username: str) -> bool:
    return username == config.CREATOR_USERNAME


def create_token(sub: str) -> str:
    now = int(time.time())
    payload = {"sub": sub, "iat": now, "exp": now + config.JWT_TTL}
    return jwt.encode(payload, config.JWT_SECRET, algorithm="HS256")


def require_auth(cred: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str:
    if cred is None:
        raise HTTPException(status_code=401, detail="not authenticated")
    try:
        payload = jwt.decode(cred.credentials, config.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="invalid or expired token")
    return str(payload.get("sub", ""))


def optional_auth(cred: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str | None:
    """Like require_auth but never raises — returns the username if a valid token
    is present, else None. Lets public endpoints tailor what an owner sees."""
    if cred is None:
        return None
    try:
        payload = jwt.decode(cred.credentials, config.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    return str(payload.get("sub", "")) or None
