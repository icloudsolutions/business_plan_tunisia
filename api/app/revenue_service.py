"""Load plan products/assumptions and run revenue projection."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bp_calc.revenue import calculate_revenue_projection
from bp_schema.liasse import PlanInputs
from bp_schema.revenue import PlanProduct, RevenueAssumptions, RevenueProjection

from app.models import PlanProduct as PlanProductORM
from app.models import PlanRevenueAssumptions as PlanRevenueAssumptionsORM


def _product_from_orm(row: PlanProductORM) -> PlanProduct:
    return PlanProduct(
        id=row.id,
        plan_id=row.plan_id,
        name=row.name,
        unit=row.unit,  # type: ignore[arg-type]
        unit_price_sell=row.unit_price_sell,
        ristourne_pct=row.ristourne_pct,
        monthly_qty_y1=row.monthly_qty_y1,
        sort_order=row.sort_order,
    )


def _assumptions_from_orm(row: PlanRevenueAssumptionsORM | None, plan_id: UUID) -> RevenueAssumptions:
    if not row:
        return RevenueAssumptions(plan_id=plan_id)
    return RevenueAssumptions(
        plan_id=row.plan_id,
        nominal_capacity=row.nominal_capacity,
        capacity_basis=row.capacity_basis,  # type: ignore[arg-type]
        production_days=row.production_days,
        growth_rate_y2=row.growth_rate_y2,
        growth_rate_y3=row.growth_rate_y3,
        growth_rate_y4=row.growth_rate_y4,
        growth_rate_y5=row.growth_rate_y5,
        growth_rate_y6=row.growth_rate_y6,
        growth_rate_y7=row.growth_rate_y7,
    )


async def load_products(db: AsyncSession, plan_id: UUID) -> list[PlanProduct]:
    result = await db.execute(
        select(PlanProductORM)
        .where(PlanProductORM.plan_id == plan_id)
        .order_by(PlanProductORM.sort_order, PlanProductORM.created_at)
    )
    return [_product_from_orm(r) for r in result.scalars().all()]


async def get_or_create_assumptions(
    db: AsyncSession, plan_id: UUID, plan_inputs: dict | None = None
) -> PlanRevenueAssumptionsORM:
    row = await db.get(PlanRevenueAssumptionsORM, plan_id)
    if row:
        return row
    prod_days = 250.0
    if plan_inputs:
        try:
            ops = PlanInputs.model_validate(plan_inputs).operations
            prod_days = float(ops.workingDaysPerYear or 250)
        except Exception:
            pass
    row = PlanRevenueAssumptionsORM(plan_id=plan_id, production_days=prod_days)
    db.add(row)
    await db.flush()
    return row


async def compute_projection(
    db: AsyncSession,
    plan_id: UUID,
    plan_inputs: dict | None = None,
) -> RevenueProjection:
    products = await load_products(db, plan_id)
    assump_row = await get_or_create_assumptions(db, plan_id, plan_inputs)
    assumptions = _assumptions_from_orm(assump_row, plan_id)
    if plan_inputs and assumptions.production_days == 250.0:
        try:
            assumptions.production_days = float(
                PlanInputs.model_validate(plan_inputs).operations.workingDaysPerYear or 250
            )
        except Exception:
            pass
    return calculate_revenue_projection(products, assumptions, plan_id=plan_id)
