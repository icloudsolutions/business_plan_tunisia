"""Procurement CRUD and projection; feeds TVA / balance sheet purchase bases."""

from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from bp_calc.procurement import (
    calculate_procurement_projection,
    has_procurement_data,
    procurement_to_purchase_bases,
)
from bp_calc.tva_reconciliation import PurchaseBases, build_purchase_bases
from bp_schema.liasse import PlanInputs
from bp_schema.procurement import (
    ProductRecipe,
    PurchaseAssumption,
    RawMaterial,
)

from app.cost_service import cost_lookup, load_cost_components
from app.models import (
    PlanProductRecipe,
    PlanPurchaseAssumption,
    PlanRawMaterial,
)
from app.revenue_service import (
    _assumptions_from_orm,
    compute_projection,
    get_or_create_assumptions,
    load_products,
)


def _material_from_orm(row: PlanRawMaterial) -> RawMaterial:
    return RawMaterial(
        id=row.id,
        plan_id=row.plan_id,
        name=row.name,
        unit=row.unit,  # type: ignore[arg-type]
        category=row.category,  # type: ignore[arg-type]
        price_per_unit=row.price_per_unit,
        supplier_payment_days=row.supplier_payment_days,
        tva_rate=row.tva_rate,
        annual_price_inflation_pct=row.annual_price_inflation_pct,
        sort_order=row.sort_order,
    )


async def load_raw_materials(db: AsyncSession, plan_id: UUID) -> list[RawMaterial]:
    result = await db.execute(
        select(PlanRawMaterial)
        .where(PlanRawMaterial.plan_id == plan_id)
        .order_by(PlanRawMaterial.sort_order, PlanRawMaterial.created_at)
    )
    return [_material_from_orm(r) for r in result.scalars().all()]


async def load_recipes(db: AsyncSession, plan_id: UUID) -> list[ProductRecipe]:
    result = await db.execute(
        select(PlanProductRecipe).where(PlanProductRecipe.plan_id == plan_id)
    )
    return [
        ProductRecipe(
            product_id=r.product_id,
            raw_material_id=r.raw_material_id,
            quantity_per_kg_product=r.quantity_per_kg_product,
        )
        for r in result.scalars().all()
    ]


async def load_purchase_assumptions(db: AsyncSession, plan_id: UUID) -> list[PurchaseAssumption]:
    result = await db.execute(
        select(PlanPurchaseAssumption).where(PlanPurchaseAssumption.plan_id == plan_id)
    )
    return [
        PurchaseAssumption(raw_material_id=r.raw_material_id, stock_days=r.stock_days)
        for r in result.scalars().all()
    ]


async def ensure_default_materials(
    db: AsyncSession, plan_id: UUID, plan_inputs: dict | None = None
) -> list[RawMaterial]:
    existing = await load_raw_materials(db, plan_id)
    if existing:
        return existing
    mp_price = 0.0
    pack_price = 0.0
    if plan_inputs:
        try:
            ops = PlanInputs.model_validate(plan_inputs).operations
            mp_price = float(ops.rawMaterialCost or 0)
            pack_price = float(ops.packagingCost or 0)
        except Exception:
            pass
    defaults = [
        ("Maïs", "mp", "kg", mp_price),
        ("Arômes", "arome", "kg", mp_price * 0.06 if mp_price else 0),
        ("Emballage", "packaging", "kg", pack_price),
    ]
    for i, (name, cat, unit, price) in enumerate(defaults):
        row = PlanRawMaterial(
            plan_id=plan_id,
            name=name,
            category=cat,
            unit=unit,
            price_per_unit=price,
            sort_order=i,
        )
        db.add(row)
        await db.flush()
        db.add(PlanPurchaseAssumption(plan_id=plan_id, raw_material_id=row.id, stock_days=30))
    await db.flush()
    return await load_raw_materials(db, plan_id)


async def ensure_recipe_grid(
    db: AsyncSession, plan_id: UUID, product_id: UUID
) -> None:
    materials = await load_raw_materials(db, plan_id)
    if not materials:
        return
    result = await db.execute(
        select(PlanProductRecipe.raw_material_id).where(
            PlanProductRecipe.plan_id == plan_id,
            PlanProductRecipe.product_id == product_id,
        )
    )
    have = {r[0] for r in result.all()}
    for m in materials:
        if m.id and m.id not in have:
            db.add(
                PlanProductRecipe(
                    plan_id=plan_id,
                    product_id=product_id,
                    raw_material_id=m.id,
                    quantity_per_kg_product=0.0,
                )
            )
    await db.flush()


async def compute_procurement_projection(
    db: AsyncSession,
    plan_id: UUID,
    plan_inputs: dict | None = None,
) -> dict:
    await ensure_default_materials(db, plan_id, plan_inputs)
    materials = await load_raw_materials(db, plan_id)
    recipes = await load_recipes(db, plan_id)
    assumptions = await load_purchase_assumptions(db, plan_id)
    if not assumptions and materials:
        for m in materials:
            if m.id:
                db.add(
                    PlanPurchaseAssumption(
                        plan_id=plan_id, raw_material_id=m.id, stock_days=30
                    )
                )
        await db.flush()
        assumptions = await load_purchase_assumptions(db, plan_id)

    products = await load_products(db, plan_id)
    for p in products:
        if p.id:
            await ensure_recipe_grid(db, plan_id, p.id)
    recipes = await load_recipes(db, plan_id)

    revenue = await compute_projection(db, plan_id, plan_inputs)
    components = await load_cost_components(db, plan_id)
    projection = calculate_procurement_projection(
        materials,
        recipes,
        assumptions,
        products,
        revenue,
        cost_lookup(components),
        plan_id=plan_id,
    )
    return projection.model_dump()


async def resolve_purchase_bases(
    db: AsyncSession,
    plan_id: UUID,
    plan_inputs: dict,
    *,
    carton_share: float = 0.35,
    other_charges_by_year: list[float] | None = None,
) -> PurchaseBases:
    """Use procurement module when recipes exist; else legacy cost-based bases."""
    materials = await load_raw_materials(db, plan_id)
    recipes = await load_recipes(db, plan_id)
    products = await load_products(db, plan_id)
    inputs = PlanInputs.model_validate(plan_inputs or {})

    if has_procurement_data(materials, recipes):
        assumptions = await load_purchase_assumptions(db, plan_id)
        assump_row = await get_or_create_assumptions(db, plan_id, plan_inputs)
        assumptions_rev = _assumptions_from_orm(assump_row, plan_id)
        revenue = await compute_projection(db, plan_id, plan_inputs)
        components = await load_cost_components(db, plan_id)
        proc = calculate_procurement_projection(
            materials,
            recipes,
            assumptions,
            products,
            revenue,
            cost_lookup(components),
            plan_id=plan_id,
        )
        bases = procurement_to_purchase_bases(proc, products, carton_share=carton_share)
        if other_charges_by_year:
            for yi, oc in enumerate(other_charges_by_year[:7]):
                bases.other_charges[yi] += oc
        return bases

    components = await load_cost_components(db, plan_id)
    assump_row = await get_or_create_assumptions(db, plan_id, plan_inputs)
    assumptions_rev = _assumptions_from_orm(assump_row, plan_id)
    revenue = await compute_projection(db, plan_id, plan_inputs)
    return build_purchase_bases(
        products,
        revenue,
        cost_lookup(components),
        inputs,
        other_charges_by_year=other_charges_by_year,
        carton_share=carton_share,
    )
