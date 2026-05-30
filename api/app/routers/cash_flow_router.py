"""Annual cash flow statement API."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.access_control import get_plan_for_user
from app.auth import get_current_user
from app.cash_flow_service import compute_cash_flow_projection
from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import CashFlowProjectionResponse
from bp_schema.liasse import PlanInputs

router = APIRouter(prefix="/plans", tags=["cash-flow"])


@router.get("/{plan_id}/cash-flow", response_model=CashFlowProjectionResponse)
async def get_cash_flow(
    plan_id: UUID,
    scenario: str = Query("base", pattern="^(base|pessimistic|optimistic)$"),
    bfr_client_days: int | None = Query(None, ge=0, le=365),
    use_compact_bfr: bool = Query(False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    growth = 0.03
    if scenario == "pessimistic":
        growth = 0.02
    elif scenario == "optimistic":
        growth = 0.04

    client_days = bfr_client_days
    if client_days is None:
        client_days = PlanInputs.model_validate(plan.inputs or {}).workingCapital.clientPaymentDays

    dump = await compute_cash_flow_projection(
        db,
        plan.id,
        plan.inputs or {},
        discount_rate=settings.discount_rate,
        revenue_growth=growth,
        bfr_client_days=client_days,
        use_compact_bfr=use_compact_bfr,
        scenario=scenario,
    )
    return CashFlowProjectionResponse(
        scenario=scenario,
        bfr_client_days=client_days,
        projection=dump,
    )
