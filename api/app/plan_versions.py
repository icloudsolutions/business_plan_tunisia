"""Immutable plan version snapshots."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import BusinessPlan, PlanVersion


async def next_version_number(db: AsyncSession, plan_id: UUID) -> int:
    result = await db.execute(
        select(func.coalesce(func.max(PlanVersion.version_number), 0)).where(
            PlanVersion.plan_id == plan_id
        )
    )
    return int(result.scalar_one()) + 1


async def create_plan_snapshot(
    db: AsyncSession,
    plan: BusinessPlan,
    *,
    reason: str,
    created_by_id: UUID,
) -> PlanVersion:
    version_number = await next_version_number(db, plan.id)
    snapshot = PlanVersion(
        plan_id=plan.id,
        version_number=version_number,
        status_at_snapshot=plan.status,
        inputs=dict(plan.inputs or {}),
        results=dict(plan.results) if plan.results else None,
        reason=reason,
        created_by_id=created_by_id,
    )
    db.add(snapshot)
    await db.flush()
    return snapshot
