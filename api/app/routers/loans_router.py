"""Loan tranches and amortization schedules."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.access_control import get_plan_for_user
from app.auth import get_current_user
from app.database import get_db
from app.loan_service import (
    compute_loan_projection,
    count_plan_loans,
    load_plan_loans,
    sync_primary_loan_to_liasse_inputs,
)
from app.models import PlanLoan as PlanLoanORM
from app.models import User
from app.schemas import (
    LoanProjectionResponse,
    LoanSyncResponse,
    PlanLoanCreate,
    PlanLoanResponse,
    PlanLoanUpdate,
)
from app.workflow_policy import PlanAction, assert_plan_action
from bp_schema.loan_plan import MAX_LOANS_PER_PLAN

router = APIRouter(prefix="/plans", tags=["loans"])


@router.get("/{plan_id}/loans", response_model=list[PlanLoanResponse])
async def list_loans(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    result = await db.execute(
        select(PlanLoanORM)
        .where(PlanLoanORM.plan_id == plan_id)
        .order_by(PlanLoanORM.sort_order, PlanLoanORM.created_at)
    )
    return [PlanLoanResponse.model_validate(r) for r in result.scalars().all()]


@router.post("/{plan_id}/loans", response_model=PlanLoanResponse, status_code=201)
async def create_loan(
    plan_id: UUID,
    body: PlanLoanCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    n = await count_plan_loans(db, plan_id)
    if n >= MAX_LOANS_PER_PLAN:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_LOANS_PER_PLAN} tranches d'emprunt par plan",
        )
    row = PlanLoanORM(
        plan_id=plan_id,
        lender_name=body.lender_name.strip(),
        amount=body.amount,
        rate=body.rate,
        term_years=body.term_years,
        grace_months=body.grace_months,
        start_date=body.start_date,
        frequency=body.frequency,
        sort_order=body.sort_order if body.sort_order is not None else n,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return PlanLoanResponse.model_validate(row)


@router.patch("/{plan_id}/loans/{loan_id}", response_model=PlanLoanResponse)
async def update_loan(
    plan_id: UUID,
    loan_id: UUID,
    body: PlanLoanUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    row = await db.get(PlanLoanORM, loan_id)
    if not row or row.plan_id != plan_id:
        raise HTTPException(status_code=404, detail="Emprunt introuvable")
    for field in (
        "lender_name",
        "amount",
        "rate",
        "term_years",
        "grace_months",
        "start_date",
        "frequency",
        "sort_order",
    ):
        val = getattr(body, field, None)
        if val is not None:
            if field == "lender_name":
                setattr(row, field, str(val).strip())
            else:
                setattr(row, field, val)
    await db.commit()
    await db.refresh(row)
    return PlanLoanResponse.model_validate(row)


@router.delete("/{plan_id}/loans/{loan_id}", status_code=204)
async def delete_loan(
    plan_id: UUID,
    loan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    row = await db.get(PlanLoanORM, loan_id)
    if not row or row.plan_id != plan_id:
        raise HTTPException(status_code=404, detail="Emprunt introuvable")
    await db.delete(row)
    await db.commit()


@router.get("/{plan_id}/loan-projection", response_model=LoanProjectionResponse)
async def get_loan_projection(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    dump = await compute_loan_projection(db, plan_id)
    return LoanProjectionResponse(projection=dump)


@router.post("/{plan_id}/loans/sync-liasse", response_model=LoanSyncResponse)
async def sync_loans_to_liasse(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    loans = await load_plan_loans(db, plan_id)
    plan.inputs = sync_primary_loan_to_liasse_inputs(plan.inputs or {}, loans)
    await db.commit()
    primary = loans[0] if loans else None
    return LoanSyncResponse(
        message="Emprunt principal synchronisé dans la liasse (financing.loan)",
        loan_count=len(loans),
        primary_amount=primary.amount if primary else 0,
    )
