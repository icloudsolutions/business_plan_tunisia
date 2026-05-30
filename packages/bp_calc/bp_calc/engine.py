"""7-year financial projection engine (VIPA-aligned)."""

from typing import Any

from bp_schema.liasse import PlanInputs, PlanResults, ProfitabilityIndicators, YearlySeries

from bp_calc.balance import check_balance_sheet, check_bfr_coherent
from bp_calc.bfr import bfr_variation_series, compute_bfr
from bp_calc.indicators import irr, npv, payback_period_years
from bp_calc.loan import build_loan_schedule
from bp_calc.patch import apply_patch
from bp_calc.tva import vat_on_amount, weighted_vat_rate

HORIZON = 7
DISCOUNT_RATE = 0.10

__all__ = ["apply_patch", "calculate_plan", "compare_results", "HORIZON"]


def _capacity_units(ops) -> float:
    ppm = ops.packagesPerMinute if ops.packagesPerMinute else ops.capacityPerMinute
    minutes_per_day = ops.hoursPerDay * 60
    gross = ppm * minutes_per_day * ops.workingDaysPerYear
    waste = ops.wasteRate.value
    return gross * (1.0 - waste)


def _total_investment(inputs: PlanInputs) -> float:
    intangible = sum(i.amount for i in inputs.investments.intangible)
    tangible = sum(i.amount for i in inputs.investments.tangible)
    return intangible + tangible


def _annual_depreciation(inputs: PlanInputs) -> list[float]:
    dep = [0.0] * HORIZON
    for line in list(inputs.investments.intangible) + list(inputs.investments.tangible):
        life = max(1, line.usefulLifeYears)
        annual = line.amount / life
        for y in range(min(life, HORIZON)):
            dep[y] += annual
    return dep


def _personnel_cost(pl) -> float:
    return sum(p.headcount * p.annualSalary for p in pl.personnel)


def calculate_plan(inputs: PlanInputs, discount_rate: float = DISCOUNT_RATE) -> PlanResults:
    total_inv = _total_investment(inputs)
    equity = total_inv * inputs.financing.equityRatio
    debt = total_inv * inputs.financing.debtRatio
    loan_amount = inputs.financing.loan.amount or debt
    vat_rate = weighted_vat_rate(inputs.company.taxRegime.tvaRates)

    dep = _annual_depreciation(inputs)
    interest, principal_rep, end_balance = build_loan_schedule(
        loan_amount,
        inputs.financing.loan.rate,
        inputs.financing.loan.years,
        inputs.financing.loan.graceMonthsPrincipal,
    )
    interest = (interest + [0.0] * HORIZON)[:HORIZON]
    principal_rep = (principal_rep + [0.0] * HORIZON)[:HORIZON]

    units = _capacity_units(inputs.operations)
    gross_revenue = [units * inputs.operations.salePrice] * HORIZON
    for y in range(1, HORIZON):
        gross_revenue[y] = gross_revenue[y - 1] * 1.03

    discount_pct = inputs.plAssumptions.commercialDiscount
    revenue_ht = [g * (1.0 - discount_pct) for g in gross_revenue]
    vat_collected = [vat_on_amount(r, vat_rate) for r in revenue_ht]

    material_unit = inputs.operations.rawMaterialCost
    packaging_unit = inputs.operations.packagingCost
    consumption = [units * (material_unit + packaging_unit) * (1.03**y) for y in range(HORIZON)]
    vat_deductible = [vat_on_amount(c, vat_rate) for c in consumption]
    vat_net = [vat_collected[y] - vat_deductible[y] for y in range(HORIZON)]

    personnel = _personnel_cost(inputs.plAssumptions)
    other = inputs.plAssumptions.otherOperatingCharges

    net_profit = []
    operating_cf = []
    bfr_levels = []
    cumulative = []
    cum = -equity

    wc = inputs.workingCapital
    net_fixed_assets = total_inv

    for y in range(HORIZON):
        rev = revenue_ht[y]
        cons = consumption[y]
        vat_payable = max(0.0, vat_net[y])
        ebitda = rev - cons - personnel - other - vat_payable
        dep_y = dep[y]
        ebit = ebitda - dep_y
        fin = interest[y]
        taxable = ebit - fin
        tax = max(0.0, taxable * inputs.plAssumptions.corporateTaxRate)
        net = taxable - tax
        net_profit.append(net)

        purchases = cons
        bfr = compute_bfr(
            rev,
            purchases,
            wc.clientPaymentDays,
            wc.supplierPaymentDays,
            wc.finishedGoodsStockDays,
            wc.rawMaterialStockDays,
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
    bs_ok = check_balance_sheet(total_assets, equity, end_balance[-1] if end_balance else debt, final_bfr)
    bfr_ok = check_bfr_coherent(bfr_levels, revenue_ht)

    return PlanResults(
        revenue=YearlySeries(years=revenue_ht),
        netProfit=YearlySeries(years=net_profit),
        operatingCashFlow=YearlySeries(years=operating_cf),
        cumulativeTreasury=YearlySeries(years=cumulative),
        bfr=YearlySeries(years=bfr_levels),
        bfrVariation=YearlySeries(years=bfr_var_series),
        depreciation=YearlySeries(years=dep),
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
