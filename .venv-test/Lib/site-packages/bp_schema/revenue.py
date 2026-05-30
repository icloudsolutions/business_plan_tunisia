"""Multi-product revenue models."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

HORIZON = 7
PRODUCTION_DAY_BASE = 310.0
DEFAULT_GROWTH_Y2_Y7 = 0.15

ProductUnit = Literal["kg", "sachet", "unit", "L", "other"]
CapacityBasis = Literal["units_per_day", "kg_per_month"]


class PlanProduct(BaseModel):
    """Product line for multi-product revenue."""

    id: UUID | None = None
    plan_id: UUID | None = None
    name: str = ""
    unit: ProductUnit = "unit"
    unit_price_sell: float = Field(ge=0, default=0.0)
    ristourne_pct: float = Field(ge=0, le=1, default=0.0, description="Discount % of gross revenue")
    monthly_qty_y1: float = Field(ge=0, default=0.0)
    sort_order: int = 0


class RevenueAssumptions(BaseModel):
    """Per-plan revenue growth and capacity settings."""

    plan_id: UUID | None = None
    nominal_capacity: float = Field(ge=0, default=0.0)
    capacity_basis: CapacityBasis = "units_per_day"
    production_days: float = Field(
        gt=0,
        default=250.0,
        description="Working/production days per year (numerator in qty formula)",
    )
    growth_rate_y2: float = Field(default=DEFAULT_GROWTH_Y2_Y7)
    growth_rate_y3: float = Field(default=DEFAULT_GROWTH_Y2_Y7)
    growth_rate_y4: float = Field(default=DEFAULT_GROWTH_Y2_Y7)
    growth_rate_y5: float = Field(default=DEFAULT_GROWTH_Y2_Y7)
    growth_rate_y6: float = Field(default=DEFAULT_GROWTH_Y2_Y7)
    growth_rate_y7: float = Field(default=DEFAULT_GROWTH_Y2_Y7)

    def growth_rates(self) -> list[float]:
        """Six rates applied from Y2→Y7 (indices 0..5 for year transitions 1→2 … 6→7)."""
        return [
            self.growth_rate_y2,
            self.growth_rate_y3,
            self.growth_rate_y4,
            self.growth_rate_y5,
            self.growth_rate_y6,
            self.growth_rate_y7,
        ]

    @field_validator(
        "growth_rate_y2",
        "growth_rate_y3",
        "growth_rate_y4",
        "growth_rate_y5",
        "growth_rate_y6",
        "growth_rate_y7",
    )
    @classmethod
    def check_growth(cls, v: float) -> float:
        if v < -0.99 or v > 5.0:
            raise ValueError("Growth rate must be between -99% and 500%")
        return v


class ProductYearRevenue(BaseModel):
    year: int = Field(ge=1, le=7)
    quantity: float = 0.0
    revenue_gross: float = 0.0
    ristourne: float = 0.0
    revenue_net: float = 0.0


class ProductRevenueSeries(BaseModel):
    product_id: str
    name: str
    unit: str
    years: list[ProductYearRevenue] = Field(default_factory=list)


class RevenueProjection(BaseModel):
    plan_id: UUID | None = None
    products: list[ProductRevenueSeries] = Field(default_factory=list)
    total_revenue_gross: list[float] = Field(default_factory=list)
    total_revenue_net: list[float] = Field(default_factory=list)
    total_quantity: list[float] = Field(default_factory=list)
    capacity_utilization_pct: list[float] = Field(default_factory=list)
    nominal_capacity_annual: float = 0.0
