"""Build workflow status timestamps for plan API responses."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PlanActivity
from app.schemas import PlanStatusHistoryItem

WORKFLOW_STATUSES = ("DRAFT", "UNDER_REVIEW", "ADJUSTMENT", "VALIDATED")


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


def build_status_history_from_activities(
    plan_created_at: datetime,
    activities: list[PlanActivity],
) -> list[PlanStatusHistoryItem]:
    """Earliest timestamp per status (DRAFT = plan creation)."""
    by_status: dict[str, datetime] = {"DRAFT": plan_created_at}

    for act in sorted(activities, key=lambda a: a.created_at or plan_created_at):
        if act.kind != "status_change":
            continue
        status = _status_from_activity_meta(act.meta) or _status_from_activity_message(
            act.message or ""
        )
        if status and status != "DRAFT":
            by_status[status] = act.created_at

    return [
        PlanStatusHistoryItem(status=s, changed_at=by_status[s])
        for s in WORKFLOW_STATUSES
        if s in by_status
    ]


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
    return build_status_history_from_activities(plan_created_at, activities)


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
    grouped: dict[UUID, list[PlanActivity]] = {pid: [] for pid in plan_ids}
    for act in result.scalars().all():
        grouped.setdefault(act.plan_id, []).append(act)

    return {
        pid: build_status_history_from_activities(created[pid], grouped.get(pid, []))
        for pid in plan_ids
    }


def plan_response_with_history(plan, history: list[PlanStatusHistoryItem]):
    from app.schemas import PlanResponse

    return PlanResponse.model_validate(plan).model_copy(update={"history": history})
