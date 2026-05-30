"""Per-product unit cost components and projections."""

from uuid import UUID

from pydantic import BaseModel, Field

HORIZON = 7
DEFAULT_MARGIN_ALERT_PCT = 0.20


class ProductCostComponents(BaseModel):
    """Editable cost grid per product and year (Y1–Y7)."""

    id: UUID | None = None
    plan_id: UUID | None = None
    product_id: UUID | None = None
    year: int = Field(ge=1, le=7, default=1)
    mp_price_per_kg: float = Field(ge=0, default=0.0)
    arome_rate_pct: float = Field(ge=0, le=1, default=0.0)
    packaging_g_per_unit: float = Field(ge=0, default=1000.0, description="Grams per sellable unit")
    packaging_price_per_kg: float = Field(ge=0, default=0.0)
    gas_monthly: float = Field(ge=0, default=0.0)
    electricity_monthly: float = Field(ge=0, default=0.0)
    water_monthly: float = Field(ge=0, default=0.0)
    waste_pct: float = Field(ge=0, le=1, default=0.0)


class CostAllocationContext(BaseModel):
    """Auto-filled from HR / investments + revenue quantities."""

    annual_payroll: float = 0.0
    annual_depreciation: float = 0.0
    total_production_kg: float = 0.0
    production_kg_product: float = 0.0
    annual_quantity_units: float = 0.0


class CostComponentBreakdown(BaseModel):
    mp: float = 0.0
    arome: float = 0.0
    packaging: float = 0.0
    utilities: float = 0.0
    labor: float = 0.0
    depreciation: float = 0.0
    waste: float = 0.0


class ProductUnitCostResult(BaseModel):
    product_id: str
    name: str
    year: int
    unit: str
    sell_price: float = 0.0
    unit_cost: float = 0.0
    gross_margin_per_unit: float = 0.0
    gross_margin_rate: float | None = None
    breakdown: CostComponentBreakdown = Field(default_factory=CostComponentBreakdown)
    breakdown_pct: dict[str, float] = Field(default_factory=dict)
    margin_alert: bool = False
    weight_kg_per_unit: float = 1.0


class PlanCostProjection(BaseModel):
    plan_id: UUID | None = None
    year: int = 1
    margin_alert_threshold: float = DEFAULT_MARGIN_ALERT_PCT
    allocation: CostAllocationContext = Field(default_factory=CostAllocationContext)
    products: list[ProductUnitCostResult] = Field(default_factory=list)
