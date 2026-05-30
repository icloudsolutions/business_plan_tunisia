"""Financial KPI dashboard models (cockpit home)."""

from pydantic import BaseModel, Field

HORIZON = 7


class PrimaryKpis(BaseModel):
    van: float = 0.0
    tri: float | None = None
    drci_years: float | None = None
    drci_label: str = "—"
    profitability_index: float | None = None
    trc: float | None = None
    discount_rate: float = 0.10
    total_investment: float = 0.0


class AnnualPerformanceYear(BaseModel):
    year: int
    revenue: float = 0.0
    ebit: float = 0.0
    net_profit: float = 0.0
    gross_margin_pct: float = 0.0
    net_margin_pct: float = 0.0
    ebe: float = 0.0


class CapacityEfficiency(BaseModel):
    capacity_utilization_pct: list[float] = Field(default_factory=list)
    break_even_revenue: float = 0.0
    y1_revenue: float = 0.0
    distance_above_break_even_pct: float = 0.0
    break_even_callout: str = ""


class FinancingYear(BaseModel):
    year: int
    debt_ratio: float = 0.0
    dscr: float | None = None
    remaining_debt: float = 0.0
    ebitda: float = 0.0
    debt_service: float = 0.0


class Financability(BaseModel):
    is_financable: bool = False
    label: str = "Non finançable"
    checks: dict[str, bool] = Field(default_factory=dict)


class KpiDashboardProjection(BaseModel):
    scenario: str = "base"
    primary: PrimaryKpis = Field(default_factory=PrimaryKpis)
    annual_performance: list[AnnualPerformanceYear] = Field(default_factory=list)
    capacity: CapacityEfficiency = Field(default_factory=CapacityEfficiency)
    financing: list[FinancingYear] = Field(default_factory=list)
    financability: Financability = Field(default_factory=Financability)
    chart_revenue_profit: list[dict] = Field(default_factory=list)
    chart_margins: list[dict] = Field(default_factory=list)
    chart_capacity: list[dict] = Field(default_factory=list)
    chart_debt_coverage: list[dict] = Field(default_factory=list)
