"""Per-product unit cost components and projections."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.access_control import get_plan_for_user
from app.auth import get_current_user
from app.cost_service import (
    autofill_hints,
    compute_all_years,
    compute_unit_cost_projection,
    ensure_cost_grid,
    load_cost_components,
)
from app.database import get_db
from app.models import BusinessPlan, PlanProduct, PlanProductCostComponent, User
from app.revenue_service import load_products
from app.schemas import (
    CostAutofillResponse,
    CostComponentBulkUpdate,
    CostComponentResponse,
    CostComponentUpsert,
    PlanCostProjectionResponse,
    RevenueAssumptionsUpdate,
)
from app.workflow_policy import PlanAction, assert_plan_action
from bp_schema.liasse import PlanInputs

router = APIRouter(prefix="/plans", tags=["costs"])


def _cost_response(row: PlanProductCostComponent) -> CostComponentResponse:
    return CostComponentResponse.model_validate(row)


@router.get("/{plan_id}/cost-components", response_model=list[CostComponentResponse])
async def list_cost_components(
    plan_id: UUID,
    year: int | None = Query(None, ge=1, le=7),
    product_id: UUID | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    q = select(PlanProductCostComponent).where(PlanProductCostComponent.plan_id == plan_id)
    if year is not None:
        q = q.where(PlanProductCostComponent.year == year)
    if product_id is not None:
        q = q.where(PlanProductCostComponent.product_id == product_id)
    result = await db.execute(q.order_by(PlanProductCostComponent.product_id, PlanProductCostComponent.year))
    return [_cost_response(r) for r in result.scalars().all()]


@router.put("/{plan_id}/cost-components", response_model=list[CostComponentResponse])
async def upsert_cost_components(
    plan_id: UUID,
    body: CostComponentBulkUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    saved: list[PlanProductCostComponent] = []
    for item in body.items:
        row = await db.execute(
            select(PlanProductCostComponent).where(
                PlanProductCostComponent.plan_id == plan_id,
                PlanProductCostComponent.product_id == item.product_id,
                PlanProductCostComponent.year == item.year,
            )
        )
        existing = row.scalar_one_or_none()
        if existing:
            for field in (
                "mp_price_per_kg",
                "arome_rate_pct",
                "packaging_g_per_unit",
                "packaging_price_per_kg",
                "gas_monthly",
                "electricity_monthly",
                "water_monthly",
                "waste_pct",
            ):
                val = getattr(item, field, None)
                if val is not None:
                    setattr(existing, field, val)
            saved.append(existing)
        else:
            prod = await db.get(PlanProduct, item.product_id)
            if not prod or prod.plan_id != plan_id:
                raise HTTPException(status_code=404, detail="Produit introuvable")
            new_row = PlanProductCostComponent(
                plan_id=plan_id,
                product_id=item.product_id,
                year=item.year,
                mp_price_per_kg=item.mp_price_per_kg,
                arome_rate_pct=item.arome_rate_pct,
                packaging_g_per_unit=item.packaging_g_per_unit,
                packaging_price_per_kg=item.packaging_price_per_kg,
                gas_monthly=item.gas_monthly,
                electricity_monthly=item.electricity_monthly,
                water_monthly=item.water_monthly,
                waste_pct=item.waste_pct,
            )
            db.add(new_row)
            await db.flush()
            saved.append(new_row)
    await db.commit()
    for row in saved:
        await db.refresh(row)
    return [_cost_response(r) for r in saved]


@router.patch("/{plan_id}/cost-components/{component_id}", response_model=CostComponentResponse)
async def patch_cost_component(
    plan_id: UUID,
    component_id: UUID,
    body: CostComponentUpsert,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    row = await db.get(PlanProductCostComponent, component_id)
    if not row or row.plan_id != plan_id:
        raise HTTPException(status_code=404, detail="Composant introuvable")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        if k not in ("product_id", "year") and v is not None:
            setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return _cost_response(row)


@router.get("/{plan_id}/cost-autofill", response_model=CostAutofillResponse)
async def get_cost_autofill(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    products = await load_products(db, plan_id)
    hints = autofill_hints(PlanInputs.model_validate(plan.inputs or {}), products)
    return CostAutofillResponse(**hints)


@router.get("/{plan_id}/unit-cost-projection", response_model=PlanCostProjectionResponse)
async def get_unit_cost_projection(
    plan_id: UUID,
    year: int = Query(1, ge=1, le=7),
    all_years: bool = Query(False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    if all_years:
        years_data = await compute_all_years(db, plan.id, plan.inputs or {})
        return PlanCostProjectionResponse(years=years_data, year=year, projection=years_data[year - 1] if years_data else None)
    dump = await compute_unit_cost_projection(db, plan.id, plan.inputs or {}, year=year)
    return PlanCostProjectionResponse(projection=dump, year=year)


@router.put("/{plan_id}/cost-settings")
async def update_cost_settings(
    plan_id: UUID,
    body: RevenueAssumptionsUpdate,
    margin_alert_threshold: float | None = Query(None, ge=0, le=1),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.revenue_service import get_or_create_assumptions

    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    row = await get_or_create_assumptions(db, plan_id, plan.inputs)
    if margin_alert_threshold is not None:
        row.margin_alert_threshold = margin_alert_threshold
    await db.commit()
    return {"margin_alert_threshold": row.margin_alert_threshold}
