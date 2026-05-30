from uuid import uuid4

from bp_calc.procurement import calculate_procurement_projection, has_procurement_data
from bp_schema.procurement import (
    ProductRecipe,
    PurchaseAssumption,
    RawMaterial,
)
from bp_schema.revenue import PlanProduct, ProductRevenueSeries, ProductYearRevenue, RevenueProjection


def test_procurement_purchases_and_stock():
    pid = uuid4()
    mid_mp = uuid4()
    mid_pack = uuid4()
    products = [
        PlanProduct(
            id=pid,
            name="PF Maïs",
            unit="kg",
            monthly_qty_y1=1000,
        )
    ]
    years_data = [
        ProductYearRevenue(year=y, quantity=12000, revenue_gross=24000, revenue_net=22000)
        for y in range(1, 8)
    ]
    revenue = RevenueProjection(
        products=[
            ProductRevenueSeries(
                product_id=str(pid),
                name="PF Maïs",
                unit="kg",
                years=years_data,
            )
        ],
        total_revenue_net=[22000] * 7,
        total_quantity=[12000] * 7,
    )
    materials = [
        RawMaterial(id=mid_mp, name="Maïs", category="mp", price_per_unit=2.0, supplier_payment_days=30),
        RawMaterial(
            id=mid_pack,
            name="Emballage",
            category="packaging",
            price_per_unit=5.0,
            supplier_payment_days=30,
        ),
    ]
    recipes = [
        ProductRecipe(product_id=pid, raw_material_id=mid_mp, quantity_per_kg_product=1.0),
        ProductRecipe(product_id=pid, raw_material_id=mid_pack, quantity_per_kg_product=0.004),
    ]
    assumptions = [
        PurchaseAssumption(raw_material_id=mid_mp, stock_days=30),
        PurchaseAssumption(raw_material_id=mid_pack, stock_days=15),
    ]
    proj = calculate_procurement_projection(
        materials, recipes, assumptions, products, revenue, {}
    )
    assert has_procurement_data(materials, recipes)
    assert len(proj.rows) == 2
    assert proj.rows[0].years[0].purchases_qty > 0
    assert proj.rows[0].years[0].purchase_value_ht > 0
    assert proj.rows[0].years[0].supplier_payable > 0
