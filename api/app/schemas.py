from datetime import date, datetime
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


class PlanProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    unit: str = Field(default="unit", pattern="^(kg|sachet|unit|L|other)$")
    unit_price_sell: float = Field(ge=0, default=0)
    ristourne_pct: float = Field(ge=0, le=1, default=0)
    monthly_qty_y1: float = Field(ge=0, default=0)
    sort_order: int | None = None


class PlanProductUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    unit: str | None = Field(None, pattern="^(kg|sachet|unit|L|other)$")
    unit_price_sell: float | None = Field(None, ge=0)
    ristourne_pct: float | None = Field(None, ge=0, le=1)
    monthly_qty_y1: float | None = Field(None, ge=0)
    sort_order: int | None = None


class PlanProductResponse(BaseModel):
    id: UUID
    plan_id: UUID
    name: str
    unit: str
    unit_price_sell: float
    ristourne_pct: float
    monthly_qty_y1: float
    sort_order: int
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class RevenueAssumptionsUpdate(BaseModel):
    nominal_capacity: float | None = Field(None, ge=0)
    capacity_basis: str | None = Field(None, pattern="^(units_per_day|kg_per_month)$")
    production_days: float | None = Field(None, gt=0)
    growth_rate_y2: float | None = None
    growth_rate_y3: float | None = None
    growth_rate_y4: float | None = None
    growth_rate_y5: float | None = None
    growth_rate_y6: float | None = None
    growth_rate_y7: float | None = None


class RevenueAssumptionsResponse(BaseModel):
    plan_id: UUID
    nominal_capacity: float
    capacity_basis: str
    production_days: float
    growth_rate_y2: float
    growth_rate_y3: float
    growth_rate_y4: float
    growth_rate_y5: float
    growth_rate_y6: float
    growth_rate_y7: float
    projection_cache: dict | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class ProductYearRevenueResponse(BaseModel):
    year: int
    quantity: float
    revenue_gross: float
    ristourne: float
    revenue_net: float


class ProductRevenueSeriesResponse(BaseModel):
    product_id: str
    name: str
    unit: str
    years: list[ProductYearRevenueResponse]


class RevenueProjectionResponse(BaseModel):
    plan_id: UUID | None = None
    products: list[ProductRevenueSeriesResponse]
    total_revenue_gross: list[float]
    total_revenue_net: list[float]
    total_quantity: list[float]
    capacity_utilization_pct: list[float]
    nominal_capacity_annual: float

    @classmethod
    def from_projection(cls, p: "RevenueProjection") -> "RevenueProjectionResponse":
        from bp_schema.revenue import RevenueProjection

        return cls(
            plan_id=p.plan_id,
            products=[
                {
                    "product_id": s.product_id,
                    "name": s.name,
                    "unit": s.unit,
                    "years": [y.model_dump() for y in s.years],
                }
                for s in p.products
            ],
            total_revenue_gross=p.total_revenue_gross,
            total_revenue_net=p.total_revenue_net,
            total_quantity=p.total_quantity,
            capacity_utilization_pct=p.capacity_utilization_pct,
            nominal_capacity_annual=p.nominal_capacity_annual,
        )


class CostComponentUpsert(BaseModel):
    product_id: UUID | None = None
    year: int | None = Field(None, ge=1, le=7)
    mp_price_per_kg: float | None = Field(None, ge=0)
    arome_rate_pct: float | None = Field(None, ge=0, le=1)
    packaging_g_per_unit: float | None = Field(None, ge=0)
    packaging_price_per_kg: float | None = Field(None, ge=0)
    gas_monthly: float | None = Field(None, ge=0)
    electricity_monthly: float | None = Field(None, ge=0)
    water_monthly: float | None = Field(None, ge=0)
    waste_pct: float | None = Field(None, ge=0, le=1)


class CostComponentBulkItem(CostComponentUpsert):
    product_id: UUID
    year: int = Field(ge=1, le=7)


class CostComponentBulkUpdate(BaseModel):
    items: list[CostComponentBulkItem]


class CostComponentResponse(BaseModel):
    id: UUID
    plan_id: UUID
    product_id: UUID
    year: int
    mp_price_per_kg: float
    arome_rate_pct: float
    packaging_g_per_unit: float
    packaging_price_per_kg: float
    gas_monthly: float
    electricity_monthly: float
    water_monthly: float
    waste_pct: float

    class Config:
        from_attributes = True


class CostAutofillResponse(BaseModel):
    annual_payroll: float
    annual_depreciation_y1: float
    depreciation_by_year: list[float]
    total_capex: float
    suggested_mp_price_per_kg: float
    suggested_packaging_price_per_kg: float
    suggested_waste_pct: float
    products: list[dict]


class PlanCostProjectionResponse(BaseModel):
    year: int = 1
    projection: dict | None = None
    years: list[dict] | None = None


class StaffRoleCreate(BaseModel):
    function_name: str = Field(min_length=1, max_length=255)
    qualification: str = Field(default="", max_length=128)
    is_production_imputable: bool = True
    base_monthly_salary: float = Field(ge=0, default=0)
    annual_raise_rate_override: float | None = Field(None, ge=0, le=1)
    sort_order: int | None = None
    headcount_y1: int = Field(ge=0, default=1)


class StaffRoleUpdate(BaseModel):
    function_name: str | None = Field(None, min_length=1, max_length=255)
    qualification: str | None = None
    is_production_imputable: bool | None = None
    base_monthly_salary: float | None = Field(None, ge=0)
    annual_raise_rate_override: float | None = None
    sort_order: int | None = None


class StaffRoleResponse(BaseModel):
    id: UUID
    plan_id: UUID
    function_name: str
    qualification: str
    is_production_imputable: bool
    base_monthly_salary: float
    annual_raise_rate_override: float | None
    sort_order: int
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class HeadcountBulkItem(BaseModel):
    staff_role_id: UUID
    year: int = Field(ge=1, le=7)
    headcount: int = Field(ge=0)


class HeadcountBulkUpdate(BaseModel):
    items: list[HeadcountBulkItem]


class HeadcountEntryResponse(BaseModel):
    id: UUID
    staff_role_id: UUID
    function_name: str
    year: int
    headcount: int


class PayrollAssumptionsUpdate(BaseModel):
    annual_raise_rate: float | None = Field(None, ge=0, le=1)
    cnss_employer_rate: float | None = Field(None, ge=0, le=1)


class PayrollAssumptionsResponse(BaseModel):
    plan_id: UUID
    annual_raise_rate: float
    cnss_employer_rate: float
    projection_cache: dict | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class PayrollProjectionResponse(BaseModel):
    projection: dict


class PayrollSyncResponse(BaseModel):
    message: str
    personnel_count: int
    imputable_y1: float
    non_imputable_y1: float


class OtherChargesConfigResponse(BaseModel):
    id: UUID
    plan_id: UUID
    category: str
    rule_type: str
    base_value: float
    rate_or_pct: float
    inflation_rate: float
    enabled: bool
    sort_order: int

    class Config:
        from_attributes = True


class OtherChargesConfigUpdate(BaseModel):
    rule_type: str | None = None
    base_value: float | None = Field(None, ge=0)
    rate_or_pct: float | None = Field(None, ge=0)
    inflation_rate: float | None = Field(None, ge=0)
    enabled: bool | None = None
    sort_order: int | None = None


class OtherChargesConfigBulkItem(OtherChargesConfigUpdate):
    id: UUID


class OtherChargesConfigBulkRequest(BaseModel):
    items: list[OtherChargesConfigBulkItem]


class OtherChargesSettingsResponse(BaseModel):
    plan_id: UUID
    lf2012_exemption_5y: bool
    projection_cache: dict | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class OtherChargesSettingsUpdate(BaseModel):
    lf2012_exemption_5y: bool | None = None


class OtherChargesProjectionResponse(BaseModel):
    projection: dict


class OtherChargesSyncResponse(BaseModel):
    message: str
    other_operating_charges_y1: float


class TvaConfigResponse(BaseModel):
    id: UUID
    plan_id: UUID
    category: str
    applies_to: str
    label: str
    tva_rate_purchase: float
    tva_rate_sales: float
    enabled: bool
    sort_order: int

    class Config:
        from_attributes = True


class TvaConfigUpdate(BaseModel):
    label: str | None = None
    tva_rate_purchase: float | None = Field(None, ge=0, le=0.19)
    tva_rate_sales: float | None = Field(None, ge=0, le=0.19)
    enabled: bool | None = None
    sort_order: int | None = None


class TvaConfigBulkItem(TvaConfigUpdate):
    id: UUID


class TvaConfigBulkRequest(BaseModel):
    items: list[TvaConfigBulkItem]


class TvaSettingsResponse(BaseModel):
    plan_id: UUID
    carton_share_of_packaging: float
    projection_cache: dict | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class TvaSettingsUpdate(BaseModel):
    carton_share_of_packaging: float | None = Field(None, ge=0, le=1)


class TvaProjectionResponse(BaseModel):
    projection: dict


class PlanLoanCreate(BaseModel):
    lender_name: str = Field(default="", max_length=255)
    amount: float = Field(ge=0, default=0)
    rate: float = Field(ge=0, le=1, default=0.083)
    term_years: int = Field(ge=1, le=30, default=7)
    grace_months: int = Field(ge=0, le=120, default=12)
    start_date: date | None = None
    frequency: str = Field(default="quarterly", pattern="^(quarterly|annual)$")
    sort_order: int | None = None


class PlanLoanUpdate(BaseModel):
    lender_name: str | None = Field(None, max_length=255)
    amount: float | None = Field(None, ge=0)
    rate: float | None = Field(None, ge=0, le=1)
    term_years: int | None = Field(None, ge=1, le=30)
    grace_months: int | None = Field(None, ge=0, le=120)
    start_date: date | None = None
    frequency: str | None = Field(None, pattern="^(quarterly|annual)$")
    sort_order: int | None = None


class PlanLoanResponse(BaseModel):
    id: UUID
    plan_id: UUID
    lender_name: str
    amount: float
    rate: float
    term_years: int
    grace_months: int
    start_date: date | None
    frequency: str
    sort_order: int
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class LoanProjectionResponse(BaseModel):
    projection: dict


class LoanSyncResponse(BaseModel):
    message: str
    loan_count: int
    primary_amount: float


class BalanceSheetResponse(BaseModel):
    scenario: str = "base"
    projection: dict


class CashFlowProjectionResponse(BaseModel):
    scenario: str = "base"
    bfr_client_days: int = 30
    projection: dict


class KpiDashboardResponse(BaseModel):
    scenario: str = "base"
    projection: dict


class FinancingSourceResponse(BaseModel):
    id: UUID
    plan_id: UUID
    source_type: str
    label: str
    amount: float
    rate: float
    term_years: int
    grace_months: int
    sort_order: int
    loan_id: UUID | None = None

    model_config = {"from_attributes": True}


class FinancingSourceCreate(BaseModel):
    source_type: str = "autre"
    label: str
    amount: float = 0.0
    rate: float = 0.0
    term_years: int = 7
    grace_months: int = 12
    sort_order: int | None = None


class FinancingSourceUpdate(BaseModel):
    label: str | None = None
    amount: float | None = None
    rate: float | None = None
    term_years: int | None = None
    grace_months: int | None = None
    sort_order: int | None = None


class FinancingStructureResponse(BaseModel):
    projection: dict


class FinancingSyncResponse(BaseModel):
    message: str
    projection: dict


class PricingGridResponse(BaseModel):
    id: UUID
    plan_id: UUID
    product_id: UUID
    purchase_price_per_kg: float
    sell_price_per_unit: float
    sell_price_per_kg: float
    market_retail_price: float
    ristourne_pct: float
    unit_weight_g: float

    model_config = {"from_attributes": True}


class PricingGridUpdate(BaseModel):
    purchase_price_per_kg: float | None = Field(None, ge=0)
    sell_price_per_unit: float | None = Field(None, ge=0)
    sell_price_per_kg: float | None = Field(None, ge=0)
    market_retail_price: float | None = Field(None, ge=0)
    ristourne_pct: float | None = Field(None, ge=0, le=1)
    unit_weight_g: float | None = Field(None, ge=0)


class PricingProjectionResponse(BaseModel):
    projection: dict


class PricingSyncResponse(BaseModel):
    message: str
    projection: dict


PlanPatchResponse.model_rebuild()
