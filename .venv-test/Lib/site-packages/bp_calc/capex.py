"""CAPEX aggregation and depreciation schedule from equipment lines."""

from bp_schema.liasse import EquipmentItem, InvestmentLine, PlanInputs

HORIZON = 7


def _legacy_as_equipment(inputs: PlanInputs) -> list[EquipmentItem]:
    """Convert legacy intangible/tangible lines to equipment (year 1)."""
    items: list[EquipmentItem] = []
    for line in inputs.investments.intangible:
        items.append(
            EquipmentItem(
                name=line.label,
                cost=line.amount,
                usefulLifeYears=line.usefulLifeYears,
                acquisitionYear=1,
                assetType="intangible",
            )
        )
    for line in inputs.investments.tangible:
        items.append(
            EquipmentItem(
                name=line.label,
                cost=line.amount,
                usefulLifeYears=line.usefulLifeYears,
                acquisitionYear=1,
                assetType="tangible",
            )
        )
    return items


def all_equipment(inputs: PlanInputs) -> list[EquipmentItem]:
    explicit = list(inputs.investments.equipment)
    if explicit:
        return explicit
    return _legacy_as_equipment(inputs)


def total_capex(inputs: PlanInputs) -> float:
    return sum(e.cost for e in all_equipment(inputs))


def annual_depreciation_schedule(inputs: PlanInputs) -> list[float]:
    dep = [0.0] * HORIZON
    for item in all_equipment(inputs):
        if item.cost <= 0:
            continue
        life = max(1, item.usefulLifeYears)
        annual = item.cost / life
        start = max(0, min(HORIZON - 1, item.acquisitionYear - 1))
        for offset in range(life):
            y = start + offset
            if y >= HORIZON:
                break
            dep[y] += annual
    return dep
