"""Annual cash flow statement models."""

from uuid import UUID

from pydantic import BaseModel, Field

HORIZON = 7


class BfrComponents(BaseModel):
    year: int
    revenue_ht: float = 0.0
    revenue_ttc: float = 0.0
    client_receivables: float = 0.0
    stocks: float = 0.0
    raw_stock: float = 0.0
    packaging_stock: float = 0.0
    finished_stock: float = 0.0
    arome_stock: float = 0.0
    supplier_payables: float = 0.0
    total_bfr: float = 0.0
    bfr_variation: float = 0.0


class CashFlowYearRow(BaseModel):
    year: int
    label: str
    operating_cf: float = 0.0
    equity_inflow: float = 0.0
    debt_drawdown: float = 0.0
    initial_investment: float = 0.0
    bfr_variation: float = 0.0
    principal_repayment: float = 0.0
    bfr_recovery: float = 0.0
    net_book_value_recovery: float = 0.0
    net_cash_flow: float = 0.0
    cumulative_treasury: float = 0.0


class CashFlowProjection(BaseModel):
    plan_id: UUID | None = None
    scenario: str = "base"
    bfr_client_days: int = 30
    rows: list[CashFlowYearRow] = Field(default_factory=list)
    bfr_series: list[BfrComponents] = Field(default_factory=list)
    treasury_break_even_year: int | None = None
    chart_waterfall: list[dict] = Field(default_factory=list)
    composition_bfr: dict[str, list[float]] = Field(default_factory=dict)
