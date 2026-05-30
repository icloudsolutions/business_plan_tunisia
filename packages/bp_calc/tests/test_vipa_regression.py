"""Sanity regression tests aligned with VIPA workbook expectations."""

import pytest

from bp_calc.engine import calculate_plan
from bp_schema.liasse import PlanInputs, InvestmentLine, PersonnelLine


@pytest.fixture
def vipa_like_inputs() -> PlanInputs:
    return PlanInputs(
        company={"name": "VIPA Test", "legalForm": "SARL"},
        investments={
            "intangible": [InvestmentLine(label="Logiciels", amount=50000, usefulLifeYears=5)],
            "tangible": [InvestmentLine(label="Machines", amount=450000, usefulLifeYears=10)],
        },
        operations={
            "capacityPerMinute": 120,
            "workingDaysPerYear": 250,
            "hoursPerDay": 8,
            "rawMaterialCost": 0.05,
            "packagingCost": 0.02,
            "salePrice": 0.35,
            "wasteRate": {"value": 0.01, "maxAllowed": 0.01},
        },
        financing={"equityRatio": 0.3, "debtRatio": 0.7, "loan": {"rate": 0.083, "years": 7}},
        plAssumptions={
            "commercialDiscount": 0.10,
            "corporateTaxRate": 0.25,
            "personnel": [
                PersonnelLine(role="Gérant", headcount=1, annualSalary=48000),
                PersonnelLine(role="Ouvriers", headcount=12, annualSalary=18000),
            ],
        },
    )


def test_horizon_seven_years(vipa_like_inputs):
    r = calculate_plan(vipa_like_inputs)
    assert len(r.revenue.years) == 7
    assert len(r.netProfit.years) == 7


def test_investment_total(vipa_like_inputs):
    r = calculate_plan(vipa_like_inputs)
    assert r.totalInvestment == 500000


def test_van_tri_present(vipa_like_inputs):
    r = calculate_plan(vipa_like_inputs)
    assert r.indicators.van is not None
    assert r.indicators.tri is not None


def test_balance_and_bfr_flags(vipa_like_inputs):
    r = calculate_plan(vipa_like_inputs)
    assert isinstance(r.balanceSheetBalanced, bool)
    assert isinstance(r.bfrCoherent, bool)
