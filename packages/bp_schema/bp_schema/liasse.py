from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


ALLOWED_TVA_RATES = {0.06, 0.07, 0.13, 0.18, 0.19}
LEGAL_FORMS = {"SARL", "SUARL", "SA"}


class TvaRateItem(BaseModel):
    label: str
    rate: float

    @field_validator("rate")
    @classmethod
    def check_tva(cls, v: float) -> float:
        if v not in ALLOWED_TVA_RATES:
            raise ValueError(f"TVA rate must be one of {sorted(ALLOWED_TVA_RATES)}")
        return v


class TaxRegime(BaseModel):
    tvaRates: list[TvaRateItem] = Field(default_factory=list)


class CompanyInfo(BaseModel):
    name: str = ""
    legalForm: str = "SARL"
    taxRegime: TaxRegime = Field(default_factory=TaxRegime)

    @field_validator("legalForm")
    @classmethod
    def check_legal_form(cls, v: str) -> str:
        if v not in LEGAL_FORMS:
            raise ValueError(f"legalForm must be one of {LEGAL_FORMS}")
        return v


class InvestmentLine(BaseModel):
    label: str
    amount: float = 0.0
    usefulLifeYears: int = 5


class EquipmentItem(BaseModel):
    """Ligne CAPEX détaillée (équipement / immobilisation)."""

    name: str
    cost: float = Field(ge=0, default=0.0)
    usefulLifeYears: int = Field(ge=1, default=5)
    acquisitionYear: int = Field(
        ge=1,
        le=7,
        default=1,
        description="Année du plan (1-7) de mise en service",
    )
    assetType: Literal["intangible", "tangible"] = "tangible"


class Investments(BaseModel):
    """CAPEX : liste d'équipements (prioritaire) + lignes legacy."""

    equipment: list[EquipmentItem] = Field(default_factory=list)
    intangible: list[InvestmentLine] = Field(default_factory=list)
    tangible: list[InvestmentLine] = Field(default_factory=list)


class WasteRate(BaseModel):
    value: float = 0.01
    maxAllowed: float = 0.01


class Operations(BaseModel):
    capacityPerMinute: float = 0.0
    packagesPerMinute: float | None = None
    workingDaysPerYear: float = 250.0
    hoursPerDay: float = 8.0
    rawMaterialCost: float = 0.0
    packagingCost: float = 0.0
    salePrice: float = 0.0
    wasteRate: WasteRate = Field(default_factory=WasteRate)
    """Taux de déchet par année (0-6). Si vide, répète wasteRate.value."""

    wasteRateByYear: list[float] = Field(default_factory=list)

    def waste_for_year(self, year_index: int) -> float:
        if self.wasteRateByYear:
            if year_index < len(self.wasteRateByYear):
                return self.wasteRateByYear[year_index]
            return self.wasteRateByYear[-1]
        return self.wasteRate.value


class LoanParams(BaseModel):
    rate: float = 0.083
    years: int = 7
    graceMonthsPrincipal: int = 0
    amount: float | None = None


class Financing(BaseModel):
    equityRatio: float = 0.3
    debtRatio: float = 0.7
    loan: LoanParams = Field(default_factory=LoanParams)

    @model_validator(mode="after")
    def check_ratios(self) -> "Financing":
        total = self.equityRatio + self.debtRatio
        if abs(total - 1.0) > 0.001:
            raise ValueError("equityRatio + debtRatio must equal 1")
        return self


class WorkingCapital(BaseModel):
    clientPaymentDays: int = 30
    supplierPaymentDays: int = 30
    finishedGoodsStockDays: int = 10
    rawMaterialStockDays: int = 30
    packagingStockDays: int = 15


class PersonnelLine(BaseModel):
    role: str
    headcount: int = 0
    annualSalary: float = 0.0


class PlAssumptions(BaseModel):
    commercialDiscount: float = 0.10
    corporateTaxRate: float = 0.25
    otherOperatingCharges: float = 0.0
    """Frais de distribution en % du CA HT (ex. 0.05 = 5 %)."""

    distributionExpensePct: float = Field(ge=0, le=1, default=0.0)
    """Frais de marketing en % du CA HT."""

    marketingExpensePct: float = Field(ge=0, le=1, default=0.0)
    personnel: list[PersonnelLine] = Field(default_factory=list)


class PlanInputs(BaseModel):
    company: CompanyInfo = Field(default_factory=CompanyInfo)
    investments: Investments = Field(default_factory=Investments)
    operations: Operations = Field(default_factory=Operations)
    financing: Financing = Field(default_factory=Financing)
    workingCapital: WorkingCapital = Field(default_factory=WorkingCapital)
    plAssumptions: PlAssumptions = Field(default_factory=PlAssumptions)


class YearlySeries(BaseModel):
    years: list[float] = Field(default_factory=list)


class ProfitabilityIndicators(BaseModel):
    van: float = 0.0
    tri: float | None = None
    drciYears: float | None = None
    discountRate: float = 0.10


class PlanResults(BaseModel):
    revenue: YearlySeries = Field(default_factory=YearlySeries)
    netProfit: YearlySeries = Field(default_factory=YearlySeries)
    operatingCashFlow: YearlySeries = Field(default_factory=YearlySeries)
    cumulativeTreasury: YearlySeries = Field(default_factory=YearlySeries)
    bfr: YearlySeries = Field(default_factory=YearlySeries)
    bfrVariation: YearlySeries = Field(default_factory=YearlySeries)
    depreciation: YearlySeries = Field(default_factory=YearlySeries)
    distributionExpense: YearlySeries = Field(default_factory=YearlySeries)
    marketingExpense: YearlySeries = Field(default_factory=YearlySeries)
    principalRepayment: YearlySeries = Field(default_factory=YearlySeries)
    interestExpense: YearlySeries = Field(default_factory=YearlySeries)
    totalInvestment: float = 0.0
    indicators: ProfitabilityIndicators = Field(default_factory=ProfitabilityIndicators)
    cashRunwayBreakYear: int | None = None
    balanceSheetBalanced: bool = True
    bfrCoherent: bool = True


class SimulationPatch(BaseModel):
    path: str
    value: Any = None
    multiplier: float | None = None
