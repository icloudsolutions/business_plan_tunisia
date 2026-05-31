"""Resolve plan-level results from stored JSON or calculated scenarios."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import BusinessPlan, PlanScenario
from app.state_machine import is_locked


async def hydrate_plan_results_from_scenarios(
    db: AsyncSession, plan: BusinessPlan
) -> dict | None:
    """
    If business_plans.results is empty, copy from official scenario or any calculated
    scenario (prefer slug ``base``). Sets official scenario when promoting a row.
    """
    if plan.results:
        return plan.results

    row: PlanScenario | None = None
    if plan.official_scenario_id:
        row = await db.get(PlanScenario, plan.official_scenario_id)
        if row is not None and not row.results:
            row = None

    if row is None or not row.results:
        result = await db.execute(
            select(PlanScenario).where(
                PlanScenario.plan_id == plan.id,
                PlanScenario.results.isnot(None),
            )
        )
        rows = [r for r in result.scalars().all() if r.results]
        if not rows:
            return None
        row = next((r for r in rows if r.slug == "base"), rows[0])

    if not row or not row.results:
        return None

    if is_locked(plan.status):
        return plan.results or row.results

    plan.results = row.results
    if plan.official_scenario_id != row.id:
        others = await db.execute(
            select(PlanScenario).where(
                PlanScenario.plan_id == plan.id,
                PlanScenario.id != row.id,
            )
        )
        for s in others.scalars().all():
            s.is_official = False
        row.is_official = True
        plan.official_scenario_id = row.id

    await db.flush()
    return plan.results


async def plan_results_for_audit(db: AsyncSession, plan: BusinessPlan) -> dict | None:
    """Results dict used by financial audit (hydrates from scenarios when needed)."""
    return await hydrate_plan_results_from_scenarios(db, plan)
