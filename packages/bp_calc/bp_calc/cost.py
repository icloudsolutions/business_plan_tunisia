"""Unit cost calculator per product (Excel-aligned)."""

from __future__ import annotations

from uuid import UUID

from bp_schema.cost import (
    CostAllocationContext,
    CostComponentBreakdown,
    DEFAULT_MARGIN_ALERT_PCT,
    HORIZON,
    PlanCostProjection,
    ProductCostComponents,
    ProductUnitCostResult,
)
from bp_schema.liasse import PlanInputs
from bp_schema.revenue import PlanProduct, RevenueAssumptions, RevenueProjection

from bp_calc.capex import annual_depreciation_schedule
from bp_calc.revenue import calculate_revenue_projection

__all__ = [
    "weight_kg_per_unit",
    "compute_unit_cost",
    "calculate_plan_cost_projection",
    "total_annual_payroll",
]


def total_annual_payroll(inputs: PlanInputs) -> float:
    return sum(p.headcount * p.annualSalary for p in inputs.plAssumptions.personnel)


def weight_kg_per_unit(product: PlanProduct, packaging_g_per_unit: float) -> float:
    if product.unit == "kg":
        return max(packaging_g_per_unit, 1.0) / 1000.0 if packaging_g_per_unit > 0 else 1.0
    grams = packaging_g_per_unit if packaging_g_per_unit > 0 else 1000.0
    return grams / 1000.0


def production_kg_from_units(annual_units: float, kg_per_unit: float) -> float:
    return max(0.0, annual_units * kg_per_unit)


def compute_unit_cost(
    components: ProductCostComponents,
    *,
    sell_price: float,
    kg_per_unit: float,
    allocation: CostAllocationContext,
    margin_threshold: float = DEFAULT_MARGIN_ALERT_PCT,
    product_id: str = "",
    name: str = "",
    unit: str = "unit",
    year: int = 1,
) -> ProductUnitCostResult:
    """unit_cost per sellable unit; utilities/labor/dep allocated per kg then × kg_per_unit."""
    mp_per_unit = components.mp_price_per_kg * kg_per_unit
    arome = mp_per_unit * components.arome_rate_pct
    packaging = components.packaging_price_per_kg * (components.packaging_g_per_unit / 1000.0)
    waste = components.waste_pct * mp_per_unit

    total_kg = allocation.total_production_kg
    utilities_annual = (
        components.gas_monthly + components.electricity_monthly + components.water_monthly
    ) * 12.0
    utilities_per_unit = 0.0
    labor_per_unit = 0.0
    dep_per_unit = 0.0
    if total_kg > 0 and kg_per_unit > 0:
        utilities_per_unit = (utilities_annual / total_kg) * kg_per_unit
        labor_per_unit = (allocation.annual_payroll / total_kg) * kg_per_unit
        dep_per_unit = (allocation.annual_depreciation / total_kg) * kg_per_unit

    breakdown = CostComponentBreakdown(
        mp=mp_per_unit,
        arome=arome,
        packaging=packaging,
        utilities=utilities_per_unit,
        labor=labor_per_unit,
        depreciation=dep_per_unit,
        waste=waste,
    )
    unit_cost = (
        breakdown.mp
        + breakdown.arome
        + breakdown.packaging
        + breakdown.utilities
        + breakdown.labor
        + breakdown.depreciation
        + breakdown.waste
    )
    margin = sell_price - unit_cost
    margin_rate = (margin / sell_price) if sell_price > 0 else None

    pct: dict[str, float] = {}
    if unit_cost > 0:
        pct = {
            "mp": breakdown.mp / unit_cost * 100,
            "arome": breakdown.arome / unit_cost * 100,
            "packaging": breakdown.packaging / unit_cost * 100,
            "utilities": breakdown.utilities / unit_cost * 100,
            "labor": breakdown.labor / unit_cost * 100,
            "depreciation": breakdown.depreciation / unit_cost * 100,
            "waste": breakdown.waste / unit_cost * 100,
        }

    alert = margin_rate is not None and margin_rate < margin_threshold

    return ProductUnitCostResult(
        product_id=product_id,
        name=name,
        year=year,
        unit=unit,
        sell_price=sell_price,
        unit_cost=unit_cost,
        gross_margin_per_unit=margin,
        gross_margin_rate=margin_rate,
        breakdown=breakdown,
        breakdown_pct=pct,
        margin_alert=alert,
        weight_kg_per_unit=kg_per_unit,
    )


def _utilities_monthly_for_year(
    cost_rows: list[ProductCostComponents], year: int
) -> tuple[float, float, float]:
    """Plan-level utilities for a year: average non-zero entries across products."""
    gas, elec, water, n = 0.0, 0.0, 0.0, 0
    for row in cost_rows:
        if row.year != year:
            continue
        if row.gas_monthly or row.electricity_monthly or row.water_monthly:
            gas += row.gas_monthly
            elec += row.electricity_monthly
            water += row.water_monthly
            n += 1
    if n == 0:
        return 0.0, 0.0, 0.0
    return gas / n, elec / n, water / n


def calculate_plan_cost_projection(
    products: list[PlanProduct],
    cost_by_key: dict[tuple[str, int], ProductCostComponents],
    revenue: RevenueProjection,
    inputs: PlanInputs,
    *,
    year: int = 1,
    plan_id: UUID | None = None,
    margin_threshold: float = DEFAULT_MARGIN_ALERT_PCT,
) -> PlanCostProjection:
    yi = year - 1
    payroll = total_annual_payroll(inputs)
    dep_schedule = annual_depreciation_schedule(inputs)
    dep_y = dep_schedule[yi] if yi < len(dep_schedule) else 0.0

    all_cost_rows = list(cost_by_key.values())
    gas_m, elec_m, water_m = _utilities_monthly_for_year(all_cost_rows, year)

    prod_kg_by_pid: dict[str, float] = {}
    qty_by_pid: dict[str, float] = {}
    for series in revenue.products:
        if yi < len(series.years):
            qty = series.years[yi].quantity
            qty_by_pid[series.product_id] = qty
            key = (series.product_id, year)
            comp = cost_by_key.get(key)
            product = next((p for p in products if str(p.id) == series.product_id), None)
            g = comp.packaging_g_per_unit if comp else 1000.0
            if product:
                kg_u = weight_kg_per_unit(product, g)
            else:
                kg_u = g / 1000.0
            prod_kg_by_pid[series.product_id] = production_kg_from_units(qty, kg_u)

    total_kg = sum(prod_kg_by_pid.values())

    results: list[ProductUnitCostResult] = []
    for p in products:
        pid = str(p.id)
        comp = cost_by_key.get((pid, year))
        if not comp:
            comp = ProductCostComponents(
                plan_id=plan_id,
                product_id=p.id,
                year=year,
            )
        comp = comp.model_copy(
            update={
                "gas_monthly": gas_m,
                "electricity_monthly": elec_m,
                "water_monthly": water_m,
            }
        )
        kg_u = weight_kg_per_unit(p, comp.packaging_g_per_unit)
        alloc = CostAllocationContext(
            annual_payroll=payroll,
            annual_depreciation=dep_y,
            total_production_kg=total_kg,
            production_kg_product=prod_kg_by_pid.get(pid, 0.0),
            annual_quantity_units=qty_by_pid.get(pid, 0.0),
        )
        results.append(
            compute_unit_cost(
                comp,
                sell_price=p.unit_price_sell,
                kg_per_unit=kg_u,
                allocation=alloc,
                margin_threshold=margin_threshold,
                product_id=pid,
                name=p.name,
                unit=p.unit,
                year=year,
            )
        )

    return PlanCostProjection(
        plan_id=plan_id,
        year=year,
        margin_alert_threshold=margin_threshold,
        allocation=CostAllocationContext(
            annual_payroll=payroll,
            annual_depreciation=dep_y,
            total_production_kg=total_kg,
        ),
        products=results,
    )


def calculate_all_years_cost_summary(
    products: list[PlanProduct],
    cost_by_key: dict[tuple[str, int], ProductCostComponents],
    assumptions: RevenueAssumptions,
    inputs: PlanInputs,
    *,
    plan_id: UUID | None = None,
    margin_threshold: float = DEFAULT_MARGIN_ALERT_PCT,
) -> list[PlanCostProjection]:
    revenue = calculate_revenue_projection(products, assumptions, plan_id=plan_id)
    return [
        calculate_plan_cost_projection(
            products,
            cost_by_key,
            revenue,
            inputs,
            year=y,
            plan_id=plan_id,
            margin_threshold=margin_threshold,
        )
        for y in range(1, HORIZON + 1)
    ]
