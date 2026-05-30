"""Payroll data loading, projection, sync to liasse inputs."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bp_calc.payroll import build_headcount_matrix, calculate_payroll_projection
from bp_schema.liasse import PersonnelLine, PlanInputs, PlAssumptions
from bp_schema.payroll import HeadcountEntry, PayrollAssumptions, StaffRole

from app.models import PlanPayrollAssumptions, PlanStaffHeadcount, PlanStaffRole


def _role_from_orm(row: PlanStaffRole) -> StaffRole:
    return StaffRole(
        id=row.id,
        plan_id=row.plan_id,
        function_name=row.function_name,
        qualification=row.qualification,
        is_production_imputable=row.is_production_imputable,
        base_monthly_salary=row.base_monthly_salary,
        annual_raise_rate_override=row.annual_raise_rate_override,
        sort_order=row.sort_order,
    )


async def load_staff_roles(db: AsyncSession, plan_id: UUID) -> list[StaffRole]:
    result = await db.execute(
        select(PlanStaffRole)
        .where(PlanStaffRole.plan_id == plan_id)
        .order_by(PlanStaffRole.sort_order, PlanStaffRole.created_at)
    )
    return [_role_from_orm(r) for r in result.scalars().all()]


async def load_headcount_entries(db: AsyncSession, plan_id: UUID) -> list[HeadcountEntry]:
    result = await db.execute(
        select(PlanStaffHeadcount)
        .join(PlanStaffRole, PlanStaffHeadcount.staff_role_id == PlanStaffRole.id)
        .where(PlanStaffRole.plan_id == plan_id)
    )
    return [
        HeadcountEntry(
            staff_role_id=row.staff_role_id,
            year=row.year,
            headcount=row.headcount,
        )
        for row in result.scalars().all()
    ]


async def get_or_create_payroll_assumptions(
    db: AsyncSession, plan_id: UUID
) -> PlanPayrollAssumptions:
    row = await db.get(PlanPayrollAssumptions, plan_id)
    if row:
        return row
    row = PlanPayrollAssumptions(plan_id=plan_id)
    db.add(row)
    await db.flush()
    return row


def _assumptions_from_orm(row: PlanPayrollAssumptions, plan_id: UUID) -> PayrollAssumptions:
    return PayrollAssumptions(
        plan_id=plan_id,
        annual_raise_rate=row.annual_raise_rate,
        cnss_employer_rate=row.cnss_employer_rate,
    )


async def compute_payroll_projection(
    db: AsyncSession,
    plan_id: UUID,
) -> dict:
    roles = await load_staff_roles(db, plan_id)
    entries = await load_headcount_entries(db, plan_id)
    assump_row = await get_or_create_payroll_assumptions(db, plan_id)
    assumptions = _assumptions_from_orm(assump_row, plan_id)
    matrix = build_headcount_matrix(roles, entries)
    projection = calculate_payroll_projection(roles, matrix, assumptions, plan_id=plan_id)
    dump = projection.model_dump()
    assump_row.projection_cache = dump
    await db.flush()
    return dump


async def ensure_headcount_grid(
    db: AsyncSession, staff_role_id: UUID, *, y1_default: int = 1
) -> None:
    existing = await db.execute(
        select(PlanStaffHeadcount).where(PlanStaffHeadcount.staff_role_id == staff_role_id)
    )
    rows = list(existing.scalars().all())
    have = {r.year for r in rows}
    y1 = next((r.headcount for r in rows if r.year == 1), y1_default)
    for y in range(1, 8):
        if y not in have:
            db.add(
                PlanStaffHeadcount(
                    staff_role_id=staff_role_id,
                    year=y,
                    headcount=y1,
                )
            )
    await db.flush()


def payroll_export_table(projection: dict) -> list[dict]:
    """Rows for PDF / CSV export."""
    rows = []
    for item in projection.get("by_role_year", []):
        rows.append(
            {
                "year": item["year"],
                "function": item["function_name"],
                "qualification": item["qualification"],
                "imputable": "Oui" if item["is_production_imputable"] else "Non",
                "headcount": item["headcount"],
                "monthly_salary": round(item["monthly_salary"], 3),
                "annual_gross": round(item["annual_gross"], 2),
                "cnss": round(item["cnss"], 2),
                "total": round(item["total_cost"], 2),
            }
        )
    return rows


def sync_payroll_to_liasse_inputs(plan_inputs: dict, projection: dict) -> dict:
    """Map Y1 payroll into plAssumptions.personnel + non-imputable into otherOperatingCharges."""
    inputs = PlanInputs.model_validate(plan_inputs or {})
    personnel: list[PersonnelLine] = []
    for item in projection.get("by_role_year", []):
        if item["year"] != 1:
            continue
        label = item["function_name"]
        if item.get("qualification"):
            label = f"{label} ({item['qualification']})"
        personnel.append(
            PersonnelLine(
                role=label,
                headcount=item["headcount"],
                annualSalary=round(item["annual_gross"] / max(item["headcount"], 1), 2),
            )
        )
    y1 = next((y for y in projection.get("by_year", []) if y["year"] == 1), None)
    non_imp = y1["non_imputable_cost"] if y1 else 0.0
    base_other = inputs.plAssumptions.otherOperatingCharges
    inputs.plAssumptions = PlAssumptions(
        commercialDiscount=inputs.plAssumptions.commercialDiscount,
        corporateTaxRate=inputs.plAssumptions.corporateTaxRate,
        otherOperatingCharges=base_other + non_imp,
        distributionExpensePct=inputs.plAssumptions.distributionExpensePct,
        marketingExpensePct=inputs.plAssumptions.marketingExpensePct,
        personnel=personnel,
    )
    return inputs.model_dump()


async def get_imputable_payroll_annual(
    db: AsyncSession, plan_id: UUID, year: int = 1
) -> float:
    from bp_calc.payroll import imputable_payroll_for_year
    from bp_schema.payroll import PayrollProjection

    assump_row = await get_or_create_payroll_assumptions(db, plan_id)
    if assump_row.projection_cache:
        proj = PayrollProjection.model_validate(assump_row.projection_cache)
        return imputable_payroll_for_year(proj, year)
    dump = await compute_payroll_projection(db, plan_id)
    proj = PayrollProjection.model_validate(dump)
    return imputable_payroll_for_year(proj, year)
