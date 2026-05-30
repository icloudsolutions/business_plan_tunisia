"""Balance sheet (bilan prévisionnel) models."""

from uuid import UUID

from pydantic import BaseModel, Field

HORIZON = 7


class BalanceLineItem(BaseModel):
    key: str
    label: str
    amount: float = 0.0
    children: list["BalanceLineItem"] = Field(default_factory=list)


class BalanceSheetSide(BaseModel):
    title: str
    total: float = 0.0
    sections: list[BalanceLineItem] = Field(default_factory=list)


class BalanceSheetRatios(BaseModel):
    endettement: float | None = None
    liquidite: float | None = None
    fonds_roulement: float | None = None
    bfr: float = 0.0
    tresorerie_nette: float = 0.0


class BalanceSheetYear(BaseModel):
    year: int
    assets: BalanceSheetSide
    liabilities: BalanceSheetSide
    total_assets: float = 0.0
    total_liabilities_equity: float = 0.0
    balanced: bool = True
    gap: float = 0.0
    ratios: BalanceSheetRatios = Field(default_factory=BalanceSheetRatios)


class BalanceSheetProjection(BaseModel):
    plan_id: UUID | None = None
    years: list[BalanceSheetYear] = Field(default_factory=list)
    composition_series: dict[str, list[float]] = Field(default_factory=dict)
