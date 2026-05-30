"""TVA reconciliation API."""

import csv
import io
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.access_control import get_plan_for_user
from app.auth import get_current_user
from app.database import get_db
from app.models import PlanTvaConfig, User
from app.tva_service import (
    compute_tva_projection,
    ensure_default_tva_config,
    get_or_create_tva_settings,
    load_tva_config,
    tva_export_table,
)
from app.schemas import (
    TvaConfigBulkRequest,
    TvaConfigResponse,
    TvaProjectionResponse,
    TvaSettingsResponse,
    TvaSettingsUpdate,
)
from app.workflow_policy import PlanAction, assert_plan_action

router = APIRouter(prefix="/plans", tags=["tva"])


@router.get("/{plan_id}/tva/config", response_model=list[TvaConfigResponse])
async def list_tva_config(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    await ensure_default_tva_config(db, plan_id)
    await db.commit()
    result = await db.execute(
        select(PlanTvaConfig)
        .where(PlanTvaConfig.plan_id == plan_id)
        .order_by(PlanTvaConfig.sort_order)
    )
    return [TvaConfigResponse.model_validate(r) for r in result.scalars().all()]


@router.put("/{plan_id}/tva/config", response_model=list[TvaConfigResponse])
async def bulk_update_tva_config(
    plan_id: UUID,
    body: TvaConfigBulkRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    saved: list[PlanTvaConfig] = []
    for item in body.items:
        row = await db.get(PlanTvaConfig, item.id)
        if not row or row.plan_id != plan_id:
            continue
        for field in (
            "label",
            "tva_rate_purchase",
            "tva_rate_sales",
            "enabled",
            "sort_order",
        ):
            val = getattr(item, field, None)
            if val is not None:
                setattr(row, field, val)
        await db.flush()
        saved.append(row)
    settings = await get_or_create_tva_settings(db, plan_id)
    settings.projection_cache = None
    await db.commit()
    return [TvaConfigResponse.model_validate(r) for r in saved]


@router.get("/{plan_id}/tva/settings", response_model=TvaSettingsResponse)
async def get_tva_settings(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    row = await get_or_create_tva_settings(db, plan_id)
    await db.commit()
    return TvaSettingsResponse.model_validate(row)


@router.put("/{plan_id}/tva/settings", response_model=TvaSettingsResponse)
async def update_tva_settings(
    plan_id: UUID,
    body: TvaSettingsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    row = await get_or_create_tva_settings(db, plan_id)
    if body.carton_share_of_packaging is not None:
        row.carton_share_of_packaging = body.carton_share_of_packaging
    row.projection_cache = None
    await db.commit()
    await db.refresh(row)
    return TvaSettingsResponse.model_validate(row)


@router.get("/{plan_id}/tva/projection", response_model=TvaProjectionResponse)
async def get_tva_projection(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    dump = await compute_tva_projection(db, plan.id, plan.inputs or {})
    await db.commit()
    return TvaProjectionResponse(projection=dump)


@router.get("/{plan_id}/tva/export")
async def export_tva(
    plan_id: UUID,
    format: str = Query("csv", pattern="^(csv|html)$"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    dump = await compute_tva_projection(db, plan.id, plan.inputs or {})
    await db.commit()
    rows = tva_export_table(dump)

    if format == "html":
        html = [
            "<h2>Tableau TVA — Liasse Unique</h2>",
            "<table border='1' cellpadding='6' cellspacing='0' style='border-collapse:collapse;font-size:12px'>",
            "<tr><th>Année</th><th>Flux</th><th>Ligne</th><th>HT</th><th>TVA</th><th>TTC</th><th>Taux %</th></tr>",
        ]
        for r in rows:
            html.append(
                f"<tr><td>{r['year']}</td><td>{r['flow']}</td><td>{r['line']}</td>"
                f"<td>{r['ht']}</td><td>{r['tva']}</td><td>{r['ttc']}</td><td>{r['rate_pct']}</td></tr>"
            )
        html.append("</table><h3>Synthèse annuelle</h3><ul>")
        for y in dump.get("by_year", []):
            credit = " (crédit)" if y.get("is_credit") else ""
            html.append(
                f"<li>Y{y['year']}: collectée {y['tva_collectee']:.2f}, "
                f"déductible {y['tva_deductible']:.2f}, solde {y['solde_tva']:.2f}{credit} — "
                f"fournisseurs {y['supplier_payables']:.2f}, clients {y['customer_receivables']:.2f}</li>"
            )
        html.append("</ul>")
        return Response(content="\n".join(html), media_type="text/html; charset=utf-8")

    buf = io.StringIO()
    if rows:
        writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    return PlainTextResponse(
        buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="tva_{plan_id}.csv"'},
    )
