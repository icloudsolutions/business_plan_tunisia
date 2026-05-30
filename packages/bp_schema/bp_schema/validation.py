from bp_schema.liasse import PlanInputs


def validate_draft_inputs(inputs: PlanInputs) -> list[str]:
    """Return list of missing or invalid field paths for DRAFT consistency checks."""
    missing: list[str] = []

    if not inputs.company.name.strip():
        missing.append("company.name")

    total_intangible = sum(i.amount for i in inputs.investments.intangible)
    total_tangible = sum(i.amount for i in inputs.investments.tangible)
    if total_intangible + total_tangible <= 0:
        missing.append("investments.intangible|tangible")

    if inputs.operations.capacityPerMinute <= 0 and (
        inputs.operations.packagesPerMinute is None
        or inputs.operations.packagesPerMinute <= 0
    ):
        missing.append("operations.capacityPerMinute")

    if inputs.operations.salePrice <= 0:
        missing.append("operations.salePrice")

    if inputs.operations.wasteRate.value > inputs.operations.wasteRate.maxAllowed:
        missing.append("operations.wasteRate.value")
    elif inputs.operations.wasteRate.value < 0:
        missing.append("operations.wasteRate.value")

    if inputs.operations.workingDaysPerYear <= 0:
        missing.append("operations.workingDaysPerYear")

    return missing
