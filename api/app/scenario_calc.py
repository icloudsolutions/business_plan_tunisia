"""Run 7-year scenario calculation (sync, for API fallback or tests)."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from bp_calc.scenarios import calculate_scenario as run_scenario_calc
from bp_schema.liasse import PlanInputs
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import BusinessPlan, CalcJob, PlanScenario


def compute_scenario_results(plan_inputs: dict, multipliers: dict | None) -> dict:
    inputs = PlanInputs.model_validate(plan_inputs)
    results, _ = run_scenario_calc(
        inputs,
        multipliers or {},
        discount_rate=settings.discount_rate,
    )
    return results.model_dump()


async def apply_scenario_results(
    db: AsyncSession,
    plan: BusinessPlan,
    scenario: PlanScenario,
    job: CalcJob | None,
) -> None:
    dump = await asyncio.to_thread(
        compute_scenario_results,
        dict(plan.inputs or {}),
        dict(scenario.multipliers or {}),
    )
    scenario.results = dump
    scenario.calc_status = "COMPLETED"
    if scenario.is_official or plan.official_scenario_id == scenario.id:
        plan.results = dump

    if job is not None:
        job.status = "COMPLETED"
        job.result = dump
        job.error = None
        job.completed_at = datetime.now(timezone.utc)


async def fail_scenario_job(
    db: AsyncSession,
    scenario: PlanScenario,
    job: CalcJob | None,
    message: str,
) -> None:
    scenario.calc_status = "FAILED"
    if job is not None:
        job.status = "FAILED"
        job.error = message
        job.completed_at = datetime.now(timezone.utc)
