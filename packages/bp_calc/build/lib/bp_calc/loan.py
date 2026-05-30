"""Loan amortization (quarterly/annual, grace period, equal principal)."""

from __future__ import annotations

import calendar
from datetime import date
from typing import Literal

from bp_schema.loan_plan import (
    HORIZON,
    AmortizationPeriod,
    CombinedLoanProjection,
    LoanAnnualSummary,
    LoanFrequency,
    LoanScheduleProjection,
    PlanLoan,
)

__all__ = [
    "periods_per_year",
    "build_amortization_schedule",
    "project_loan_schedule",
    "aggregate_loan_projections",
    "build_loan_schedule",
    "annual_from_loans",
]


def periods_per_year(frequency: str | LoanFrequency) -> int:
    key = frequency.value if isinstance(frequency, LoanFrequency) else frequency
    return 4 if key == LoanFrequency.quarterly.value else 1


def _grace_periods(grace_months: int, frequency: str) -> int:
    ppy = periods_per_year(frequency)
    if ppy == 4:
        return max(0, grace_months // 3)
    return max(0, grace_months // 12)


def _add_months(d: date, months: int) -> date:
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(d.day, last_day))


def _period_date(start: date | None, period_index: int, frequency: str) -> str:
    base = start or date.today().replace(month=1, day=1)
    months_step = 3 if periods_per_year(frequency) == 4 else 12
    d = _add_months(base, months_step * (period_index - 1))
    return d.isoformat()


def _plan_year_for_period(period_index: int, frequency: str) -> int:
    """Map period to business-plan year 1..7."""
    ppy = periods_per_year(frequency)
    return min(HORIZON, max(1, (period_index - 1) // ppy + 1))


def build_amortization_schedule(
    amount: float,
    annual_rate: float,
    term_years: int,
    grace_months: int = 0,
    *,
    frequency: str | LoanFrequency = LoanFrequency.quarterly,
    start_date: date | None = None,
) -> list[AmortizationPeriod]:
    if amount <= 0:
        return []

    freq = frequency.value if isinstance(frequency, LoanFrequency) else frequency
    ppy = periods_per_year(freq)
    total_periods = term_years * ppy
    grace_p = min(_grace_periods(grace_months, freq), total_periods)
    repay_periods = max(1, total_periods - grace_p)
    principal_per_period = amount / repay_periods
    rate_per_period = annual_rate / ppy

    balance = amount
    rows: list[AmortizationPeriod] = []

    for p in range(1, total_periods + 1):
        opening = balance
        in_grace = p <= grace_p
        interest = opening * rate_per_period
        if in_grace:
            principal = 0.0
        else:
            principal = min(principal_per_period, balance)
        payment = interest + principal
        balance = max(0.0, balance - principal)
        rows.append(
            AmortizationPeriod(
                period=p,
                date=_period_date(start_date, p, freq),
                opening_balance=round(opening, 2),
                payment=round(payment, 2),
                principal=round(principal, 2),
                interest=round(interest, 2),
                closing_balance=round(balance, 2),
                in_grace=in_grace,
            )
        )
        if balance <= 0.01:
            break

    return rows


def _annual_from_periods(
    periods: list[AmortizationPeriod], frequency: str
) -> list[LoanAnnualSummary]:
    buckets: dict[int, dict[str, float]] = {
        y: {"interest": 0.0, "principal": 0.0, "ending": 0.0} for y in range(1, HORIZON + 1)
    }
    for row in periods:
        y = _plan_year_for_period(row.period, frequency)
        buckets[y]["interest"] += row.interest
        buckets[y]["principal"] += row.principal
        buckets[y]["ending"] = row.closing_balance

    out: list[LoanAnnualSummary] = []
    for y in range(1, HORIZON + 1):
        b = buckets[y]
        interest = b["interest"]
        principal = b["principal"]
        out.append(
            LoanAnnualSummary(
                year=y,
                interest=round(interest, 2),
                principal=round(principal, 2),
                debt_service=round(interest + principal, 2),
                ending_balance=round(b["ending"], 2),
            )
        )
    return out


def project_loan_schedule(loan: PlanLoan) -> LoanScheduleProjection:
    freq = loan.frequency.value if isinstance(loan.frequency, LoanFrequency) else str(loan.frequency)
    periods = build_amortization_schedule(
        loan.amount,
        loan.rate,
        loan.term_years,
        loan.grace_months,
        frequency=freq,
        start_date=loan.start_date,
    )
    annual = _annual_from_periods(periods, freq)
    return LoanScheduleProjection(
        loan_id=str(loan.id) if loan.id else None,
        lender_name=loan.lender_name,
        amount=loan.amount,
        rate=loan.rate,
        term_years=loan.term_years,
        grace_months=loan.grace_months,
        frequency=freq,
        periods=periods,
        annual=annual,
    )


def aggregate_loan_projections(
    loans: list[PlanLoan],
    *,
    plan_id=None,
) -> CombinedLoanProjection:
    projections = [project_loan_schedule(loan) for loan in loans if loan.amount > 0]
    interest = [0.0] * HORIZON
    principal = [0.0] * HORIZON
    debt_service = [0.0] * HORIZON
    ending = [0.0] * HORIZON

    for proj in projections:
        for a in proj.annual:
            yi = a.year - 1
            if 0 <= yi < HORIZON:
                interest[yi] += a.interest
                principal[yi] += a.principal
                debt_service[yi] += a.debt_service
                ending[yi] += a.ending_balance

    return CombinedLoanProjection(
        plan_id=plan_id,
        loans=projections,
        annual_interest=interest,
        annual_principal=principal,
        annual_debt_service=debt_service,
        annual_ending_balance=ending,
    )


def annual_from_loans(loans: list[PlanLoan]) -> tuple[list[float], list[float], list[float]]:
    """Per-year interest, principal, ending balance (summed tranches)."""
    combined = aggregate_loan_projections(loans)
    return (
        combined.annual_interest,
        combined.annual_principal,
        combined.annual_ending_balance,
    )


def build_loan_schedule(
    principal: float,
    annual_rate: float,
    years: int,
    grace_months_principal: int = 0,
    *,
    frequency: Literal["quarterly", "annual"] = "quarterly",
) -> tuple[list[float], list[float], list[float]]:
    """Legacy annual API used by engine — aggregates quarterly schedule to plan years."""
    loan = PlanLoan(
        amount=principal,
        rate=annual_rate,
        term_years=years,
        grace_months=grace_months_principal,
        frequency=LoanFrequency(frequency),
    )
    interest, principal_rep, ending = annual_from_loans([loan])
    return interest, principal_rep, ending
