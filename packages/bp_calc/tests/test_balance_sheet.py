from bp_calc.balance_sheet import BalanceSheetDrivers, build_balance_sheet


def test_balance_sheet_balanced():
    drivers = BalanceSheetDrivers(
        revenue_ht=[1_000_000] * 7,
        raw_purchases=[400_000] * 7,
        packaging_purchases=[100_000] * 7,
        net_profit=[50_000] * 7,
        depreciation=[30_000] * 7,
        cumulative_treasury=[100_000, 150_000, 200_000, 250_000, 300_000, 350_000, 400_000],
        loan_balance_end=[500_000, 450_000, 400_000, 350_000, 300_000, 250_000, 200_000],
        vat_payable=[10_000] * 7,
        intangible_gross=50_000,
        tangible_gross=450_000,
        equity_capital=150_000,
    )
    proj = build_balance_sheet(drivers)
    y1 = proj.years[0]
    assert y1.total_assets > 0
    assert y1.ratios.bfr != 0
    assert len(proj.composition_series["net_fixed_assets"]) == 7
