from bp_calc.other_charges import ExpenseDrivers, amount_for_category_year, calculate_other_charges_projection
from bp_schema.other_charges import (
    OtherChargeCategory,
    OtherChargeRuleType,
    OtherChargesConfig,
)


def test_pct_investment_maintenance():
    cfg = OtherChargesConfig(
        category=OtherChargeCategory.maintenance,
        rule_type=OtherChargeRuleType.pct_investment,
        rate_or_pct=0.04,
    )
    drivers = ExpenseDrivers(
        revenue_by_year=[1_000_000] * 7,
        investment_total=500_000,
        payroll_by_year=[100_000] * 7,
    )
    assert amount_for_category_year(cfg, 1, drivers) == 20_000
    assert amount_for_category_year(cfg, 7, drivers) == 20_000


def test_tfp_exemption_lf2012():
    cfg = OtherChargesConfig(
        category=OtherChargeCategory.tfp,
        rule_type=OtherChargeRuleType.pct_payroll,
        rate_or_pct=0.01,
    )
    drivers = ExpenseDrivers(
        revenue_by_year=[0] * 7,
        investment_total=0,
        payroll_by_year=[200_000] * 7,
        lf2012_exemption_5y=True,
    )
    assert amount_for_category_year(cfg, 5, drivers) == 0
    assert amount_for_category_year(cfg, 6, drivers) == 2_000


def test_fixed_inflation_rent():
    cfg = OtherChargesConfig(
        category=OtherChargeCategory.rent,
        rule_type=OtherChargeRuleType.fixed_inflation,
        base_value=12_000,
        inflation_rate=0.05,
    )
    drivers = ExpenseDrivers(revenue_by_year=[], investment_total=0, payroll_by_year=[])
    assert amount_for_category_year(cfg, 1, drivers) == 12_000
    assert abs(amount_for_category_year(cfg, 2, drivers) - 12_600) < 0.01


def test_projection_totals():
    configs = [
        OtherChargesConfig(
            category=OtherChargeCategory.management,
            rule_type=OtherChargeRuleType.pct_revenue,
            rate_or_pct=0.01,
            sort_order=0,
        ),
        OtherChargesConfig(
            category=OtherChargeCategory.rent,
            rule_type=OtherChargeRuleType.fixed_inflation,
            base_value=10_000,
            inflation_rate=0,
            sort_order=1,
        ),
    ]
    drivers = ExpenseDrivers(
        revenue_by_year=[100_000],
        investment_total=0,
        payroll_by_year=[0],
    )
    proj = calculate_other_charges_projection(configs, drivers)
    assert proj.by_year[0].total == 11_000
    assert proj.total_series[0] == 11_000
