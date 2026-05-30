from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.access_control import assert_job_access
from app.auth import get_current_user
from app.database import get_db
from app.models import CalcJob, ExportJob, User
from app.schemas import JobResponse

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CalcJob).where(CalcJob.id == job_id))
    job = result.scalar_one_or_none()
    if job:
        await assert_job_access(job.plan_id, user, db)
        return JobResponse(
            id=job.id,
            status=job.status,
            task_type=job.task_type,
            result=job.result,
            error=job.error,
        )

    result = await db.execute(select(ExportJob).where(ExportJob.id == job_id))
    export = result.scalar_one_or_none()
    if export:
        await assert_job_access(export.plan_id, user, db)
        return JobResponse(
            id=export.id,
            status=export.status,
            task_type="export",
            result={"file_path": export.file_path, "format": export.format},
        )

    raise HTTPException(status_code=404, detail="Job introuvable")
