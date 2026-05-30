from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from bp_schema.liasse import PlanInputs


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRegister(BaseModel):
    email: str
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Le mot de passe doit contenir au moins 8 caractères")
        return v


class UserLogin(BaseModel):
    email: str
    password: str


class ExpertCreate(BaseModel):
    email: str
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Le mot de passe doit contenir au moins 8 caractères")
        return v


class AdminUserCreate(BaseModel):
    email: str
    password: str
    role: Literal["client", "expert"] = "client"

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Le mot de passe doit contenir au moins 8 caractères")
        return v


class UserResponse(BaseModel):
    id: UUID
    email: str
    role: str
    display_name: str | None = None
    status: str = "active"
    last_active_at: datetime | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class AdminUserRow(UserResponse):
    plans_count: int = 0


class AdminUserPatch(BaseModel):
    role: Literal["client", "expert", "admin"] | None = None
    status: Literal["active", "suspended"] | None = None
    display_name: str | None = None


class BulkUserIds(BaseModel):
    user_ids: list[UUID] = Field(default_factory=list)


class AdminPlanRow(BaseModel):
    id: UUID
    title: str
    status: str
    owner_id: UUID
    owner_email: str
    expert_id: UUID | None
    expert_email: str | None
    updated_at: datetime
    completion_pct: int
    export_status: str


class AdminPlanFilters(BaseModel):
    status: str | None = None
    expert_id: UUID | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None


class AdminPlanStatusSet(BaseModel):
    status: Literal["DRAFT", "UNDER_REVIEW", "ADJUSTMENT", "VALIDATED"]


class AdminPlanExpertAssign(BaseModel):
    expert_id: UUID


class AdminNotificationSend(BaseModel):
    title: str
    body: str
    channel: Literal["in_app", "email", "both"] = "in_app"
    template_key: str | None = None
    user_id: UUID | None = None
    role_target: Literal["client", "expert", "admin"] | None = None


class AiAssistRequest(BaseModel):
    action: Literal["field_assist", "executive_summary"] = "field_assist"
    field_key: str | None = None
    message: str | None = None
    sector: str | None = None
    company_type: Literal["PME", "GE"] = "PME"
    location: str = "Tunisie"
    chat_history: list[dict[str, str]] = Field(default_factory=list)


class AiAssistResponse(BaseModel):
    reply: str
    suggested_value: float | str | int | None = None
    benchmarks: str | None = None
    suggestion_id: UUID | None = None
    executive_summary: str | None = None


class AiSuggestionAccept(BaseModel):
    accepted: bool = True


class SystemHealthResponse(BaseModel):
    api: dict
    celery_queues: dict[str, int]
    postgres_bytes: int
    postgres_human: str


class PlanCreate(BaseModel):
    title: str = "Nouveau Business Plan"
    inputs: dict | None = None


class PlanUpdateInputs(BaseModel):
    inputs: dict


class PlanUpdate(BaseModel):
    title: str | None = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Le titre ne peut pas être vide")
        return v.strip() if v else v


class PlanResponse(BaseModel):
    id: UUID
    title: str
    status: str
    owner_id: UUID
    assigned_expert_id: UUID | None = None
    inputs: dict
    results: dict | None
    locked_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TransitionRequest(BaseModel):
    action: str
    message: str | None = None


class ProjectionsSimulateRequest(BaseModel):
    revenue_year1_mult: float = Field(default=1.0, ge=0.5, le=2.0)
    growth_mult: float = Field(default=1.0, ge=0.5, le=2.0)
    loan_rate_mult: float = Field(default=1.0, ge=0.5, le=2.0)
    persist: bool = Field(
        default=True,
        description="Si vrai, enregistre les résultats sur le plan après calcul",
    )


class ProjectionsResponse(BaseModel):
    plan_id: UUID
    plan_title: str
    plan_status: str
    has_results: bool
    scenario: str
    active: dict | None = None
    scenarios: dict | None = None


class ScenarioMultipliers(BaseModel):
    revenue_growth_by_year: list[float] = Field(
        default_factory=lambda: [0.03] * 7,
        min_length=7,
        max_length=7,
    )
    personnel_cost_growth: float = 0.03
    raw_material_cost_ratio: float = 1.0
    loan_interest_rate_mult: float = 1.0
    revenue_scale: float = 1.0


class PlanScenarioCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    multipliers: ScenarioMultipliers | dict | None = None


class PlanScenarioUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=128)
    multipliers: ScenarioMultipliers | dict | None = None
    recalculate: bool = False


class PlanScenarioResponse(BaseModel):
    id: UUID
    plan_id: UUID
    name: str
    slug: str | None = None
    multipliers: dict
    results: dict | None = None
    calc_job_id: UUID | None = None
    calc_status: str
    is_official: bool
    recommended_by_id: UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class ScenarioKpiRow(BaseModel):
    id: UUID
    name: str
    slug: str | None = None
    status: str
    is_official: bool
    van: float | None = None
    tri: float | None = None
    drci: float | None = None
    point_mort: int | None = None


class ScenarioCompareResponse(BaseModel):
    plan_id: UUID
    official_scenario_id: UUID | None = None
    kpi_table: list[ScenarioKpiRow]
    net_profit_series: dict[str, list[float]]
    scenarios: list[PlanScenarioResponse]


class SimulateRequest(BaseModel):
    name: str = "Scénario"
    patches: list[dict] = Field(default_factory=list)


class CommentCreate(BaseModel):
    field_key: str | None = None
    content: str
    parent_id: UUID | None = None


class CommentPatch(BaseModel):
    resolved: bool | None = None
    content: str | None = None


class CommentResponse(BaseModel):
    id: UUID
    plan_id: UUID
    field_key: str
    user_id: UUID
    user_email: str | None = None
    content: str
    parent_id: UUID | None = None
    resolved: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SectionReviewUpsert(BaseModel):
    status: str


class SectionReviewResponse(BaseModel):
    id: UUID
    plan_id: UUID
    section_key: str
    status: str
    user_id: UUID
    user_email: str | None = None
    updated_at: datetime

    class Config:
        from_attributes = True


class CollaborationSyncResponse(BaseModel):
    plan_status: str
    comments: list[dict]
    section_reviews: list[dict]
    activity: list[dict]
    presence: list[dict]


class JobResponse(BaseModel):
    id: UUID
    status: str
    task_type: str
    result: dict | None = None
    error: str | None = None


class ExportRequest(BaseModel):
    formats: list[str] = Field(default=["pdf", "xlsx"])


class CopilotRequest(BaseModel):
    state: str
    output_mode: str
    action: str
    input_data: dict
    plan_id: UUID | None = None


class CompletionFieldItem(BaseModel):
    path: str
    section: str
    tier: str
    label_fr: str
    label_ar: str
    filled: bool


class SectionCompletionOut(BaseModel):
    section: str
    title_fr: str
    title_ar: str
    score_pct: int
    status: Literal["complete", "warning", "incomplete"]
    required_missing: list[str]
    recommended_missing: list[str]
    fields_total: int
    fields_filled: int


class PlanCompletionResponse(BaseModel):
    overall_pct: int
    sections: list[SectionCompletionOut]
    required_missing: list[CompletionFieldItem]
    recommended_missing: list[CompletionFieldItem]
    can_submit: bool
    milestones_reached: list[int]
    scored_fields_total: int
    scored_fields_filled: int


class PlanPatchResponse(BaseModel):
    plan: PlanResponse
    missingFields: list[str] = Field(default_factory=list)


class PlanVersionResponse(BaseModel):
    id: UUID
    plan_id: UUID
    version_number: int
    status_at_snapshot: str
    reason: str
    reason_label: str | None = None
    created_at: datetime
    created_by_id: UUID | None = None
    created_by_email: str | None = None

    class Config:
        from_attributes = True


class PlanVersionDetailResponse(PlanVersionResponse):
    snapshot: dict


class PlanVersionCreate(BaseModel):
    reason: str | None = "manual"


class VersionDiffItem(BaseModel):
    path: str
    old_value: str | None = None
    new_value: str | None = None
    kind: Literal["added", "removed", "changed"]


class PlanVersionDiffResponse(BaseModel):
    version_id: UUID
    version_number: int
    changes: list[VersionDiffItem]
    change_count: int


class VersionRestoreResponse(BaseModel):
    plan_id: UUID
    restored_version_id: UUID
    message: str


class AuditLogEntryResponse(BaseModel):
    id: UUID
    plan_id: UUID
    user_id: UUID | None = None
    user_email: str | None = None
    field_path: str
    old_value: str | None = None
    new_value: str | None = None
    changed_at: datetime

    class Config:
        from_attributes = True


PlanPatchResponse.model_rebuild()
