"""Export pack complet (Excel + Word + PPTX → ZIP)."""

from pathlib import Path
from uuid import UUID

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.access_control import get_plan_for_user
from app.auth import get_current_user
from app.celery_client import celery_app
from app.database import get_db
from app.export_files import parse_export_files
from app.models import ExportJob, User
from app.schemas import ExportAllRequest, ExportAllResponse, ExportStatusResponse
from app.workflow_policy import PlanAction, assert_plan_action

router = APIRouter(prefix="/plans", tags=["exports"])


def _zip_path_from_job(job: ExportJob) -> str | None:
    files = parse_export_files(job.file_path)
    return files.get("zip")


@router.post("/{plan_id}/exports/all", response_model=ExportAllResponse, status_code=202)
async def start_export_all(
    plan_id: UUID,
    body: ExportAllRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Démarre l'export parallèle Excel + Word + PPTX puis ZIP."""
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.EXPORT)

    audience = body.audience
    if audience not in ("banque", "investisseur", "client"):
        raise HTTPException(status_code=400, detail="audience invalide")

    job = ExportJob(
        plan_id=plan.id,
        format="all",
        status="PENDING",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    task = celery_app.send_task(
        "worker.tasks.export_all_documents",
        args=[str(plan.id), str(job.id), audience],
        queue="export",
    )
    job.celery_task_id = task.id
    await db.commit()

    return ExportAllResponse(
        job_id=job.id,
        status=job.status,
        celery_task_id=task.id,
    )


@router.get("/{plan_id}/exports/{job_id}/status", response_model=ExportStatusResponse)
async def export_job_status(
    plan_id: UUID,
    job_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Polling : progression Redis + fichiers prêts + URL ZIP si terminé."""
    await get_plan_for_user(plan_id, user, db)
    result = await db.execute(
        select(ExportJob).where(ExportJob.id == job_id, ExportJob.plan_id == plan_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Export introuvable")

    files = parse_export_files(job.file_path)
    files_ready = [k for k in ("xlsx", "docx", "pptx", "zip") if k in files]
    progress_pct = 0
    zip_url: str | None = None

    status = (job.status or "PENDING").upper()
    if status == "COMPLETED":
        progress_pct = 100
        zip_url = files.get("zip")
    elif status == "FAILED":
        progress_pct = 0
    elif status in ("STARTED", "RUNNING", "PENDING"):
        try:
            from app.export_progress import get_export_progress_from_redis

            prog = get_export_progress_from_redis(str(job_id))
            progress_pct = int(prog.get("progress_pct") or 0)
            redis_ready = prog.get("files_ready") or []
            files_ready = list(dict.fromkeys([*files_ready, *redis_ready]))
        except Exception:
            progress_pct = 10 if status == "STARTED" else 0
        if job.celery_task_id and progress_pct < 95:
            ar = AsyncResult(job.celery_task_id, app=celery_app)
            if ar.ready():
                progress_pct = max(progress_pct, 95)
            elif ar.state == "STARTED":
                progress_pct = max(progress_pct, 15)

    return ExportStatusResponse(
        job_id=job.id,
        status=job.status,
        progress_pct=progress_pct,
        files_ready=files_ready,
        zip_url=zip_url,
        files=files if status == "COMPLETED" else None,
    )


@router.get("/{plan_id}/exports/{job_id}/download-pack")
async def download_export_pack(
    plan_id: UUID,
    job_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Télécharge le ZIP du pack complet (fichier direct, pas de redirect externe)."""
    await get_plan_for_user(plan_id, user, db)
    result = await db.execute(
        select(ExportJob).where(ExportJob.id == job_id, ExportJob.plan_id == plan_id)
    )
    job = result.scalar_one_or_none()
    if not job or job.status != "COMPLETED":
        raise HTTPException(status_code=404, detail="Export non terminé")

    zip_path = _zip_path_from_job(job)
    if not zip_path:
        raise HTTPException(status_code=404, detail="ZIP non disponible")

    path = Path(zip_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Fichier ZIP absent du stockage")

    return FileResponse(
        path,
        media_type="application/zip",
        filename=f"export-pack-{plan_id}.zip",
    )

