"""Load DB-backed counts for wizard step completion."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from bp_schema.completion import PlanCompletionContext

from app.models import (
    PlanFinancingSource,
    PlanOtherChargesConfig,
    PlanPricingGrid,
    PlanProduct,
    PlanProductCostComponent,
    PlanProductRecipe,
    PlanRawMaterial,
    PlanStaffHeadcount,
    PlanStaffRole,
    PlanTimelinePhase,
    PlanTimelineSettings,
    PlanTvaConfig,
)


async def build_plan_completion_context(db: AsyncSession, plan_id: UUID) -> PlanCompletionContext:
    phases = await db.scalar(
        select(func.count())
        .select_from(PlanTimelinePhase)
        .where(PlanTimelinePhase.plan_id == plan_id)
    )
    settings = await db.get(PlanTimelineSettings, plan_id)
    raw_materials = await db.scalar(
        select(func.count())
        .select_from(PlanRawMaterial)
        .where(PlanRawMaterial.plan_id == plan_id)
    )
    recipes = await db.scalar(
        select(func.count())
        .select_from(PlanProductRecipe)
        .where(PlanProductRecipe.plan_id == plan_id)
    )
    products = await db.scalar(
        select(func.count()).select_from(PlanProduct).where(PlanProduct.plan_id == plan_id)
    )
    pricing_filled = await db.scalar(
        select(func.count())
        .select_from(PlanPricingGrid)
        .where(
            PlanPricingGrid.plan_id == plan_id,
            or_(
                PlanPricingGrid.sell_price_per_unit > 0,
                PlanPricingGrid.sell_price_per_kg > 0,
            ),
        )
    )
    cost_rows = await db.scalar(
        select(func.count())
        .select_from(PlanProductCostComponent)
        .where(
            PlanProductCostComponent.plan_id == plan_id,
            PlanProductCostComponent.year == 1,
        )
    )
    other_active = await db.scalar(
        select(func.count())
        .select_from(PlanOtherChargesConfig)
        .where(
            PlanOtherChargesConfig.plan_id == plan_id,
            PlanOtherChargesConfig.enabled.is_(True),
            or_(
                PlanOtherChargesConfig.base_value > 0,
                PlanOtherChargesConfig.rate_or_pct > 0,
            ),
        )
    )
    tva_rows = await db.scalar(
        select(func.count())
        .select_from(PlanTvaConfig)
        .where(PlanTvaConfig.plan_id == plan_id, PlanTvaConfig.enabled.is_(True))
    )
    financing_sources = await db.scalar(
        select(func.count())
        .select_from(PlanFinancingSource)
        .where(PlanFinancingSource.plan_id == plan_id)
    )
    staff_roles = await db.scalar(
        select(func.count())
        .select_from(PlanStaffRole)
        .where(PlanStaffRole.plan_id == plan_id)
    )
    headcount_active = await db.scalar(
        select(func.count())
        .select_from(PlanStaffHeadcount)
        .join(PlanStaffRole, PlanStaffHeadcount.staff_role_id == PlanStaffRole.id)
        .where(PlanStaffRole.plan_id == plan_id, PlanStaffHeadcount.headcount > 0)
    )

    return PlanCompletionContext(
        timeline_phases_count=int(phases or 0),
        timeline_has_settings=settings is not None,
        raw_materials_count=int(raw_materials or 0),
        product_recipes_count=int(recipes or 0),
        products_count=int(products or 0),
        pricing_rows_filled=int(pricing_filled or 0),
        cost_component_rows=int(cost_rows or 0),
        other_charges_active=int(other_active or 0),
        tva_config_count=int(tva_rows or 0),
        financing_sources_count=int(financing_sources or 0),
        staff_roles_count=int(staff_roles or 0),
        headcount_active_count=int(headcount_active or 0),
    )
