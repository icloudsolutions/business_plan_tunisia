from bp_schema.enums import AuditDecision, BusinessPlanStatus

TRANSITIONS: dict[tuple[BusinessPlanStatus, str], BusinessPlanStatus] = {
    (BusinessPlanStatus.DRAFT, "submit"): BusinessPlanStatus.UNDER_REVIEW,
    (BusinessPlanStatus.UNDER_REVIEW, AuditDecision.NEEDS_ADJUSTMENT.value): BusinessPlanStatus.ADJUSTMENT,
    (BusinessPlanStatus.UNDER_REVIEW, AuditDecision.VALIDATE.value): BusinessPlanStatus.VALIDATED,
    (BusinessPlanStatus.UNDER_REVIEW, AuditDecision.REJECT.value): BusinessPlanStatus.DRAFT,
    (BusinessPlanStatus.ADJUSTMENT, "resubmit"): BusinessPlanStatus.UNDER_REVIEW,
    (BusinessPlanStatus.ADJUSTMENT, AuditDecision.VALIDATE.value): BusinessPlanStatus.VALIDATED,
}

EDITABLE_STATUSES = {BusinessPlanStatus.DRAFT, BusinessPlanStatus.ADJUSTMENT}
SIMULATION_STATUSES = {BusinessPlanStatus.UNDER_REVIEW, BusinessPlanStatus.ADJUSTMENT}


def can_transition(current: BusinessPlanStatus, action: str) -> bool:
    return (current, action) in TRANSITIONS


def next_status(current: BusinessPlanStatus, action: str) -> BusinessPlanStatus:
    key = (current, action)
    if key not in TRANSITIONS:
        raise ValueError(f"Transition invalide: {current} + {action}")
    return TRANSITIONS[key]


def can_edit_inputs(status: str) -> bool:
    return BusinessPlanStatus(status) in EDITABLE_STATUSES


def can_simulate(status: str) -> bool:
    return BusinessPlanStatus(status) in SIMULATION_STATUSES


def is_locked(status: str) -> bool:
    return BusinessPlanStatus(status) == BusinessPlanStatus.VALIDATED
