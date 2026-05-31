"""Instanciation et extraction des templates documentaires → PlanInputs."""

from __future__ import annotations

import copy
from typing import Any
from uuid import UUID

from bp_schema.liasse import DAYS_PER_MONTH, EquipmentItem, PlanInputs
from bp_schema.templates import (
    TemplateHypothesesBundle,
    hypotheses_preview,
    hypotheses_to_rows,
    validate_secteur,
    validate_sous_secteur,
)

from app.models import BusinessPlan, DocumentTemplate, TemplateHypothese


def _pct_to_ratio(v: float) -> float:
    return v / 100.0 if v > 1 else v


def build_inputs_from_hypotheses(
    hyp: dict[str, Any],
    *,
    plan_name: str,
    project_description: str | None = None,
    secteur: str,
    sous_secteur: str,
    template_id: str | None = None,
    template_code: str | None = None,
) -> dict:
    """Construit un dict PlanInputs pré-rempli depuis hypotheses JSON."""
    bundle = TemplateHypothesesBundle.model_validate(hyp)
    inv = bundle.investissement
    fin = bundle.financement
    exp = bundle.exploitation
    fiscal = bundle.fiscalite

    total_inv = float(inv.montant_cible_DT or (inv.montant_min_DT + inv.montant_max_DT) / 2)
    corp_pct = _pct_to_ratio(inv.part_immo_corporelles_pct)
    intangible_pct = max(0.0, 1.0 - corp_pct - _pct_to_ratio(inv.part_bfr_pct))
    corp_amount = total_inv * corp_pct
    intangible_amount = total_inv * intangible_pct

    equipment: list[EquipmentItem] = []
    if intangible_amount > 0:
        equipment.append(
            EquipmentItem(
                name="Études, licences et frais préliminaires",
                cost=round(intangible_amount * 0.4, 2),
                usefulLifeYears=5,
                acquisitionYear=1,
                assetType="intangible",
            )
        )
    if corp_amount > 0:
        equipment.append(
            EquipmentItem(
                name="Équipements et installations",
                cost=round(corp_amount * 0.85, 2),
                usefulLifeYears=inv.duree_amortissement_equipements_ans,
                acquisitionYear=1,
                assetType="tangible",
            )
        )
        equipment.append(
            EquipmentItem(
                name="Outillage et mobilier",
                cost=round(corp_amount * 0.15, 2),
                usefulLifeYears=5,
                acquisitionYear=1,
                assetType="tangible",
            )
        )

    equity = _pct_to_ratio(fin.taux_fonds_propres_min_pct)
    debt = 1.0 - equity
    loan_amount = total_inv * debt

    bfr_days = exp.bfr_jours_ca
    client_days = int(min(90, max(15, bfr_days * 0.45)))
    supplier_days = int(min(90, max(15, bfr_days * 0.35)))
    stock_days = int(min(60, max(5, bfr_days * 0.2)))

    base = PlanInputs()
    base.company.name = plan_name.strip() or "Nouveau projet"
    base.investments.equipment = equipment or base.investments.equipment
    base.financing.equityRatio = equity
    base.financing.debtRatio = debt
    base.financing.loan.rate = _pct_to_ratio(fin.taux_interet_CMT_pct)
    base.financing.loan.years = fin.duree_CMT_max_ans
    base.financing.loan.graceMonthsPrincipal = int(fin.duree_grace_max_ans * 12)
    base.financing.loan.amount = round(loan_amount, 2)
    base.workingCapital.clientPaymentDays = client_days
    base.workingCapital.supplierPaymentDays = supplier_days
    base.workingCapital.finishedGoodsStockDays = stock_days
    base.workingCapital.rawMaterialStockMonths = stock_days / DAYS_PER_MONTH
    base.plAssumptions.commercialDiscount = _pct_to_ratio(exp.taux_ristourne_pct)
    base.plAssumptions.marketingExpensePct = _pct_to_ratio(exp.taux_marketing_sur_ca_pct)
    base.plAssumptions.distributionExpensePct = _pct_to_ratio(exp.taux_transport_sur_ca_pct)
    base.plAssumptions.corporateTaxRate = _pct_to_ratio(fiscal.taux_is_pct)

    margin = _pct_to_ratio(exp.taux_marge_brute_pct)
    if margin > 0 and margin < 1:
        base.operations.rawMaterialCost = round(max(0.1, 1.0 - margin) * 2.5, 2)
        base.operations.packagingCost = 0.2
        base.operations.salePrice = 2.5

    growth = _pct_to_ratio(exp.taux_croissance_ca_annuel_pct)
    base.operations.wasteRateByYear = [0.01] * 7
    if growth > 0:
        base.operations.qtySoldY1 = None

    data = base.model_dump()
    meta: dict[str, Any] = {
        "secteur": secteur,
        "sous_secteur": sous_secteur,
        "project_description": project_description or "",
        "template_growth_pct": exp.taux_croissance_ca_annuel_pct,
        "template_margin_pct": exp.taux_marge_brute_pct,
        "template_investment_DT": total_inv,
    }
    if template_id:
        meta["template_id"] = template_id
    if template_code:
        meta["template_code"] = template_code
    data["_template"] = meta
    if project_description:
        data["project_description"] = project_description
    return data


def extract_hypotheses_from_plan(plan: BusinessPlan) -> dict[str, Any]:
    """Extrait un bundle hypotheses depuis les inputs d'un plan."""
    raw = plan.inputs if isinstance(plan.inputs, dict) else {}
    meta = raw.get("_template") or {}
    secteur = meta.get("secteur") or raw.get("secteur") or "SERVICES"
    inv_total = 0.0
    try:
        pi = PlanInputs.model_validate(raw)
        inv_total = pi.investments.total_capex()
        fin = pi.financing
        wc = pi.workingCapital
        pl = pi.plAssumptions
        hyp = TemplateHypothesesBundle(
            investissement={
                "montant_cible_DT": inv_total,
                "montant_min_DT": inv_total * 0.8,
                "montant_max_DT": inv_total * 1.2,
            },
            financement={
                "taux_fonds_propres_min_pct": fin.equityRatio * 100,
                "taux_CMT_max_pct": fin.debtRatio * 100,
                "taux_interet_CMT_pct": fin.loan.rate * 100,
                "duree_CMT_max_ans": fin.loan.years,
                "duree_grace_max_ans": fin.loan.graceMonthsPrincipal / 12,
            },
            exploitation={
                "taux_ristourne_pct": pl.commercialDiscount * 100,
                "taux_marketing_sur_ca_pct": pl.marketingExpensePct * 100,
                "taux_transport_sur_ca_pct": pl.distributionExpensePct * 100,
                "bfr_jours_ca": wc.clientPaymentDays + wc.supplierPaymentDays,
            },
            fiscalite={"taux_is_pct": pl.corporateTaxRate * 100},
        )
        data = hyp.model_dump()
        data["_meta"] = {"secteur": secteur, "sous_secteur": meta.get("sous_secteur")}
        return data
    except Exception:
        return TemplateHypothesesBundle().model_dump()


def sync_hypothesis_rows(template: DocumentTemplate) -> list[TemplateHypothese]:
    """Remplace les lignes template_hypotheses depuis hypotheses JSON."""
    rows_data = hypotheses_to_rows(template.hypotheses or {})
    return [
        TemplateHypothese(
            template_id=template.id,
            categorie=r.categorie,
            cle=r.cle,
            valeur_defaut=r.valeur_defaut,
            unite=r.unite,
            description=r.description,
            min_valeur=r.min_valeur,
            max_valeur=r.max_valeur,
            source=r.source,
        )
        for r in rows_data
    ]


def template_to_summary(t: DocumentTemplate) -> dict[str, Any]:
    hyp = t.hypotheses or {}
    return {
        "id": str(t.id),
        "code": t.code,
        "name": t.name,
        "version": t.version,
        "secteur": t.secteur,
        "sous_secteur": t.sous_secteur,
        "type_entreprise": t.type_entreprise,
        "type_financement": t.type_financement,
        "document_type": t.document_type,
        "usage_count": t.usage_count,
        "is_public": t.is_public,
        "hypotheses_preview": hypotheses_preview(hyp),
    }


def template_to_detail(t: DocumentTemplate) -> dict[str, Any]:
    detail = template_to_summary(t)
    detail["hypotheses"] = t.hypotheses
    detail["sections_incluses"] = t.sections_incluses or []
    detail["description"] = t.description
    detail["is_active"] = t.is_active
    detail["created_at"] = t.created_at.isoformat() if t.created_at else None
    detail["hypothesis_rows"] = [
        {
            "id": str(h.id),
            "categorie": h.categorie,
            "cle": h.cle,
            "valeur_defaut": h.valeur_defaut,
            "unite": h.unite,
            "description": h.description,
            "min_valeur": h.min_valeur,
            "max_valeur": h.max_valeur,
            "source": h.source,
        }
        for h in (t.hypothesis_rows or [])
    ]
    return detail


def validate_template_meta(secteur: str, sous_secteur: str) -> None:
    validate_secteur(secteur)
    validate_sous_secteur(secteur, sous_secteur)
