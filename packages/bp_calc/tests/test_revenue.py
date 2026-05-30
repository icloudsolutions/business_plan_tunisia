from uuid import uuid4

from bp_calc.revenue import (
    annual_qty_from_monthly,
    calculate_revenue_projection,
    nominal_capacity_annual,
    utilization_color,
)
from bp_schema.revenue import PlanProduct, RevenueAssumptions


def test_annual_qty_formula():
    # 1000/month, 250 days -> 1000 * 12 * (250/310)
    q = annual_qty_from_monthly(1000, 250)
    assert abs(q - 1000 * 12 * (250 / 310)) < 0.01


def test_growth_and_ristourne():
    products = [
        PlanProduct(
            id=uuid4(),
            name="Produit A",
            unit="kg",
            unit_price_sell=10.0,
            ristourne_pct=0.10,
            monthly_qty_y1=100.0,
        )
    ]
    assumptions = RevenueAssumptions(
        nominal_capacity=5000,
        capacity_basis="units_per_day",
        production_days=250,
        growth_rate_y2=0.15,
        growth_rate_y3=0.15,
        growth_rate_y4=0.15,
        growth_rate_y5=0.15,
        growth_rate_y6=0.15,
        growth_rate_y7=0.15,
    )
    proj = calculate_revenue_projection(products, assumptions)
    assert len(proj.total_revenue_net) == 7
    y1_net = proj.products[0].years[0].revenue_net
    y2_net = proj.products[0].years[1].revenue_net
    assert y2_net > y1_net
    assert proj.products[0].years[0].ristourne > 0
    assert sum(proj.total_revenue_net) > 0


def test_utilization_colors():
    assert utilization_color(50) == "green"
    assert utilization_color(85) == "orange"
    assert utilization_color(96) == "red"


def test_nominal_kg_per_month():
    cap = nominal_capacity_annual(1000, "kg_per_month", 250)
    assert cap == 1000 * 12 * (250 / 310)
