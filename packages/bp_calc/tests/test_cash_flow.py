from bp_calc.bfr import compute_bfr_detail, compute_bfr_compact
from bp_calc.cash_flow import CashFlowInputs, build_annual_cash_flow


def test_bfr_three_components():
    d = compute_bfr_detail(
        1_000_000,
        1_190_000,
        400_000,
        100_000,
        client_days=33,
        supplier_days=30,
        finished_goods_stock_days=10,
        raw_material_stock_days=30,
        packaging_stock_days=15,
    )
    assert d.client_receivables > 0
    assert d.stocks > 0
    assert d.total == d.client_receivables + d.stocks - d.supplier_payables


def test_compact_bfr_33_days():
    assert abs(compute_bfr_compact(1_200_000, 33) - 1_200_000 * 33 / 360) < 1


def test_cash_flow_y0_investment():
    cf = CashFlowInputs(
        revenue_ht=[500_000] * 7,
        raw_purchases=[200_000] * 7,
        packaging_purchases=[50_000] * 7,
        net_profit=[40_000] * 7,
        depreciation=[30_000] * 7,
        principal_repayment=[10_000] * 7,
        equity=150_000,
        total_investment=500_000,
        loan_drawdown=350_000,
        client_payment_days=33,
    )
    proj = build_annual_cash_flow(cf)
    y0 = proj.rows[0]
    assert y0.initial_investment < 0
    assert y0.equity_inflow == 150_000
    assert y0.debt_drawdown == 350_000
    assert len(proj.rows) == 8
