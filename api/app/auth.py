"""Minimal JWT auth for the single creator account.

The video feed is public; uploading and managing require a signed-in creator.
(Production upgrade: swap this for Cognito / a real user store + multi-user.)
"""

import time

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import config

_bearer = HTTPBearer(auto_error=False)


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
