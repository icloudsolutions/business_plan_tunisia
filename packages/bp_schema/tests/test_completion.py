from bp_schema.completion import compute_plan_completion, get_required_missing_paths
from bp_schema.liasse import EquipmentItem, PlanInputs


def test_empty_plan_has_missing_required():
    report = compute_plan_completion(PlanInputs())
    assert report["can_submit"] is False
    assert len(report["required_missing"]) >= 1
    assert "company.name" in get_required_missing_paths(PlanInputs())


def test_filled_plan_improves_score():
    inputs = PlanInputs()
    inputs.company.name = "VIPA Industries"
    inputs.investments.equipment = [
        EquipmentItem(name="Ligne", cost=100000, usefulLifeYears=10, acquisitionYear=1)
    ]
    inputs.operations.capacityPerMinute = 10
    inputs.operations.salePrice = 1.5
    inputs.operations.workingDaysPerYear = 250
    inputs.operations.wasteRateByYear = [0.01] * 7
    report = compute_plan_completion(inputs)
    assert report["overall_pct"] > 50
    assert len(report["sections"]) == 6
