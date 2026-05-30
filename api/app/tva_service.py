"""TVA config, drivers, projection, export."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.cost_service import cost_lookup, load_cost_components
from bp_calc.revenue import calculate_revenue_projection
from bp_calc.tva_reconciliation import build_purchase_bases, calculate_tva_projection
from bp_schema.liasse import PlanInputs
from bp_schema.tva_module import (
    SYSTEM_DEFAULTS,
    TvaConfig,
    TvaConfigCategory,
    guess_product_tva_profile,
)

from app.models import PlanTvaConfig, PlanTvaSettings
from app.json_dump import pydantic_json_dump
from app.other_charges_service import compute_other_charges_projection
from app.revenue_service import (
    _assumptions_from_orm as revenue_assumptions_from_orm,
    get_or_create_assumptions as get_or_create_revenue_assumptions,
    load_products,
)


def _config_from_orm(row: PlanTvaConfig) -> TvaConfig:
    return TvaConfig(
        id=row.id,
        plan_id=row.plan_id,
        category=row.category,
        applies_to=row.applies_to,
        label=row.label,
        tva_rate_purchase=row.tva_rate_purchase,
        tva_rate_sales=row.tva_rate_sales,
        enabled=row.enabled,
        sort_order=row.sort_order,
    )


async def load_tva_config(db: AsyncSession, plan_id: UUID) -> list[TvaConfig]:
    result = await db.execute(
        select(PlanTvaConfig)
        .where(PlanTvaConfig.plan_id == plan_id)
        .order_by(PlanTvaConfig.sort_order, PlanTvaConfig.label)
    )
    return [_config_from_orm(r) for r in result.scalars().all()]


async def get_or_create_tva_settings(db: AsyncSession, plan_id: UUID) -> PlanTvaSettings:
    row = await db.get(PlanTvaSettings, plan_id)
    if row:
        return row
    row = PlanTvaSettings(plan_id=plan_id)
    db.add(row)
    await db.flush()
    return row


async def ensure_default_tva_config(db: AsyncSession, plan_id: UUID) -> list[TvaConfig]:
    existing = await load_tva_config(db, plan_id)
    have_applies = {(r.category, r.applies_to) for r in existing}
    products = await load_products(db, plan_id)
    to_add: list[PlanTvaConfig] = []

    for idx, p in enumerate(products):
        if not p.id:
            continue
        key = (TvaConfigCategory.product.value, str(p.id))
        if key in have_applies:
            continue
        purch, sales = guess_product_tva_profile(p.name)
        to_add.append(
            PlanTvaConfig(
                plan_id=plan_id,
                category=TvaConfigCategory.product.value,
                applies_to=str(p.id),
                label=p.name or "Produit",
                tva_rate_purchase=purch,
                tva_rate_sales=sales,
                sort_order=idx,
            )
        )
        have_applies.add(key)

    for preset in SYSTEM_DEFAULTS:
        key = (preset["category"].value, preset["applies_to"])
        if key in have_applies:
            continue
        to_add.append(
            PlanTvaConfig(
                plan_id=plan_id,
                category=preset["category"].value,
                applies_to=preset["applies_to"],
                label=preset["label"],
                tva_rate_purchase=preset["tva_rate_purchase"],
                tva_rate_sales=preset["tva_rate_sales"],
                sort_order=preset["sort_order"],
            )
        )

    for row in to_add:
        db.add(row)
    if to_add:
        await db.flush()
    return await load_tva_config(db, plan_id)


async def compute_tva_projection(
    db: AsyncSession,
    plan_id: UUID,
    plan_inputs: dict,
) -> dict:
    await ensure_default_tva_config(db, plan_id)
    settings = await get_or_create_tva_settings(db, plan_id)
    configs = await load_tva_config(db, plan_id)
    products = await load_products(db, plan_id)
    assump_row = await get_or_create_revenue_assumptions(db, plan_id, plan_inputs)
    assumptions = revenue_assumptions_from_orm(assump_row, plan_id)
    revenue = calculate_revenue_projection(products, assumptions, plan_id=plan_id)
    components = await load_cost_components(db, plan_id)
    inputs = PlanInputs.model_validate(plan_inputs or {})

    other_dump = await compute_other_charges_projection(db, plan_id, plan_inputs)
    other_by_year = [y["total"] for y in other_dump.get("by_year", [])]

    purchases = build_purchase_bases(
        products,
        revenue,
        cost_lookup(components),
        inputs,
        other_charges_by_year=other_by_year,
        carton_share=settings.carton_share_of_packaging,
    )
    projection = calculate_tva_projection(
        configs,
        revenue,
        purchases,
        plan_id=plan_id,
    )
    dump = pydantic_json_dump(projection)
    settings.projection_cache = dump
    await db.flush()
    return dump


def tva_export_table(projection: dict) -> list[dict]:
    rows = []
    for item in projection.get("line_items", []):
        rows.append(
            {
                "year": item["year"],
                "flow": item["flow"],
                "line": item["label"],
                "ht": round(item["ht"], 2),
                "tva": round(item["tva"], 2),
                "ttc": round(item["ttc"], 2),
                "rate_pct": round(item["tva_rate"] * 100, 2),
            }
        )
    for y in projection.get("by_year", []):
        rows.append(
            {
                "year": y["year"],
                "flow": "balance",
                "line": "Solde TVA",
                "ht": round(y["sales_ht"] - y["purchases_ht"], 2),
                "tva": round(y["solde_tva"], 2),
                "ttc": "",
                "rate_pct": "",
            }
        )
    return rows
