"""Central state + role policy for all mutating plan actions."""

from fastapi import HTTPException, status

from bp_schema.enums import BusinessPlanStatus

from app.models import BusinessPlan, User
from app.state_machine import can_edit_inputs, can_simulate, is_locked


class PlanAction:
    PATCH_INPUTS = "patch_inputs"
    UPDATE_META = "update_meta"
    DELETE = "delete"
    SUBMIT = "submit"
    RESUBMIT = "resubmit"
    TRANSITION = "transition"
    RECALCULATE = "recalculate"
    SIMULATE = "simulate"
    AUDIT = "audit"
    COMMENT = "comment"
    SECTION_REVIEW = "section_review"
    EXPORT = "export"


def assert_collaboration_state(plan: BusinessPlan) -> None:
    if plan.status not in (
        BusinessPlanStatus.UNDER_REVIEW.value,
        BusinessPlanStatus.ADJUSTMENT.value,
    ):
        raise HTTPException(
            status_code=400,
            detail="Collaboration disponible uniquement en revue ou ajustement",
        )


def assert_plan_action(plan: BusinessPlan, user: User, action: str) -> None:
    if action == PlanAction.PATCH_INPUTS:
        if is_locked(plan.status):
            raise HTTPException(status_code=403, detail="Plan verrouillé (VALIDATED)")
        if user.role == "client" and not can_edit_inputs(plan.status):
            raise HTTPException(status_code=403, detail="Modification non autorisée dans cet état")
        if user.role == "expert" and plan.status not in (
            BusinessPlanStatus.ADJUSTMENT.value,
            BusinessPlanStatus.UNDER_REVIEW.value,
        ):
            raise HTTPException(status_code=403, detail="Expert: modification limitée aux phases de revue/ajustement")
        return

    if action == PlanAction.UPDATE_META:
        if is_locked(plan.status):
            raise HTTPException(status_code=403, detail="Plan verrouillé (VALIDATED)")
        if user.role == "admin":
            return
        if user.role == "client" and plan.owner_id == user.id:
            return
        raise HTTPException(status_code=403, detail="Modification du titre non autorisée")

    if action == PlanAction.DELETE:
        if plan.status == BusinessPlanStatus.VALIDATED.value:
            raise HTTPException(status_code=403, detail="Impossible de supprimer un plan validé")
        if user.role == "admin":
            return
        if user.role == "client" and plan.owner_id == user.id:
            if plan.status == BusinessPlanStatus.DRAFT.value:
                return
            raise HTTPException(
                status_code=403,
                detail="Suppression autorisée uniquement en brouillon",
            )
        raise HTTPException(status_code=403, detail="Suppression non autorisée")

    if action == PlanAction.SUBMIT:
        if user.role != "client" or plan.owner_id != user.id:
            raise HTTPException(status_code=403, detail="Seul le client propriétaire peut soumettre")
        if plan.status != BusinessPlanStatus.DRAFT.value:
            raise HTTPException(status_code=400, detail="Soumission uniquement depuis DRAFT")
        return

    if action == PlanAction.RESUBMIT:
        if user.role != "client" or plan.owner_id != user.id:
            raise HTTPException(status_code=403, detail="Seul le client propriétaire peut resoumettre")
        if plan.status != BusinessPlanStatus.ADJUSTMENT.value:
            raise HTTPException(status_code=400, detail="Resoumission uniquement depuis ADJUSTMENT")
        return

    if action == PlanAction.TRANSITION:
        if user.role != "expert":
            raise HTTPException(status_code=403, detail="Rôle expert requis")
        if is_locked(plan.status):
            raise HTTPException(status_code=403, detail="Plan déjà validé")
        return

    if action == PlanAction.RECALCULATE:
        if is_locked(plan.status):
            raise HTTPException(status_code=403, detail="Plan verrouillé")
        return

    if action == PlanAction.SIMULATE:
        if not can_simulate(plan.status):
            raise HTTPException(status_code=400, detail="Simulation non autorisée dans cet état")
        return

    if action == PlanAction.AUDIT:
        if user.role != "expert":
            raise HTTPException(status_code=403, detail="Rôle expert requis")
        return

    if action == PlanAction.COMMENT:
        assert_collaboration_state(plan)
        return

    if action == PlanAction.SECTION_REVIEW:
        if user.role != "expert":
            raise HTTPException(status_code=403, detail="Annotations expert uniquement")
        assert_collaboration_state(plan)
        return

    if action == PlanAction.EXPORT:
        if plan.status != BusinessPlanStatus.VALIDATED.value:
            raise HTTPException(status_code=400, detail="Export uniquement pour plans VALIDATED")
        return

    raise HTTPException(status_code=400, detail=f"Action inconnue: {action}")
