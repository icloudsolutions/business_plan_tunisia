"""KPI dashboard assembly from plan modules."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from bp_calc.kpi_dashboard import build_kpi_dashboard
from bp_calc.projections import SCENARIO_PRESETS, apply_scenario_to_inputs
from bp_schema.liasse import PlanInputs

from app.balance_sheet_service import _revenue_and_purchases
from app.revenue_service import (
    _assumptions_from_orm,
    get_or_create_assumptions,
    load_products,
)
from bp_calc.revenue import calculate_revenue_projection


async def compute_kpi_dashboard(
    db: AsyncSession,
    plan_id: UUID,
    plan_inputs: dict,
    *,
    discount_rate: float = 0.10,
    scenario: str = "base",
) -> dict:
    inputs = PlanInputs.model_validate(plan_inputs or {})
    preset = SCENARIO_PRESETS.get(scenario, SCENARIO_PRESETS["base"])
    growth = preset["growth_rate"]

    capacity_util: list[float] | None = None
    products = await load_products(db, plan_id)
    if products:
        assump_row = await get_or_create_assumptions(db, plan_id, plan_inputs)
        assumptions = _assumptions_from_orm(assump_row, plan_id)
        rev_proj = calculate_revenue_projection(products, assumptions, plan_id=plan_id)
        if rev_proj.capacity_utilization_pct:
            capacity_util = list(rev_proj.capacity_utilization_pct)

    scenario_inputs = apply_scenario_to_inputs(
        inputs,
        revenue_scale=preset["revenue_scale"],
        loan_rate_scale=preset["loan_rate_scale"],
    )
    revenue_ht, _, _ = await _revenue_and_purchases(db, plan_id, scenario_inputs)
    rev_override = revenue_ht if revenue_ht and sum(revenue_ht) > 0 else None

    projection = build_kpi_dashboard(
        scenario_inputs,
        scenario=scenario,
        discount_rate=discount_rate,
        revenue_growth=growth,
        capacity_utilization_pct=capacity_util,
        revenue_ht_override=rev_override,
    )
    from bp_calc.kpi_dashboard import tri_status_color

    dump = projection.model_dump()
    dump["tri_status"] = tri_status_color(projection.primary.tri)
    return dump
