"""Loan amortization table (Emprunt sheet logic)."""


def build_loan_schedule(
    principal: float,
    annual_rate: float,
    years: int,
    grace_months_principal: int = 0,
) -> tuple[list[float], list[float], list[float]]:
    """
    Returns per-year: interest, principal repayment, remaining balance (end of year).
    Quarterly interest accrual simplified to annual equivalent.
    """
    n = years
    interest_by_year = [0.0] * n
    principal_by_year = [0.0] * n
    balance_by_year = [0.0] * n

    if principal <= 0:
        return interest_by_year, principal_by_year, balance_by_year

    grace_years = grace_months_principal / 12.0
    balance = principal
    repay_years = max(1, n - int(grace_years))

    # Level principal after grace
    annual_principal_payment = principal / repay_years if repay_years else principal

    for y in range(n):
        interest = balance * annual_rate
        interest_by_year[y] = interest

        in_grace = y < int(grace_years)
        if in_grace:
            principal_pay = 0.0
        else:
            principal_pay = min(annual_principal_payment, balance)

        principal_by_year[y] = principal_pay
        balance = max(0.0, balance - principal_pay)
        balance_by_year[y] = balance

    return interest_by_year, principal_by_year, balance_by_year
