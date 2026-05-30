"""Plan loan tranches and amortization schedules."""

from datetime import date
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field

HORIZON = 7
MAX_LOANS_PER_PLAN = 3
DEFAULT_LOAN_RATE = 0.083
DEFAULT_TERM_YEARS = 7
DEFAULT_GRACE_MONTHS = 12


class LoanFrequency(str, Enum):
    quarterly = "quarterly"
    annual = "annual"


class PlanLoan(BaseModel):
    id: UUID | None = None
    plan_id: UUID | None = None
    lender_name: str = ""
    amount: float = Field(ge=0, default=0.0)
    rate: float = Field(ge=0, le=1, default=DEFAULT_LOAN_RATE)
    term_years: int = Field(ge=1, le=30, default=DEFAULT_TERM_YEARS)
    grace_months: int = Field(ge=0, le=120, default=DEFAULT_GRACE_MONTHS)
    start_date: date | None = None
    frequency: LoanFrequency = LoanFrequency.quarterly
    sort_order: int = 0


class AmortizationPeriod(BaseModel):
    period: int
    date: str
    opening_balance: float
    payment: float
    principal: float
    interest: float
    closing_balance: float
    in_grace: bool


class LoanAnnualSummary(BaseModel):
    year: int
    interest: float
    principal: float
    debt_service: float
    ending_balance: float


class LoanScheduleProjection(BaseModel):
    loan_id: str | None = None
    lender_name: str = ""
    amount: float = 0.0
    rate: float = 0.0
    term_years: int = 7
    grace_months: int = 0
    frequency: str = "quarterly"
    periods: list[AmortizationPeriod] = Field(default_factory=list)
    annual: list[LoanAnnualSummary] = Field(default_factory=list)


class CombinedLoanProjection(BaseModel):
    plan_id: UUID | None = None
    loans: list[LoanScheduleProjection] = Field(default_factory=list)
    annual_interest: list[float] = Field(default_factory=list)
    annual_principal: list[float] = Field(default_factory=list)
    annual_debt_service: list[float] = Field(default_factory=list)
    annual_ending_balance: list[float] = Field(default_factory=list)
