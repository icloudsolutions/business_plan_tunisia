"""Build workflow status timestamps for plan API responses."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PlanActivity, User
from app.schemas import PlanStatusHistoryItem

WORKFLOW_STATUSES = ("DRAFT", "UNDER_REVIEW", "ADJUSTMENT", "VALIDATED")

_StatusRecord = tuple[datetime, str | None]


def _status_from_activity_message(message: str) -> str | None:
    if "→" not in message:
        return None
    tail = message.split("→", 1)[1].strip()
    token = tail.split()[0].strip() if tail else ""
    return token if token in WORKFLOW_STATUSES else None


def _status_from_activity_meta(meta: dict | None) -> str | None:
    if not meta:
        return None
    status = meta.get("status")
    if isinstance(status, str) and status in WORKFLOW_STATUSES:
        return status
    return None


def _user_label(user: User | None) -> str | None:
    if user is None:
        return None
    if user.display_name and user.display_name.strip():
        return user.display_name.strip()
    return user.email


def build_status_history_from_activities(
    plan_created_at: datetime,
    activities: list[PlanActivity],
    users_by_id: dict[UUID, User] | None = None,
) -> list[PlanStatusHistoryItem]:
    """Earliest timestamp per status (DRAFT = plan creation)."""
    users_by_id = users_by_id or {}
    by_status: dict[str, _StatusRecord] = {
        "DRAFT": (plan_created_at, None),
    }

    for act in sorted(activities, key=lambda a: a.created_at or plan_created_at):
        if act.kind != "status_change":
            continue
        status = _status_from_activity_meta(act.meta) or _status_from_activity_message(
            act.message or ""
        )
        if status and status != "DRAFT":
            by_status[status] = (
                act.created_at,
                _user_label(users_by_id.get(act.user_id)) if act.user_id else None,
            )

    return [
        PlanStatusHistoryItem(
            status=s,
            changed_at=by_status[s][0],
            changed_by=by_status[s][1],
        )
        for s in WORKFLOW_STATUSES
        if s in by_status
    ]


async def _load_users_for_activities(
    db: AsyncSession, activities: list[PlanActivity]
) -> dict[UUID, User]:
    user_ids = {act.user_id for act in activities if act.user_id}
    if not user_ids:
        return {}
    result = await db.execute(select(User).where(User.id.in_(user_ids)))
    return {u.id: u for u in result.scalars().all()}


async def fetch_plan_status_history(
    db: AsyncSession,
    plan_id: UUID,
    plan_created_at: datetime,
) -> list[PlanStatusHistoryItem]:
    result = await db.execute(
        select(PlanActivity)
        .where(
            PlanActivity.plan_id == plan_id,
            PlanActivity.kind == "status_change",
        )
        .order_by(PlanActivity.created_at.asc())
    )
    activities = list(result.scalars().all())
    users = await _load_users_for_activities(db, activities)
    return build_status_history_from_activities(plan_created_at, activities, users)


async def fetch_status_histories_batch(
    db: AsyncSession,
    plans: list[tuple[UUID, datetime]],
) -> dict[UUID, list[PlanStatusHistoryItem]]:
    if not plans:
        return {}
    plan_ids = [p[0] for p in plans]
    created = {pid: ts for pid, ts in plans}
    result = await db.execute(
        select(PlanActivity)
        .where(
            PlanActivity.plan_id.in_(plan_ids),
            PlanActivity.kind == "status_change",
        )
        .order_by(PlanActivity.created_at.asc())
    )
    all_activities = list(result.scalars().all())
    users = await _load_users_for_activities(db, all_activities)

    grouped: dict[UUID, list[PlanActivity]] = {pid: [] for pid in plan_ids}
    for act in all_activities:
        grouped.setdefault(act.plan_id, []).append(act)

    return {
        pid: build_status_history_from_activities(created[pid], grouped.get(pid, []), users)
        for pid in plan_ids
    }


def plan_response_with_history(plan, history: list[PlanStatusHistoryItem]):
    from app.schemas import PlanResponse

    return PlanResponse.model_validate(plan).model_copy(update={"history": history})
