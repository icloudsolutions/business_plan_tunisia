"""Implementation timeline (Gantt) API."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.access_control import get_plan_for_user
from app.auth import get_current_user
from app.database import get_db
from app.models import PlanTimelinePhase, User
from app.schemas import (
    TimelinePhaseCreate,
    TimelinePhaseResponse,
    TimelinePhaseUpdate,
    TimelineProjectionResponse,
    TimelineSettingsResponse,
    TimelineSettingsUpdate,
)
from app.timeline_service import (
    compute_timeline_projection,
    ensure_default_phases,
    get_or_create_timeline_settings,
    render_gantt_svg,
    reset_default_phases,
)
from app.workflow_policy import PlanAction, assert_plan_action

router = APIRouter(prefix="/plans", tags=["timeline"])


@router.get("/{plan_id}/timeline", response_model=TimelineProjectionResponse)
async def get_timeline(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    dump = await compute_timeline_projection(db, plan.id, plan.inputs or {})
    await db.commit()
    return TimelineProjectionResponse(projection=dump)


@router.get("/{plan_id}/timeline/settings", response_model=TimelineSettingsResponse)
async def get_timeline_settings(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    row = await get_or_create_timeline_settings(db, plan.id, plan.inputs or {})
    await db.commit()
    return TimelineSettingsResponse.model_validate(row)


@router.put("/{plan_id}/timeline/settings", response_model=TimelineSettingsResponse)
async def update_timeline_settings(
    plan_id: UUID,
    body: TimelineSettingsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    row = await get_or_create_timeline_settings(db, plan.id, plan.inputs or {})
    if body.plan_start_date is not None:
        row.plan_start_date = body.plan_start_date
    if body.startup_delay_days is not None:
        row.startup_delay_days = body.startup_delay_days
    if body.horizon_months is not None:
        row.horizon_months = body.horizon_months
    await db.commit()
    await db.refresh(row)
    return TimelineSettingsResponse.model_validate(row)


@router.post("/{plan_id}/timeline/reset-defaults", response_model=TimelineProjectionResponse)
async def reset_timeline_defaults(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    await reset_default_phases(db, plan.id, plan.inputs or {})
    dump = await compute_timeline_projection(db, plan.id, plan.inputs or {})
    await db.commit()
    return TimelineProjectionResponse(projection=dump)


@router.post("/{plan_id}/timeline/phases", response_model=TimelinePhaseResponse, status_code=201)
async def create_phase(
    plan_id: UUID,
    body: TimelinePhaseCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    await get_or_create_timeline_settings(db, plan.id, plan.inputs or {})
    count = await db.scalar(
        select(func.count()).select_from(PlanTimelinePhase).where(PlanTimelinePhase.plan_id == plan_id)
    )
    if body.end_date < body.start_date:
        raise HTTPException(400, "end_date must be >= start_date")
    row = PlanTimelinePhase(
        plan_id=plan_id,
        name=body.name.strip(),
        start_date=body.start_date,
        end_date=body.end_date,
        phase_type=body.phase_type,
        color=body.color,
        sort_order=body.sort_order if body.sort_order is not None else int(count or 0),
    )
    db.add(row)
    await db.flush()
    await db.commit()
    await db.refresh(row)
    return TimelinePhaseResponse.model_validate(row)


@router.patch("/{plan_id}/timeline/phases/{phase_id}", response_model=TimelinePhaseResponse)
async def update_phase(
    plan_id: UUID,
    phase_id: UUID,
    body: TimelinePhaseUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    row = await db.get(PlanTimelinePhase, phase_id)
    if not row or row.plan_id != plan_id:
        raise HTTPException(404, "Phase not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    if row.end_date < row.start_date:
        raise HTTPException(400, "end_date must be >= start_date")
    await db.commit()
    await db.refresh(row)
    return TimelinePhaseResponse.model_validate(row)


@router.delete("/{plan_id}/timeline/phases/{phase_id}", status_code=204)
async def delete_phase(
    plan_id: UUID,
    phase_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    row = await db.get(PlanTimelinePhase, phase_id)
    if not row or row.plan_id != plan_id:
        raise HTTPException(404, "Phase not found")
    await db.delete(row)
    await db.commit()


@router.get("/{plan_id}/timeline/gantt.svg")
async def export_gantt_svg(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    dump = await compute_timeline_projection(db, plan.id, plan.inputs or {})
    await db.commit()
    svg = render_gantt_svg(dump.get("chart", {}))
    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={
            "Content-Disposition": f'inline; filename="gantt_{plan_id}.svg"',
        },
    )
