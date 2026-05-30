from bp_calc.loan import build_amortization_schedule, project_loan_schedule
from bp_schema.loan_plan import PlanLoan


def test_grace_interest_only():
    periods = build_amortization_schedule(
        420_000,
        0.083,
        7,
        grace_months=12,
        frequency="quarterly",
    )
    assert len(periods) == 28
    assert periods[0].in_grace
    assert periods[0].principal == 0
    assert periods[0].interest > 0
    assert periods[4].principal > 0


def test_annual_aggregate():
    loan = PlanLoan(amount=100_000, rate=0.1, term_years=2, grace_months=0, frequency="annual")
    proj = project_loan_schedule(loan)
    assert len(proj.annual) == 7
    assert proj.annual[0].debt_service > 0
    assert proj.annual[0].ending_balance < 100_000
