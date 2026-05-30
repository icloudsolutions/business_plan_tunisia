"""Financing structure and sources API."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.access_control import get_plan_for_user
from app.auth import get_current_user
from app.database import get_db
from app.financing_structure_service import (
    compute_financing_structure_projection,
    ensure_default_financing_sources,
    load_financing_sources,
    sync_structure_to_liasse,
    _sync_debt_sources_to_loans,
)
from app.models import PlanFinancingSource, User
from app.schemas import (
    FinancingSourceCreate,
    FinancingSourceResponse,
    FinancingSourceUpdate,
    FinancingStructureResponse,
    FinancingSyncResponse,
)
from app.workflow_policy import PlanAction, assert_plan_action

router = APIRouter(prefix="/plans", tags=["financing-structure"])


@router.get("/{plan_id}/financing-structure", response_model=FinancingStructureResponse)
async def get_financing_structure(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    dump = await compute_financing_structure_projection(db, plan.id, plan.inputs or {})
    await db.commit()
    return FinancingStructureResponse(projection=dump)


@router.get("/{plan_id}/financing-sources", response_model=list[FinancingSourceResponse])
async def list_financing_sources(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    await ensure_default_financing_sources(db, plan.id, plan.inputs or {})
    await db.commit()
    rows = await db.execute(
        select(PlanFinancingSource)
        .where(PlanFinancingSource.plan_id == plan_id)
        .order_by(PlanFinancingSource.sort_order)
    )
    return [FinancingSourceResponse.model_validate(r) for r in rows.scalars().all()]


@router.post("/{plan_id}/financing-sources", response_model=FinancingSourceResponse, status_code=201)
async def create_financing_source(
    plan_id: UUID,
    body: FinancingSourceCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    count = await db.scalar(
        select(func.count())
        .select_from(PlanFinancingSource)
        .where(PlanFinancingSource.plan_id == plan_id)
    )
    row = PlanFinancingSource(
        plan_id=plan_id,
        source_type=body.source_type,
        label=body.label.strip(),
        amount=body.amount,
        rate=body.rate,
        term_years=body.term_years,
        grace_months=body.grace_months,
        sort_order=body.sort_order if body.sort_order is not None else int(count or 0),
    )
    db.add(row)
    await db.flush()
    await _sync_debt_sources_to_loans(db, plan_id)
    await db.commit()
    await db.refresh(row)
    return FinancingSourceResponse.model_validate(row)


@router.patch("/{plan_id}/financing-sources/{source_id}", response_model=FinancingSourceResponse)
async def update_financing_source(
    plan_id: UUID,
    source_id: UUID,
    body: FinancingSourceUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    row = await db.get(PlanFinancingSource, source_id)
    if not row or row.plan_id != plan_id:
        raise HTTPException(404, "Source de financement introuvable")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    await db.flush()
    await _sync_debt_sources_to_loans(db, plan_id)
    await db.commit()
    await db.refresh(row)
    return FinancingSourceResponse.model_validate(row)


@router.delete("/{plan_id}/financing-sources/{source_id}", status_code=204)
async def delete_financing_source(
    plan_id: UUID,
    source_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    row = await db.get(PlanFinancingSource, source_id)
    if not row or row.plan_id != plan_id:
        raise HTTPException(404, "Source introuvable")
    if row.source_type == "fonds_propres":
        raise HTTPException(400, "Les fonds propres ne peuvent pas être supprimés")
    await db.delete(row)
    await db.commit()


@router.post("/{plan_id}/financing-structure/sync-liasse", response_model=FinancingSyncResponse)
async def sync_financing_liasse(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models import BusinessPlan

    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    new_inputs = await sync_structure_to_liasse(db, plan_id, plan.inputs or {})
    bp = await db.get(BusinessPlan, plan_id)
    if bp:
        bp.inputs = new_inputs
    await db.commit()
    proj = await compute_financing_structure_projection(db, plan_id, new_inputs)
    return FinancingSyncResponse(
        message="Structure de financement synchronisée avec la liasse et les emprunts.",
        projection=proj,
    )
