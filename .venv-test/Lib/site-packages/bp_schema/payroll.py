"""Payroll planning models (staff roles, headcount Y1–Y7, CNSS)."""

from uuid import UUID

from pydantic import BaseModel, Field

HORIZON = 7
DEFAULT_ANNUAL_RAISE_RATE = 0.06
DEFAULT_CNSS_EMPLOYER_RATE = 0.1897


class StaffRole(BaseModel):
    id: UUID | None = None
    plan_id: UUID | None = None
    function_name: str = ""
    qualification: str = ""
    is_production_imputable: bool = True
    base_monthly_salary: float = Field(ge=0, default=0.0)
    annual_raise_rate_override: float | None = Field(
        default=None,
        description="Per-role raise override; None uses plan default",
    )
    sort_order: int = 0


class HeadcountEntry(BaseModel):
    staff_role_id: UUID
    year: int = Field(ge=1, le=7)
    headcount: int = Field(ge=0, default=0)


class PayrollAssumptions(BaseModel):
    plan_id: UUID | None = None
    annual_raise_rate: float = Field(default=DEFAULT_ANNUAL_RAISE_RATE)
    cnss_employer_rate: float = Field(default=DEFAULT_CNSS_EMPLOYER_RATE)


class StaffRoleYearPayroll(BaseModel):
    staff_role_id: str
    function_name: str
    qualification: str
    is_production_imputable: bool
    year: int
    headcount: int
    monthly_salary: float
    annual_gross: float
    cnss: float
    total_cost: float
    raise_rate_applied: float


class PayrollYearSummary(BaseModel):
    year: int
    total_headcount: int
    annual_gross: float
    cnss: float
    total_payroll: float
    imputable_cost: float
    non_imputable_cost: float


class PayrollProjection(BaseModel):
    plan_id: UUID | None = None
    assumptions: PayrollAssumptions = Field(default_factory=PayrollAssumptions)
    by_year: list[PayrollYearSummary] = Field(default_factory=list)
    by_role_year: list[StaffRoleYearPayroll] = Field(default_factory=list)
    headcount_series: list[int] = Field(default_factory=list)
    total_payroll_series: list[float] = Field(default_factory=list)
    cnss_series: list[float] = Field(default_factory=list)
    imputable_series: list[float] = Field(default_factory=list)
    non_imputable_series: list[float] = Field(default_factory=list)
