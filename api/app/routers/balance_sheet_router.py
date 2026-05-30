"""Balance sheet (bilan prévisionnel) projection."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.access_control import get_plan_for_user
from app.auth import get_current_user
from app.balance_sheet_service import compute_balance_sheet
from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import BalanceSheetResponse

router = APIRouter(prefix="/plans", tags=["balance-sheet"])


@router.get("/{plan_id}/balance-sheet", response_model=BalanceSheetResponse)
async def get_balance_sheet(
    plan_id: UUID,
    scenario: str = Query("base", pattern="^(base|pessimistic|optimistic)$"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    growth = 0.03
    if scenario == "pessimistic":
        growth = 0.02
    elif scenario == "optimistic":
        growth = 0.04
    dump = await compute_balance_sheet(
        db,
        plan.id,
        plan.inputs or {},
        discount_rate=settings.discount_rate,
        revenue_growth=growth,
    )
    return BalanceSheetResponse(scenario=scenario, projection=dump)
