"""Centralized authorization for business plan resources."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bp_schema.enums import BusinessPlanStatus

from app.models import BusinessPlan, User


def user_can_access_plan(plan: BusinessPlan, user: User) -> bool:
    """Owner always; expert only if assigned and plan is no longer a private client draft."""
    if user.role == "admin":
        return True
    if plan.owner_id == user.id:
        return True
    if user.role == "expert":
        if plan.assigned_expert_id != user.id:
            return False
        return plan.status != BusinessPlanStatus.DRAFT.value
    return False


async def get_plan_for_user(
    plan_id: UUID,
    user: User,
    db: AsyncSession,
) -> BusinessPlan:
    result = await db.execute(select(BusinessPlan).where(BusinessPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan introuvable")
    if not user_can_access_plan(plan, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")
    return plan


def apply_plans_list_filter(query, user: User):
    """Restrict list_plans to resources the user may see."""
    if user.role == "admin":
        return query
    if user.role == "client":
        return query.where(BusinessPlan.owner_id == user.id)
    if user.role == "expert":
        return query.where(
            BusinessPlan.assigned_expert_id == user.id,
            BusinessPlan.status != BusinessPlanStatus.DRAFT.value,
        )
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Rôle non autorisé")


async def assert_job_access(
    plan_id: UUID | None,
    user: User,
    db: AsyncSession,
) -> None:
    if plan_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès au job refusé")
    await get_plan_for_user(plan_id, user, db)


async def resolve_default_expert(db: AsyncSession) -> User:
    """Pick the expert assigned on client submit (env email or first expert account)."""
    from app.config import settings

    if settings.assign_expert_email:
        result = await db.execute(
            select(User).where(
                User.email == settings.assign_expert_email,
                User.role == "expert",
            )
        )
        expert = result.scalar_one_or_none()
        if expert:
            return expert

    result = await db.execute(select(User).where(User.role == "expert").limit(1))
    expert = result.scalar_one_or_none()
    if not expert:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Aucun expert disponible pour traiter la soumission",
        )
    return expert
