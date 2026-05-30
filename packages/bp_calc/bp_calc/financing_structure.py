"""Financing structure validation and Tunisia funding eligibility."""

from __future__ import annotations

from uuid import UUID

from bp_calc.capex import total_capex
from bp_schema.financing_plan import (
    MIN_EQUITY_RATIO_BANK,
    EligibilityProgram,
    FinancingSource,
    FinancingStructureProjection,
    FinancingSummary,
    InvestmentBreakdown,
)
from bp_schema.liasse import PlanInputs

__all__ = [
    "compute_initial_bfr_y1",
    "build_financing_structure",
    "is_equity_source",
    "is_debt_source",
]

DEBT_TYPES = frozenset({"cmt", "leasing"})
EQUITY_TYPES = frozenset({"fonds_propres", "subvention"})


def is_equity_source(source_type: str) -> bool:
    return source_type in EQUITY_TYPES


def is_debt_source(source_type: str, *, rate: float = 0.0) -> bool:
    return source_type in DEBT_TYPES or (source_type == "autre" and rate > 0)


def _classify_amount(source: FinancingSource) -> tuple[float, float, float]:
    """Return (equity, debt, subvention) amounts."""
    if source.source_type == "fonds_propres":
        return source.amount, 0.0, 0.0
    if source.source_type == "subvention":
        return source.amount, 0.0, source.amount
    if source.source_type in DEBT_TYPES:
        return 0.0, source.amount, 0.0
    if source.source_type == "autre":
        if source.rate > 0:
            return 0.0, source.amount, 0.0
        return source.amount, 0.0, 0.0
    return 0.0, 0.0, 0.0


def compute_initial_bfr_y1(
    inputs: PlanInputs,
    *,
    revenue_y1: float | None = None,
    raw_y1: float | None = None,
    pack_y1: float | None = None,
) -> float:
    """First-year BFR (créances + stocks − fournisseurs) from operations."""
    from bp_calc.bfr import compute_bfr_detail
    from bp_calc.engine import _capacity_units
    from bp_calc.tva import weighted_vat_rate, vat_on_amount

    wc = inputs.workingCapital
    vat_rate = weighted_vat_rate(inputs.company.taxRegime.tvaRates)
    if revenue_y1 is not None:
        rev = revenue_y1
        units = _capacity_units(inputs.operations, 0)
        growth = 1.0
        raw = raw_y1 if raw_y1 is not None else units * inputs.operations.rawMaterialCost * growth
        pack = pack_y if pack_y1 is not None else units * inputs.operations.packagingCost * growth
    else:
        units = _capacity_units(inputs.operations, 0)
        discount = inputs.plAssumptions.commercialDiscount
        rev = units * inputs.operations.salePrice * (1 - discount)
        raw = units * inputs.operations.rawMaterialCost
        pack = units * inputs.operations.packagingCost

    rev_ttc = rev * (1 + vat_rate)
    detail = compute_bfr_detail(
        rev,
        rev_ttc,
        raw,
        pack,
        client_days=wc.clientPaymentDays,
        supplier_days=wc.supplierPaymentDays,
        finished_goods_stock_days=wc.finishedGoodsStockDays,
        raw_material_stock_days=wc.rawMaterialStockDays,
        packaging_stock_days=wc.packagingStockDays,
    )
    return max(0.0, detail.total)


def build_financing_structure(
    inputs: PlanInputs,
    sources: list[FinancingSource],
    *,
    plan_id: UUID | None = None,
    revenue_y1: float | None = None,
    raw_y1: float | None = None,
    pack_y1: float | None = None,
    indicators: dict | None = None,
    min_equity_ratio: float = MIN_EQUITY_RATIO_BANK,
) -> FinancingStructureProjection:
    fixed = total_capex(inputs)
    bfr = compute_initial_bfr_y1(
        inputs, revenue_y1=revenue_y1, raw_y1=raw_y1, pack_y1=pack_y1
    )
    total_need = fixed + bfr
    total_sources = sum(s.amount for s in sources)
    gap = round(total_need - total_sources, 2)

    equity_amt = 0.0
    debt_amt = 0.0
    subvention_amt = 0.0
    for s in sources:
        eq, deb, sub = _classify_amount(s)
        equity_amt += eq
        debt_amt += deb
        subvention_amt += sub

    total_fin = total_sources if total_sources > 0 else total_need
    equity_ratio = equity_amt / total_fin if total_fin > 0 else 0.0
    debt_ratio = debt_amt / total_fin if total_fin > 0 else 0.0
    meets_equity = equity_ratio >= min_equity_ratio
    balanced = abs(gap) < 1.0
    conforme = balanced and meets_equity

    summary = FinancingSummary(
        total_investment=round(fixed, 2),
        initial_bfr=round(bfr, 2),
        total_financing_need=round(total_need, 2),
        total_sources_amount=round(total_sources, 2),
        gap=gap,
        is_balanced=balanced,
        equity_amount=round(equity_amt, 2),
        debt_amount=round(debt_amt, 2),
        subvention_amount=round(subvention_amt, 2),
        equity_ratio=round(equity_ratio, 4),
        debt_ratio=round(debt_ratio, 4),
        meets_bank_equity_minimum=meets_equity,
        min_equity_ratio_required=min_equity_ratio,
        structure_status="conforme" if conforme else "non_conforme",
        structure_label="Conforme ✓" if conforme else "Non conforme ✗",
    )

    chart = []
    if equity_amt > 0:
        chart.append(
            {
                "name": "Fonds propres & subventions",
                "slice": "equity",
                "value": round(equity_amt, 2),
                "pct": round(equity_ratio * 100, 1),
            }
        )
    if debt_amt > 0:
        chart.append(
            {
                "name": "Dettes (CMT, leasing…)",
                "slice": "debt",
                "value": round(debt_amt, 2),
                "pct": round(debt_ratio * 100, 1),
            }
        )
    other = total_sources - equity_amt - debt_amt
    if other > 1:
        chart.append(
            {
                "name": "Autres",
                "slice": "other",
                "value": round(other, 2),
                "pct": round(other / total_fin * 100, 1) if total_fin else 0,
            }
        )

    programs = _eligibility_programs(summary, indicators or {})

    sources_with_pct = []
    for s in sources:
        pct = (s.amount / total_fin * 100) if total_fin > 0 else 0.0
        sources_with_pct.append(
            {
                **s.model_dump(),
                "share_pct": round(pct, 1),
                "is_equity": is_equity_source(s.source_type),
                "is_debt": s.source_type in DEBT_TYPES or (s.source_type == "autre" and s.rate > 0),
            }
        )

    return FinancingStructureProjection(
        plan_id=plan_id,
        investment=InvestmentBreakdown(
            fixed_assets_total=round(fixed, 2),
            initial_bfr=round(bfr, 2),
            total_financing_need=round(total_need, 2),
        ),
        summary=summary,
        sources=sources,
        chart_structure=chart,
        eligibility_programs=programs,
        indicators=indicators or {},
    )


def _eligibility_programs(
    summary: FinancingSummary,
    indicators: dict,
) -> list[EligibilityProgram]:
    van = indicators.get("van")
    tri = indicators.get("tri")
    drci = indicators.get("drci_years")
    loan_years = indicators.get("loan_term_years", 7)

    def prog(
        key: str,
        name: str,
        desc: str,
        criteria: list[str],
        eligible: bool,
        reasons: list[str],
    ) -> EligibilityProgram:
        return EligibilityProgram(
            key=key,
            name=name,
            description=desc,
            criteria=criteria,
            eligible=eligible,
            reasons=reasons,
        )

    programs: list[EligibilityProgram] = []

    bfpm_reasons = []
    bfpm_ok = summary.is_balanced and summary.meets_bank_equity_minimum
    if van is not None and van <= 0:
        bfpm_ok = False
        bfpm_reasons.append("VAN doit être positif")
    if summary.equity_ratio < 0.20:
        bfpm_ok = False
        bfpm_reasons.append("Fonds propres ≥ 20 % recommandés")
    programs.append(
        prog(
            "bfpme",
            "BFPME",
            "Banque de financement des PME (Tunisie)",
            [
                "Projet économiquement viable (VAN > 0)",
                "Structure équilibrée (écart = 0)",
                "Part de fonds propres suffisante",
            ],
            bfpm_ok,
            bfpm_reasons if not bfpm_ok else ["Critères principaux remplis"],
        )
    )

    sicar_ok = summary.equity_ratio >= 0.15 and (tri is None or tri >= 0.12)
    if van is not None and van <= 0:
        sicar_ok = False
    programs.append(
        prog(
            "sicar",
            "SICAR",
            "Sociétés de capital-investissement",
            [
                "TRI attractif (> 12 %)",
                "Part capitaux propres significative",
                "Potentiel de croissance",
            ],
            sicar_ok,
            [] if sicar_ok else ["TRI ou fonds propres insuffisants"],
        )
    )

    bts_ok = summary.is_balanced and summary.debt_amount > 0
    programs.append(
        prog(
            "bts",
            "BTS",
            "Banque tunisienne / crédit PME-tourisme",
            [
                "Besoin de financement couvert",
                "Emprunt bancaire identifié",
            ],
            bts_ok,
            [] if bts_ok else ["Structure ou dette non définie"],
        )
    )

    sotugar_ok = (
        summary.meets_bank_equity_minimum
        and summary.debt_amount > 0
        and summary.is_balanced
    )
    programs.append(
        prog(
            "sotugar",
            "SOTUGAR",
            "Fonds de garantie (caution mutuelle)",
            [
                "Fonds propres ≥ 25 % (standard bancaire)",
                "Prêt bancaire à garantir",
                "Plan équilibré",
            ],
            sotugar_ok,
            [] if sotugar_ok else ["Ratio fonds propres ou équilibre insuffisant"],
        )
    )

    foprodi_ok = summary.total_investment > 0 and summary.is_balanced
    if van is not None and van < 0:
        foprodi_ok = False
    programs.append(
        prog(
            "foprodi",
            "FOPRODI",
            "Fonds de promotion de l'industrie",
            [
                "Investissement industriel (immobilisations)",
                "Équilibre financement / besoin",
                "Viabilité du projet",
            ],
            foprodi_ok,
            [] if foprodi_ok else ["Besoin ou viabilité à confirmer"],
        )
    )

    return programs
