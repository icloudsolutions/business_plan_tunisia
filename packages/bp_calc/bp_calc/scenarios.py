"""Plan scenario multipliers and 7-year recalculation."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from bp_calc.engine import HORIZON, calculate_plan
from bp_calc.projections import build_kpis, compute_yearly_pl_breakdown
from bp_schema.liasse import PlanInputs, PlanResults

DEFAULT_MULTIPLIERS: dict[str, dict[str, Any]] = {
    "pessimiste": {
        "revenue_growth_by_year": [0.01, 0.015, 0.02, 0.02, 0.02, 0.02, 0.02],
        "personnel_cost_growth": 0.04,
        "raw_material_cost_ratio": 1.15,
        "loan_interest_rate_mult": 1.08,
        "revenue_scale": 0.88,
    },
    "base": {
        "revenue_growth_by_year": [0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03],
        "personnel_cost_growth": 0.03,
        "raw_material_cost_ratio": 1.0,
        "loan_interest_rate_mult": 1.0,
        "revenue_scale": 1.0,
    },
    "optimiste": {
        "revenue_growth_by_year": [0.05, 0.05, 0.04, 0.04, 0.04, 0.04, 0.04],
        "personnel_cost_growth": 0.025,
        "raw_material_cost_ratio": 0.92,
        "loan_interest_rate_mult": 0.95,
        "revenue_scale": 1.12,
    },
}

BUILTIN_SCENARIOS = [
    ("pessimiste", "Pessimiste"),
    ("base", "Base"),
    ("optimiste", "Optimiste"),
]


def normalize_multipliers(data: dict[str, Any] | str | None) -> dict[str, Any]:
    base = deepcopy(DEFAULT_MULTIPLIERS["base"])
    if data is None:
        return base
    if isinstance(data, str):
        return deepcopy(DEFAULT_MULTIPLIERS.get(data, DEFAULT_MULTIPLIERS["base"]))
    if not data:
        return base
    growth = data.get("revenue_growth_by_year")
    if isinstance(growth, list) and len(growth) == HORIZON:
        base["revenue_growth_by_year"] = [float(x) for x in growth]
    elif isinstance(growth, (int, float)):
        base["revenue_growth_by_year"] = [float(growth)] * HORIZON
    for key in ("personnel_cost_growth", "raw_material_cost_ratio", "loan_interest_rate_mult", "revenue_scale"):
        if key in data and data[key] is not None:
            base[key] = float(data[key])
    return base


def apply_multipliers_to_inputs(inputs: PlanInputs, multipliers: dict[str, Any]) -> PlanInputs:
    m = normalize_multipliers(multipliers)
    data = inputs.model_dump()
    ops = data.setdefault("operations", {})
    scale = float(m.get("revenue_scale", 1.0))
    if scale != 1.0:
        ops["salePrice"] = float(ops.get("salePrice", 0)) * scale
    ratio = float(m.get("raw_material_cost_ratio", 1.0))
    if ratio != 1.0:
        ops["rawMaterialCost"] = float(ops.get("rawMaterialCost", 0)) * ratio
        ops["packagingCost"] = float(ops.get("packagingCost", 0)) * ratio
    fin = data.setdefault("financing", {})
    loan = fin.setdefault("loan", {})
    lmult = float(m.get("loan_interest_rate_mult", 1.0))
    if lmult != 1.0:
        loan["rate"] = float(loan.get("rate", 0.083)) * lmult
    return PlanInputs.model_validate(data)


def calculate_scenario(
    inputs: PlanInputs,
    multipliers: dict[str, Any],
    *,
    discount_rate: float = 0.10,
) -> tuple[PlanResults, list[dict[str, Any]]]:
    m = normalize_multipliers(multipliers)
    scenario_inputs = apply_multipliers_to_inputs(inputs, m)
    growth_by_year = m["revenue_growth_by_year"]
    avg_growth = sum(growth_by_year) / len(growth_by_year) if growth_by_year else 0.03
    results, yearly = compute_yearly_pl_breakdown(
        scenario_inputs,
        discount_rate=discount_rate,
        revenue_growth=avg_growth,
        revenue_growth_by_year=growth_by_year,
        personnel_cost_growth=float(m.get("personnel_cost_growth", 0.03)),
    )
    return results, yearly


def build_scenario_payload(
    inputs: PlanInputs,
    multipliers: dict[str, Any],
    *,
    scenario_name: str,
    discount_rate: float = 0.10,
    stored_results: PlanResults | None = None,
) -> dict[str, Any]:
    results, yearly = calculate_scenario(inputs, multipliers, discount_rate=discount_rate)
    m = normalize_multipliers(multipliers)
    return {
        "scenario": scenario_name,
        "multipliers": m,
        "hasResults": True,
        "pl": yearly,
        "kpis": build_kpis(results, yearly, stored_results),
        "indicators": results.indicators.model_dump(),
        "series": {
            "revenue": results.revenue.years,
            "netProfit": results.netProfit.years,
            "operatingCashFlow": results.operatingCashFlow.years,
            "cumulativeTreasury": results.cumulativeTreasury.years,
        },
        "results": results.model_dump(),
    }


def compare_scenarios(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Build KPI comparison table from scenario rows with results."""
    table: list[dict[str, Any]] = []
    series: dict[str, list[float]] = {}
    for row in rows:
        name = row.get("name", "")
        slug = row.get("slug") or name.lower()
        results = row.get("results")
        if not results:
            table.append(
                {
                    "id": str(row.get("id", "")),
                    "name": name,
                    "slug": slug,
                    "status": row.get("calc_status", "PENDING"),
                    "is_official": row.get("is_official", False),
                    "van": None,
                    "tri": None,
                    "drci": None,
                    "point_mort": None,
                }
            )
            continue
        ind = results.get("indicators", {})
        net = results.get("netProfit", {}).get("years", [])
        cum = results.get("cumulativeTreasury", {}).get("years", [])
        point_mort = None
        run = 0.0
        for i, p in enumerate(net):
            run += p
            if run >= 0 and point_mort is None:
                point_mort = i + 1
        if point_mort is None and cum:
            for i, c in enumerate(cum):
                if c >= 0:
                    point_mort = i + 1
                    break
        sid = row.get("id", "")
        table.append(
            {
                "id": sid,
                "name": name,
                "slug": slug,
                "status": row.get("calc_status", "COMPLETED"),
                "is_official": row.get("is_official", False),
                "van": ind.get("van"),
                "tri": ind.get("tri"),
                "drci": ind.get("drciYears"),
                "point_mort": point_mort,
            }
        )
        series[slug] = net
    return {"kpi_table": table, "net_profit_series": series}
