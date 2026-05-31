"""Lecture progression export pack (Redis, écrit par le worker)."""

from __future__ import annotations

import json
import os

import redis


def get_export_progress_from_redis(job_id: str) -> dict:
    url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    try:
        client = redis.from_url(url, decode_responses=True)
        raw = client.get(f"export:progress:{job_id}")
        if raw:
            return json.loads(raw)
    except (redis.RedisError, json.JSONDecodeError):
        pass
    return {"progress_pct": 0, "files_ready": []}
