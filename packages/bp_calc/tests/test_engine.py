import pytest

from bp_calc.engine import apply_patch, calculate_plan, compare_results
from bp_schema.liasse import PlanInputs, InvestmentLine, PersonnelLine


@pytest.fixture
def sample_inputs() -> PlanInputs:
    return PlanInputs(
        company={"name": "Test SARL", "legalForm": "SARL"},
        investments={
            "intangible": [{"label": "Logiciels", "amount": 50000, "usefulLifeYears": 5}],
            "tangible": [{"label": "Machines", "amount": 450000, "usefulLifeYears": 10}],
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
                {"role": "Gérant", "headcount": 1, "annualSalary": 48000},
                {"role": "Ouvriers", "headcount": 12, "annualSalary": 18000},
            ],
        },
    )


def test_calculate_plan_horizon(sample_inputs):
    results = calculate_plan(sample_inputs)
    assert len(results.revenue.years) == 7
    assert len(results.netProfit.years) == 7
    assert results.totalInvestment == 500000


def test_indicators_computed(sample_inputs):
    results = calculate_plan(sample_inputs)
    assert results.indicators.van is not None
    assert isinstance(results.balanceSheetBalanced, bool)
    assert isinstance(results.bfrCoherent, bool)


def test_simulation_patch(sample_inputs):
    baseline = calculate_plan(sample_inputs)
    patched = apply_patch(sample_inputs, "operations/rawMaterialCost", multiplier=1.15)
    scenario = calculate_plan(patched)
    delta = compare_results(baseline, scenario)
    assert "deltaVan" in delta


def test_waste_rate_validation():
    from bp_schema.validation import validate_draft_inputs

    inputs = PlanInputs(
        operations={"wasteRate": {"value": 0.05, "maxAllowed": 0.01}},
    )
    missing = validate_draft_inputs(inputs)
    assert "operations.wasteRate.value" in missing or "company.name" in missing
