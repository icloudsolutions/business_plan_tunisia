from bp_schema.completion import get_required_missing_paths
from bp_schema.liasse import PlanInputs


def _total_capex_amount(inputs: PlanInputs) -> float:
    total = sum(e.cost for e in inputs.investments.equipment)
    total += sum(i.amount for i in inputs.investments.intangible)
    total += sum(i.amount for i in inputs.investments.tangible)
    return total


def validate_draft_inputs(inputs: PlanInputs) -> list[str]:
    """Return list of missing required field paths (blocks submission)."""
    missing = get_required_missing_paths(inputs)

    # Extra structural checks on equipment lines
    for i, eq in enumerate(inputs.investments.equipment):
        if eq.cost < 0:
            path = f"investments.equipment.{i}.cost"
            if path not in missing:
                missing.append(path)
        if eq.usefulLifeYears < 1:
            path = f"investments.equipment.{i}.usefulLifeYears"
            if path not in missing:
                missing.append(path)
        if eq.acquisitionYear < 1 or eq.acquisitionYear > 7:
            path = f"investments.equipment.{i}.acquisitionYear"
            if path not in missing:
                missing.append(path)

    if _total_capex_amount(inputs) <= 0 and "investments.equipment" not in missing:
        missing.append("investments.equipment")

    return missing
