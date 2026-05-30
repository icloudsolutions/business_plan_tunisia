"""Financing sources CRUD, structure validation, loan sync."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from bp_calc.financing_structure import build_financing_structure
from bp_calc.kpi_dashboard import build_kpi_dashboard
from bp_schema.financing_plan import FinancingSource
from bp_schema.liasse import PlanInputs

from app.balance_sheet_service import _revenue_and_purchases
from app.config import settings as app_settings
from app.loan_service import load_plan_loans, sync_primary_loan_to_liasse_inputs
from app.models import PlanFinancingSource as PlanFinancingSourceORM
from app.models import PlanLoan as PlanLoanORM


DEFAULT_SOURCE_TEMPLATES: list[tuple[str, str]] = [
    ("fonds_propres", "Fonds propres"),
    ("cmt", "CMT"),
    ("leasing", "Leasing"),
    ("subvention", "Subvention BFPME / SICAR"),
    ("autre", "Autre"),
]


def _source_from_orm(row: PlanFinancingSourceORM) -> FinancingSource:
    return FinancingSource(
        id=row.id,
        plan_id=row.plan_id,
        source_type=row.source_type,  # type: ignore[arg-type]
        label=row.label,
        amount=row.amount,
        rate=row.rate,
        term_years=row.term_years,
        grace_months=row.grace_months,
        sort_order=row.sort_order,
        loan_id=row.loan_id,
    )


async def load_financing_sources(db: AsyncSession, plan_id: UUID) -> list[FinancingSource]:
    result = await db.execute(
        select(PlanFinancingSourceORM)
        .where(PlanFinancingSourceORM.plan_id == plan_id)
        .order_by(PlanFinancingSourceORM.sort_order, PlanFinancingSourceORM.created_at)
    )
    return [_source_from_orm(r) for r in result.scalars().all()]


async def ensure_default_financing_sources(
    db: AsyncSession, plan_id: UUID, plan_inputs: dict | None = None
) -> list[FinancingSource]:
    existing = await load_financing_sources(db, plan_id)
    if existing:
        return existing
    inputs = PlanInputs.model_validate(plan_inputs or {})
    from bp_calc.capex import total_capex

    capex = total_capex(inputs)
    equity_default = capex * inputs.financing.equityRatio
    debt_default = capex * inputs.financing.debtRatio
    amounts = {
        "fonds_propres": equity_default,
        "cmt": debt_default,
        "leasing": 0.0,
        "subvention": 0.0,
        "autre": 0.0,
    }
    for i, (stype, label) in enumerate(DEFAULT_SOURCE_TEMPLATES):
        row = PlanFinancingSourceORM(
            plan_id=plan_id,
            source_type=stype,
            label=label,
            amount=amounts.get(stype, 0.0),
            rate=inputs.financing.loan.rate if stype in ("cmt", "leasing") else 0.0,
            term_years=inputs.financing.loan.years if stype in ("cmt", "leasing") else 0,
            grace_months=inputs.financing.loan.graceMonthsPrincipal
            if stype in ("cmt", "leasing")
            else 0,
            sort_order=i,
        )
        db.add(row)
    await db.flush()
    await _sync_debt_sources_to_loans(db, plan_id)
    return await load_financing_sources(db, plan_id)


async def _sync_debt_sources_to_loans(db: AsyncSession, plan_id: UUID) -> None:
    """Keep plan_loans in sync with CMT/leasing financing sources."""
    sources = await load_financing_sources(db, plan_id)
    debt_sources = [s for s in sources if s.source_type in ("cmt", "leasing") and s.amount > 0]
    existing_loans = {
        r.id: r
        for r in (
            await db.execute(select(PlanLoanORM).where(PlanLoanORM.plan_id == plan_id))
        ).scalars().all()
    }
    for s in debt_sources:
        if s.loan_id and s.loan_id in existing_loans:
            loan = existing_loans[s.loan_id]
            loan.lender_name = s.label
            loan.amount = s.amount
            loan.rate = s.rate
            loan.term_years = max(1, s.term_years or 7)
            loan.grace_months = s.grace_months
        elif s.amount > 0:
            loan = PlanLoanORM(
                plan_id=plan_id,
                lender_name=s.label,
                amount=s.amount,
                rate=s.rate or 0.083,
                term_years=max(1, s.term_years or 7),
                grace_months=s.grace_months,
                sort_order=s.sort_order,
            )
            db.add(loan)
            await db.flush()
            orm = await db.get(PlanFinancingSourceORM, s.id)
            if orm:
                orm.loan_id = loan.id
    await db.flush()


async def compute_financing_structure_projection(
    db: AsyncSession,
    plan_id: UUID,
    plan_inputs: dict | None = None,
) -> dict:
    inputs = PlanInputs.model_validate(plan_inputs or {})
    await ensure_default_financing_sources(db, plan_id, plan_inputs)
    sources = await load_financing_sources(db, plan_id)

    revenue_ht, raw_p, pack_p = await _revenue_and_purchases(db, plan_id, inputs)
    rev_y1 = revenue_ht[0] if revenue_ht else None

    try:
        kpi = build_kpi_dashboard(
            inputs,
            discount_rate=app_settings.discount_rate,
            revenue_ht_override=revenue_ht if revenue_ht and sum(revenue_ht) > 0 else None,
        )
        indicators = {
            "van": kpi.primary.van,
            "tri": kpi.primary.tri,
            "drci_years": kpi.primary.drci_years,
            "loan_term_years": inputs.financing.loan.years,
            "financable": kpi.financability.is_financable,
        }
    except Exception:
        indicators = {}

    projection = build_financing_structure(
        inputs,
        sources,
        plan_id=plan_id,
        revenue_y1=rev_y1,
        raw_y1=raw_p[0] if raw_p else None,
        pack_y1=pack_p[0] if pack_p else None,
        indicators=indicators,
    )
    dump = projection.model_dump(mode="json")
    sources_enriched = []
    total_fin = projection.summary.total_sources_amount or projection.summary.total_financing_need
    for s in sources:
        pct = (s.amount / total_fin * 100) if total_fin > 0 else 0.0
        sources_enriched.append(
            {
                **s.model_dump(mode="json"),
                "share_pct": round(pct, 1),
            }
        )
    dump["sources_detail"] = sources_enriched
    return dump


async def sync_structure_to_liasse(
    db: AsyncSession, plan_id: UUID, plan_inputs: dict
) -> dict:
    sources = await load_financing_sources(db, plan_id)
    await _sync_debt_sources_to_loans(db, plan_id)
    loans = await load_plan_loans(db, plan_id)
    data = sync_primary_loan_to_liasse_inputs(plan_inputs, loans)
    summary = build_financing_structure(
        PlanInputs.model_validate(plan_inputs or {}),
        sources,
        plan_id=plan_id,
    ).summary
    total = summary.total_sources_amount
    if total > 0:
        fin = data.setdefault("financing", {})
        fin["equityRatio"] = round(summary.equity_amount / total, 4)
        fin["debtRatio"] = round(summary.debt_amount / total, 4)
    return data
