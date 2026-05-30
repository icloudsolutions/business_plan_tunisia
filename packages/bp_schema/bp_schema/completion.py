"""Liasse section completion rules (required / recommended / optional)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Literal

from bp_schema.liasse import PlanInputs

FieldTier = Literal["required", "recommended", "optional"]
SectionId = Literal["general", "investments", "financing", "operations", "hr", "financial"]
SectionStatus = Literal["complete", "warning", "incomplete"]


@dataclass(frozen=True)
class FieldRule:
    path: str
    section: SectionId
    tier: FieldTier
    label_fr: str
    label_ar: str
    check: Callable[[PlanInputs], bool]


def _total_capex(inputs: PlanInputs) -> float:
    inv = inputs.investments
    return (
        sum(e.cost for e in inv.equipment)
        + sum(i.amount for i in inv.intangible)
        + sum(i.amount for i in inv.tangible)
    )


def _has_capacity(inputs: PlanInputs) -> bool:
    op = inputs.operations
    if op.capacityPerMinute > 0:
        return True
    return op.packagesPerMinute is not None and op.packagesPerMinute > 0


def _waste_valid(inputs: PlanInputs) -> bool:
    op = inputs.operations
    max_w = op.wasteRate.maxAllowed
    if op.wasteRateByYear:
        return all(0 <= r <= max_w for r in op.wasteRateByYear)
    v = op.wasteRate.value
    return 0 <= v <= max_w


def _personnel_active(inputs: PlanInputs) -> bool:
    return any(p.headcount > 0 and p.role.strip() for p in inputs.plAssumptions.personnel)


def _financing_balanced(inputs: PlanInputs) -> bool:
    return abs(inputs.financing.equityRatio + inputs.financing.debtRatio - 1.0) <= 0.01


SECTION_TITLES: dict[SectionId, tuple[str, str]] = {
    "general": ("Informations générales", "معلومات عامة"),
    "investments": ("Investissements", "الاستثمارات"),
    "financing": ("Financement", "التمويل"),
    "operations": ("Exploitation", "الاستغلال"),
    "hr": ("Ressources humaines", "الموارد البشرية"),
    "financial": ("Indicateurs financiers", "المؤشرات المالية"),
}

FIELD_RULES: list[FieldRule] = [
    # --- general ---
    FieldRule(
        "company.name",
        "general",
        "required",
        "Raison sociale",
        "الاسم التجاري",
        lambda i: len(i.company.name.strip()) >= 2,
    ),
    FieldRule(
        "company.legalForm",
        "general",
        "recommended",
        "Forme juridique",
        "الشكل القانوني",
        lambda i: i.company.legalForm in ("SARL", "SUARL", "SA"),
    ),
    # --- investments ---
    FieldRule(
        "investments.equipment",
        "investments",
        "required",
        "Investissements (CAPEX)",
        "الاستثمارات",
        lambda i: _total_capex(i) > 0,
    ),
    FieldRule(
        "investments.equipment.detail",
        "investments",
        "recommended",
        "Au moins un équipement nommé",
        "معدات مسماة",
        lambda i: any(e.name.strip() and e.cost > 0 for e in i.investments.equipment),
    ),
    # --- financing ---
    FieldRule(
        "financing.equityRatio",
        "financing",
        "required",
        "Répartition fonds propres / dette",
        "نسبة التمويل",
        _financing_balanced,
    ),
    FieldRule(
        "financing.loan.rate",
        "financing",
        "required",
        "Taux d'intérêt emprunt",
        "سعر الفائدة",
        lambda i: i.financing.loan.rate > 0,
    ),
    FieldRule(
        "financing.loan.years",
        "financing",
        "recommended",
        "Durée emprunt (années)",
        "مدة القرض",
        lambda i: i.financing.loan.years >= 1,
    ),
    # --- operations ---
    FieldRule(
        "operations.capacityPerMinute",
        "operations",
        "required",
        "Capacité de production",
        "الطاقة الإنتاجية",
        _has_capacity,
    ),
    FieldRule(
        "operations.salePrice",
        "operations",
        "required",
        "Prix de vente unitaire HT",
        "سعر البيع",
        lambda i: i.operations.salePrice > 0,
    ),
    FieldRule(
        "operations.workingDaysPerYear",
        "operations",
        "required",
        "Jours ouvrés / an",
        "أيام العمل",
        lambda i: i.operations.workingDaysPerYear > 0,
    ),
    FieldRule(
        "operations.wasteRate",
        "operations",
        "required",
        "Taux de déchet",
        "نسبة الهدر",
        _waste_valid,
    ),
    FieldRule(
        "operations.rawMaterialCost",
        "operations",
        "recommended",
        "Coût matière première",
        "تكلفة المواد",
        lambda i: i.operations.rawMaterialCost > 0,
    ),
    FieldRule(
        "operations.packagingCost",
        "operations",
        "recommended",
        "Coût emballage",
        "تكلفة التغليف",
        lambda i: i.operations.packagingCost > 0,
    ),
    FieldRule(
        "operations.hoursPerDay",
        "operations",
        "recommended",
        "Heures / jour",
        "ساعات العمل",
        lambda i: i.operations.hoursPerDay > 0,
    ),
    # --- hr ---
    FieldRule(
        "plAssumptions.personnel",
        "hr",
        "recommended",
        "Effectifs renseignés",
        "الموظفون",
        _personnel_active,
    ),
    FieldRule(
        "plAssumptions.otherOperatingCharges",
        "hr",
        "optional",
        "Autres charges opérationnelles",
        "مصاريف أخرى",
        lambda i: True,
    ),
    # --- financial ---
    FieldRule(
        "workingCapital.clientPaymentDays",
        "financial",
        "required",
        "Délai clients (BFR)",
        "آجال الزبائن",
        lambda i: i.workingCapital.clientPaymentDays >= 0,
    ),
    FieldRule(
        "workingCapital.supplierPaymentDays",
        "financial",
        "required",
        "Délai fournisseurs (BFR)",
        "آجال الموردين",
        lambda i: i.workingCapital.supplierPaymentDays >= 0,
    ),
    FieldRule(
        "workingCapital.rawMaterialStockDays",
        "financial",
        "required",
        "Stock matières premières",
        "مخزون المواد",
        lambda i: i.workingCapital.rawMaterialStockDays >= 0,
    ),
    FieldRule(
        "workingCapital.packagingStockDays",
        "financial",
        "required",
        "Stock emballages",
        "مخزون التغليف",
        lambda i: i.workingCapital.packagingStockDays >= 0,
    ),
    FieldRule(
        "workingCapital.finishedGoodsStockDays",
        "financial",
        "required",
        "Stock produits finis",
        "مخزون المنتجات",
        lambda i: i.workingCapital.finishedGoodsStockDays >= 0,
    ),
    FieldRule(
        "plAssumptions.corporateTaxRate",
        "financial",
        "required",
        "Taux IS",
        "ضريبة الشركات",
        lambda i: 0 < i.plAssumptions.corporateTaxRate <= 1,
    ),
    FieldRule(
        "plAssumptions.distributionExpensePct",
        "financial",
        "recommended",
        "Frais de distribution (% CA)",
        "مصاريف التوزيع",
        lambda i: 0 <= i.plAssumptions.distributionExpensePct <= 1,
    ),
    FieldRule(
        "plAssumptions.marketingExpensePct",
        "financial",
        "recommended",
        "Frais marketing (% CA)",
        "مصاريف التسويق",
        lambda i: 0 <= i.plAssumptions.marketingExpensePct <= 1,
    ),
]


def _rules_for_section(section: SectionId) -> list[FieldRule]:
    return [r for r in FIELD_RULES if r.section == section and r.tier != "optional"]


def _section_status(required_missing: list[str], recommended_missing: list[str], score: int) -> SectionStatus:
    if required_missing:
        return "incomplete"
    if recommended_missing or score < 100:
        return "warning"
    return "complete"


def _score_pct(filled: int, total: int) -> int:
    if total <= 0:
        return 100
    return int(round(100 * filled / total))


def compute_plan_completion(inputs: PlanInputs) -> dict:
    """Full completion report for API and UI."""
    sections_out: list[dict] = []
    required_missing_all: list[dict] = []
    recommended_missing_all: list[dict] = []

    total_scored = 0
    filled_scored = 0

    for section in SECTION_TITLES:
        rules = _rules_for_section(section)
        req_rules = [r for r in rules if r.tier == "required"]
        rec_rules = [r for r in rules if r.tier == "recommended"]

        req_missing: list[str] = []
        rec_missing: list[str] = []
        section_filled = 0
        section_total = len(req_rules) + len(rec_rules)

        for rule in req_rules + rec_rules:
            ok = rule.check(inputs)
            if ok:
                section_filled += 1
            item = {
                "path": rule.path,
                "section": rule.section,
                "tier": rule.tier,
                "label_fr": rule.label_fr,
                "label_ar": rule.label_ar,
                "filled": ok,
            }
            if not ok:
                if rule.tier == "required":
                    req_missing.append(rule.path)
                    required_missing_all.append(item)
                else:
                    rec_missing.append(rule.path)
                    recommended_missing_all.append(item)

        total_scored += section_total
        filled_scored += section_filled
        score = _score_pct(section_filled, section_total)
        title_fr, title_ar = SECTION_TITLES[section]
        sections_out.append(
            {
                "section": section,
                "title_fr": title_fr,
                "title_ar": title_ar,
                "score_pct": score,
                "status": _section_status(req_missing, rec_missing, score),
                "required_missing": req_missing,
                "recommended_missing": rec_missing,
                "fields_total": section_total,
                "fields_filled": section_filled,
            }
        )

    overall = _score_pct(filled_scored, total_scored)
    milestones = [m for m in (50, 100) if overall >= m]

    return {
        "overall_pct": overall,
        "sections": sections_out,
        "required_missing": required_missing_all,
        "recommended_missing": recommended_missing_all,
        "can_submit": len(required_missing_all) == 0,
        "milestones_reached": milestones,
        "scored_fields_total": total_scored,
        "scored_fields_filled": filled_scored,
    }


def get_required_missing_paths(inputs: PlanInputs) -> list[str]:
    """Paths blocking submission (required tier only)."""
    return [item["path"] for item in compute_plan_completion(inputs)["required_missing"]]


def completion_percent_legacy(inputs: PlanInputs) -> int:
    return compute_plan_completion(inputs)["overall_pct"]
