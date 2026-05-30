"""Tests for Liasse Unique inventory chain formulas."""

import pytest

from bp_calc.inventory import (
    PURCHASE_MULTIPLIER,
    PRODUCTION_SELLING_RATIO,
    compute_purchases_and_stock_mp,
    compute_qty_consumed,
    compute_qty_produced,
    inventory_chain,
)
from bp_schema.liasse import Operations, WorkingCapital


# VIPA reference (Year 1, PF Maïs) — annual kg sold ≈ 37 440
VIPA_QTY_SOLD_Y1 = 37_440.0
VIPA_STOCK_DAYS_PF = 10
VIPA_SELLING_DAYS = 310.0
VIPA_WASTE_RATE = 0.01
VIPA_MP_PRICE_Y1 = 2.80


class TestProductionSellRatio:
    def test_ratio_constant(self):
        assert abs(PRODUCTION_SELLING_RATIO - 320 / 310) < 1e-9

    def test_effective_production_days(self):
        ops = Operations(workingDaysPerYear=310)
        assert abs(ops.effective_production_days - 320.0) < 0.5


class TestWorkingCapitalMonths:
    def test_stock_days_from_months(self):
        wc = WorkingCapital(rawMaterialStockMonths=1.0, packagingStockMonths=0.5)
        assert abs(wc.rawMaterialStockDays - 30.42) < 0.01
        assert abs(wc.packagingStockDays - 15.21) < 0.01

    def test_migrate_legacy_days(self):
        wc = WorkingCapital.model_validate(
            {"rawMaterialStockDays": 30, "packagingStockDays": 15}
        )
        assert abs(wc.rawMaterialStockMonths - 30 / 30.42) < 0.05


class TestQtyProduced:
    def test_single_year_vipa(self):
        produced, closing_pf = compute_qty_produced(
            [VIPA_QTY_SOLD_Y1], VIPA_STOCK_DAYS_PF, VIPA_SELLING_DAYS
        )
        assert abs(closing_pf[0] - VIPA_QTY_SOLD_Y1 * 10 / 310) < 1.0
        assert abs(produced[0] - (VIPA_QTY_SOLD_Y1 + closing_pf[0])) < 0.01

    def test_produced_always_gte_sold(self):
        sold = [100_000, 115_000, 132_000]
        produced, _ = compute_qty_produced(sold, 10, 310)
        for s, p in zip(sold, produced):
            assert p >= s


class TestQtyConsumed:
    def test_waste_adds_1_percent(self):
        produced = [100_000.0]
        consumed = compute_qty_consumed(produced, waste_rate=0.01)
        assert abs(consumed[0] - 101_000.0) < 0.01

    def test_zero_waste(self):
        produced = [50_000.0]
        consumed = compute_qty_consumed(produced, waste_rate=0.0)
        assert consumed[0] == 50_000.0


class TestPurchasesAndStockMP:
    def test_13_over_12_multiplier(self):
        consumed = [12_000.0]
        purchased, closing, opening = compute_purchases_and_stock_mp(
            consumed, opening_stock_mp_y0=0.0
        )
        assert abs(purchased[0] - 12_000.0 * PURCHASE_MULTIPLIER) < 0.01

    def test_closing_stock_equals_one_month(self):
        consumed = [120_000.0]
        purchased, closing, _ = compute_purchases_and_stock_mp(consumed, 0.0)
        expected_one_month = consumed[0] / 12
        assert abs(closing[0] - expected_one_month) < 1.0

    def test_opening_stock_carried_forward(self):
        consumed = [12_000.0, 13_000.0]
        purchased, closing, opening = compute_purchases_and_stock_mp(consumed, 0.0)
        assert abs(opening[1] - closing[0]) < 0.01

    def test_new_project_zero_opening(self):
        consumed = [10_000.0, 11_000.0]
        _, _, opening = compute_purchases_and_stock_mp(consumed, 0.0)
        assert opening[0] == 0.0

    def test_purchases_not_negative(self):
        consumed = [1_000.0]
        purchased, _, _ = compute_purchases_and_stock_mp(consumed, opening_stock_mp_y0=5_000.0)
        assert purchased[0] >= 0.0


class TestInventoryChainVIPA:
    def test_vipa_y1_full_chain(self):
        qty_sold = [VIPA_QTY_SOLD_Y1] * 7
        result = inventory_chain(
            qty_sold=qty_sold,
            stock_days_pf=VIPA_STOCK_DAYS_PF,
            selling_days=VIPA_SELLING_DAYS,
            waste_rate=VIPA_WASTE_RATE,
            mp_price_y1=VIPA_MP_PRICE_Y1,
        )
        assert abs(result["qty_produced"][0] - 38_647.7) < 5.0
        assert abs(result["qty_consumed"][0] - 39_034.0) < 5.0
        assert abs(result["closing_stock_pf"][0] - VIPA_QTY_SOLD_Y1 * 10 / 310) < 5.0
        assert abs(result["closing_stock_mp"][0] - result["qty_consumed"][0] / 12) < 5.0

    def test_stock_balance_every_year(self):
        qty_sold = [VIPA_QTY_SOLD_Y1 * (1.15 ** y) for y in range(7)]
        result = inventory_chain(
            qty_sold=qty_sold,
            stock_days_pf=10,
            selling_days=310,
            waste_rate=0.01,
            mp_price_y1=2.80,
        )
        for y in range(7):
            balance = result["qty_purchased"][y] - result["qty_consumed"][y]
            assert abs(balance - result["closing_stock_mp"][y]) < 0.01

    def test_opening_continuity_all_years(self):
        qty_sold = [100_000 * (1.1 ** y) for y in range(7)]
        result = inventory_chain(
            qty_sold=qty_sold,
            stock_days_pf=10,
            selling_days=310,
            waste_rate=0.01,
            mp_price_y1=3.0,
        )
        for y in range(1, 7):
            assert abs(result["opening_stock_mp"][y] - result["closing_stock_mp"][y - 1]) < 0.01


class TestEngineInventoryIntegration:
    def test_plan_with_qty_sold_y1(self):
        from bp_calc.engine import calculate_plan
        from bp_schema.liasse import PlanInputs

        inputs = PlanInputs.model_validate(
            {
                "investments": {
                    "equipment": [{"name": "Ligne", "cost": 100_000, "usefulLifeYears": 10}]
                },
                "operations": {
                    "capacityPerMinute": 10,
                    "salePrice": 5,
                    "rawMaterialCost": 2.8,
                    "qtySoldY1": VIPA_QTY_SOLD_Y1,
                    "mpPricePerUnit": 2.8,
                    "workingDaysPerYear": 310,
                },
                "financing": {"equityRatio": 0.3, "debtRatio": 0.7},
            }
        )
        results = calculate_plan(inputs)
        assert len(results.qtyProduced.years) == 7
        assert results.purchaseValueMP.years[0] > 0
        assert results.qtySold.years[0] == VIPA_QTY_SOLD_Y1
