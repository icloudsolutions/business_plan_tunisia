"""Sell-price grid with market comparison."""

from uuid import UUID

from pydantic import BaseModel, Field


class PricingGridRow(BaseModel):
    id: UUID | None = None
    plan_id: UUID | None = None
    product_id: UUID | None = None
    purchase_price_per_kg: float = Field(ge=0, default=0.0)
    sell_price_per_unit: float = Field(ge=0, default=0.0)
    sell_price_per_kg: float = Field(ge=0, default=0.0)
    market_retail_price: float = Field(ge=0, default=0.0)
    ristourne_pct: float = Field(ge=0, le=1, default=0.0)
    unit_weight_g: float = Field(ge=0, default=1000.0, description="Net weight per sell unit (g)")


class PricingRowComputed(BaseModel):
    product_id: UUID | None = None
    product_name: str = ""
    unit: str = "unit"
    purchase_price_per_kg: float = 0.0
    sell_price_per_unit: float = 0.0
    sell_price_per_kg: float = 0.0
    market_retail_price: float = 0.0
    ristourne_pct: float = 0.0
    unit_weight_g: float = 1000.0
    price_to_reseller: float = 0.0
    gross_margin_per_kg: float = 0.0
    gross_margin_unit: float = 0.0
    gross_margin_pct: float | None = None
    gross_margin_vs_market: float = 0.0
    competitiveness_ratio: float | None = None
    below_market_pct: float | None = None
    margin_band: str = "unknown"
    is_competitive: bool = True


class PricingChartBar(BaseModel):
    product_id: UUID | None = None
    product_name: str = ""
    cost: float = 0.0
    producer_margin: float = 0.0
    reseller_margin: float = 0.0
    shelf_price: float = 0.0


class PricingProjection(BaseModel):
    plan_id: UUID | None = None
    rows: list[PricingRowComputed] = Field(default_factory=list)
    chart_bars: list[PricingChartBar] = Field(default_factory=list)
