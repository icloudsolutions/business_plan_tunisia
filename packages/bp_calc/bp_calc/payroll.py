"""Payroll planning engine (7-year headcount + CNSS + imputable split)."""

from __future__ import annotations

from uuid import UUID

from bp_schema.payroll import (
    HORIZON,
    HeadcountEntry,
    PayrollAssumptions,
    PayrollProjection,
    PayrollYearSummary,
    StaffRole,
    StaffRoleYearPayroll,
)

__all__ = [
    "monthly_salary_for_year",
    "effective_raise_rate",
    "build_headcount_matrix",
    "calculate_payroll_projection",
    "imputable_payroll_for_year",
    "non_imputable_payroll_for_year",
]


def effective_raise_rate(role: StaffRole, assumptions: PayrollAssumptions) -> float:
    if role.annual_raise_rate_override is not None:
        return role.annual_raise_rate_override
    return assumptions.annual_raise_rate


def monthly_salary_for_year(base_monthly: float, raise_rate: float, year: int) -> float:
    """year 1 = base; year n = base * (1 + raise)^(n-1)."""
    if year <= 1:
        return base_monthly
    return base_monthly * ((1.0 + raise_rate) ** (year - 1))


def build_headcount_matrix(
    roles: list[StaffRole],
    entries: list[HeadcountEntry],
) -> dict[str, list[int]]:
    """Return headcount per role for Y1..Y7; forward-fill from Y1 if year missing."""
    by_role: dict[str, dict[int, int]] = {}
    for e in entries:
        rid = str(e.staff_role_id)
        by_role.setdefault(rid, {})[e.year] = e.headcount

    out: dict[str, list[int]] = {}
    for role in roles:
        rid = str(role.id)
        year_map = by_role.get(rid, {})
        y1 = year_map.get(1, 0)
        counts: list[int] = []
        last = y1
        for y in range(1, HORIZON + 1):
            if y in year_map:
                last = year_map[y]
            counts.append(last)
        out[rid] = counts
    return out


def calculate_payroll_projection(
    roles: list[StaffRole],
    headcount_matrix: dict[str, list[int]],
    assumptions: PayrollAssumptions,
    *,
    plan_id: UUID | None = None,
) -> PayrollProjection:
    by_role_year: list[StaffRoleYearPayroll] = []
    year_summaries: list[PayrollYearSummary] = []

    for yi in range(HORIZON):
        year = yi + 1
        total_hc = 0
        gross = 0.0
        cnss = 0.0
        imputable = 0.0
        non_imputable = 0.0

        for role in roles:
            rid = str(role.id)
            hc_list = headcount_matrix.get(rid, [0] * HORIZON)
            hc = hc_list[yi] if yi < len(hc_list) else 0
            raise_r = effective_raise_rate(role, assumptions)
            monthly = monthly_salary_for_year(role.base_monthly_salary, raise_r, year)
            annual_gross = monthly * 12.0 * hc
            cnss_cost = annual_gross * assumptions.cnss_employer_rate
            total = annual_gross + cnss_cost

            by_role_year.append(
                StaffRoleYearPayroll(
                    staff_role_id=rid,
                    function_name=role.function_name,
                    qualification=role.qualification,
                    is_production_imputable=role.is_production_imputable,
                    year=year,
                    headcount=hc,
                    monthly_salary=monthly,
                    annual_gross=annual_gross,
                    cnss=cnss_cost,
                    total_cost=total,
                    raise_rate_applied=raise_r,
                )
            )
            total_hc += hc
            gross += annual_gross
            cnss += cnss_cost
            if role.is_production_imputable:
                imputable += total
            else:
                non_imputable += total

        year_summaries.append(
            PayrollYearSummary(
                year=year,
                total_headcount=total_hc,
                annual_gross=gross,
                cnss=cnss,
                total_payroll=gross + cnss,
                imputable_cost=imputable,
                non_imputable_cost=non_imputable,
            )
        )

    return PayrollProjection(
        plan_id=plan_id,
        assumptions=assumptions,
        by_year=year_summaries,
        by_role_year=by_role_year,
        headcount_series=[s.total_headcount for s in year_summaries],
        total_payroll_series=[s.total_payroll for s in year_summaries],
        cnss_series=[s.cnss for s in year_summaries],
        imputable_series=[s.imputable_cost for s in year_summaries],
        non_imputable_series=[s.non_imputable_cost for s in year_summaries],
    )


def imputable_payroll_for_year(projection: PayrollProjection, year: int) -> float:
    for s in projection.by_year:
        if s.year == year:
            return s.imputable_cost
    return 0.0


def non_imputable_payroll_for_year(projection: PayrollProjection, year: int) -> float:
    for s in projection.by_year:
        if s.year == year:
            return s.non_imputable_cost
    return 0.0
