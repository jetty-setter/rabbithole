"""RabbitHole API — presigned uploads + job status.

Runs locally as a normal FastAPI app (uvicorn) and on AWS Lambda via Mangum.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from . import config, rabbithole_routes
from .routers import ai, comments, curation, discovery, engagement, system, topics, uploads, videos

app = FastAPI(title="RabbitHole API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# RabbitHole V1 content model (see docs/RABBITHOLE_SCHEMA.md).
app.include_router(rabbithole_routes.router)

for module in (system, ai, engagement, uploads, videos, topics, discovery, curation, comments):
    app.include_router(module.router)

# Lambda entrypoint
handler = Mangum(app)
