"""Formula-driven operating expenses (Autres charges) over 7 years."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from bp_schema.other_charges import (
    CATEGORY_LABELS,
    HORIZON,
    OtherChargeCategory,
    OtherChargeRuleType,
    OtherChargesConfig,
    OtherChargesProjection,
    OtherChargesYearSummary,
    CategoryYearAmount,
)

__all__ = [
    "ExpenseDrivers",
    "amount_for_category_year",
    "calculate_other_charges_projection",
]


@dataclass
class ExpenseDrivers:
    """Inputs from revenue, investment, payroll modules."""

    revenue_by_year: list[float]
    investment_total: float
    payroll_by_year: list[float]
    lf2012_exemption_5y: bool = True


def _pad_series(values: list[float], length: int = HORIZON) -> list[float]:
    out = list(values[:length])
    while len(out) < length:
        out.append(out[-1] if out else 0.0)
    return out


def amount_for_category_year(
    config: OtherChargesConfig,
    year: int,
    drivers: ExpenseDrivers,
) -> float:
    """Compute one category for year 1..7."""
    if not config.enabled:
        return 0.0

    cat = config.category
    if isinstance(cat, str):
        cat_key = cat
    else:
        cat_key = cat.value

    if drivers.lf2012_exemption_5y and cat_key in (
        OtherChargeCategory.tfp.value,
        OtherChargeCategory.foprolo.value,
    ):
        if year <= 5:
            return 0.0

    rev = _pad_series(drivers.revenue_by_year)
    payroll = _pad_series(drivers.payroll_by_year)
    yi = year - 1
    revenue_y = rev[yi] if yi < len(rev) else 0.0
    payroll_y = payroll[yi] if yi < len(payroll) else 0.0
    infl = config.inflation_rate
    mult = (1.0 + infl) ** (year - 1) if infl else 1.0

    rule = config.rule_type
    if isinstance(rule, str):
        rule_key = rule
    else:
        rule_key = rule.value

    if rule_key == OtherChargeRuleType.pct_revenue.value:
        return revenue_y * config.rate_or_pct * mult

    if rule_key == OtherChargeRuleType.pct_investment.value:
        return drivers.investment_total * config.rate_or_pct

    if rule_key == OtherChargeRuleType.pct_payroll.value:
        return payroll_y * config.rate_or_pct

    if rule_key == OtherChargeRuleType.fixed_inflation.value:
        return config.base_value * mult

    return 0.0


def calculate_other_charges_projection(
    configs: list[OtherChargesConfig],
    drivers: ExpenseDrivers,
    *,
    plan_id: UUID | None = None,
) -> OtherChargesProjection:
    configs_sorted = sorted(configs, key=lambda c: c.sort_order)
    by_category_year: list[CategoryYearAmount] = []
    by_year: list[OtherChargesYearSummary] = []

    for year in range(1, HORIZON + 1):
        cat_totals: dict[str, float] = {}
        for cfg in configs_sorted:
            cat_key = cfg.category.value if isinstance(cfg.category, OtherChargeCategory) else str(cfg.category)
            amt = amount_for_category_year(cfg, year, drivers)
            cat_totals[cat_key] = amt
            by_category_year.append(
                CategoryYearAmount(
                    category=cat_key,
                    label=CATEGORY_LABELS.get(cat_key, cat_key),
                    year=year,
                    amount=amt,
                    rule_type=cfg.rule_type.value
                    if isinstance(cfg.rule_type, OtherChargeRuleType)
                    else str(cfg.rule_type),
                )
            )
        by_year.append(
            OtherChargesYearSummary(
                year=year,
                total=sum(cat_totals.values()),
                by_category=cat_totals,
            )
        )

    return OtherChargesProjection(
        plan_id=plan_id,
        lf2012_exemption_5y=drivers.lf2012_exemption_5y,
        investment_total=drivers.investment_total,
        revenue_series=_pad_series(drivers.revenue_by_year),
        payroll_series=_pad_series(drivers.payroll_by_year),
        by_year=by_year,
        by_category_year=by_category_year,
        total_series=[s.total for s in by_year],
    )
