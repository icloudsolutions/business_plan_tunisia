"""Plan version history, audit log, restore."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bp_schema.liasse import PlanInputs

from app.access_control import get_plan_for_user
from app.audit_log import build_plan_snapshot, diff_against_current, log_inputs_patch, log_meta_patch
from app.auth import get_current_user, require_role
from app.database import get_db
from app.models import BusinessPlan, PlanAuditLog, PlanVersion, User
from app.plan_versions import create_plan_snapshot
from app.schemas import (
    AuditLogEntryResponse,
    PlanVersionCreate,
    PlanVersionDetailResponse,
    PlanVersionDiffResponse,
    PlanVersionResponse,
    VersionRestoreResponse,
)
from app.workflow_policy import PlanAction, assert_plan_action

router = APIRouter(prefix="/plans", tags=["history"])

REASON_LABELS = {
    "submit": "Soumission client",
    "resubmit": "Resoumission corrections",
    "manual": "Point de sauvegarde manuel",
    "pre_validate": "Avant validation",
    "status_change": "Changement de statut",
}


def _reason_label(reason: str) -> str:
    if reason.startswith("status:"):
        return f"Transition {reason.replace('status:', '').replace('_', ' → ')}"
    return REASON_LABELS.get(reason, reason)


async def _version_detail(db: AsyncSession, row: PlanVersion) -> PlanVersionDetailResponse:
    user = await db.get(User, row.created_by_id)
    snap = row.snapshot or {
        "title": "",
        "status": row.status_at_snapshot,
        "inputs": row.inputs,
        "results": row.results,
    }
    return PlanVersionDetailResponse(
        id=row.id,
        plan_id=row.plan_id,
        version_number=row.version_number,
        status_at_snapshot=row.status_at_snapshot,
        reason=row.reason,
        reason_label=_reason_label(row.reason),
        created_at=row.created_at,
        created_by_id=row.created_by_id,
        created_by_email=user.email if user else None,
        snapshot=snap,
    )


@router.get("/{plan_id}/audit-log", response_model=list[AuditLogEntryResponse])
async def list_audit_log(
    plan_id: UUID,
    limit: int = 200,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    result = await db.execute(
        select(PlanAuditLog, User.email)
        .outerjoin(User, PlanAuditLog.user_id == User.id)
        .where(PlanAuditLog.plan_id == plan_id)
        .order_by(PlanAuditLog.changed_at.desc())
        .limit(min(limit, 500))
    )
    rows = []
    for log_row, email in result.all():
        rows.append(
            AuditLogEntryResponse(
                id=log_row.id,
                plan_id=log_row.plan_id,
                user_id=log_row.user_id,
                user_email=email,
                field_path=log_row.field_path,
                old_value=log_row.old_value,
                new_value=log_row.new_value,
                changed_at=log_row.changed_at,
            )
        )
    return rows


@router.get("/{plan_id}/versions", response_model=list[PlanVersionResponse])
async def list_versions(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    result = await db.execute(
        select(PlanVersion, User.email)
        .join(User, PlanVersion.created_by_id == User.id)
        .where(PlanVersion.plan_id == plan_id)
        .order_by(PlanVersion.created_at.desc())
    )
    out: list[PlanVersionResponse] = []
    for ver, email in result.all():
        out.append(
            PlanVersionResponse(
                id=ver.id,
                plan_id=ver.plan_id,
                version_number=ver.version_number,
                status_at_snapshot=ver.status_at_snapshot,
                reason=ver.reason,
                reason_label=_reason_label(ver.reason),
                created_at=ver.created_at,
                created_by_id=ver.created_by_id,
                created_by_email=email,
            )
        )
    return out


@router.post("/{plan_id}/versions", response_model=PlanVersionDetailResponse, status_code=201)
async def create_manual_snapshot(
    plan_id: UUID,
    body: PlanVersionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    reason = (body.reason or "manual").strip()[:64]
    row = await create_plan_snapshot(db, plan, reason=reason, created_by_id=user.id)
    await db.commit()
    await db.refresh(row)
    return await _version_detail(db, row)


@router.get("/{plan_id}/versions/{version_id}", response_model=PlanVersionDetailResponse)
async def get_version(
    plan_id: UUID,
    version_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    row = await db.get(PlanVersion, version_id)
    if not row or row.plan_id != plan_id:
        raise HTTPException(status_code=404, detail="Version introuvable")
    return await _version_detail(db, row)


@router.get("/{plan_id}/versions/{version_id}/diff", response_model=PlanVersionDiffResponse)
async def diff_version(
    plan_id: UUID,
    version_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    row = await db.get(PlanVersion, version_id)
    if not row or row.plan_id != plan_id:
        raise HTTPException(status_code=404, detail="Version introuvable")
    version_snap = row.snapshot or {
        "title": plan.title,
        "status": row.status_at_snapshot,
        "inputs": row.inputs,
        "results": row.results,
    }
    current = build_plan_snapshot(plan)
    changes = diff_against_current(current, version_snap)
    return PlanVersionDiffResponse(
        version_id=row.id,
        version_number=row.version_number,
        changes=changes,
        change_count=len(changes),
    )


@router.post("/{plan_id}/versions/{version_id}/restore", response_model=VersionRestoreResponse)
async def restore_version(
    plan_id: UUID,
    version_id: UUID,
    user: User = Depends(require_role("expert", "admin")),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    if plan.status == "VALIDATED":
        raise HTTPException(status_code=403, detail="Plan validé — restauration interdite")

    row = await db.get(PlanVersion, version_id)
    if not row or row.plan_id != plan_id:
        raise HTTPException(status_code=404, detail="Version introuvable")

    snap = row.snapshot or {"inputs": row.inputs, "results": row.results}
    old_inputs = dict(plan.inputs or {})

    if "title" in snap and snap["title"]:
        await log_meta_patch(
            db,
            plan_id=plan.id,
            user_id=user.id,
            field_path="meta.title",
            old_value=plan.title,
            new_value=snap["title"],
        )
        plan.title = snap["title"]

    new_inputs = dict(snap.get("inputs") or row.inputs or {})
    try:
        validated = PlanInputs.model_validate(new_inputs)
        plan.inputs = validated.model_dump()
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    if "results" in snap:
        plan.results = snap.get("results")

    await log_inputs_patch(
        db,
        plan_id=plan.id,
        user_id=user.id,
        old_inputs=old_inputs,
        new_inputs=plan.inputs,
    )
    await create_plan_snapshot(db, plan, reason="restore", created_by_id=user.id)
    await db.commit()
    await db.refresh(plan)

    return VersionRestoreResponse(
        plan_id=plan.id,
        restored_version_id=row.id,
        message=f"Plan restauré sur la version {row.version_number}",
    )
