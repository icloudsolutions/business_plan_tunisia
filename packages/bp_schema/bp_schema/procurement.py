"""Procurement planning: raw materials, recipes, purchase projections."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

HORIZON = 7

RawMaterialUnit = Literal["kg", "litre", "unit", "L", "other"]
RawMaterialCategory = Literal["mp", "arome", "packaging", "other"]


class RawMaterial(BaseModel):
    id: UUID | None = None
    plan_id: UUID | None = None
    name: str = ""
    unit: RawMaterialUnit = "kg"
    category: RawMaterialCategory = "mp"
    price_per_unit: float = Field(ge=0, default=0.0)
    supplier_payment_days: int = Field(default=30, ge=0, le=365)
    tva_rate: float = Field(ge=0, le=0.19, default=0.18)
    annual_price_inflation_pct: float = Field(ge=0, le=1, default=0.0)
    sort_order: int = 0


class ProductRecipe(BaseModel):
    product_id: UUID
    raw_material_id: UUID
    quantity_per_kg_product: float = Field(
        ge=0,
        default=0.0,
        description="kg of raw material per kg of finished product",
    )


class PurchaseAssumption(BaseModel):
    raw_material_id: UUID
    stock_days: int = Field(default=30, ge=0, le=365)


class ProcurementYearCell(BaseModel):
    year: int
    annual_consumption: float = 0.0
    opening_stock: float = 0.0
    closing_stock: float = 0.0
    purchases_qty: float = 0.0
    purchase_value_ht: float = 0.0
    supplier_payable: float = 0.0
    unit_price: float = 0.0


class MaterialProcurementRow(BaseModel):
    raw_material_id: str
    name: str
    unit: str
    category: RawMaterialCategory
    stock_days: int = 30
    years: list[ProcurementYearCell] = Field(default_factory=list)
    consumption_by_product: dict[str, list[float]] = Field(
        default_factory=dict,
        description="product_id -> annual consumption qty per year",
    )


class ProcurementProjection(BaseModel):
    plan_id: UUID | None = None
    materials: list[RawMaterial] = Field(default_factory=list)
    recipes: list[ProductRecipe] = Field(default_factory=list)
    assumptions: list[PurchaseAssumption] = Field(default_factory=list)
    rows: list[MaterialProcurementRow] = Field(default_factory=list)
    totals_by_year: list[dict] = Field(default_factory=list)
    composition_by_category: dict[str, float] = Field(default_factory=dict)
    chart_donut: list[dict] = Field(default_factory=list)
    chart_trend: list[dict] = Field(default_factory=list)
