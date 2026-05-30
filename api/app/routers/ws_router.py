"""WebSocket realtime channel for plan collaboration."""

import json
import logging
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from sqlalchemy import select

from app.access_control import user_can_access_plan
from app.config import settings
from app.database import async_session
from app.models import BusinessPlan, User
from app.realtime import (
    clear_presence,
    list_presence,
    plan_rooms,
    presence_color,
    touch_presence,
)

logger = logging.getLogger("bp.ws")
router = APIRouter(tags=["websocket"])


async def _user_from_token(token: str) -> User | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = UUID(payload["sub"])
    except (JWTError, ValueError):
        return None
    async with async_session() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()


@router.websocket("/ws/plans/{plan_id}")
async def plan_websocket(websocket: WebSocket, plan_id: UUID):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401)
        return

    user = await _user_from_token(token)
    if not user:
        await websocket.close(code=4401)
        return

    async with async_session() as db:
        result = await db.execute(select(BusinessPlan).where(BusinessPlan.id == plan_id))
        plan = result.scalar_one_or_none()
        if not plan or not user_can_access_plan(plan, user):
            await websocket.close(code=4403)
            return
        plan_status = plan.status

    pid = str(plan_id)
    await plan_rooms.connect(pid, websocket)
    await touch_presence(pid, str(user.id), user.email, user.role)

    presence_payload = {
        "users": [
            {
                **u,
                "color": presence_color(u.get("role", ""), u.get("user_id", "")),
            }
            for u in await list_presence(pid)
        ]
    }
    await websocket.send_text(
        json.dumps(
            {
                "type": "connected",
                "payload": {"plan_status": plan_status, "presence": presence_payload},
            },
            default=str,
        )
    )
    await plan_rooms.broadcast(
        pid,
        {"type": "presence.updated", "payload": presence_payload},
    )

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if msg.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            elif msg.get("type") == "presence.heartbeat":
                await touch_presence(pid, str(user.id), user.email, user.role)
                presence_payload = {
                    "users": [
                        {
                            **u,
                            "color": presence_color(u.get("role", ""), u.get("user_id", "")),
                        }
                        for u in await list_presence(pid)
                    ]
                }
                await plan_rooms.broadcast(
                    pid,
                    {"type": "presence.updated", "payload": presence_payload},
                )
    except WebSocketDisconnect:
        pass
    finally:
        await clear_presence(pid, str(user.id))
        await plan_rooms.disconnect(pid, websocket)
        presence_payload = {
            "users": [
                {
                    **u,
                    "color": presence_color(u.get("role", ""), u.get("user_id", "")),
                }
                for u in await list_presence(pid)
            ]
        }
        await plan_rooms.broadcast(
            pid,
            {"type": "presence.updated", "payload": presence_payload},
        )
