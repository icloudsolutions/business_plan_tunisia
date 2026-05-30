"""Pricing grid CRUD and projection."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bp_calc.cost import weight_kg_per_unit
from bp_calc.pricing import build_pricing_projection, compute_pricing_row
from bp_schema.liasse import PlanInputs
from bp_schema.pricing import PricingGridRow
from app.models import PlanPricingGrid as PlanPricingGridORM
from app.models import PlanProduct as PlanProductORM
from app.models import PlanProductCostComponent
from app.revenue_service import _product_from_orm, load_products


def _row_from_orm(row: PlanPricingGridORM) -> PricingGridRow:
    return PricingGridRow(
        id=row.id,
        plan_id=row.plan_id,
        product_id=row.product_id,
        purchase_price_per_kg=row.purchase_price_per_kg,
        sell_price_per_unit=row.sell_price_per_unit,
        sell_price_per_kg=row.sell_price_per_kg,
        market_retail_price=row.market_retail_price,
        ristourne_pct=row.ristourne_pct,
        unit_weight_g=row.unit_weight_g,
    )


async def _default_purchase_kg(
    db: AsyncSession, plan_id: UUID, product_id: UUID, plan_inputs: dict | None
) -> float:
    cost = await db.execute(
        select(PlanProductCostComponent)
        .where(
            PlanProductCostComponent.plan_id == plan_id,
            PlanProductCostComponent.product_id == product_id,
            PlanProductCostComponent.year == 1,
        )
        .limit(1)
    )
    row = cost.scalar_one_or_none()
    if row and row.mp_price_per_kg > 0:
        return row.mp_price_per_kg
    inputs = PlanInputs.model_validate(plan_inputs or {})
    return inputs.operations.rawMaterialCost


async def _default_unit_weight_g(
    db: AsyncSession, plan_id: UUID, product: PlanProductORM
) -> float:
    cost = await db.execute(
        select(PlanProductCostComponent.packaging_g_per_unit)
        .where(
            PlanProductCostComponent.plan_id == plan_id,
            PlanProductCostComponent.product_id == product.id,
            PlanProductCostComponent.year == 1,
        )
        .limit(1)
    )
    packaging_g = cost.scalar_one_or_none()
    if packaging_g and packaging_g > 0:
        return float(packaging_g)
    p = _product_from_orm(product)
    return weight_kg_per_unit(p, 1000.0) * 1000.0


async def ensure_pricing_row(
    db: AsyncSession,
    plan_id: UUID,
    product: PlanProductORM,
    plan_inputs: dict | None = None,
) -> PlanPricingGridORM:
    existing = await db.execute(
        select(PlanPricingGridORM).where(
            PlanPricingGridORM.plan_id == plan_id,
            PlanPricingGridORM.product_id == product.id,
        )
    )
    row = existing.scalar_one_or_none()
    if row:
        return row

    purchase = await _default_purchase_kg(db, plan_id, product.id, plan_inputs)
    weight_g = await _default_unit_weight_g(db, plan_id, product)
    kg = max(weight_g, 1.0) / 1000.0
    sell_kg = (product.unit_price_sell / kg) if kg > 0 and product.unit_price_sell > 0 else 0.0

    row = PlanPricingGridORM(
        plan_id=plan_id,
        product_id=product.id,
        purchase_price_per_kg=purchase,
        sell_price_per_unit=product.unit_price_sell,
        sell_price_per_kg=sell_kg,
        market_retail_price=0.0,
        ristourne_pct=product.ristourne_pct,
        unit_weight_g=weight_g,
    )
    db.add(row)
    await db.flush()
    return row


async def ensure_pricing_grid(
    db: AsyncSession, plan_id: UUID, plan_inputs: dict | None = None
) -> list[PricingGridRow]:
    products = (
        await db.execute(
            select(PlanProductORM)
            .where(PlanProductORM.plan_id == plan_id)
            .order_by(PlanProductORM.sort_order)
        )
    ).scalars().all()
    rows: list[PricingGridRow] = []
    for p in products:
        orm = await ensure_pricing_row(db, plan_id, p, plan_inputs)
        rows.append(_row_from_orm(orm))
    return rows


async def sync_pricing_to_product(db: AsyncSession, row: PlanPricingGridORM) -> None:
    product = await db.get(PlanProductORM, row.product_id)
    if not product:
        return
    computed = compute_pricing_row(_row_from_orm(row), product_name=product.name, unit=product.unit)
    product.unit_price_sell = row.sell_price_per_unit
    product.ristourne_pct = row.ristourne_pct
    row.sell_price_per_kg = computed.sell_price_per_kg
    await db.flush()


async def compute_pricing_projection(
    db: AsyncSession,
    plan_id: UUID,
    plan_inputs: dict | None = None,
) -> dict:
    grid = await ensure_pricing_grid(db, plan_id, plan_inputs)
    products = await load_products(db, plan_id)
    names = {str(p.id): (p.name, p.unit) for p in products if p.id}
    proj = build_pricing_projection(grid, plan_id=plan_id, names_by_product=names)
    dump = proj.model_dump(mode="json")
    dump["grid"] = [r.model_dump(mode="json") for r in grid]
    return dump
