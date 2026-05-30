from uuid import uuid4

from bp_calc.payroll import build_headcount_matrix, calculate_payroll_projection, monthly_salary_for_year
from bp_schema.payroll import HeadcountEntry, PayrollAssumptions, StaffRole


def test_raise_compound():
    assert monthly_salary_for_year(1000, 0.06, 1) == 1000
    assert abs(monthly_salary_for_year(1000, 0.06, 3) - 1000 * 1.06**2) < 0.01


def test_imputable_split():
    rid = uuid4()
    roles = [
        StaffRole(
            id=rid,
            function_name="Opérateur",
            is_production_imputable=True,
            base_monthly_salary=1000,
        ),
        StaffRole(
            id=uuid4(),
            function_name="Admin",
            is_production_imputable=False,
            base_monthly_salary=2000,
        ),
    ]
    entries = [
        HeadcountEntry(staff_role_id=rid, year=1, headcount=2),
        HeadcountEntry(staff_role_id=roles[1].id, year=1, headcount=1),
    ]
    matrix = build_headcount_matrix(roles, entries)
    proj = calculate_payroll_projection(roles, matrix, PayrollAssumptions())
    y1 = proj.by_year[0]
    assert y1.imputable_cost > 0
    assert y1.non_imputable_cost > 0
    assert y1.total_payroll == y1.imputable_cost + y1.non_imputable_cost
