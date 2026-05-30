"""7-year financial projections for finance cockpit."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bp_calc.projections import build_all_scenarios, build_projection_payload
from bp_schema.liasse import PlanInputs, PlanResults

from app.access_control import get_plan_for_user
from app.auth import get_current_user
from app.celery_client import celery_app
from app.config import settings
from app.database import get_db
from app.models import BusinessPlan, CalcJob, PlanVersion, User
from app.schemas import JobResponse, ProjectionsSimulateRequest, ProjectionsResponse
from app.workflow_policy import PlanAction, assert_plan_action

router = APIRouter(prefix="/plans", tags=["projections"])


async def _prior_results(db: AsyncSession, plan_id: UUID) -> PlanResults | None:
    result = await db.execute(
        select(PlanVersion)
        .where(PlanVersion.plan_id == plan_id, PlanVersion.results.isnot(None))
        .order_by(PlanVersion.version_number.desc())
        .offset(1)
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if row and row.results:
        return PlanResults.model_validate(row.results)
    return None


@router.get("/{plan_id}/projections", response_model=ProjectionsResponse)
async def get_projections(
    plan_id: UUID,
    scenario: str = Query("base", pattern="^(base|pessimistic|optimistic|custom|all)$"),
    revenue_mult: float | None = Query(None, ge=0.5, le=2.0),
    growth_mult: float | None = Query(None, ge=0.5, le=2.0),
    loan_rate_mult: float | None = Query(None, ge=0.5, le=2.0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    inputs = PlanInputs.model_validate(plan.inputs)
    stored = PlanResults.model_validate(plan.results) if plan.results else None
    prior = await _prior_results(db, plan.id)
    discount = settings.discount_rate

    if scenario == "all":
        custom = None
        if revenue_mult is not None or growth_mult is not None or loan_rate_mult is not None:
            custom = {
                "revenueScale": revenue_mult or 1.0,
                "growthMult": growth_mult or 1.0,
                "loanRateMult": loan_rate_mult or 1.0,
            }
        scenarios = build_all_scenarios(
            inputs,
            discount_rate=discount,
            prior_results=prior,
            custom_mults=custom,
        )
        return ProjectionsResponse(
            plan_id=plan.id,
            plan_title=plan.title,
            plan_status=plan.status,
            has_results=stored is not None,
            scenario="all",
            scenarios=scenarios,
            active=scenarios.get("base"),
        )

    preset_growth = 0.03 * (growth_mult or 1.0)
    payload = build_projection_payload(
        inputs,
        scenario=scenario,
        revenue_mult=revenue_mult,
        growth_mult=growth_mult,
        loan_rate_mult=loan_rate_mult,
        discount_rate=discount,
        prior_results=prior,
        stored_results=stored,
    )
    if growth_mult is not None:
        payload["multipliers"]["growthRate"] = preset_growth

    return ProjectionsResponse(
        plan_id=plan.id,
        plan_title=plan.title,
        plan_status=plan.status,
        has_results=stored is not None,
        scenario=scenario,
        active=payload,
        scenarios=None,
    )


@router.post("/{plan_id}/projections/simulate", response_model=JobResponse, status_code=202)
async def simulate_projections(
    plan_id: UUID,
    body: ProjectionsSimulateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.RECALCULATE)

    overrides = {
        "revenue_scale": body.revenue_year1_mult,
        "growth_mult": body.growth_mult,
        "loan_rate_mult": body.loan_rate_mult,
        "persist": body.persist,
    }

    job = CalcJob(
        plan_id=plan.id,
        task_type="projection_simulate",
        status="PENDING",
        payload=overrides,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    task = celery_app.send_task(
        "worker.tasks.recalculate_plan",
        args=[str(plan.id), str(job.id)],
        kwargs={"overrides": overrides},
        queue="calc",
    )
    job.celery_task_id = task.id
    await db.commit()
    return JobResponse(id=job.id, status=job.status, task_type=job.task_type)
