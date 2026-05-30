"""In-process WebSocket rooms + optional Redis presence."""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any
from uuid import UUID

from fastapi import WebSocket

logger = logging.getLogger("bp.realtime")

SECTION_KEYS = ("general", "investments", "financing", "operations", "hr", "financial")


class PlanRoomManager:
    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, plan_id: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._rooms[plan_id].add(ws)

    async def disconnect(self, plan_id: str, ws: WebSocket) -> None:
        async with self._lock:
            self._rooms[plan_id].discard(ws)
            if not self._rooms[plan_id]:
                del self._rooms[plan_id]

    async def broadcast(self, plan_id: str, message: dict[str, Any]) -> None:
        payload = json.dumps(message, default=str)
        async with self._lock:
            sockets = list(self._rooms.get(plan_id, ()))
        dead: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(plan_id, ws)


plan_rooms = PlanRoomManager()


async def get_redis():
    try:
        import redis.asyncio as aioredis

        from app.config import settings

        return aioredis.from_url(settings.redis_url, decode_responses=True)
    except Exception as e:
        logger.debug("Redis unavailable: %s", e)
        return None


async def touch_presence(plan_id: str, user_id: str, email: str, role: str) -> None:
    r = await get_redis()
    if not r:
        return
    key = f"plan:presence:{plan_id}"
    entry = json.dumps({"email": email, "role": role, "user_id": user_id})
    await r.hset(key, user_id, entry)
    await r.expire(key, 45)
    await r.aclose()


async def clear_presence(plan_id: str, user_id: str) -> None:
    r = await get_redis()
    if not r:
        return
    await r.hdel(f"plan:presence:{plan_id}", user_id)
    await r.aclose()


async def list_presence(plan_id: str) -> list[dict[str, Any]]:
    r = await get_redis()
    if not r:
        return []
    key = f"plan:presence:{plan_id}"
    raw = await r.hgetall(key)
    await r.aclose()
    out: list[dict[str, Any]] = []
    for uid, blob in raw.items():
        try:
            data = json.loads(blob)
            data["user_id"] = uid
            out.append(data)
        except json.JSONDecodeError:
            continue
    return out


def presence_color(role: str, user_id: str) -> str:
    if role == "expert":
        return "#2563eb"
    if role == "client":
        return "#d97706"
    palette = ["#059669", "#7c3aed", "#db2777", "#0891b2"]
    return palette[hash(user_id) % len(palette)]


async def broadcast_plan_event(plan_id: UUID, event_type: str, payload: dict[str, Any]) -> None:
    await plan_rooms.broadcast(
        str(plan_id),
        {"type": event_type, "payload": payload},
    )
