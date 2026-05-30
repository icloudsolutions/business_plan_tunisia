from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import delete as sql_delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from bp_schema.enums import BusinessPlanStatus
from bp_schema.liasse import PlanInputs
from bp_schema.validation import validate_draft_inputs

from app.access_control import apply_plans_list_filter, get_plan_for_user, resolve_default_expert
from app.audit import run_financial_audit
from app.auth import get_current_user, require_role
from app.celery_client import celery_app
from app.config import settings
from app.database import get_db
from app.models import BusinessPlan, CalcJob, ExpertComment, ExportJob, PlanVersion, Simulation, User
from app.export_files import parse_export_files
from app.plan_versions import create_plan_snapshot
from app.schemas import (
    CommentCreate,
    CommentResponse,
    ExportRequest,
    JobResponse,
    PlanCreate,
    PlanPatchResponse,
    PlanResponse,
    PlanUpdate,
    PlanUpdateInputs,
    PlanVersionResponse,
    SimulateRequest,
    TransitionRequest,
)
from app.state_machine import next_status
from app.workflow_policy import PlanAction, assert_plan_action

router = APIRouter(prefix="/plans", tags=["plans"])


def _default_inputs() -> dict:
    from bp_schema.liasse import EquipmentItem

    base = PlanInputs()
    if not base.investments.equipment:
        base.investments.equipment = [
            EquipmentItem(
                name="Logiciels & ERP",
                cost=50000,
                usefulLifeYears=5,
                acquisitionYear=1,
                assetType="intangible",
            ),
            EquipmentItem(
                name="Ligne de production",
                cost=350000,
                usefulLifeYears=10,
                acquisitionYear=1,
                assetType="tangible",
            ),
            EquipmentItem(
                name="Conditionnement automatique",
                cost=100000,
                usefulLifeYears=7,
                acquisitionYear=2,
                assetType="tangible",
            ),
        ]
    if not base.operations.wasteRateByYear:
        base.operations.wasteRateByYear = [0.01] * 7
    base.workingCapital.packagingStockDays = 15
    base.plAssumptions.distributionExpensePct = 0.04
    base.plAssumptions.marketingExpensePct = 0.02
    return base.model_dump()


@router.get("", response_model=list[PlanResponse])
async def list_plans(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = apply_plans_list_filter(select(BusinessPlan), user)
    result = await db.execute(q.order_by(BusinessPlan.updated_at.desc()))
    return result.scalars().all()


@router.post("", response_model=PlanResponse)
async def create_plan(
    body: PlanCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role not in ("client", "admin"):
        raise HTTPException(status_code=403, detail="Seuls les clients peuvent créer un plan")
    plan = BusinessPlan(
        title=body.title,
        owner_id=user.id,
        inputs=body.inputs or _default_inputs(),
        status=BusinessPlanStatus.DRAFT.value,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan


@router.get("/{plan_id}", response_model=PlanResponse)
async def get_plan(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_plan_for_user(plan_id, user, db)


@router.patch("/{plan_id}", response_model=PlanResponse)
async def update_plan(
    plan_id: UUID,
    body: PlanUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.UPDATE_META)
    if body.title is not None:
        plan.title = body.title
    await db.commit()
    await db.refresh(plan)
    return plan


@router.delete("/{plan_id}", status_code=204)
async def delete_plan(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.DELETE)
    pid = plan.id
    for model in (ExpertComment, Simulation, ExportJob, PlanVersion, CalcJob):
        await db.execute(sql_delete(model).where(model.plan_id == pid))
    await db.delete(plan)
    await db.commit()


@router.get("/{plan_id}/versions", response_model=list[PlanVersionResponse])
async def list_versions(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    result = await db.execute(
        select(PlanVersion)
        .where(PlanVersion.plan_id == plan_id)
        .order_by(PlanVersion.version_number.desc())
    )
    return result.scalars().all()


@router.patch("/{plan_id}/inputs", response_model=PlanPatchResponse)
async def update_inputs(
    plan_id: UUID,
    body: PlanUpdateInputs,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)

    try:
        validated = PlanInputs.model_validate(body.inputs)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    missing = validate_draft_inputs(validated)
    try:
        plan.inputs = validated.model_dump()
        await db.commit()
        await db.refresh(plan)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e

    return PlanPatchResponse(
        plan=PlanResponse.model_validate(plan),
        missingFields=missing,
    )


@router.post("/{plan_id}/submit", response_model=PlanResponse)
async def submit_plan(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.SUBMIT)
    missing = validate_draft_inputs(PlanInputs.model_validate(plan.inputs))
    if missing:
        raise HTTPException(status_code=422, detail={"missingFields": missing})

    expert = await resolve_default_expert(db)
    plan.assigned_expert_id = expert.id
    plan.status = next_status(BusinessPlanStatus.DRAFT, "submit").value

    version = await create_plan_snapshot(db, plan, reason="submit", created_by_id=user.id)
    plan.baseline_version_id = version.id

    await db.commit()
    await db.refresh(plan)
    return plan


@router.post("/{plan_id}/transition", response_model=PlanResponse)
async def transition_plan(
    plan_id: UUID,
    body: TransitionRequest,
    user: User = Depends(require_role("expert")),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.TRANSITION)

    current = BusinessPlanStatus(plan.status)
    try:
        new_status = next_status(current, body.action)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if new_status == BusinessPlanStatus.VALIDATED:
        from bp_schema.liasse import PlanResults

        audit = run_financial_audit(
            PlanInputs.model_validate(plan.inputs),
            PlanResults.model_validate(plan.results) if plan.results else None,
        )
        if body.action == "VALIDATE" and audit["decision"] != "VALIDATE":
            raise HTTPException(
                status_code=400,
                detail={"message": "Validation refusée", "audit": audit},
            )
        await create_plan_snapshot(db, plan, reason="pre_validate", created_by_id=user.id)

    plan.status = new_status.value
    if new_status == BusinessPlanStatus.VALIDATED:
        plan.locked_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(plan)
    return plan


@router.post("/{plan_id}/recalculate", response_model=JobResponse, status_code=202)
async def recalculate(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.RECALCULATE)

    job = CalcJob(plan_id=plan.id, task_type="recalculate_plan", status="PENDING")
    db.add(job)
    await db.commit()
    await db.refresh(job)

    task = celery_app.send_task(
        "worker.tasks.recalculate_plan",
        args=[str(plan.id), str(job.id)],
        queue="calc",
    )
    job.celery_task_id = task.id
    await db.commit()
    return JobResponse(id=job.id, status=job.status, task_type=job.task_type)


@router.post("/{plan_id}/simulate", response_model=JobResponse, status_code=202)
async def simulate(
    plan_id: UUID,
    body: SimulateRequest,
    user: User = Depends(require_role("expert", "client")),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.SIMULATE)

    job = CalcJob(
        plan_id=plan.id,
        task_type="run_simulation",
        status="PENDING",
        payload={"name": body.name, "patches": body.patches},
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    task = celery_app.send_task(
        "worker.tasks.run_simulation",
        args=[str(plan.id), str(job.id), body.model_dump()],
        queue="calc",
    )
    job.celery_task_id = task.id
    await db.commit()
    return JobResponse(id=job.id, status=job.status, task_type=job.task_type)


@router.post("/{plan_id}/audit")
async def audit_plan(
    plan_id: UUID,
    user: User = Depends(require_role("expert")),
    db: AsyncSession = Depends(get_db),
):
    from bp_schema.liasse import PlanResults

    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.AUDIT)
    inputs = PlanInputs.model_validate(plan.inputs)
    results = PlanResults.model_validate(plan.results) if plan.results else None
    return run_financial_audit(inputs, results)


@router.post("/{plan_id}/comments", response_model=CommentResponse)
async def add_comment(
    plan_id: UUID,
    body: CommentCreate,
    user: User = Depends(require_role("expert")),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.COMMENT)
    comment = ExpertComment(
        plan_id=plan.id,
        field_path=body.field_path,
        body=body.body,
        author_id=user.id,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


@router.get("/{plan_id}/comments", response_model=list[CommentResponse])
async def list_comments(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    result = await db.execute(
        select(ExpertComment).where(ExpertComment.plan_id == plan_id).order_by(ExpertComment.created_at)
    )
    return result.scalars().all()


@router.get("/{plan_id}/simulations")
async def list_simulations(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    result = await db.execute(select(Simulation).where(Simulation.plan_id == plan_id))
    sims = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "name": s.name,
            "deltaVsBaseline": s.delta_vs_baseline,
            "results": s.results,
        }
        for s in sims
    ]


@router.post("/{plan_id}/export", response_model=JobResponse, status_code=202)
async def export_plan(
    plan_id: UUID,
    body: ExportRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.EXPORT)

    job = ExportJob(plan_id=plan.id, format=",".join(body.formats), status="PENDING")
    db.add(job)
    await db.commit()
    await db.refresh(job)

    task = celery_app.send_task(
        "worker.tasks.generate_export",
        args=[str(plan.id), str(job.id), body.formats],
        queue="export",
    )
    job.celery_task_id = task.id
    await db.commit()
    return JobResponse(id=job.id, status=job.status, task_type="export")


@router.get("/{plan_id}/exports/{job_id}")
async def get_export_job(
    plan_id: UUID,
    job_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    result = await db.execute(
        select(ExportJob).where(ExportJob.id == job_id, ExportJob.plan_id == plan_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Export introuvable")
    files = parse_export_files(job.file_path)
    return {
        "id": str(job.id),
        "status": job.status,
        "formats": list(files.keys()),
        "files": files,
    }


@router.get("/{plan_id}/exports/{job_id}/download")
async def download_export(
    plan_id: UUID,
    job_id: UUID,
    format: str = Query("pdf", pattern="^(pdf|xlsx)$"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    result = await db.execute(
        select(ExportJob).where(ExportJob.id == job_id, ExportJob.plan_id == plan_id)
    )
    job = result.scalar_one_or_none()
    if not job or job.status != "COMPLETED" or not job.file_path:
        raise HTTPException(status_code=404, detail="Export introuvable ou non terminé")

    files = parse_export_files(job.file_path)
    file_str = files.get(format)
    if not file_str:
        raise HTTPException(
            status_code=404,
            detail=f"Format {format} non disponible pour cet export",
        )
    path = Path(file_str)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Fichier absent du stockage")

    if format == "pdf":
        media = "application/pdf"
        filename = f"business-plan-{plan_id}.pdf"
    else:
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"business-plan-{plan_id}.xlsx"
    return FileResponse(path, media_type=media, filename=filename)
