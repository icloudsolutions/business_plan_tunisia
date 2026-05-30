"""Pricing grid calculations and market competitiveness."""

from __future__ import annotations

from uuid import UUID

from bp_schema.pricing import PricingChartBar, PricingGridRow, PricingProjection, PricingRowComputed

__all__ = [
    "compute_pricing_row",
    "build_pricing_projection",
    "margin_band",
]

MARGIN_RED_MAX = 0.10
MARGIN_ORANGE_MAX = 0.25


def margin_band(margin_pct: float | None) -> str:
    if margin_pct is None:
        return "unknown"
    if margin_pct < MARGIN_RED_MAX:
        return "red"
    if margin_pct < MARGIN_ORANGE_MAX:
        return "orange"
    return "green"


def _kg_per_unit(unit_weight_g: float) -> float:
    return max(unit_weight_g, 1.0) / 1000.0


def compute_pricing_row(
    row: PricingGridRow,
    *,
    product_name: str = "",
    unit: str = "unit",
) -> PricingRowComputed:
    kg = _kg_per_unit(row.unit_weight_g)
    sell = row.sell_price_per_unit
    purchase_kg = row.purchase_price_per_kg
    market = row.market_retail_price

    price_per_kg_sell = (sell / kg) if kg > 0 and sell > 0 else row.sell_price_per_kg
    cost_unit = purchase_kg * kg
    gross_margin_per_kg = price_per_kg_sell - purchase_kg
    gross_margin_unit = sell - cost_unit
    gross_margin_pct = (gross_margin_unit / sell) if sell > 0 else None
    gross_margin_vs_market = market - sell if market > 0 else 0.0
    competitiveness_ratio = (sell / market) if market > 0 else None
    below_market_pct = None
    if market > 0 and sell > 0:
        below_market_pct = round((1.0 - competitiveness_ratio) * 100, 1)  # type: ignore[operator]
    is_competitive = competitiveness_ratio is None or competitiveness_ratio < 1.0

    return PricingRowComputed(
        product_id=row.product_id,
        product_name=product_name,
        unit=unit,
        purchase_price_per_kg=round(purchase_kg, 4),
        sell_price_per_unit=round(sell, 4),
        sell_price_per_kg=round(price_per_kg_sell, 4),
        market_retail_price=round(market, 4),
        ristourne_pct=row.ristourne_pct,
        unit_weight_g=row.unit_weight_g,
        price_to_reseller=round(sell, 4),
        gross_margin_per_kg=round(gross_margin_per_kg, 4),
        gross_margin_unit=round(gross_margin_unit, 4),
        gross_margin_pct=round(gross_margin_pct, 4) if gross_margin_pct is not None else None,
        gross_margin_vs_market=round(gross_margin_vs_market, 4),
        competitiveness_ratio=round(competitiveness_ratio, 4)
        if competitiveness_ratio is not None
        else None,
        below_market_pct=below_market_pct,
        margin_band=margin_band(gross_margin_pct),
        is_competitive=is_competitive,
    )


def build_pricing_projection(
    rows: list[PricingGridRow],
    *,
    plan_id: UUID | None = None,
    names_by_product: dict[str, tuple[str, str]] | None = None,
) -> PricingProjection:
    names = names_by_product or {}
    computed: list[PricingRowComputed] = []
    charts: list[PricingChartBar] = []

    for row in rows:
        pid = str(row.product_id) if row.product_id else ""
        name, unit = names.get(pid, ("", "unit"))
        c = compute_pricing_row(row, product_name=name, unit=unit)
        computed.append(c)
        kg = _kg_per_unit(row.unit_weight_g)
        cost = row.purchase_price_per_kg * kg
        charts.append(
            PricingChartBar(
                product_id=row.product_id,
                product_name=name,
                cost=round(cost, 2),
                producer_margin=round(max(0.0, c.gross_margin_unit), 2),
                reseller_margin=round(max(0.0, c.gross_margin_vs_market), 2),
                shelf_price=round(row.market_retail_price, 2),
            )
        )

    return PricingProjection(plan_id=plan_id, rows=computed, chart_bars=charts)
