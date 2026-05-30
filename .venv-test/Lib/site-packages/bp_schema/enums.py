from enum import Enum


class BusinessPlanStatus(str, Enum):
    DRAFT = "DRAFT"
    UNDER_REVIEW = "UNDER_REVIEW"
    ADJUSTMENT = "ADJUSTMENT"
    VALIDATED = "VALIDATED"


class AuditDecision(str, Enum):
    VALIDATE = "VALIDATE"
    NEEDS_ADJUSTMENT = "NEEDS_ADJUSTMENT"
    REJECT = "REJECT"


class OutputMode(str, Enum):
    DATA_MODE = "DATA_MODE"
    AUDIT_MODE = "AUDIT_MODE"
    REPORT_MODE = "REPORT_MODE"


class UserRole(str, Enum):
    CLIENT = "client"
    EXPERT = "expert"
