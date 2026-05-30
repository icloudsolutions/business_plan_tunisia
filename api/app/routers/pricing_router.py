"""Pricing grid API."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.access_control import get_plan_for_user
from app.auth import get_current_user
from app.database import get_db
from app.models import PlanPricingGrid, PlanProduct, User
from app.pricing_service import (
    compute_pricing_projection,
    ensure_pricing_grid,
    sync_pricing_to_product,
    _row_from_orm,
)
from app.schemas import (
    PricingGridResponse,
    PricingGridUpdate,
    PricingProjectionResponse,
    PricingSyncResponse,
)
from app.workflow_policy import PlanAction, assert_plan_action

router = APIRouter(prefix="/plans", tags=["pricing"])


@router.get("/{plan_id}/pricing", response_model=PricingProjectionResponse)
async def get_pricing_projection(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    dump = await compute_pricing_projection(db, plan.id, plan.inputs or {})
    await db.commit()
    return PricingProjectionResponse(projection=dump)


@router.get("/{plan_id}/pricing-grid", response_model=list[PricingGridResponse])
async def list_pricing_grid(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    await ensure_pricing_grid(db, plan.id, plan.inputs or {})
    await db.commit()
    rows = await db.execute(
        select(PlanPricingGrid)
        .where(PlanPricingGrid.plan_id == plan_id)
        .order_by(PlanPricingGrid.created_at)
    )
    return [PricingGridResponse.model_validate(r) for r in rows.scalars().all()]


@router.patch("/{plan_id}/pricing-grid/{row_id}", response_model=PricingGridResponse)
async def update_pricing_row(
    plan_id: UUID,
    row_id: UUID,
    body: PricingGridUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    row = await db.get(PlanPricingGrid, row_id)
    if not row or row.plan_id != plan_id:
        raise HTTPException(404, "Ligne prix introuvable")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    await sync_pricing_to_product(db, row)
    await db.commit()
    await db.refresh(row)
    return PricingGridResponse.model_validate(row)


@router.post("/{plan_id}/pricing/sync-products", response_model=PricingSyncResponse)
async def sync_pricing_from_products(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    products = (
        await db.execute(select(PlanProduct).where(PlanProduct.plan_id == plan_id))
    ).scalars().all()
    from app.pricing_service import ensure_pricing_row

    for p in products:
        row = await ensure_pricing_row(db, plan_id, p, plan.inputs)
        row.sell_price_per_unit = p.unit_price_sell
        row.ristourne_pct = p.ristourne_pct
        await sync_pricing_to_product(db, row)
    await db.commit()
    proj = await compute_pricing_projection(db, plan_id, plan.inputs or {})
    return PricingSyncResponse(
        message="Grille prix alignée sur le catalogue produits.",
        projection=proj,
    )
