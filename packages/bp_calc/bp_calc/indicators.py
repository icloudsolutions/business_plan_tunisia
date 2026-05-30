"""NPV (VAN), IRR (TRI), payback (DRCI)."""

from typing import Sequence


def npv(rate: float, cashflows: Sequence[float]) -> float:
    """VAN: initial investment at t=0 (negative) + discounted flows."""
    if not cashflows:
        return 0.0
    return float(
        sum(cf / (1 + rate) ** t for t, cf in enumerate(cashflows))
    )


def irr(cashflows: Sequence[float], guess: float = 0.1) -> float | None:
    """TRI via Newton-Raphson with bisection fallback."""
    flows = list(cashflows)
    if len(flows) < 2:
        return None

    def npv_at(r: float) -> float:
        if r <= -1:
            return float("inf")
        return sum(cf / (1 + r) ** t for t, cf in enumerate(flows))

    rate = guess
    for _ in range(100):
        f = npv_at(rate)
        eps = 1e-7
        f1 = (npv_at(rate + eps) - f) / eps
        if abs(f1) < 1e-12:
            break
        new_rate = rate - f / f1
        if abs(new_rate - rate) < 1e-8:
            return new_rate
        rate = new_rate

    # Bisection between -0.99 and 5.0
    lo, hi = -0.5, 2.0
    if npv_at(lo) * npv_at(hi) > 0:
        return None
    for _ in range(200):
        mid = (lo + hi) / 2
        if npv_at(mid) * npv_at(lo) <= 0:
            hi = mid
        else:
            lo = mid
        if abs(hi - lo) < 1e-8:
            return (lo + hi) / 2
    return (lo + hi) / 2


def payback_period_years(
    initial_investment: float,
    annual_cashflows: Sequence[float],
    cumulative_treasury: Sequence[float] | None = None,
) -> float | None:
    """DRCI: year when cumulative cash recovers initial investment."""
    if initial_investment <= 0:
        return 0.0

    if cumulative_treasury:
        target = initial_investment
        cum = 0.0
        for i, cf in enumerate(cumulative_treasury):
            prev = cum
            cum += cf
            if cum >= target and (i == 0 or prev < target):
                if cf == 0:
                    return float(i)
                fraction = (target - prev) / cf if cf else 1.0
                return i + max(0.0, min(1.0, fraction))
        return None

    cum = -initial_investment
    for i, cf in enumerate(annual_cashflows):
        prev = cum
        cum += cf
        if cum >= 0 and prev < 0:
            if cf == 0:
                return float(i + 1)
            fraction = -prev / cf
            return i + fraction
    return None
