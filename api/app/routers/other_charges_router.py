"""Autres charges — formula-driven operating expenses."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.access_control import get_plan_for_user
from app.auth import get_current_user
from app.database import get_db
from app.models import PlanOtherChargesConfig, User
from app.other_charges_service import (
    compute_other_charges_projection,
    ensure_default_categories,
    get_or_create_settings,
    load_other_charges_config,
    sync_other_charges_to_liasse_inputs,
)
from app.schemas import (
    OtherChargesConfigBulkRequest,
    OtherChargesConfigResponse,
    OtherChargesProjectionResponse,
    OtherChargesSettingsResponse,
    OtherChargesSettingsUpdate,
    OtherChargesSyncResponse,
)
from app.workflow_policy import PlanAction, assert_plan_action
from bp_schema.other_charges import CATEGORY_LABELS

router = APIRouter(prefix="/plans", tags=["other-charges"])


@router.get("/{plan_id}/other-charges/config", response_model=list[OtherChargesConfigResponse])
async def list_other_charges_config(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    await ensure_default_categories(db, plan_id)
    await db.commit()
    result = await db.execute(
        select(PlanOtherChargesConfig)
        .where(PlanOtherChargesConfig.plan_id == plan_id)
        .order_by(PlanOtherChargesConfig.sort_order)
    )
    return [OtherChargesConfigResponse.model_validate(r) for r in result.scalars().all()]


@router.put("/{plan_id}/other-charges/config", response_model=list[OtherChargesConfigResponse])
async def bulk_update_other_charges_config(
    plan_id: UUID,
    body: OtherChargesConfigBulkRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    await ensure_default_categories(db, plan_id)
    saved: list[PlanOtherChargesConfig] = []
    for item in body.items:
        row = await db.get(PlanOtherChargesConfig, item.id)
        if not row or row.plan_id != plan_id:
            raise HTTPException(status_code=404, detail="Catégorie introuvable")
        for field in (
            "rule_type",
            "base_value",
            "rate_or_pct",
            "inflation_rate",
            "enabled",
            "sort_order",
        ):
            val = getattr(item, field, None)
            if val is not None:
                setattr(row, field, val)
        await db.flush()
        saved.append(row)
    settings = await get_or_create_settings(db, plan_id)
    settings.projection_cache = None
    await db.commit()
    return [OtherChargesConfigResponse.model_validate(r) for r in saved]


@router.get("/{plan_id}/other-charges/settings", response_model=OtherChargesSettingsResponse)
async def get_other_charges_settings(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    row = await get_or_create_settings(db, plan_id)
    await db.commit()
    return OtherChargesSettingsResponse.model_validate(row)


@router.put("/{plan_id}/other-charges/settings", response_model=OtherChargesSettingsResponse)
async def update_other_charges_settings(
    plan_id: UUID,
    body: OtherChargesSettingsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    row = await get_or_create_settings(db, plan_id)
    if body.lf2012_exemption_5y is not None:
        row.lf2012_exemption_5y = body.lf2012_exemption_5y
    row.projection_cache = None
    await db.commit()
    await db.refresh(row)
    return OtherChargesSettingsResponse.model_validate(row)


@router.get("/{plan_id}/other-charges/projection", response_model=OtherChargesProjectionResponse)
async def get_other_charges_projection(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    dump = await compute_other_charges_projection(db, plan.id, plan.inputs or {})
    await db.commit()
    return OtherChargesProjectionResponse(projection=dump)


@router.get("/{plan_id}/other-charges/category-labels")
async def get_category_labels(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    return CATEGORY_LABELS


@router.post("/{plan_id}/other-charges/sync-liasse", response_model=OtherChargesSyncResponse)
async def sync_other_charges_to_liasse(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from bp_schema.payroll import PayrollProjection
    from app.payroll_service import compute_payroll_projection

    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    dump = await compute_other_charges_projection(db, plan.id, plan.inputs or {})
    non_imp = 0.0
    try:
        payroll_dump = await compute_payroll_projection(db, plan.id)
        proj = PayrollProjection.model_validate(payroll_dump)
        y1 = next((y for y in proj.by_year if y.year == 1), None)
        if y1:
            non_imp = y1.non_imputable_cost
    except Exception:
        pass
    new_inputs = sync_other_charges_to_liasse_inputs(
        plan.inputs or {},
        dump,
        non_imputable_payroll_y1=non_imp,
    )
    plan.inputs = new_inputs
    await db.commit()
    y1 = next((y for y in dump.get("by_year", []) if y["year"] == 1), {})
    return OtherChargesSyncResponse(
        message="Autres charges synchronisées dans la liasse (Y1)",
        other_operating_charges_y1=new_inputs.get("plAssumptions", {}).get(
            "otherOperatingCharges", y1.get("total", 0)
        ),
    )
