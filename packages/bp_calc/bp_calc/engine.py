"""7-year financial projection engine (VIPA-aligned)."""

from bp_schema.liasse import PlanInputs, PlanResults, ProfitabilityIndicators, YearlySeries

from bp_calc.balance import check_balance_sheet, check_bfr_coherent
from bp_calc.bfr import bfr_variation_series, compute_bfr
from bp_calc.capex import annual_depreciation_schedule, total_capex
from bp_calc.indicators import irr, npv, payback_period_years
from bp_calc.loan import build_loan_schedule
from bp_calc.patch import apply_patch
from bp_calc.tva import vat_on_amount, weighted_vat_rate

HORIZON = 7
DISCOUNT_RATE = 0.10

__all__ = ["apply_patch", "calculate_plan", "compare_results", "HORIZON"]


def _capacity_units(ops, year_index: int) -> float:
    ppm = ops.packagesPerMinute if ops.packagesPerMinute else ops.capacityPerMinute
    minutes_per_day = ops.hoursPerDay * 60
    gross = ppm * minutes_per_day * ops.workingDaysPerYear
    waste = ops.waste_for_year(year_index)
    return gross * (1.0 - waste)


def _personnel_cost(pl) -> float:
    return sum(p.headcount * p.annualSalary for p in pl.personnel)


def calculate_plan(
    inputs: PlanInputs,
    discount_rate: float = DISCOUNT_RATE,
    revenue_growth: float = 0.03,
    *,
    revenue_growth_by_year: list[float] | None = None,
    personnel_cost_growth: float = 0.0,
) -> PlanResults:
    total_inv = total_capex(inputs)
    equity = total_inv * inputs.financing.equityRatio
    debt = total_inv * inputs.financing.debtRatio
    loan_amount = inputs.financing.loan.amount or debt
    vat_rate = weighted_vat_rate(inputs.company.taxRegime.tvaRates)

    dep = annual_depreciation_schedule(inputs)
    interest, principal_rep, end_balance = build_loan_schedule(
        loan_amount,
        inputs.financing.loan.rate,
        inputs.financing.loan.years,
        inputs.financing.loan.graceMonthsPrincipal,
    )
    interest = (interest + [0.0] * HORIZON)[:HORIZON]
    principal_rep = (principal_rep + [0.0] * HORIZON)[:HORIZON]

    units_by_year = [_capacity_units(inputs.operations, y) for y in range(HORIZON)]
    gross_revenue = [units_by_year[0] * inputs.operations.salePrice]
    for y in range(1, HORIZON):
        if revenue_growth_by_year and y - 1 < len(revenue_growth_by_year):
            g = revenue_growth_by_year[y - 1]
        else:
            g = revenue_growth
        gross_revenue.append(gross_revenue[y - 1] * (1.0 + g))

    discount_pct = inputs.plAssumptions.commercialDiscount
    revenue_ht = [g * (1.0 - discount_pct) for g in gross_revenue]
    vat_collected = [vat_on_amount(r, vat_rate) for r in revenue_ht]

    material_unit = inputs.operations.rawMaterialCost
    packaging_unit = inputs.operations.packagingCost
    raw_consumption = []
    packaging_consumption = []
    consumption = []
    for y in range(HORIZON):
        growth = (1.0 + revenue_growth) ** y
        raw_c = units_by_year[y] * material_unit * growth
        pack_c = units_by_year[y] * packaging_unit * growth
        raw_consumption.append(raw_c)
        packaging_consumption.append(pack_c)
        consumption.append(raw_c + pack_c)

    vat_deductible = [vat_on_amount(c, vat_rate) for c in consumption]
    vat_net = [vat_collected[y] - vat_deductible[y] for y in range(HORIZON)]

    personnel_base = _personnel_cost(inputs.plAssumptions)
    personnel = personnel_base
    other = inputs.plAssumptions.otherOperatingCharges
    dist_pct = inputs.plAssumptions.distributionExpensePct
    mkt_pct = inputs.plAssumptions.marketingExpensePct

    net_profit = []
    operating_cf = []
    bfr_levels = []
    cumulative = []
    distribution_exp = []
    marketing_exp = []
    cum = -equity

    wc = inputs.workingCapital
    net_fixed_assets = total_inv

    for y in range(HORIZON):
        if y > 0 and personnel_cost_growth:
            personnel = personnel_base * ((1.0 + personnel_cost_growth) ** y)
        rev = revenue_ht[y]
        raw_c = raw_consumption[y]
        pack_c = packaging_consumption[y]
        cons = consumption[y]
        vat_payable = max(0.0, vat_net[y])
        dist_cost = rev * dist_pct
        mkt_cost = rev * mkt_pct
        distribution_exp.append(dist_cost)
        marketing_exp.append(mkt_cost)
        ebitda = (
            rev
            - cons
            - personnel
            - other
            - dist_cost
            - mkt_cost
            - vat_payable
        )
        dep_y = dep[y]
        ebit = ebitda - dep_y
        fin = interest[y]
        taxable = ebit - fin
        tax = max(0.0, taxable * inputs.plAssumptions.corporateTaxRate)
        net = taxable - tax
        net_profit.append(net)

        bfr = compute_bfr(
            rev,
            raw_c,
            pack_c,
            wc.clientPaymentDays,
            wc.supplierPaymentDays,
            wc.finishedGoodsStockDays,
            wc.rawMaterialStockDays,
            wc.packagingStockDays,
        )
        bfr_levels.append(bfr)

        bfr_var = bfr_variation_series(bfr_levels)[y]
        ocf = net + dep_y - bfr_var
        operating_cf.append(ocf)

        treasury_delta = ocf - principal_rep[y]
        cum += treasury_delta
        cumulative.append(cum)

        net_fixed_assets = max(0.0, net_fixed_assets - dep_y)

    bfr_var_series = bfr_variation_series(bfr_levels)
    cash_break = next((y + 1 for y, c in enumerate(cumulative) if c < 0), None)

    cf_vector = [-total_inv]
    for y in range(HORIZON):
        cf_vector.append(operating_cf[y] - principal_rep[y])

    van = npv(discount_rate, cf_vector)
    tri = irr(cf_vector)
    drci = payback_period_years(total_inv, operating_cf, cumulative)

    final_bfr = bfr_levels[-1] if bfr_levels else 0.0
    total_assets = net_fixed_assets + final_bfr
    bs_ok = check_balance_sheet(
        total_assets, equity, end_balance[-1] if end_balance else debt, final_bfr
    )
    bfr_ok = check_bfr_coherent(bfr_levels, revenue_ht)

    return PlanResults(
        revenue=YearlySeries(years=revenue_ht),
        netProfit=YearlySeries(years=net_profit),
        operatingCashFlow=YearlySeries(years=operating_cf),
        cumulativeTreasury=YearlySeries(years=cumulative),
        bfr=YearlySeries(years=bfr_levels),
        bfrVariation=YearlySeries(years=bfr_var_series),
        depreciation=YearlySeries(years=dep),
        distributionExpense=YearlySeries(years=distribution_exp),
        marketingExpense=YearlySeries(years=marketing_exp),
        principalRepayment=YearlySeries(years=principal_rep),
        interestExpense=YearlySeries(years=interest),
        totalInvestment=total_inv,
        indicators=ProfitabilityIndicators(
            van=van,
            tri=tri,
            drciYears=drci,
            discountRate=discount_rate,
        ),
        cashRunwayBreakYear=cash_break,
        balanceSheetBalanced=bs_ok,
        bfrCoherent=bfr_ok,
    )


def compare_results(baseline: PlanResults, scenario: PlanResults) -> dict:
    return {
        "deltaVan": scenario.indicators.van - baseline.indicators.van,
        "deltaTri": (
            (scenario.indicators.tri or 0) - (baseline.indicators.tri or 0)
            if scenario.indicators.tri and baseline.indicators.tri
            else None
        ),
        "baselineCashBreakYear": baseline.cashRunwayBreakYear,
        "scenarioCashBreakYear": scenario.cashRunwayBreakYear,
        "baselineVan": baseline.indicators.van,
        "scenarioVan": scenario.indicators.van,
    }
