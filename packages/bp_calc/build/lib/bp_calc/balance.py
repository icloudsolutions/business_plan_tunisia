"""Simplified balance sheet coherence check."""


def check_balance_sheet(
    total_assets: float,
    equity: float,
    debt: float,
    bfr: float,
    tolerance: float = 1.0,
) -> bool:
    """
    Assets ≈ equity + debt + BFR financing need (simplified Tunisian SME model).
    """
    liabilities_side = equity + debt + max(0.0, bfr)
    if total_assets <= 0:
        return liabilities_side <= tolerance
    rel = abs(total_assets - liabilities_side) / total_assets
    return rel <= 0.05 or abs(total_assets - liabilities_side) <= tolerance * 1000


def check_bfr_coherent(bfr_levels: list[float], revenue_levels: list[float]) -> bool:
    if not bfr_levels:
        return False
    if any(b < 0 for b in bfr_levels):
        return False
    for b, r in zip(bfr_levels, revenue_levels):
        if r > 0 and b > r * 2:
            return False
    return True
