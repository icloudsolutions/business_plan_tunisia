"""Build finance cockpit projection payloads from plan inputs and results."""

from __future__ import annotations

from typing import Any

from bp_calc.capex import all_equipment, total_capex
from bp_calc.engine import HORIZON, _capacity_units, _personnel_cost, calculate_plan
from bp_schema.liasse import PlanInputs, PlanResults

SCENARIO_PRESETS = {
    "base": {"revenue_scale": 1.0, "growth_rate": 0.03, "loan_rate_scale": 1.0},
    "pessimistic": {"revenue_scale": 0.85, "growth_rate": 0.02, "loan_rate_scale": 1.05},
    "optimistic": {"revenue_scale": 1.15, "growth_rate": 0.04, "loan_rate_scale": 0.95},
}


def apply_scenario_to_inputs(
    inputs: PlanInputs,
    *,
    revenue_scale: float = 1.0,
    loan_rate_scale: float = 1.0,
) -> PlanInputs:
    data = inputs.model_dump()
    ops = data.setdefault("operations", {})
    if revenue_scale != 1.0:
        ops["salePrice"] = float(ops.get("salePrice", 0)) * revenue_scale
    fin = data.setdefault("financing", {})
    loan = fin.setdefault("loan", {})
    if loan_rate_scale != 1.0:
        loan["rate"] = float(loan.get("rate", 0.083)) * loan_rate_scale
    return PlanInputs.model_validate(data)


def compute_yearly_pl_breakdown(
    inputs: PlanInputs,
    discount_rate: float = 0.10,
    revenue_growth: float = 0.03,
    *,
    revenue_growth_by_year: list[float] | None = None,
    personnel_cost_growth: float = 0.0,
) -> tuple[PlanResults, list[dict[str, Any]]]:
    """Run engine and attach yearly P&L lines for charts."""
    results = calculate_plan(
        inputs,
        discount_rate=discount_rate,
        revenue_growth=revenue_growth,
        revenue_growth_by_year=revenue_growth_by_year,
        personnel_cost_growth=personnel_cost_growth,
    )

    from bp_calc.capex import annual_depreciation_schedule
    from bp_calc.loan import build_loan_schedule
    from bp_calc.tva import vat_on_amount, weighted_vat_rate

    total_inv = total_capex(inputs)
    debt = total_inv * inputs.financing.debtRatio
    loan_amount = inputs.financing.loan.amount or debt
    vat_rate = weighted_vat_rate(inputs.company.taxRegime.tvaRates)
    dep = annual_depreciation_schedule(inputs)
    interest, principal_rep, _ = build_loan_schedule(
        loan_amount,
        inputs.financing.loan.rate,
        inputs.financing.loan.years,
        inputs.financing.loan.graceMonthsPrincipal,
        frequency="quarterly",
    )
    interest = (interest + [0.0] * HORIZON)[:HORIZON]
    principal_rep = (principal_rep + [0.0] * HORIZON)[:HORIZON]

    units_by_year = [_capacity_units(inputs.operations, y) for y in range(HORIZON)]
    gross_revenue = [units_by_year[0] * inputs.operations.salePrice]
    for y in range(1, HORIZON):
        gross_revenue.append(gross_revenue[y - 1] * (1.0 + revenue_growth))

    discount_pct = inputs.plAssumptions.commercialDiscount
    revenue_ht = [g * (1.0 - discount_pct) for g in gross_revenue]
    material_unit = inputs.operations.rawMaterialCost
    packaging_unit = inputs.operations.packagingCost
    personnel = _personnel_cost(inputs.plAssumptions)
    other = inputs.plAssumptions.otherOperatingCharges
    dist_pct = inputs.plAssumptions.distributionExpensePct
    mkt_pct = inputs.plAssumptions.marketingExpensePct
    tax_rate = inputs.plAssumptions.corporateTaxRate

    yearly: list[dict[str, Any]] = []
    for y in range(HORIZON):
        rev = revenue_ht[y]
        growth_f = (1.0 + revenue_growth) ** y
        raw_c = units_by_year[y] * material_unit * growth_f
        pack_c = units_by_year[y] * packaging_unit * growth_f
        cons = raw_c + pack_c
        vat_payable = max(
            0.0,
            vat_on_amount(rev, vat_rate) - vat_on_amount(cons, vat_rate),
        )
        dist_cost = rev * dist_pct
        mkt_cost = rev * mkt_pct
        dep_y = dep[y]
        ebe = rev - cons - personnel - other - dist_cost - mkt_cost - vat_payable
        ebit = ebe - dep_y
        fin = interest[y]
        taxable = ebit - fin
        tax = max(0.0, taxable * tax_rate)
        net = taxable - tax
        gross_margin_pct = (rev - cons) / rev if rev else 0.0

        yearly.append(
            {
                "year": y + 1,
                "revenue": rev,
                "cogs": cons,
                "personnel": personnel,
                "otherOpex": other,
                "distribution": dist_cost,
                "marketing": mkt_cost,
                "vat": vat_payable,
                "depreciation": dep_y,
                "interest": fin,
                "tax": tax,
                "totalExpenses": cons + personnel + other + dist_cost + mkt_cost + vat_payable + dep_y + fin + tax,
                "netProfit": net,
                "ebe": ebe,
                "grossMarginPct": gross_margin_pct,
                "operatingCashFlow": results.operatingCashFlow.years[y]
                if y < len(results.operatingCashFlow.years)
                else 0.0,
                "cumulativeTreasury": results.cumulativeTreasury.years[y]
                if y < len(results.cumulativeTreasury.years)
                else 0.0,
                "principalRepayment": principal_rep[y],
                "bfrVariation": results.bfrVariation.years[y]
                if y < len(results.bfrVariation.years)
                else 0.0,
            }
        )

    return results, yearly


def investment_breakdown(inputs: PlanInputs) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for eq in all_equipment(inputs):
        cat = "Incorporel" if eq.assetType == "intangible" else "Corporel"
        items.append(
            {
                "name": eq.name,
                "category": cat,
                "amount": eq.cost,
                "acquisitionYear": eq.acquisitionYear,
            }
        )
    by_cat: dict[str, float] = {}
    for row in items:
        by_cat[row["category"]] = by_cat.get(row["category"], 0.0) + row["amount"]
    return [
        {"name": k, "value": v, "category": k}
        for k, v in sorted(by_cat.items(), key=lambda x: -x[1])
    ]


def treasury_waterfall(results: PlanResults, total_investment: float) -> list[dict[str, Any]]:
    steps: list[dict[str, Any]] = [
        {"step": "Investissement initial", "value": -total_investment, "type": "outflow"},
    ]
    for y in range(min(HORIZON, len(results.operatingCashFlow.years))):
        ocf = results.operatingCashFlow.years[y]
        principal = (
            results.principalRepayment.years[y]
            if y < len(results.principalRepayment.years)
            else 0.0
        )
        steps.append({"step": f"CF exploitation An {y + 1}", "value": ocf, "type": "inflow"})
        if principal > 0:
            steps.append(
                {
                    "step": f"Remboursement An {y + 1}",
                    "value": -principal,
                    "type": "outflow",
                }
            )
    end = results.cumulativeTreasury.years[-1] if results.cumulativeTreasury.years else 0.0
    steps.append({"step": "Trésorerie finale (An 7)", "value": end, "type": "total"})
    return steps


def build_kpis(
    results: PlanResults,
    yearly: list[dict[str, Any]],
    prior: PlanResults | None = None,
) -> dict[str, Any]:
    y0 = yearly[0] if yearly else {}
    prior_y0_margin = None
    prior_van = None
    prior_tri = None
    prior_drci = None
    if prior and prior.revenue.years:
        rev0 = prior.revenue.years[0]
        # approximate prior gross margin from stored results only
        prior_van = prior.indicators.van
        prior_tri = prior.indicators.tri
        prior_drci = prior.indicators.drciYears

    def trend(cur: float, prev: float | None) -> float | None:
        if prev is None or prev == 0:
            return None
        return (cur - prev) / abs(prev)

    break_even_year = results.cashRunwayBreakYear
    cum_profit = 0.0
    point_mort_year = None
    for row in yearly:
        cum_profit += row["netProfit"]
        if cum_profit >= 0 and point_mort_year is None:
            point_mort_year = row["year"]

    return {
        "van": results.indicators.van,
        "tri": results.indicators.tri,
        "drci": results.indicators.drciYears,
        "pointMort": point_mort_year or break_even_year,
        "grossMarginPct": y0.get("grossMarginPct", 0.0),
        "ebe": y0.get("ebe", 0.0),
        "totalInvestment": results.totalInvestment,
        "trends": {
            "van": trend(results.indicators.van, prior_van),
            "tri": trend(results.indicators.tri or 0, prior_tri or 0) if results.indicators.tri else None,
            "drci": trend(results.indicators.drciYears or 0, prior_drci or 0)
            if results.indicators.drciYears
            else None,
            "grossMarginPct": trend(y0.get("grossMarginPct", 0), prior_y0_margin),
            "ebe": None,
        },
    }


def build_projection_payload(
    inputs: PlanInputs,
    *,
    scenario: str = "base",
    revenue_mult: float | None = None,
    growth_mult: float | None = None,
    loan_rate_mult: float | None = None,
    discount_rate: float = 0.10,
    prior_results: PlanResults | None = None,
    stored_results: PlanResults | None = None,
) -> dict[str, Any]:
    preset = SCENARIO_PRESETS.get(scenario, SCENARIO_PRESETS["base"])
    rev_scale = revenue_mult if revenue_mult is not None else preset["revenue_scale"]
    growth = preset["growth_rate"] * (growth_mult if growth_mult is not None else 1.0)
    loan_scale = loan_rate_mult if loan_rate_mult is not None else preset["loan_rate_scale"]

    scenario_inputs = apply_scenario_to_inputs(
        inputs,
        revenue_scale=rev_scale,
        loan_rate_scale=loan_scale,
    )
    results, yearly = compute_yearly_pl_breakdown(
        scenario_inputs, discount_rate=discount_rate, revenue_growth=growth
    )

    return {
        "scenario": scenario,
        "multipliers": {
            "revenueScale": rev_scale,
            "growthRate": growth,
            "loanRateScale": loan_scale,
        },
        "hasResults": stored_results is not None,
        "pl": yearly,
        "treasuryWaterfall": treasury_waterfall(results, results.totalInvestment),
        "investments": investment_breakdown(inputs),
        "investmentDetails": [
            {"name": e.name, "value": e.cost, "category": e.assetType}
            for e in all_equipment(inputs)
        ],
        "kpis": build_kpis(results, yearly, prior_results),
        "indicators": results.indicators.model_dump(),
        "series": {
            "revenue": results.revenue.years,
            "netProfit": results.netProfit.years,
            "operatingCashFlow": results.operatingCashFlow.years,
            "cumulativeTreasury": results.cumulativeTreasury.years,
            "bfr": results.bfr.years,
            "depreciation": results.depreciation.years,
        },
    }


def build_all_scenarios(
    inputs: PlanInputs,
    discount_rate: float = 0.10,
    prior_results: PlanResults | None = None,
    custom_mults: dict[str, float] | None = None,
) -> dict[str, Any]:
    """Base payload plus overlay series for pessimistic/optimistic."""
    base = build_projection_payload(
        inputs,
        scenario="base",
        discount_rate=discount_rate,
        prior_results=prior_results,
    )
    pess = build_projection_payload(inputs, scenario="pessimistic", discount_rate=discount_rate)
    opt = build_projection_payload(inputs, scenario="optimistic", discount_rate=discount_rate)

    custom = None
    if custom_mults:
        custom = build_projection_payload(
            inputs,
            scenario="custom",
            revenue_mult=custom_mults.get("revenueScale"),
            growth_mult=custom_mults.get("growthMult"),
            loan_rate_mult=custom_mults.get("loanRateMult"),
            discount_rate=discount_rate,
        )

    return {
        "base": base,
        "pessimistic": pess,
        "optimistic": opt,
        "custom": custom,
    }
