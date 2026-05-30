"""Load autres charges config, build drivers, projection, liasse sync."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bp_calc.capex import total_capex
from bp_calc.other_charges import ExpenseDrivers, calculate_other_charges_projection
from bp_calc.revenue import calculate_revenue_projection
from bp_schema.liasse import PlanInputs, PlAssumptions
from bp_schema.other_charges import (
    DEFAULT_OTHER_CHARGES,
    OtherChargeCategory,
    OtherChargeRuleType,
    OtherChargesConfig,
)
from bp_schema.payroll import PayrollProjection

from app.models import PlanOtherChargesConfig, PlanOtherChargesSettings
from app.revenue_service import (
    _assumptions_from_orm as revenue_assumptions_from_orm,
    get_or_create_assumptions as get_or_create_revenue_assumptions,
    load_products,
)


def _config_from_orm(row: PlanOtherChargesConfig) -> OtherChargesConfig:
    return OtherChargesConfig(
        id=row.id,
        plan_id=row.plan_id,
        category=OtherChargeCategory(row.category),
        rule_type=OtherChargeRuleType(row.rule_type),
        base_value=row.base_value,
        rate_or_pct=row.rate_or_pct,
        inflation_rate=row.inflation_rate,
        enabled=row.enabled,
        sort_order=row.sort_order,
    )


async def load_other_charges_config(db: AsyncSession, plan_id: UUID) -> list[OtherChargesConfig]:
    result = await db.execute(
        select(PlanOtherChargesConfig)
        .where(PlanOtherChargesConfig.plan_id == plan_id)
        .order_by(PlanOtherChargesConfig.sort_order, PlanOtherChargesConfig.category)
    )
    return [_config_from_orm(r) for r in result.scalars().all()]


async def get_or_create_settings(db: AsyncSession, plan_id: UUID) -> PlanOtherChargesSettings:
    row = await db.get(PlanOtherChargesSettings, plan_id)
    if row:
        return row
    row = PlanOtherChargesSettings(plan_id=plan_id)
    db.add(row)
    await db.flush()
    return row


async def ensure_default_categories(db: AsyncSession, plan_id: UUID) -> list[OtherChargesConfig]:
    existing = await load_other_charges_config(db, plan_id)
    if existing:
        return existing
    for preset in DEFAULT_OTHER_CHARGES:
        row = PlanOtherChargesConfig(
            plan_id=plan_id,
            category=preset["category"].value,
            rule_type=preset["rule_type"].value,
            base_value=preset.get("base_value", 0.0),
            rate_or_pct=preset.get("rate_or_pct", 0.0),
            inflation_rate=preset.get("inflation_rate", 0.0),
            sort_order=preset.get("sort_order", 0),
        )
        db.add(row)
    await db.flush()
    return await load_other_charges_config(db, plan_id)


async def _payroll_series(db: AsyncSession, plan_id: UUID) -> list[float]:
    from app.payroll_service import compute_payroll_projection

    dump = await compute_payroll_projection(db, plan_id)
    proj = PayrollProjection.model_validate(dump)
    return [y.total_payroll for y in proj.by_year]


async def _revenue_series(
    db: AsyncSession, plan_id: UUID, plan_inputs: dict
) -> list[float]:
    products = await load_products(db, plan_id)
    assump_row = await get_or_create_revenue_assumptions(db, plan_id, plan_inputs)
    assumptions = revenue_assumptions_from_orm(assump_row, plan_id)
    rev = calculate_revenue_projection(products, assumptions, plan_id=plan_id)
    return list(rev.total_revenue_net)


async def build_expense_drivers(
    db: AsyncSession,
    plan_id: UUID,
    plan_inputs: dict,
    *,
    lf2012_exemption_5y: bool = True,
) -> ExpenseDrivers:
    inputs = PlanInputs.model_validate(plan_inputs or {})
    revenue = await _revenue_series(db, plan_id, plan_inputs)
    payroll = await _payroll_series(db, plan_id)
    if not any(payroll):
        personnel = sum(
            p.headcount * p.annualSalary for p in inputs.plAssumptions.personnel
        )
        payroll = [personnel] * 7
    return ExpenseDrivers(
        revenue_by_year=revenue,
        investment_total=total_capex(inputs),
        payroll_by_year=payroll,
        lf2012_exemption_5y=lf2012_exemption_5y,
    )


async def compute_other_charges_projection(
    db: AsyncSession,
    plan_id: UUID,
    plan_inputs: dict,
) -> dict:
    await ensure_default_categories(db, plan_id)
    settings = await get_or_create_settings(db, plan_id)
    configs = await load_other_charges_config(db, plan_id)
    drivers = await build_expense_drivers(
        db,
        plan_id,
        plan_inputs,
        lf2012_exemption_5y=settings.lf2012_exemption_5y,
    )
    projection = calculate_other_charges_projection(configs, drivers, plan_id=plan_id)
    dump = projection.model_dump()
    settings.projection_cache = dump
    await db.flush()
    return dump


def sync_other_charges_to_liasse_inputs(
    plan_inputs: dict,
    projection: dict,
    *,
    non_imputable_payroll_y1: float = 0.0,
) -> dict:
    """Set plAssumptions.otherOperatingCharges from Y1 autres charges + optional non-imputable MO."""
    inputs = PlanInputs.model_validate(plan_inputs or {})
    y1 = next((y for y in projection.get("by_year", []) if y["year"] == 1), None)
    total_y1 = y1["total"] if y1 else 0.0
    inputs.plAssumptions = PlAssumptions(
        commercialDiscount=inputs.plAssumptions.commercialDiscount,
        corporateTaxRate=inputs.plAssumptions.corporateTaxRate,
        otherOperatingCharges=total_y1 + non_imputable_payroll_y1,
        distributionExpensePct=inputs.plAssumptions.distributionExpensePct,
        marketingExpensePct=inputs.plAssumptions.marketingExpensePct,
        personnel=inputs.plAssumptions.personnel,
    )
    return inputs.model_dump()
