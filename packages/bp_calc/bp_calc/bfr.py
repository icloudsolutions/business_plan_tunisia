"""Working capital requirement (BFR) from payment delays."""


def compute_bfr(
    revenue: float,
    purchases: float,
    client_days: int,
    supplier_days: int,
    finished_stock_days: int,
    raw_stock_days: int,
) -> float:
    receivables = revenue * client_days / 365.0
    payables = purchases * supplier_days / 365.0
    finished_stock = revenue * finished_stock_days / 365.0
    raw_stock = purchases * raw_stock_days / 365.0
    return receivables + finished_stock + raw_stock - payables


def bfr_variation_series(bfr_levels: list[float]) -> list[float]:
    if not bfr_levels:
        return []
    variations = [0.0]
    for i in range(1, len(bfr_levels)):
        variations.append(bfr_levels[i] - bfr_levels[i - 1])
    return variations
