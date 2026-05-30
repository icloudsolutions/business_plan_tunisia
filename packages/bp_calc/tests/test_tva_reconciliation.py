from uuid import uuid4

from bp_calc.tva_reconciliation import (
    PurchaseBases,
    build_purchase_bases,
    calculate_tva_projection,
)
from bp_schema.liasse import PlanInputs
from bp_schema.revenue import PlanProduct, ProductRevenueSeries, ProductYearRevenue, RevenueProjection
from bp_schema.tva_module import TvaConfig, TvaConfigCategory, guess_product_tva_profile


def test_guess_maize_profile():
    assert guess_product_tva_profile("Farine de maïs") == (0.06, 0.06)


def test_tva_balance_sales_minus_purchases():
    pid = str(uuid4())
    configs = [
        TvaConfig(
            category=TvaConfigCategory.product,
            applies_to=pid,
            label="Maïs",
            tva_rate_purchase=0.06,
            tva_rate_sales=0.06,
        ),
    ]
    revenue = RevenueProjection(
        products=[
            ProductRevenueSeries(
                product_id=pid,
                name="Maïs",
                unit="kg",
                years=[
                    ProductYearRevenue(year=1, quantity=1000, revenue_gross=10000, revenue_net=10000),
                ],
            )
        ],
        total_revenue_net=[10000],
    )
    purchases = PurchaseBases(
        mp_by_product={pid: [5000.0]},
    )
    proj = calculate_tva_projection(configs, revenue, purchases)
    y1 = proj.by_year[0]
    assert abs(y1.tva_collectee - 600) < 0.01
    assert abs(y1.tva_deductible - 300) < 0.01
    assert abs(y1.solde_tva - 300) < 0.01
    assert y1.customer_receivables > 0
    assert y1.supplier_payables > 0
