"""CRUD and comparison for plan scenarios (pessimiste / base / optimiste)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bp_calc.scenarios import compare_scenarios, normalize_multipliers
from bp_schema.liasse import PlanInputs

from app.access_control import get_plan_for_user
from app.auth import get_current_user, require_role
from app.celery_client import celery_app
from app.collaboration import log_activity
from app.config import settings
from app.database import get_db
from app.models import BusinessPlan, CalcJob, PlanScenario, User
from app.scenario_services import ensure_default_scenarios, scenario_response
from app.schemas import (
    JobResponse,
    PlanScenarioCreate,
    PlanScenarioResponse,
    PlanScenarioUpdate,
    ScenarioCompareResponse,
    ScenarioKpiRow,
)

router = APIRouter(prefix="/plans", tags=["scenarios"])


async def _get_scenario(db: AsyncSession, plan_id: UUID, scenario_id: UUID) -> PlanScenario:
    row = await db.get(PlanScenario, scenario_id)
    if not row or row.plan_id != plan_id:
        raise HTTPException(status_code=404, detail="Scénario introuvable")
    return row


def _multipliers_dict(body) -> dict:
    if body is None:
        return normalize_multipliers(None)
    if hasattr(body, "model_dump"):
        return normalize_multipliers(body.model_dump())
    return normalize_multipliers(body)


async def _queue_calc(db: AsyncSession, plan: BusinessPlan, scenario: PlanScenario) -> CalcJob:
    job = CalcJob(
        plan_id=plan.id,
        task_type="calculate_plan_scenario",
        status="PENDING",
        payload={"scenario_id": str(scenario.id)},
    )
    db.add(job)
    await db.flush()
    scenario.calc_job_id = job.id
    scenario.calc_status = "PENDING"
    task = celery_app.send_task(
        "worker.tasks.calculate_plan_scenario",
        args=[str(plan.id), str(scenario.id), str(job.id)],
        queue="calc",
    )
    job.celery_task_id = task.id
    return job


@router.get("/{plan_id}/scenarios", response_model=list[PlanScenarioResponse])
async def list_plan_scenarios(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    rows = await ensure_default_scenarios(db, plan.id)
    await db.commit()
    return [PlanScenarioResponse.model_validate(scenario_response(r)) for r in rows]


@router.get("/{plan_id}/scenarios/compare", response_model=ScenarioCompareResponse)
async def compare_plan_scenarios(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    rows = await ensure_default_scenarios(db, plan.id)
    await db.commit()
    payload_rows = [scenario_response(r) for r in rows]
    cmp = compare_scenarios(payload_rows)
    return ScenarioCompareResponse(
        plan_id=plan.id,
        official_scenario_id=plan.official_scenario_id,
        kpi_table=[ScenarioKpiRow.model_validate(k) for k in cmp["kpi_table"]],
        net_profit_series=cmp["net_profit_series"],
        scenarios=[PlanScenarioResponse.model_validate(s) for s in payload_rows],
    )


@router.post("/{plan_id}/scenarios", response_model=PlanScenarioResponse, status_code=201)
async def create_plan_scenario(
    plan_id: UUID,
    body: PlanScenarioCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    row = PlanScenario(
        plan_id=plan.id,
        name=body.name.strip(),
        slug=None,
        multipliers=_multipliers_dict(body.multipliers),
        calc_status="PENDING",
    )
    db.add(row)
    await db.flush()
    await _queue_calc(db, plan, row)
    await db.commit()
    await db.refresh(row)
    return PlanScenarioResponse.model_validate(scenario_response(row))


@router.patch("/{plan_id}/scenarios/{scenario_id}", response_model=PlanScenarioResponse)
async def update_plan_scenario(
    plan_id: UUID,
    scenario_id: UUID,
    body: PlanScenarioUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    row = await _get_scenario(db, plan_id, scenario_id)
    if body.name is not None:
        row.name = body.name.strip()
    if body.multipliers is not None:
        row.multipliers = _multipliers_dict(body.multipliers)
    if body.recalculate or body.multipliers is not None:
        await _queue_calc(db, plan, row)
    await db.commit()
    await db.refresh(row)
    return PlanScenarioResponse.model_validate(scenario_response(row))


@router.post("/{plan_id}/scenarios/{scenario_id}/calculate", response_model=JobResponse, status_code=202)
async def calculate_scenario(
    plan_id: UUID,
    scenario_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    row = await _get_scenario(db, plan_id, scenario_id)
    job = await _queue_calc(db, plan, row)
    await db.commit()
    await db.refresh(job)
    return JobResponse(id=job.id, status=job.status, task_type=job.task_type)


@router.post("/{plan_id}/scenarios/calculate-all", response_model=list[JobResponse], status_code=202)
async def calculate_all_scenarios(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    rows = await ensure_default_scenarios(db, plan.id)
    jobs: list[JobResponse] = []
    for row in rows:
        job = await _queue_calc(db, plan, row)
        jobs.append(JobResponse(id=job.id, status=job.status, task_type=job.task_type))
    await db.commit()
    return jobs


@router.post("/{plan_id}/scenarios/{scenario_id}/set-official", response_model=PlanScenarioResponse)
async def set_official_scenario(
    plan_id: UUID,
    scenario_id: UUID,
    user: User = Depends(require_role("expert")),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    row = await _get_scenario(db, plan_id, scenario_id)
    if not row.results:
        raise HTTPException(
            status_code=400,
            detail="Calculez d'abord ce scénario avant de le recommander pour la liasse",
        )

    others = await db.execute(
        select(PlanScenario).where(PlanScenario.plan_id == plan_id, PlanScenario.id != scenario_id)
    )
    for s in others.scalars().all():
        s.is_official = False

    row.is_official = True
    row.recommended_by_id = user.id
    plan.official_scenario_id = row.id
    plan.results = row.results

    await log_activity(
        db,
        plan.id,
        user.id,
        "scenario_official",
        f"Scénario officiel : {row.name}",
        {"scenario_id": str(row.id), "slug": row.slug},
        broadcast=False,
    )
    await db.commit()
    await db.refresh(row)
    return PlanScenarioResponse.model_validate(scenario_response(row))
