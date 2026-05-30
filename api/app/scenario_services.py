"""Plan scenario defaults and helpers."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bp_calc.scenarios import BUILTIN_SCENARIOS, DEFAULT_MULTIPLIERS, normalize_multipliers

from app.models import PlanScenario


async def ensure_default_scenarios(db: AsyncSession, plan_id: UUID) -> list[PlanScenario]:
    result = await db.execute(select(PlanScenario).where(PlanScenario.plan_id == plan_id))
    existing = {s.slug: s for s in result.scalars().all() if s.slug}
    created: list[PlanScenario] = []
    for slug, name in BUILTIN_SCENARIOS:
        if slug in existing:
            created.append(existing[slug])
            continue
        row = PlanScenario(
            plan_id=plan_id,
            name=name,
            slug=slug,
            multipliers=normalize_multipliers(DEFAULT_MULTIPLIERS[slug]),
            calc_status="PENDING",
        )
        db.add(row)
        created.append(row)
    await db.flush()
    result2 = await db.execute(
        select(PlanScenario).where(PlanScenario.plan_id == plan_id).order_by(PlanScenario.created_at)
    )
    return list(result2.scalars().all())


def scenario_response(row: PlanScenario) -> dict:
    return {
        "id": row.id,
        "plan_id": row.plan_id,
        "name": row.name,
        "slug": row.slug,
        "multipliers": normalize_multipliers(row.multipliers),
        "results": row.results,
        "calc_job_id": row.calc_job_id,
        "calc_status": row.calc_status,
        "is_official": row.is_official,
        "recommended_by_id": row.recommended_by_id,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }
