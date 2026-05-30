"""Admin helpers: completion %, analytics, system health."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from bp_schema.liasse import PlanInputs
from bp_schema.completion import compute_plan_completion

from app.models import BusinessPlan, EmailNotification, ExportJob, PlanActivity, PlanVersion, User


def completion_percent(inputs: dict) -> int:
    try:
        validated = PlanInputs.model_validate(inputs)
        return compute_plan_completion(validated)["overall_pct"]
    except Exception:
        return 0


async def user_plans_count(db: AsyncSession, user_id: UUID) -> int:
    r = await db.execute(
        select(func.count()).select_from(BusinessPlan).where(BusinessPlan.owner_id == user_id)
    )
    return int(r.scalar_one())


async def latest_export_status(db: AsyncSession, plan_id: UUID) -> str:
    r = await db.execute(
        select(ExportJob.status)
        .where(ExportJob.plan_id == plan_id)
        .order_by(ExportJob.created_at.desc())
        .limit(1)
    )
    row = r.scalar_one_or_none()
    return row or "—"


async def build_email_delivery_stats(db: AsyncSession) -> dict:
    total_r = await db.execute(select(func.count()).select_from(EmailNotification))
    total = int(total_r.scalar_one())

    sent_r = await db.execute(
        select(func.count())
        .select_from(EmailNotification)
        .where(EmailNotification.sent_at.isnot(None))
    )
    sent = int(sent_r.scalar_one())

    opened_r = await db.execute(
        select(func.count())
        .select_from(EmailNotification)
        .where(EmailNotification.opened_at.isnot(None))
    )
    opened = int(opened_r.scalar_one())

    failed_r = await db.execute(
        select(func.count())
        .select_from(EmailNotification)
        .where(EmailNotification.sent_at.is_(None), EmailNotification.error.isnot(None))
    )
    failed = int(failed_r.scalar_one())

    by_type_r = await db.execute(
        select(EmailNotification.type, func.count())
        .group_by(EmailNotification.type)
    )
    by_type = [{"type": row[0], "count": int(row[1])} for row in by_type_r.all()]

    pending = max(0, total - sent - failed)
    open_rate = round(100 * opened / sent, 1) if sent else 0.0

    return {
        "total": total,
        "sent": sent,
        "pending": pending,
        "failed": failed,
        "opened": opened,
        "openRatePct": open_rate,
        "byType": by_type,
    }


async def build_analytics(db: AsyncSession) -> dict:
    plans_r = await db.execute(select(BusinessPlan))
    plans = plans_r.scalars().all()

    by_month: dict[str, int] = {}
    by_state: dict[str, int] = {}
    for p in plans:
        month = p.created_at.strftime("%Y-%m") if p.created_at else "unknown"
        by_month[month] = by_month.get(month, 0) + 1
        by_state[p.status] = by_state.get(p.status, 0) + 1

    months_sorted = sorted(by_month.keys())
    plans_per_month = [{"month": m, "count": by_month[m]} for m in months_sorted]

    state_distribution = [{"state": k, "count": v} for k, v in by_state.items()]

    # Expert workload
    expert_r = await db.execute(select(User).where(User.role == "expert"))
    experts = expert_r.scalars().all()
    workload = []
    for ex in experts:
        c = await db.execute(
            select(func.count())
            .select_from(BusinessPlan)
            .where(BusinessPlan.assigned_expert_id == ex.id)
        )
        workload.append(
            {
                "expert_id": str(ex.id),
                "expert_email": ex.email,
                "plans_count": int(c.scalar_one()),
            }
        )

    # Avg days in state from version snapshots
    versions_r = await db.execute(
        select(PlanVersion).order_by(PlanVersion.plan_id, PlanVersion.version_number)
    )
    versions = versions_r.scalars().all()
    state_durations: dict[str, list[float]] = {}
    by_plan: dict[UUID, list[PlanVersion]] = {}
    for v in versions:
        by_plan.setdefault(v.plan_id, []).append(v)

    for pid, vers in by_plan.items():
        vers.sort(key=lambda x: x.version_number)
        for i, v in enumerate(vers):
            start = v.created_at
            end = vers[i + 1].created_at if i + 1 < len(vers) else datetime.now(timezone.utc)
            if start and end:
                days = (end - start).total_seconds() / 86400
                state_durations.setdefault(v.status_at_snapshot, []).append(days)

    avg_time_per_state = [
        {
            "state": st,
            "avgDays": round(sum(vals) / len(vals), 1) if vals else 0,
        }
        for st, vals in sorted(state_durations.items())
    ]

    activities_r = await db.execute(
        select(PlanActivity)
        .where(PlanActivity.kind == "status_change")
        .order_by(PlanActivity.created_at.desc())
        .limit(50)
    )
    recent_transitions = len(activities_r.scalars().all())

    email_stats = await build_email_delivery_stats(db)

    return {
        "plansPerMonth": plans_per_month,
        "stateDistribution": state_distribution,
        "avgTimePerState": avg_time_per_state,
        "expertWorkload": workload,
        "totalPlans": len(plans),
        "recentTransitions": recent_transitions,
        "emailDelivery": email_stats,
    }


async def postgres_storage_bytes(db: AsyncSession) -> int:
    r = await db.execute(
        text("SELECT pg_database_size(current_database()) AS size")
    )
    row = r.mappings().first()
    return int(row["size"]) if row else 0


async def celery_queue_depth() -> dict[str, int]:
    try:
        import redis.asyncio as aioredis
        from app.config import settings

        r = await aioredis.from_url(settings.redis_url, decode_responses=True)
        depths: dict[str, int] = {}
        for key in ("calc", "export", "email", "celery"):
            try:
                depths[key] = await r.llen(key)
            except Exception:
                depths[key] = 0
        # Default Celery Redis transport keys
        for key in await r.keys("celery*"):
            if await r.type(key) == "list":
                depths[key] = await r.llen(key)
        await r.aclose()
        return depths
    except Exception:
        return {"calc": 0, "export": 0, "unavailable": 1}
