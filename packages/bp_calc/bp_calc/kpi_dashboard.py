"""Financial KPI dashboard engine (VIPA / Excel aligned)."""

from __future__ import annotations

from typing import Any

from bp_calc.engine import HORIZON, _capacity_units
from bp_calc.indicators import irr, npv, payback_period_years
from bp_calc.projections import SCENARIO_PRESETS, apply_scenario_to_inputs, compute_yearly_pl_breakdown
from bp_schema.kpi_dashboard import (
    AnnualPerformanceYear,
    CapacityEfficiency,
    Financability,
    FinancingYear,
    KpiDashboardProjection,
    PrimaryKpis,
)
from bp_schema.liasse import PlanInputs

__all__ = [
    "format_payback_label",
    "tri_status_color",
    "build_kpi_dashboard",
]


def format_payback_label(years: float | None) -> str:
    if years is None:
        return "—"
    y = int(years)
    months = int(round((years - y) * 12))
    if months >= 12:
        y += 1
        months = 0
    if y <= 0 and months <= 0:
        return "0 mois"
    if y <= 0:
        return f"{months} mois"
    if months <= 0:
        return f"{y} ans"
    return f"{y} ans {months} mois"


def tri_status_color(tri: float | None) -> str:
    if tri is None:
        return "neutral"
    if tri > 0.15:
        return "green"
    if tri >= 0.10:
        return "orange"
    return "red"


def _profitability_index(van: float, investment: float) -> float | None:
    if investment <= 0:
        return None
    return van / investment


def _accounting_rate_of_return(net_profits: list[float], investment: float) -> float | None:
    """TRC: average annual net profit / initial investment."""
    if investment <= 0 or not net_profits:
        return None
    avg = sum(net_profits) / len(net_profits)
    return avg / investment


def _break_even_revenue(
    revenue: float,
    gross_margin_pct: float,
    personnel: float,
    other_opex: float,
    distribution: float,
    marketing: float,
    vat: float,
    depreciation: float,
    interest: float,
) -> float:
    """Point mort (CA) = charges fixes / taux de marge brute."""
    if gross_margin_pct <= 0:
        return 0.0
    fixed = personnel + other_opex + distribution + marketing + vat + depreciation + interest
    return fixed / gross_margin_pct


def build_kpi_dashboard(
    inputs: PlanInputs,
    *,
    scenario: str = "base",
    discount_rate: float = 0.10,
    revenue_growth: float | None = None,
    capacity_utilization_pct: list[float] | None = None,
    revenue_ht_override: list[float] | None = None,
    plan_term_years: int | None = None,
) -> KpiDashboardProjection:
    preset = SCENARIO_PRESETS.get(scenario, SCENARIO_PRESETS["base"])
    growth = revenue_growth if revenue_growth is not None else preset["growth_rate"]
    scenario_inputs = apply_scenario_to_inputs(
        inputs,
        revenue_scale=preset["revenue_scale"],
        loan_rate_scale=preset["loan_rate_scale"],
    )

    results, yearly = compute_yearly_pl_breakdown(
        scenario_inputs, discount_rate=discount_rate, revenue_growth=growth
    )

    if revenue_ht_override:
        for y in range(min(HORIZON, len(revenue_ht_override), len(yearly))):
            old_rev = yearly[y]["revenue"] or 1.0
            new_rev = revenue_ht_override[y]
            scale = new_rev / old_rev if old_rev else 1.0
            yearly[y]["revenue"] = new_rev
            for key in ("cogs", "distribution", "marketing", "vat", "ebe"):
                if key in yearly[y]:
                    yearly[y][key] = yearly[y][key] * scale
            yearly[y]["grossMarginPct"] = (
                (new_rev - yearly[y]["cogs"]) / new_rev if new_rev else 0.0
            )
            yearly[y]["netProfit"] = yearly[y].get("netProfit", 0.0) * scale
            yearly[y]["ebe"] = yearly[y].get("ebe", 0.0) * scale

    total_inv = results.totalInvestment
    equity = total_inv * inputs.financing.equityRatio
    loan_years = inputs.financing.loan.years or HORIZON
    term = plan_term_years or loan_years

    cf_vector = [-total_inv]
    for y in range(HORIZON):
        ocf = results.operatingCashFlow.years[y] if y < len(results.operatingCashFlow.years) else 0.0
        principal = (
            results.principalRepayment.years[y]
            if y < len(results.principalRepayment.years)
            else 0.0
        )
        cf_vector.append(ocf - principal)

    van = npv(discount_rate, cf_vector)
    tri = irr(cf_vector)
    drci = payback_period_years(
        total_inv,
        results.operatingCashFlow.years,
        results.cumulativeTreasury.years,
    )
    ip = _profitability_index(van, total_inv)
    trc = _accounting_rate_of_return(list(results.netProfit.years), total_inv)

    primary = PrimaryKpis(
        van=round(van, 2),
        tri=round(tri, 6) if tri is not None else None,
        drci_years=round(drci, 4) if drci is not None else None,
        drci_label=format_payback_label(drci),
        profitability_index=round(ip, 4) if ip is not None else None,
        trc=round(trc, 6) if trc is not None else None,
        discount_rate=discount_rate,
        total_investment=round(total_inv, 2),
    )

    annual_perf: list[AnnualPerformanceYear] = []
    chart_revenue: list[dict[str, Any]] = []
    chart_margins: list[dict[str, Any]] = []

    for row in yearly:
        rev = row["revenue"]
        ebe = row["ebe"]
        dep = row["depreciation"]
        ebit = ebe - dep
        net = row["netProfit"]
        gm = row["grossMarginPct"]
        nm = net / rev if rev else 0.0
        annual_perf.append(
            AnnualPerformanceYear(
                year=row["year"],
                revenue=round(rev, 2),
                ebit=round(ebit, 2),
                net_profit=round(net, 2),
                gross_margin_pct=round(gm, 6),
                net_margin_pct=round(nm, 6),
                ebe=round(ebe, 2),
            )
        )
        chart_revenue.append(
            {
                "year": f"Y{row['year']}",
                "revenue": round(rev, 2),
                "ebit": round(ebit, 2),
                "netProfit": round(net, 2),
            }
        )
        chart_margins.append(
            {
                "year": f"Y{row['year']}",
                "grossMarginPct": round(gm * 100, 2),
                "netMarginPct": round(nm * 100, 2),
            }
        )

    y0 = yearly[0] if yearly else {}
    gm0 = y0.get("grossMarginPct", 0.0) or 0.0
    be_rev = _break_even_revenue(
        y0.get("revenue", 0.0),
        gm0,
        y0.get("personnel", 0.0),
        y0.get("otherOpex", 0.0),
        y0.get("distribution", 0.0),
        y0.get("marketing", 0.0),
        y0.get("vat", 0.0),
        y0.get("depreciation", 0.0),
        y0.get("interest", 0.0),
    )
    y1_rev = y0.get("revenue", 0.0)
    dist_pct = (y1_rev - be_rev) / be_rev * 100.0 if be_rev > 0 else 0.0
    be_fmt = f"{be_rev:,.0f}".replace(",", " ")
    callout = (
        f"Votre seuil de rentabilité est atteint à {be_fmt} DT de CA"
        f" — vous êtes à {dist_pct:.1f} % au-dessus en Y1"
        if be_rev > 0
        else "Seuil de rentabilité non calculable (marge brute nulle)."
    )

    if capacity_utilization_pct and len(capacity_utilization_pct) >= HORIZON:
        util = list(capacity_utilization_pct[:HORIZON])
    else:
        nominal = _capacity_units(inputs.operations, 0)
        util = []
        for y in range(HORIZON):
            actual = _capacity_units(inputs.operations, y)
            util.append((actual / nominal * 100.0) if nominal > 0 else 0.0)

    chart_capacity = [{"year": f"Y{y + 1}", "utilization": round(util[y], 2)} for y in range(HORIZON)]

    financing_rows: list[FinancingYear] = []
    chart_debt: list[dict[str, Any]] = []
    debt_balance = total_inv * inputs.financing.debtRatio
    min_dscr: float | None = None

    for y in range(HORIZON):
        row = yearly[y] if y < len(yearly) else {}
        ebe = row.get("ebe", 0.0)
        interest = row.get("interest", 0.0)
        principal = row.get("principalRepayment", 0.0)
        debt_service = interest + principal
        dscr = ebe / debt_service if debt_service > 0 else None
        if dscr is not None:
            min_dscr = dscr if min_dscr is None else min(min_dscr, dscr)

        debt_balance = max(0.0, debt_balance - principal)
        denom_equity = equity if equity > 0 else 1.0
        debt_ratio = debt_balance / denom_equity if denom_equity else 0.0

        financing_rows.append(
            FinancingYear(
                year=y + 1,
                debt_ratio=round(debt_ratio, 4),
                dscr=round(dscr, 4) if dscr is not None else None,
                remaining_debt=round(debt_balance, 2),
                ebitda=round(ebe, 2),
                debt_service=round(debt_service, 2),
            )
        )
        chart_debt.append(
            {
                "year": f"Y{y + 1}",
                "ebitda": round(ebe, 2),
                "debtService": round(debt_service, 2),
                "dscr": round(dscr, 2) if dscr is not None else None,
            }
        )

    checks = {
        "van_positive": van > 0,
        "tri_above_discount": (tri is not None and tri > discount_rate),
        "drci_within_term": (drci is not None and drci < term),
        "dscr_adequate": (min_dscr is not None and min_dscr > 1.2),
    }
    ok = all(checks.values())
    financability = Financability(
        is_financable=ok,
        label="Finançable ✓" if ok else "Non finançable ✗",
        checks=checks,
    )

    return KpiDashboardProjection(
        scenario=scenario,
        primary=primary,
        annual_performance=annual_perf,
        capacity=CapacityEfficiency(
            capacity_utilization_pct=[round(u, 2) for u in util],
            break_even_revenue=round(be_rev, 2),
            y1_revenue=round(y1_rev, 2),
            distance_above_break_even_pct=round(dist_pct, 2),
            break_even_callout=callout,
        ),
        financing=financing_rows,
        financability=financability,
        chart_revenue_profit=chart_revenue,
        chart_margins=chart_margins,
        chart_capacity=chart_capacity,
        chart_debt_coverage=chart_debt,
    )
