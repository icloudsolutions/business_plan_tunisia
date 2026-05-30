"""Working capital requirement (BFR) from payment delays and stock days."""


def compute_bfr(
    revenue: float,
    raw_material_purchases: float,
    packaging_purchases: float,
    client_days: int,
    supplier_days: int,
    finished_goods_stock_days: int,
    raw_material_stock_days: int,
    packaging_stock_days: int,
) -> float:
    total_purchases = raw_material_purchases + packaging_purchases
    receivables = revenue * client_days / 365.0
    payables = total_purchases * supplier_days / 365.0
    finished_stock = revenue * finished_goods_stock_days / 365.0
    raw_stock = raw_material_purchases * raw_material_stock_days / 365.0
    packaging_stock = packaging_purchases * packaging_stock_days / 365.0
    return receivables + finished_stock + raw_stock + packaging_stock - payables


def bfr_variation_series(bfr_levels: list[float]) -> list[float]:
    if not bfr_levels:
        return []
    variations = [0.0]
    for i in range(1, len(bfr_levels)):
        variations.append(bfr_levels[i] - bfr_levels[i - 1])
    return variations
