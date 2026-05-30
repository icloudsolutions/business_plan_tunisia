from uuid import uuid4

import pytest

from bp_calc.pricing import build_pricing_projection, compute_pricing_row, margin_band
from bp_schema.pricing import PricingGridRow


def test_pricing_margins_and_competitiveness():
    pid = uuid4()
    row = PricingGridRow(
        product_id=pid,
        purchase_price_per_kg=2.0,
        sell_price_per_unit=5.0,
        market_retail_price=7.0,
        unit_weight_g=500.0,
        ristourne_pct=0.1,
    )
    c = compute_pricing_row(row, product_name="Test")
    assert c.price_to_reseller == 5.0
    assert c.sell_price_per_kg == 10.0
    assert c.gross_margin_per_kg == 8.0
    assert c.gross_margin_vs_market == 2.0
    assert c.competitiveness_ratio == pytest.approx(5 / 7, rel=1e-2)
    assert c.is_competitive is True
    assert margin_band(c.gross_margin_pct) == "green"


def test_build_projection_chart():
    pid = uuid4()
    proj = build_pricing_projection(
        [
            PricingGridRow(
                product_id=pid,
                purchase_price_per_kg=1.0,
                sell_price_per_unit=4.0,
                market_retail_price=6.0,
                unit_weight_g=1000.0,
            )
        ],
        names_by_product={str(pid): ("A", "kg")},
    )
    assert len(proj.rows) == 1
    bar = proj.chart_bars[0]
    assert bar.cost == 1.0
    assert bar.producer_margin == 3.0
    assert bar.reseller_margin == 2.0
    assert bar.shelf_price == 6.0
