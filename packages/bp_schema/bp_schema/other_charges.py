"""Operating expenses (Autres charges) — formula-driven categories."""

from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field

HORIZON = 7


class OtherChargeCategory(str, Enum):
    maintenance = "maintenance"
    management = "management"
    transport = "transport"
    advertising = "advertising"
    rent = "rent"
    fees = "fees"
    travel = "travel"
    insurance = "insurance"
    tfp = "tfp"
    foprolo = "foprolo"
    tcl = "tcl"


class OtherChargeRuleType(str, Enum):
    pct_revenue = "pct_revenue"
    pct_investment = "pct_investment"
    pct_payroll = "pct_payroll"
    fixed_inflation = "fixed_inflation"


class OtherChargesConfig(BaseModel):
    id: UUID | None = None
    plan_id: UUID | None = None
    category: OtherChargeCategory
    rule_type: OtherChargeRuleType
    base_value: float = Field(ge=0, default=0.0)
    rate_or_pct: float = Field(ge=0, default=0.0)
    inflation_rate: float = Field(ge=0, default=0.0)
    enabled: bool = True
    sort_order: int = 0


class CategoryYearAmount(BaseModel):
    category: str
    label: str
    year: int
    amount: float
    rule_type: str


class OtherChargesYearSummary(BaseModel):
    year: int
    total: float
    by_category: dict[str, float] = Field(default_factory=dict)


class OtherChargesProjection(BaseModel):
    plan_id: UUID | None = None
    lf2012_exemption_5y: bool = True
    investment_total: float = 0.0
    revenue_series: list[float] = Field(default_factory=list)
    payroll_series: list[float] = Field(default_factory=list)
    by_year: list[OtherChargesYearSummary] = Field(default_factory=list)
    by_category_year: list[CategoryYearAmount] = Field(default_factory=list)
    total_series: list[float] = Field(default_factory=list)


# Default Excel-aligned presets (rate_or_pct / base_value / inflation)
DEFAULT_OTHER_CHARGES: list[dict] = [
    {
        "category": OtherChargeCategory.maintenance,
        "rule_type": OtherChargeRuleType.pct_investment,
        "rate_or_pct": 0.04,
        "sort_order": 0,
    },
    {
        "category": OtherChargeCategory.management,
        "rule_type": OtherChargeRuleType.pct_revenue,
        "rate_or_pct": 0.005,
        "sort_order": 1,
    },
    {
        "category": OtherChargeCategory.transport,
        "rule_type": OtherChargeRuleType.pct_revenue,
        "rate_or_pct": 0.03,
        "sort_order": 2,
    },
    {
        "category": OtherChargeCategory.advertising,
        "rule_type": OtherChargeRuleType.pct_revenue,
        "rate_or_pct": 0.035,
        "sort_order": 3,
    },
    {
        "category": OtherChargeCategory.rent,
        "rule_type": OtherChargeRuleType.fixed_inflation,
        "base_value": 0.0,
        "inflation_rate": 0.05,
        "sort_order": 4,
    },
    {
        "category": OtherChargeCategory.fees,
        "rule_type": OtherChargeRuleType.fixed_inflation,
        "base_value": 0.0,
        "inflation_rate": 0.05,
        "sort_order": 5,
    },
    {
        "category": OtherChargeCategory.travel,
        "rule_type": OtherChargeRuleType.fixed_inflation,
        "base_value": 0.0,
        "inflation_rate": 0.05,
        "sort_order": 6,
    },
    {
        "category": OtherChargeCategory.insurance,
        "rule_type": OtherChargeRuleType.pct_revenue,
        "rate_or_pct": 0.0011,
        "inflation_rate": 0.03,
        "sort_order": 7,
    },
    {
        "category": OtherChargeCategory.tfp,
        "rule_type": OtherChargeRuleType.pct_payroll,
        "rate_or_pct": 0.01,
        "sort_order": 8,
    },
    {
        "category": OtherChargeCategory.foprolo,
        "rule_type": OtherChargeRuleType.pct_payroll,
        "rate_or_pct": 0.01,
        "sort_order": 9,
    },
    {
        "category": OtherChargeCategory.tcl,
        "rule_type": OtherChargeRuleType.pct_revenue,
        "rate_or_pct": 0.002,
        "sort_order": 10,
    },
]


CATEGORY_LABELS: dict[str, str] = {
    "maintenance": "Frais de maintenance / entretien",
    "management": "Frais de gestion (télécoms, poste)",
    "transport": "Transport sur vente",
    "advertising": "Dépenses publicitaires",
    "rent": "Loyer",
    "fees": "Honoraires (audit, avocat)",
    "travel": "Voyages & déplacements",
    "insurance": "Assurance",
    "tfp": "TFP (taxe formation prof.)",
    "foprolo": "FOPROLOS",
    "tcl": "TCL",
}
