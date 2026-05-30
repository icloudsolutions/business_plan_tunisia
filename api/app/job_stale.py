"""Mark calc jobs that never left PENDING/STARTED as failed with a clear message."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CalcJob, PlanScenario

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
