"""Procurement planning API."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.access_control import get_plan_for_user
from app.auth import get_current_user
from app.database import get_db
from app.models import PlanProductRecipe, PlanPurchaseAssumption, PlanRawMaterial, User
from app.procurement_service import (
    compute_procurement_projection,
    ensure_default_materials,
    ensure_recipe_grid,
    load_raw_materials,
)
from app.schemas import (
    ProcurementProjectionResponse,
    PurchaseAssumptionBulkUpdate,
    RawMaterialCreate,
    RawMaterialResponse,
    RawMaterialUpdate,
    RecipeBulkUpdate,
)
from app.workflow_policy import PlanAction, assert_plan_action

router = APIRouter(prefix="/plans", tags=["procurement"])


@router.get("/{plan_id}/procurement", response_model=ProcurementProjectionResponse)
async def get_procurement(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    dump = await compute_procurement_projection(db, plan.id, plan.inputs or {})
    await db.commit()
    return ProcurementProjectionResponse(projection=dump)


@router.get("/{plan_id}/raw-materials", response_model=list[RawMaterialResponse])
async def list_raw_materials(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    await ensure_default_materials(db, plan.id, plan.inputs or {})
    await db.commit()
    rows = await db.execute(
        select(PlanRawMaterial)
        .where(PlanRawMaterial.plan_id == plan_id)
        .order_by(PlanRawMaterial.sort_order)
    )
    return [RawMaterialResponse.model_validate(r) for r in rows.scalars().all()]


@router.post("/{plan_id}/raw-materials", response_model=RawMaterialResponse, status_code=201)
async def create_raw_material(
    plan_id: UUID,
    body: RawMaterialCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    count = await db.scalar(
        select(func.count()).select_from(PlanRawMaterial).where(PlanRawMaterial.plan_id == plan_id)
    )
    row = PlanRawMaterial(
        plan_id=plan_id,
        name=body.name.strip(),
        unit=body.unit,
        category=body.category,
        price_per_unit=body.price_per_unit,
        supplier_payment_days=body.supplier_payment_days,
        tva_rate=body.tva_rate,
        annual_price_inflation_pct=body.annual_price_inflation_pct,
        sort_order=body.sort_order if body.sort_order is not None else int(count or 0),
    )
    db.add(row)
    await db.flush()
    db.add(PlanPurchaseAssumption(plan_id=plan_id, raw_material_id=row.id, stock_days=30))
    from app.revenue_service import load_products

    for p in await load_products(db, plan_id):
        if p.id:
            await ensure_recipe_grid(db, plan_id, p.id)
    await db.commit()
    await db.refresh(row)
    return RawMaterialResponse.model_validate(row)


@router.patch("/{plan_id}/raw-materials/{material_id}", response_model=RawMaterialResponse)
async def update_raw_material(
    plan_id: UUID,
    material_id: UUID,
    body: RawMaterialUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    row = await db.get(PlanRawMaterial, material_id)
    if not row or row.plan_id != plan_id:
        raise HTTPException(404, "Matière première introuvable")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return RawMaterialResponse.model_validate(row)


@router.delete("/{plan_id}/raw-materials/{material_id}", status_code=204)
async def delete_raw_material(
    plan_id: UUID,
    material_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    row = await db.get(PlanRawMaterial, material_id)
    if not row or row.plan_id != plan_id:
        raise HTTPException(404, "Matière première introuvable")
    await db.delete(row)
    await db.commit()


@router.put("/{plan_id}/procurement/recipes", response_model=ProcurementProjectionResponse)
async def update_recipes(
    plan_id: UUID,
    body: RecipeBulkUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    for entry in body.entries:
        pid = UUID(str(entry["product_id"]))
        mid = UUID(str(entry["raw_material_id"]))
        qty = float(entry.get("quantity_per_kg_product", 0))
        result = await db.execute(
            select(PlanProductRecipe).where(
                PlanProductRecipe.plan_id == plan_id,
                PlanProductRecipe.product_id == pid,
                PlanProductRecipe.raw_material_id == mid,
            )
        )
        row = result.scalar_one_or_none()
        if row:
            row.quantity_per_kg_product = qty
        else:
            db.add(
                PlanProductRecipe(
                    plan_id=plan_id,
                    product_id=pid,
                    raw_material_id=mid,
                    quantity_per_kg_product=qty,
                )
            )
    await db.flush()
    dump = await compute_procurement_projection(db, plan.id, plan.inputs or {})
    await db.commit()
    return ProcurementProjectionResponse(projection=dump)


@router.put("/{plan_id}/procurement/assumptions", response_model=ProcurementProjectionResponse)
async def update_assumptions(
    plan_id: UUID,
    body: PurchaseAssumptionBulkUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    for entry in body.assumptions:
        mid = UUID(str(entry["raw_material_id"]))
        days = int(entry.get("stock_days", 30))
        result = await db.execute(
            select(PlanPurchaseAssumption).where(
                PlanPurchaseAssumption.plan_id == plan_id,
                PlanPurchaseAssumption.raw_material_id == mid,
            )
        )
        row = result.scalar_one_or_none()
        if row:
            row.stock_days = days
        else:
            db.add(
                PlanPurchaseAssumption(
                    plan_id=plan_id, raw_material_id=mid, stock_days=days
                )
            )
    await db.flush()
    dump = await compute_procurement_projection(db, plan.id, plan.inputs or {})
    await db.commit()
    return ProcurementProjectionResponse(projection=dump)
