"""Multi-product revenue projection (7 years)."""

from __future__ import annotations

from typing import Literal

from bp_calc.timeline import apply_y1_startup_factor
from bp_schema.revenue import (
    HORIZON,
    PRODUCTION_DAY_BASE,
    PlanProduct,
    ProductRevenueSeries,
    ProductYearRevenue,
    RevenueAssumptions,
    RevenueProjection,
)

__all__ = [
    "annual_qty_from_monthly",
    "nominal_capacity_annual",
    "calculate_revenue_projection",
    "utilization_color",
]


def annual_qty_from_monthly(monthly_qty: float, production_days: float) -> float:
    """qty_annual = monthly_qty * 12 * (production_days / 310)."""
    if monthly_qty <= 0 or production_days <= 0:
        return 0.0
    return monthly_qty * 12.0 * (production_days / PRODUCTION_DAY_BASE)


def nominal_capacity_annual(
    nominal: float,
    basis: str,
    production_days: float,
) -> float:
    if nominal <= 0:
        return 0.0
    if basis == "kg_per_month":
        return nominal * 12.0 * (production_days / PRODUCTION_DAY_BASE)
    return nominal * production_days


def _revenue_from_qty(qty: float, unit_price: float, ristourne_pct: float) -> tuple[float, float, float]:
    gross = qty * unit_price
    ristourne = gross * ristourne_pct
    net = gross - ristourne
    return gross, ristourne, net


def _apply_growth_chain(base_annual_qty: float, growth_rates: list[float]) -> list[float]:
    """Return annual quantities for Y1..Y7."""
    qtys = [base_annual_qty]
    for y in range(1, HORIZON):
        rate = growth_rates[y - 1] if y - 1 < len(growth_rates) else growth_rates[-1] if growth_rates else 0.0
        qtys.append(qtys[y - 1] * (1.0 + rate))
    return qtys


def calculate_revenue_projection(
    products: list[PlanProduct],
    assumptions: RevenueAssumptions,
    *,
    plan_id=None,
    startup_delay_days: int = 0,
) -> RevenueProjection:
    growth = assumptions.growth_rates()
    prod_days = assumptions.production_days
    cap_annual = nominal_capacity_annual(
        assumptions.nominal_capacity,
        assumptions.capacity_basis,
        prod_days,
    )

    series_list: list[ProductRevenueSeries] = []
    total_gross = [0.0] * HORIZON
    total_net = [0.0] * HORIZON
    total_qty = [0.0] * HORIZON

    for p in products:
        base = annual_qty_from_monthly(p.monthly_qty_y1, prod_days)
        qty_by_year = _apply_growth_chain(base, growth)
        years: list[ProductYearRevenue] = []
        pid = str(p.id) if p.id else p.name

        for yi in range(HORIZON):
            q = qty_by_year[yi]
            gross, rist, net = _revenue_from_qty(q, p.unit_price_sell, p.ristourne_pct)
            years.append(
                ProductYearRevenue(
                    year=yi + 1,
                    quantity=q,
                    revenue_gross=gross,
                    ristourne=rist,
                    revenue_net=net,
                )
            )
            total_gross[yi] += gross
            total_net[yi] += net
            total_qty[yi] += q

        series_list.append(
            ProductRevenueSeries(
                product_id=pid,
                name=p.name,
                unit=p.unit,
                years=years,
            )
        )

    if startup_delay_days > 0:
        from bp_calc.timeline import y1_revenue_startup_factor

        sf = y1_revenue_startup_factor(startup_delay_days)
        total_gross = apply_y1_startup_factor(total_gross, startup_delay_days)
        total_net = apply_y1_startup_factor(total_net, startup_delay_days)
        total_qty = apply_y1_startup_factor(total_qty, startup_delay_days)
        for s in series_list:
            if s.years:
                y0 = s.years[0]
                y0.quantity *= sf
                y0.revenue_gross *= sf
                y0.revenue_net *= sf
                y0.ristourne = y0.revenue_gross - y0.revenue_net

    utilization = [
        (total_qty[y] / cap_annual * 100.0) if cap_annual > 0 else 0.0 for y in range(HORIZON)
    ]

    return RevenueProjection(
        plan_id=plan_id,
        products=series_list,
        total_revenue_gross=total_gross,
        total_revenue_net=total_net,
        total_quantity=total_qty,
        capacity_utilization_pct=utilization,
        nominal_capacity_annual=cap_annual,
    )


def utilization_color(pct: float) -> Literal["green", "orange", "red"]:
    if pct > 95:
        return "red"
    if pct >= 80:
        return "orange"
    return "green"
