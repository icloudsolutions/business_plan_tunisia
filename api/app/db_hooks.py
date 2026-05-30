"""ORM hooks — block mutation of VALIDATED plan financial data."""

from sqlalchemy import event, inspect

from bp_schema.enums import BusinessPlanStatus

from app.models import BusinessPlan


@event.listens_for(BusinessPlan, "before_update")
def _prevent_validated_plan_mutation(mapper, connection, target: BusinessPlan):
    if target.status != BusinessPlanStatus.VALIDATED.value:
        return
    state = inspect(target)
    for attr in ("inputs", "results", "title"):
        hist = state.attrs[attr].history
        if hist.has_changes():
            raise ValueError(
                f"Modification interdite: le plan {target.id} est VALIDATED (champ {attr})"
            )
