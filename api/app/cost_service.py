"""Load cost components and compute unit cost projections."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bp_calc.cost import calculate_all_years_cost_summary, calculate_plan_cost_projection
from bp_calc.revenue import calculate_revenue_projection
from bp_schema.cost import ProductCostComponents
from bp_schema.liasse import PlanInputs
from bp_schema.revenue import PlanProduct

from app.models import PlanProduct as PlanProductORM
from app.models import PlanProductCostComponent, PlanRevenueAssumptions
from app.payroll_service import get_imputable_payroll_annual, load_staff_roles
from app.revenue_service import (
    _assumptions_from_orm,
    _product_from_orm,
    get_or_create_assumptions,
    load_products,
)


def _cost_from_orm(row: PlanProductCostComponent) -> ProductCostComponents:
    return ProductCostComponents(
        id=row.id,
        plan_id=row.plan_id,
        product_id=row.product_id,
        year=row.year,
        mp_price_per_kg=row.mp_price_per_kg,
        arome_rate_pct=row.arome_rate_pct,
        packaging_g_per_unit=row.packaging_g_per_unit,
        packaging_price_per_kg=row.packaging_price_per_kg,
        gas_monthly=row.gas_monthly,
        electricity_monthly=row.electricity_monthly,
        water_monthly=row.water_monthly,
        waste_pct=row.waste_pct,
    )


async def load_cost_components(
    db: AsyncSession, plan_id: UUID, year: int | None = None
) -> list[ProductCostComponents]:
    q = select(PlanProductCostComponent).where(PlanProductCostComponent.plan_id == plan_id)
    if year is not None:
        q = q.where(PlanProductCostComponent.year == year)
    result = await db.execute(q.order_by(PlanProductCostComponent.year))
    return [_cost_from_orm(r) for r in result.scalars().all()]


def cost_lookup(components: list[ProductCostComponents]) -> dict[tuple[str, int], ProductCostComponents]:
    out: dict[tuple[str, int], ProductCostComponents] = {}
    for c in components:
        if c.product_id:
            out[(str(c.product_id), c.year)] = c
    return out


async def ensure_cost_grid(db: AsyncSession, plan_id: UUID, product_id: UUID) -> None:
    """Create Y1–Y7 cost rows for a new product if missing."""
    existing = await db.execute(
        select(PlanProductCostComponent.year).where(
            PlanProductCostComponent.plan_id == plan_id,
            PlanProductCostComponent.product_id == product_id,
        )
    )
    have = {r[0] for r in existing.all()}
    for y in range(1, 8):
        if y not in have:
            db.add(
                PlanProductCostComponent(
                    plan_id=plan_id,
                    product_id=product_id,
                    year=y,
                )
            )
    await db.flush()


async def _payroll_for_cost(
    db: AsyncSession, plan_id: UUID, plan_inputs: dict, year: int
) -> float:
    from bp_calc.cost import total_annual_payroll

    roles = await load_staff_roles(db, plan_id)
    if roles:
        return await get_imputable_payroll_annual(db, plan_id, year)
    return total_annual_payroll(PlanInputs.model_validate(plan_inputs))


async def compute_unit_cost_projection(
    db: AsyncSession,
    plan_id: UUID,
    plan_inputs: dict,
    *,
    year: int = 1,
) -> dict:
    products = await load_products(db, plan_id)
    components = await load_cost_components(db, plan_id)
    assump_row = await get_or_create_assumptions(db, plan_id, plan_inputs)
    assumptions = _assumptions_from_orm(assump_row, plan_id)
    inputs = PlanInputs.model_validate(plan_inputs)
    margin = float(getattr(assump_row, "margin_alert_threshold", 0.2) or 0.2)
    payroll = await _payroll_for_cost(db, plan_id, plan_inputs, year)

    revenue = calculate_revenue_projection(products, assumptions, plan_id=plan_id)
    projection = calculate_plan_cost_projection(
        products,
        cost_lookup(components),
        revenue,
        inputs,
        year=year,
        plan_id=plan_id,
        margin_threshold=margin,
        annual_payroll=payroll,
    )
    return projection.model_dump()


async def compute_all_years(
    db: AsyncSession,
    plan_id: UUID,
    plan_inputs: dict,
) -> list[dict]:
    products = await load_products(db, plan_id)
    components = await load_cost_components(db, plan_id)
    assump_row = await get_or_create_assumptions(db, plan_id, plan_inputs)
    assumptions = _assumptions_from_orm(assump_row, plan_id)
    inputs = PlanInputs.model_validate(plan_inputs)
    margin = float(getattr(assump_row, "margin_alert_threshold", 0.2) or 0.2)
    payroll_by_year = {
        y: await _payroll_for_cost(db, plan_id, plan_inputs, y) for y in range(1, 8)
    }
    rows = calculate_all_years_cost_summary(
        products,
        cost_lookup(components),
        assumptions,
        inputs,
        plan_id=plan_id,
        margin_threshold=margin,
        payroll_by_year=payroll_by_year,
    )
    return [r.model_dump() for r in rows]


async def autofill_hints(
    db: AsyncSession,
    plan_id: UUID,
    inputs: PlanInputs,
    products: list[PlanProduct],
) -> dict:
    from bp_calc.capex import annual_depreciation_schedule, total_capex
    from bp_calc.cost import total_annual_payroll

    dep = annual_depreciation_schedule(inputs)
    payroll = await _payroll_for_cost(db, plan_id, inputs.model_dump(), 1)
    if payroll <= 0:
        payroll = total_annual_payroll(inputs)
    ops = inputs.operations
    return {
        "annual_payroll": payroll,
        "annual_depreciation_y1": dep[0] if dep else 0.0,
        "depreciation_by_year": dep,
        "total_capex": total_capex(inputs),
        "suggested_mp_price_per_kg": ops.rawMaterialCost,
        "suggested_packaging_price_per_kg": ops.packagingCost,
        "suggested_waste_pct": ops.wasteRate.value,
        "products": [
            {
                "product_id": str(p.id),
                "name": p.name,
                "unit": p.unit,
            }
            for p in products
        ],
    }
