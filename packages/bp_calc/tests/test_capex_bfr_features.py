import pytest

from bp_calc.capex import annual_depreciation_schedule, total_capex
from bp_calc.engine import calculate_plan
from bp_schema.liasse import EquipmentItem, PlanInputs


def test_equipment_staggered_depreciation():
    inputs = PlanInputs(
        company={"name": "CAPEX Test", "legalForm": "SARL"},
        investments={
            "equipment": [
                EquipmentItem(
                    name="Ligne A",
                    cost=100000,
                    usefulLifeYears=5,
                    acquisitionYear=1,
                ),
                EquipmentItem(
                    name="Ligne B",
                    cost=200000,
                    usefulLifeYears=4,
                    acquisitionYear=3,
                ),
            ],
        },
        operations={
            "capacityPerMinute": 100,
            "workingDaysPerYear": 250,
            "salePrice": 1.0,
            "rawMaterialCost": 0.1,
            "wasteRateByYear": [0.01, 0.02, 0.01, 0.015, 0.01, 0.01, 0.01],
        },
        financing={"equityRatio": 1.0, "debtRatio": 0.0},
    )
    assert total_capex(inputs) == 300000
    dep = annual_depreciation_schedule(inputs)
    assert dep[0] == pytest.approx(20000, rel=1e-3)
    assert dep[2] == pytest.approx(70000, rel=1e-3)
    results = calculate_plan(inputs)
    assert results.totalInvestment == 300000
    assert len(results.distributionExpense.years) == 7


def test_distribution_marketing_reduce_ebitda():
    base = PlanInputs(
        company={"name": "OPEX", "legalForm": "SARL"},
        investments={
            "equipment": [
                EquipmentItem(name="M", cost=500000, usefulLifeYears=10, acquisitionYear=1)
            ]
        },
        operations={
            "capacityPerMinute": 120,
            "workingDaysPerYear": 250,
            "salePrice": 0.35,
            "rawMaterialCost": 0.05,
        },
        financing={"equityRatio": 0.3, "debtRatio": 0.7},
        plAssumptions={"distributionExpensePct": 0.0, "marketingExpensePct": 0.0},
    )
    with_fees = base.model_copy(deep=True)
    with_fees.plAssumptions.distributionExpensePct = 0.05
    with_fees.plAssumptions.marketingExpensePct = 0.03
    r0 = calculate_plan(base)
    r1 = calculate_plan(with_fees)
    assert r1.netProfit.years[0] < r0.netProfit.years[0]
    assert r1.distributionExpense.years[0] > 0
    assert r1.marketingExpense.years[0] > 0


def test_packaging_stock_days_affects_bfr():
    inputs = PlanInputs(
        company={"name": "BFR", "legalForm": "SARL"},
        investments={
            "equipment": [EquipmentItem(name="X", cost=400000, usefulLifeYears=10)]
        },
        operations={
            "capacityPerMinute": 100,
            "workingDaysPerYear": 250,
            "salePrice": 1.0,
            "rawMaterialCost": 0.2,
            "packagingCost": 0.1,
        },
        financing={"equityRatio": 1.0, "debtRatio": 0.0},
        workingCapital={
            "rawMaterialStockDays": 30,
            "packagingStockDays": 10,
            "finishedGoodsStockDays": 15,
        },
    )
    low = calculate_plan(inputs)
    high = inputs.model_copy(deep=True)
    high.workingCapital.packagingStockDays = 60
    high_r = calculate_plan(high)
    assert high_r.bfr.years[0] > low.bfr.years[0]
