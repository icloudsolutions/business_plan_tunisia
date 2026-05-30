"""Payroll planning CRUD, projection, export, liasse sync."""

import csv
import io
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.access_control import get_plan_for_user
from app.auth import get_current_user
from app.database import get_db
from app.models import PlanStaffHeadcount, PlanStaffRole, User
from app.payroll_service import (
    compute_payroll_projection,
    ensure_headcount_grid,
    get_or_create_payroll_assumptions,
    load_headcount_entries,
    load_staff_roles,
    payroll_export_table,
    sync_payroll_to_liasse_inputs,
)
from app.schemas import (
    HeadcountBulkUpdate,
    HeadcountEntryResponse,
    PayrollAssumptionsResponse,
    PayrollAssumptionsUpdate,
    PayrollProjectionResponse,
    PayrollSyncResponse,
    StaffRoleCreate,
    StaffRoleResponse,
    StaffRoleUpdate,
)
from app.workflow_policy import PlanAction, assert_plan_action

router = APIRouter(prefix="/plans", tags=["payroll"])


@router.get("/{plan_id}/staff-roles", response_model=list[StaffRoleResponse])
async def list_staff_roles(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    result = await db.execute(
        select(PlanStaffRole)
        .where(PlanStaffRole.plan_id == plan_id)
        .order_by(PlanStaffRole.sort_order, PlanStaffRole.created_at)
    )
    return [StaffRoleResponse.model_validate(r) for r in result.scalars().all()]


@router.post("/{plan_id}/staff-roles", response_model=StaffRoleResponse, status_code=201)
async def create_staff_role(
    plan_id: UUID,
    body: StaffRoleCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    await get_or_create_payroll_assumptions(db, plan_id)
    count = await db.scalar(
        select(func.count()).select_from(PlanStaffRole).where(PlanStaffRole.plan_id == plan_id)
    )
    row = PlanStaffRole(
        plan_id=plan_id,
        function_name=body.function_name.strip(),
        qualification=(body.qualification or "").strip(),
        is_production_imputable=body.is_production_imputable,
        base_monthly_salary=body.base_monthly_salary,
        annual_raise_rate_override=body.annual_raise_rate_override,
        sort_order=body.sort_order if body.sort_order is not None else int(count or 0),
    )
    db.add(row)
    await db.flush()
    await ensure_headcount_grid(db, row.id, y1_default=body.headcount_y1)
    y1_row = await db.execute(
        select(PlanStaffHeadcount).where(
            PlanStaffHeadcount.staff_role_id == row.id,
            PlanStaffHeadcount.year == 1,
        )
    )
    hc1 = y1_row.scalar_one_or_none()
    if hc1:
        hc1.headcount = body.headcount_y1
    await db.commit()
    await db.refresh(row)
    return StaffRoleResponse.model_validate(row)


@router.patch("/{plan_id}/staff-roles/{role_id}", response_model=StaffRoleResponse)
async def update_staff_role(
    plan_id: UUID,
    role_id: UUID,
    body: StaffRoleUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    row = await db.get(PlanStaffRole, role_id)
    if not row or row.plan_id != plan_id:
        raise HTTPException(status_code=404, detail="Poste introuvable")
    for field in (
        "function_name",
        "qualification",
        "is_production_imputable",
        "base_monthly_salary",
        "annual_raise_rate_override",
        "sort_order",
    ):
        val = getattr(body, field, None)
        if val is not None:
            if field == "function_name":
                setattr(row, field, str(val).strip())
            else:
                setattr(row, field, val)
    await db.commit()
    await db.refresh(row)
    return StaffRoleResponse.model_validate(row)


@router.delete("/{plan_id}/staff-roles/{role_id}", status_code=204)
async def delete_staff_role(
    plan_id: UUID,
    role_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    row = await db.get(PlanStaffRole, role_id)
    if not row or row.plan_id != plan_id:
        raise HTTPException(status_code=404, detail="Poste introuvable")
    await db.delete(row)
    await db.commit()


@router.get("/{plan_id}/headcount-plan", response_model=list[HeadcountEntryResponse])
async def list_headcount(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    result = await db.execute(
        select(PlanStaffHeadcount, PlanStaffRole)
        .join(PlanStaffRole, PlanStaffHeadcount.staff_role_id == PlanStaffRole.id)
        .where(PlanStaffRole.plan_id == plan_id)
        .order_by(PlanStaffRole.sort_order, PlanStaffHeadcount.year)
    )
    out = []
    for hc, role in result.all():
        out.append(
            HeadcountEntryResponse(
                id=hc.id,
                staff_role_id=hc.staff_role_id,
                function_name=role.function_name,
                year=hc.year,
                headcount=hc.headcount,
            )
        )
    return out


@router.put("/{plan_id}/headcount-plan", response_model=list[HeadcountEntryResponse])
async def upsert_headcount(
    plan_id: UUID,
    body: HeadcountBulkUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    saved: list[PlanStaffHeadcount] = []
    for item in body.items:
        role = await db.get(PlanStaffRole, item.staff_role_id)
        if not role or role.plan_id != plan_id:
            raise HTTPException(status_code=404, detail="Poste introuvable")
        result = await db.execute(
            select(PlanStaffHeadcount).where(
                PlanStaffHeadcount.staff_role_id == item.staff_role_id,
                PlanStaffHeadcount.year == item.year,
            )
        )
        row = result.scalar_one_or_none()
        if row:
            row.headcount = item.headcount
        else:
            row = PlanStaffHeadcount(
                staff_role_id=item.staff_role_id,
                year=item.year,
                headcount=item.headcount,
            )
            db.add(row)
        await db.flush()
        saved.append(row)
    await db.commit()
    await compute_payroll_projection(db, plan_id)
    await db.commit()
    return await list_headcount(plan_id, user, db)


@router.get("/{plan_id}/payroll-assumptions", response_model=PayrollAssumptionsResponse)
async def get_payroll_assumptions(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    row = await get_or_create_payroll_assumptions(db, plan_id)
    await db.commit()
    return PayrollAssumptionsResponse.model_validate(row)


@router.put("/{plan_id}/payroll-assumptions", response_model=PayrollAssumptionsResponse)
async def update_payroll_assumptions(
    plan_id: UUID,
    body: PayrollAssumptionsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    row = await get_or_create_payroll_assumptions(db, plan_id)
    if body.annual_raise_rate is not None:
        row.annual_raise_rate = body.annual_raise_rate
    if body.cnss_employer_rate is not None:
        row.cnss_employer_rate = body.cnss_employer_rate
    row.projection_cache = None
    await db.commit()
    await db.refresh(row)
    return PayrollAssumptionsResponse.model_validate(row)


@router.get("/{plan_id}/payroll-projection", response_model=PayrollProjectionResponse)
async def get_payroll_projection(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    dump = await compute_payroll_projection(db, plan.id)
    await db.commit()
    return PayrollProjectionResponse(projection=dump)


@router.post("/{plan_id}/payroll/sync-liasse", response_model=PayrollSyncResponse)
async def sync_payroll_to_liasse(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    dump = await compute_payroll_projection(db, plan.id)
    new_inputs = sync_payroll_to_liasse_inputs(plan.inputs or {}, dump)
    plan.inputs = new_inputs
    await db.commit()
    y1 = next((y for y in dump.get("by_year", []) if y["year"] == 1), {})
    return PayrollSyncResponse(
        message="Masse salariale synchronisée dans la liasse (personnel + autres charges)",
        personnel_count=len(new_inputs.get("plAssumptions", {}).get("personnel", [])),
        imputable_y1=y1.get("imputable_cost", 0),
        non_imputable_y1=y1.get("non_imputable_cost", 0),
    )


@router.get("/{plan_id}/payroll/export")
async def export_payroll(
    plan_id: UUID,
    format: str = Query("csv", pattern="^(csv|html)$"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    dump = await compute_payroll_projection(db, plan.id)
    await db.commit()
    rows = payroll_export_table(dump)

    if format == "html":
        html = [
            "<h2>Synthèse masse salariale — insertion Liasse PDF</h2>",
            "<table border='1' cellpadding='6' cellspacing='0' style='border-collapse:collapse;font-size:12px'>",
            "<tr><th>Année</th><th>Fonction</th><th>Qualification</th><th>Imputable</th>"
            "<th>Effectif</th><th>Salaire mensuel</th><th>Brut annuel</th><th>CNSS</th><th>Total</th></tr>",
        ]
        for r in rows:
            html.append(
                f"<tr><td>{r['year']}</td><td>{r['function']}</td><td>{r['qualification']}</td>"
                f"<td>{r['imputable']}</td><td>{r['headcount']}</td><td>{r['monthly_salary']}</td>"
                f"<td>{r['annual_gross']}</td><td>{r['cnss']}</td><td>{r['total']}</td></tr>"
            )
        html.append("</table>")
        by_year = dump.get("by_year", [])
        if by_year:
            html.append("<h3>Totaux par année</h3><ul>")
            for y in by_year:
                html.append(
                    f"<li>Y{y['year']}: effectifs {y['total_headcount']}, "
                    f"masse {y['total_payroll']:.2f} DT (imputable {y['imputable_cost']:.2f}, "
                    f"non imputable {y['non_imputable_cost']:.2f})</li>"
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
        headers={"Content-Disposition": f'attachment; filename="payroll_{plan_id}.csv"'},
    )
