"""Working capital requirement (BFR) — detailed components + TTC."""

from __future__ import annotations

from dataclasses import dataclass

__all__ = [
    "BfrDetail",
    "compute_bfr",
    "compute_bfr_detail",
    "compute_bfr_compact",
    "bfr_variation_series",
    "bfr_levels_with_year_zero",
]


@dataclass
class BfrDetail:
    revenue_ht: float
    revenue_ttc: float
    client_receivables: float
    stocks: float
    raw_stock: float
    packaging_stock: float
    finished_stock: float
    arome_stock: float
    supplier_payables: float
    total: float

    @property
    def stocks_total(self) -> float:
        return self.stocks


def compute_bfr_detail(
    revenue_ht: float,
    revenue_ttc: float,
    raw_material_purchases: float,
    packaging_purchases: float,
    *,
    client_days: int,
    supplier_days: int,
    finished_goods_stock_days: int,
    raw_material_stock_days: int,
    packaging_stock_days: int,
    arome_share_of_raw: float = 0.05,
) -> BfrDetail:
    """BFR = créances clients + stocks − dettes fournisseurs (CA TTC for receivables)."""
    receivables = revenue_ttc * client_days / 365.0
    payables = (raw_material_purchases + packaging_purchases) * supplier_days / 365.0
    finished_stock = revenue_ht * finished_goods_stock_days / 365.0
    raw_stock = raw_material_purchases * raw_material_stock_days / 365.0
    packaging_stock = packaging_purchases * packaging_stock_days / 365.0
    arome_stock = raw_stock * arome_share_of_raw
    stocks = raw_stock + packaging_stock + finished_stock + arome_stock
    total = receivables + stocks - payables
    return BfrDetail(
        revenue_ht=revenue_ht,
        revenue_ttc=revenue_ttc,
        client_receivables=receivables,
        stocks=stocks,
        raw_stock=raw_stock,
        packaging_stock=packaging_stock,
        finished_stock=finished_stock,
        arome_stock=arome_stock,
        supplier_payables=payables,
        total=total,
    )


def compute_bfr_compact(revenue_ttc: float, bfr_days: float) -> float:
    """Excel compact: BFR ≈ (CA TTC / 360) × days (e.g. 33 days)."""
    return revenue_ttc * bfr_days / 360.0


def compute_bfr(
    revenue: float,
    raw_material_purchases: float,
    packaging_purchases: float,
    client_days: int,
    supplier_days: int,
    finished_goods_stock_days: int,
    raw_material_stock_days: int,
    packaging_stock_days: int,
    *,
    revenue_ttc: float | None = None,
    vat_rate: float = 0.0,
) -> float:
    ttc = revenue_ttc if revenue_ttc is not None else revenue * (1.0 + vat_rate)
    return compute_bfr_detail(
        revenue,
        ttc,
        raw_material_purchases,
        packaging_purchases,
        client_days=client_days,
        supplier_days=supplier_days,
        finished_goods_stock_days=finished_goods_stock_days,
        raw_material_stock_days=raw_material_stock_days,
        packaging_stock_days=packaging_stock_days,
    ).total


def bfr_variation_series(bfr_levels: list[float]) -> list[float]:
    if not bfr_levels:
        return []
    variations = [0.0]
    for i in range(1, len(bfr_levels)):
        variations.append(bfr_levels[i] - bfr_levels[i - 1])
    return variations


def bfr_levels_with_year_zero(operating_years: list[float]) -> list[float]:
    """Prepend BFR=0 at Y0 before Y1..Y7 operating levels."""
    return [0.0] + list(operating_years[:7])
