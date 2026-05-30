"""
Liasse Unique-compliant production and inventory quantity chain.

Formulas (from Hypothèse sheet — Tunisian standard):
  Production = ventes + stock final PF
  consommation = (1 + waste_rate) × production
  Achat = (consommation − SI) × 13/12
  Stock final MP = Achat − consommation
  Stock final PF = ventes × jours stock PF / jours vente
"""

from __future__ import annotations

PRODUCTION_SELLING_RATIO = 320.0 / 310.0
PURCHASE_MULTIPLIER = 13.0 / 12.0
HORIZON = 7

__all__ = [
    "PRODUCTION_SELLING_RATIO",
    "PURCHASE_MULTIPLIER",
    "HORIZON",
    "compute_qty_produced",
    "compute_qty_consumed",
    "compute_purchases_and_stock_mp",
    "compute_purchase_values",
    "compute_stock_values",
    "inventory_chain",
]


def compute_qty_produced(
    qty_sold: list[float],
    stock_days_pf: float,
    selling_days: float,
) -> tuple[list[float], list[float]]:
    """Returns (qty_produced, closing_stock_PF) per year."""
    closing_pf: list[float] = []
    qty_produced: list[float] = []
    denom = selling_days if selling_days > 0 else 310.0
    for y in range(len(qty_sold)):
        c_pf = qty_sold[y] * stock_days_pf / denom
        closing_pf.append(c_pf)
        qty_produced.append(qty_sold[y] + c_pf)
    return qty_produced, closing_pf


def compute_qty_consumed(
    qty_produced: list[float],
    waste_rate: float = 0.01,
) -> list[float]:
    return [qp * (1.0 + waste_rate) for qp in qty_produced]


def compute_purchases_and_stock_mp(
    qty_consumed: list[float],
    opening_stock_mp_y0: float = 0.0,
) -> tuple[list[float], list[float], list[float]]:
    opening: list[float] = [opening_stock_mp_y0]
    purchased: list[float] = []
    closing: list[float] = []

    for y in range(len(qty_consumed)):
        si = opening[y]
        qp = max(0.0, (qty_consumed[y] - si) * PURCHASE_MULTIPLIER)
        cf = qp - qty_consumed[y]
        purchased.append(qp)
        closing.append(cf)
        if y + 1 < len(qty_consumed):
            opening.append(cf)

    return purchased, closing, opening


def compute_purchase_values(
    qty_purchased: list[float],
    mp_price_y1: float,
    inflation_rate: float = 0.0,
) -> list[float]:
    values: list[float] = []
    for y, qty in enumerate(qty_purchased):
        price = mp_price_y1 * ((1.0 + inflation_rate) ** y)
        values.append(qty * price)
    return values


def compute_stock_values(
    closing_stock_mp: list[float],
    closing_stock_pf: list[float],
    mp_price_y1: float,
    pf_value_per_unit: float,
    mp_price_inflation: float = 0.0,
) -> tuple[list[float], list[float]]:
    """Monetary stock values from physical closing stocks."""
    mp_vals: list[float] = []
    pf_vals: list[float] = []
    for y in range(len(closing_stock_mp)):
        mp_p = mp_price_y1 * ((1.0 + mp_price_inflation) ** y)
        mp_vals.append(closing_stock_mp[y] * mp_p)
        pf_vals.append(closing_stock_pf[y] * pf_value_per_unit)
    return mp_vals, pf_vals


def inventory_chain(
    qty_sold: list[float],
    stock_days_pf: float,
    selling_days: float,
    waste_rate: float,
    mp_price_y1: float,
    mp_price_inflation: float = 0.0,
    opening_stock_mp_y0: float = 0.0,
    pf_value_per_unit: float = 0.0,
) -> dict[str, list[float]]:
    qty_produced, closing_stock_pf = compute_qty_produced(
        qty_sold, stock_days_pf, selling_days
    )
    qty_consumed = compute_qty_consumed(qty_produced, waste_rate)
    qty_purchased, closing_stock_mp, opening_stock_mp = compute_purchases_and_stock_mp(
        qty_consumed, opening_stock_mp_y0
    )
    purchase_value_mp = compute_purchase_values(
        qty_purchased, mp_price_y1, mp_price_inflation
    )
    stock_value_mp, stock_value_pf = compute_stock_values(
        closing_stock_mp,
        closing_stock_pf,
        mp_price_y1,
        pf_value_per_unit,
        mp_price_inflation,
    )

    return {
        "qty_sold": list(qty_sold),
        "qty_produced": qty_produced,
        "closing_stock_pf": closing_stock_pf,
        "qty_consumed": qty_consumed,
        "qty_purchased": qty_purchased,
        "closing_stock_mp": closing_stock_mp,
        "opening_stock_mp": opening_stock_mp,
        "purchase_value_mp": purchase_value_mp,
        "stock_value_mp": stock_value_mp,
        "stock_value_pf": stock_value_pf,
    }
