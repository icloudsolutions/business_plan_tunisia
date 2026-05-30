"""Recover or fail calc jobs when Celery worker does not run."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import BusinessPlan, CalcJob, PlanScenario
from app.scenario_calc import apply_scenario_results, fail_scenario_job

logger = logging.getLogger(__name__)

# If still PENDING after this, run calc in API (send_task succeeded but worker idle)
PENDING_SYNC_FALLBACK_SECONDS = 3
STALE_PENDING_MINUTES = 5
STALE_STARTED_MINUTES = 7

WORKER_HINT = (
    "Le worker Celery n'a pas exécuté le calcul. "
    "Sur le serveur : docker compose ps worker && docker compose logs worker --tail=80. "
    "Ou définissez SCENARIO_CALC_SYNC=true sur le service api pour calculer sans worker."
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


async def recover_pending_scenario_job_if_needed(
    db: AsyncSession, job: CalcJob
) -> CalcJob:
    """Complete scenario calc in API when Celery queued the task but worker never picked it up."""
    if job.status != "PENDING" or job.task_type != "calculate_plan_scenario":
        return job
    if not job.created_at or not job.plan_id:
        return job
    if (job.payload or {}).get("_sync_recovery"):
        return job

    age = _utc_now() - _as_utc(job.created_at)
    if age < timedelta(seconds=PENDING_SYNC_FALLBACK_SECONDS):
        return job

    scenario_id = (job.payload or {}).get("scenario_id")
    if not scenario_id:
        return job

    plan = await db.get(BusinessPlan, job.plan_id)
    try:
        scenario = await db.get(PlanScenario, UUID(str(scenario_id)))
    except (ValueError, TypeError):
        return job
    if not plan or not scenario or scenario.plan_id != plan.id:
        return job

    logger.info(
        "Scenario job %s still PENDING after %ss — running sync calc in API",
        job.id,
        int(age.total_seconds()),
    )
    job.payload = {**(job.payload or {}), "_sync_recovery": True}
    try:
        await apply_scenario_results(db, plan, scenario, job)
    except Exception as exc:
        logger.exception("Sync scenario recovery failed for job %s", job.id)
        await fail_scenario_job(db, scenario, job, str(exc))
    await db.commit()
    await db.refresh(job)
    return job


async def fail_stale_calc_job_if_needed(db: AsyncSession, job: CalcJob) -> CalcJob:
    if job.status not in ("PENDING", "STARTED"):
        return job
    if not job.created_at:
        return job

    age = _utc_now() - _as_utc(job.created_at)
    limit = (
        timedelta(minutes=STALE_STARTED_MINUTES)
        if job.status == "STARTED"
        else timedelta(minutes=STALE_PENDING_MINUTES)
    )
    if age <= limit:
        return job

    job.status = "FAILED"
    job.error = WORKER_HINT
    job.completed_at = _utc_now()

    scenario_id = (job.payload or {}).get("scenario_id")
    if scenario_id:
        try:
            row = await db.get(PlanScenario, UUID(str(scenario_id)))
            if row is not None:
                row.calc_status = "FAILED"
        except (ValueError, TypeError):
            pass

    await db.commit()
    await db.refresh(job)
    return job
