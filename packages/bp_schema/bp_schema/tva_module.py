"""TVA reconciliation models (Liasse Unique / Tunisian fiscal)."""

from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field

HORIZON = 7

AppliesToScope = str  # product UUID or system scope key


class TvaSystemScope(str, Enum):
    all_equipment = "all_equipment"
    packaging = "packaging"
    arome = "arome"
    cartons = "cartons"
    utilities = "utilities"
    other_charges = "other_charges"


class TvaConfigCategory(str, Enum):
    product = "product"
    packaging = "packaging"
    arome = "arome"
    cartons = "cartons"
    equipment = "equipment"
    utilities = "utilities"
    other_charges = "other_charges"


class TvaConfig(BaseModel):
    id: UUID | None = None
    plan_id: UUID | None = None
    category: TvaConfigCategory | str
    applies_to: str = Field(
        description="product_id UUID or system scope (all_equipment, packaging, …)",
    )
    label: str = ""
    tva_rate_purchase: float = Field(ge=0, le=0.19, default=0.18)
    tva_rate_sales: float = Field(ge=0, le=0.19, default=0.18)
    enabled: bool = True
    sort_order: int = 0


class TvaLineAmount(BaseModel):
    """HT | TVA | TTC for one line and year."""

    line_key: str
    label: str
    year: int
    flow: str  # sales | purchase
    ht: float
    tva: float
    ttc: float
    tva_rate: float


class TvaYearBalance(BaseModel):
    year: int
    tva_collectee: float
    tva_deductible: float
    solde_tva: float
    is_credit: bool
    collectee_by_line: dict[str, float] = Field(default_factory=dict)
    deductible_by_line: dict[str, float] = Field(default_factory=dict)
    sales_ht: float = 0.0
    sales_ttc: float = 0.0
    purchases_ht: float = 0.0
    purchases_ttc: float = 0.0
    supplier_payables: float = 0.0
    customer_receivables: float = 0.0


class TvaProjection(BaseModel):
    plan_id: UUID | None = None
    by_year: list[TvaYearBalance] = Field(default_factory=list)
    line_items: list[TvaLineAmount] = Field(default_factory=list)
    collectee_series: list[float] = Field(default_factory=list)
    deductible_series: list[float] = Field(default_factory=list)
    solde_series: list[float] = Field(default_factory=list)
    supplier_payables_series: list[float] = Field(default_factory=list)
    customer_receivables_series: list[float] = Field(default_factory=list)


TVA_PROFILE_MAIZE = (0.06, 0.06)
TVA_PROFILE_DRIED_FRUIT = (0.06, 0.18)
TVA_PROFILE_STANDARD = (0.18, 0.18)

SYSTEM_DEFAULTS: list[dict] = [
    {
        "category": TvaConfigCategory.equipment,
        "applies_to": TvaSystemScope.all_equipment.value,
        "label": "Équipements importés",
        "tva_rate_purchase": 0.06,
        "tva_rate_sales": 0.0,
        "sort_order": 100,
    },
    {
        "category": TvaConfigCategory.packaging,
        "applies_to": TvaSystemScope.packaging.value,
        "label": "Emballages",
        "tva_rate_purchase": 0.18,
        "tva_rate_sales": 0.0,
        "sort_order": 101,
    },
    {
        "category": TvaConfigCategory.arome,
        "applies_to": TvaSystemScope.arome.value,
        "label": "Arômes",
        "tva_rate_purchase": 0.18,
        "tva_rate_sales": 0.0,
        "sort_order": 102,
    },
    {
        "category": TvaConfigCategory.cartons,
        "applies_to": TvaSystemScope.cartons.value,
        "label": "Cartons",
        "tva_rate_purchase": 0.18,
        "tva_rate_sales": 0.0,
        "sort_order": 103,
    },
    {
        "category": TvaConfigCategory.utilities,
        "applies_to": TvaSystemScope.utilities.value,
        "label": "Énergie & fluides",
        "tva_rate_purchase": 0.18,
        "tva_rate_sales": 0.0,
        "sort_order": 104,
    },
    {
        "category": TvaConfigCategory.other_charges,
        "applies_to": TvaSystemScope.other_charges.value,
        "label": "Autres charges d'exploitation",
        "tva_rate_purchase": 0.18,
        "tva_rate_sales": 0.0,
        "sort_order": 105,
    },
]


def guess_product_tva_profile(product_name: str) -> tuple[float, float]:
    n = (product_name or "").lower()
    if "maïs" in n or "mais" in n or "maï" in n:
        return TVA_PROFILE_MAIZE
    for token in ("noisette", "pistache", "amande", "noix", "sèche", "seche"):
        if token in n:
            return TVA_PROFILE_DRIED_FRUIT
    return TVA_PROFILE_STANDARD
