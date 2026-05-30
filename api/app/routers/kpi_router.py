"""Financial KPI dashboard API."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.access_control import get_plan_for_user
from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.kpi_service import compute_kpi_dashboard
from app.models import User
from app.schemas import KpiDashboardResponse

router = APIRouter(prefix="/plans", tags=["kpis"])


@router.get("/{plan_id}/kpis", response_model=KpiDashboardResponse)
async def get_kpis(
    plan_id: UUID,
    scenario: str = Query("base", pattern="^(base|pessimistic|optimistic)$"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    dump = await compute_kpi_dashboard(
        db,
        plan.id,
        plan.inputs or {},
        discount_rate=settings.discount_rate,
        scenario=scenario,
    )
    return KpiDashboardResponse(scenario=scenario, projection=dump)
