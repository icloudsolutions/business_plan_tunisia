"""Plan financing structure: sources, validation, eligibility."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

FinancingSourceType = Literal[
    "fonds_propres",
    "cmt",
    "leasing",
    "subvention",
    "autre",
]

MIN_EQUITY_RATIO_BANK = 0.25


class FinancingSource(BaseModel):
    id: UUID | None = None
    plan_id: UUID | None = None
    source_type: FinancingSourceType = "fonds_propres"
    label: str = ""
    amount: float = Field(ge=0, default=0.0)
    rate: float = Field(ge=0, le=1, default=0.0)
    term_years: int = Field(ge=0, le=30, default=7)
    grace_months: int = Field(ge=0, le=120, default=12)
    sort_order: int = 0
    loan_id: UUID | None = None


class InvestmentBreakdown(BaseModel):
    fixed_assets_total: float = 0.0
    initial_bfr: float = 0.0
    total_financing_need: float = 0.0


class FinancingSummary(BaseModel):
    total_investment: float = 0.0
    initial_bfr: float = 0.0
    total_financing_need: float = 0.0
    total_sources_amount: float = 0.0
    gap: float = 0.0
    is_balanced: bool = False
    equity_amount: float = 0.0
    debt_amount: float = 0.0
    subvention_amount: float = 0.0
    equity_ratio: float = 0.0
    debt_ratio: float = 0.0
    meets_bank_equity_minimum: bool = False
    min_equity_ratio_required: float = MIN_EQUITY_RATIO_BANK
    structure_status: str = "non_conforme"
    structure_label: str = "Non conforme"


class EligibilityProgram(BaseModel):
    key: str
    name: str
    description: str
    criteria: list[str] = Field(default_factory=list)
    eligible: bool = False
    reasons: list[str] = Field(default_factory=list)


class FinancingStructureProjection(BaseModel):
    plan_id: UUID | None = None
    investment: InvestmentBreakdown = Field(default_factory=InvestmentBreakdown)
    summary: FinancingSummary = Field(default_factory=FinancingSummary)
    sources: list[FinancingSource] = Field(default_factory=list)
    chart_structure: list[dict] = Field(default_factory=list)
    eligibility_programs: list[EligibilityProgram] = Field(default_factory=list)
    indicators: dict = Field(default_factory=dict)
