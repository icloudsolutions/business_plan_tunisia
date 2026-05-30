from bp_calc.kpi_dashboard import build_kpi_dashboard, format_payback_label, tri_status_color
from bp_schema.liasse import PlanInputs


def _minimal_inputs() -> PlanInputs:
    return PlanInputs.model_validate(
        {
            "operations": {
                "capacityPerMinute": 120,
                "salePrice": 2.5,
                "rawMaterialCost": 0.8,
                "packagingCost": 0.2,
                "workingDaysPerYear": 250,
                "hoursPerDay": 8,
            },
            "investments": {
                "equipment": [{"name": "Ligne", "cost": 500_000, "usefulLifeYears": 10}]
            },
            "financing": {
                "equityRatio": 0.3,
                "debtRatio": 0.7,
                "loan": {"amount": 350_000, "rate": 0.083, "years": 7},
            },
            "plAssumptions": {
                "personnel": [{"role": "Op", "headcount": 5, "annualSalary": 12000}],
                "otherOperatingCharges": 50000,
            },
        }
    )


def test_format_payback():
    assert "2 ans" in format_payback_label(2.92)


def test_tri_color_thresholds():
    assert tri_status_color(0.20) == "green"
    assert tri_status_color(0.12) == "orange"
    assert tri_status_color(0.05) == "red"


def test_build_kpi_dashboard_has_primary():
    proj = build_kpi_dashboard(_minimal_inputs())
    assert proj.primary.total_investment > 0
    assert len(proj.annual_performance) == 7
    assert len(proj.financing) == 7
    assert "checks" in proj.financability.model_dump()
