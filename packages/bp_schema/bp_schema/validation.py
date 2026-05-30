from bp_schema.liasse import PlanInputs


def _total_capex_amount(inputs: PlanInputs) -> float:
    total = sum(e.cost for e in inputs.investments.equipment)
    total += sum(i.amount for i in inputs.investments.intangible)
    total += sum(i.amount for i in inputs.investments.tangible)
    return total


def validate_draft_inputs(inputs: PlanInputs) -> list[str]:
    """Return list of missing or invalid field paths for DRAFT consistency checks."""
    missing: list[str] = []

    if not inputs.company.name.strip():
        missing.append("company.name")

    if _total_capex_amount(inputs) <= 0:
        missing.append("investments.equipment")

    if inputs.operations.capacityPerMinute <= 0 and (
        inputs.operations.packagesPerMinute is None
        or inputs.operations.packagesPerMinute <= 0
    ):
        missing.append("operations.capacityPerMinute")

    if inputs.operations.salePrice <= 0:
        missing.append("operations.salePrice")

    max_waste = inputs.operations.wasteRate.maxAllowed
    for i, rate in enumerate(inputs.operations.wasteRateByYear):
        if rate < 0 or rate > max_waste:
            missing.append(f"operations.wasteRateByYear.{i}")
    if not inputs.operations.wasteRateByYear:
        if inputs.operations.wasteRate.value > max_waste:
            missing.append("operations.wasteRate.value")
        elif inputs.operations.wasteRate.value < 0:
            missing.append("operations.wasteRate.value")

    if inputs.operations.workingDaysPerYear <= 0:
        missing.append("operations.workingDaysPerYear")

    wc = inputs.workingCapital
    for path, days in [
        ("workingCapital.rawMaterialStockDays", wc.rawMaterialStockDays),
        ("workingCapital.packagingStockDays", wc.packagingStockDays),
        ("workingCapital.finishedGoodsStockDays", wc.finishedGoodsStockDays),
    ]:
        if days < 0:
            missing.append(path)

    pl = inputs.plAssumptions
    if pl.distributionExpensePct < 0 or pl.distributionExpensePct > 1:
        missing.append("plAssumptions.distributionExpensePct")
    if pl.marketingExpensePct < 0 or pl.marketingExpensePct > 1:
        missing.append("plAssumptions.marketingExpensePct")

    for i, eq in enumerate(inputs.investments.equipment):
        if eq.cost < 0:
            missing.append(f"investments.equipment.{i}.cost")
        if eq.usefulLifeYears < 1:
            missing.append(f"investments.equipment.{i}.usefulLifeYears")
        if eq.acquisitionYear < 1 or eq.acquisitionYear > 7:
            missing.append(f"investments.equipment.{i}.acquisitionYear")

    return missing
