"""Plan loans CRUD, amortization projection, liasse sync."""

from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from bp_calc.loan import aggregate_loan_projections
from bp_schema.liasse import PlanInputs
from bp_schema.loan_plan import MAX_LOANS_PER_PLAN, PlanLoan

from app.models import PlanLoan as PlanLoanORM


def _loan_from_orm(row: PlanLoanORM) -> PlanLoan:
    return PlanLoan(
        id=row.id,
        plan_id=row.plan_id,
        lender_name=row.lender_name,
        amount=row.amount,
        rate=row.rate,
        term_years=row.term_years,
        grace_months=row.grace_months,
        start_date=row.start_date,
        frequency=row.frequency,  # type: ignore[arg-type]
        sort_order=row.sort_order,
    )


async def load_plan_loans(db: AsyncSession, plan_id: UUID) -> list[PlanLoan]:
    result = await db.execute(
        select(PlanLoanORM)
        .where(PlanLoanORM.plan_id == plan_id)
        .order_by(PlanLoanORM.sort_order, PlanLoanORM.created_at)
    )
    return [_loan_from_orm(r) for r in result.scalars().all()]


async def count_plan_loans(db: AsyncSession, plan_id: UUID) -> int:
    return int(
        await db.scalar(
            select(func.count()).select_from(PlanLoanORM).where(PlanLoanORM.plan_id == plan_id)
        )
        or 0
    )


async def compute_loan_projection(db: AsyncSession, plan_id: UUID) -> dict:
    loans = await load_plan_loans(db, plan_id)
    combined = aggregate_loan_projections(loans, plan_id=plan_id)
    return combined.model_dump()


def sync_primary_loan_to_liasse_inputs(plan_inputs: dict, loans: list[PlanLoan]) -> dict:
    """Map primary tranche (sort_order 0) into legacy financing.loan."""
    inputs = PlanInputs.model_validate(plan_inputs or {})
    data = inputs.model_dump()
    fin = data.setdefault("financing", {})
    loan = fin.setdefault("loan", {})
    primary = loans[0] if loans else None
    if primary:
        loan["amount"] = primary.amount
        loan["rate"] = primary.rate
        loan["years"] = primary.term_years
        loan["graceMonthsPrincipal"] = primary.grace_months
    return data
