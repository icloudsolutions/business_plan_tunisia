"""Procurement engine: consumption, stocks, purchases, supplier payables."""

from __future__ import annotations

from uuid import UUID

from bp_calc.cost import production_kg_from_units, weight_kg_per_unit
from bp_calc.tva_reconciliation import PurchaseBases
from bp_schema.cost import ProductCostComponents
from bp_schema.procurement import (
    HORIZON,
    MaterialProcurementRow,
    ProcurementProjection,
    ProcurementYearCell,
    ProductRecipe,
    PurchaseAssumption,
    RawMaterial,
    RawMaterialCategory,
)
from bp_schema.revenue import PlanProduct, RevenueProjection

__all__ = [
    "calculate_procurement_projection",
    "procurement_to_purchase_bases",
    "has_procurement_data",
]


def has_procurement_data(
    materials: list[RawMaterial],
    recipes: list[ProductRecipe],
) -> bool:
    if not materials:
        return False
    return any(r.quantity_per_kg_product > 0 for r in recipes)


def _price_for_year(material: RawMaterial, year_index: int) -> float:
    return material.price_per_unit * ((1.0 + material.annual_price_inflation_pct) ** year_index)


def calculate_procurement_projection(
    materials: list[RawMaterial],
    recipes: list[ProductRecipe],
    assumptions: list[PurchaseAssumption],
    products: list[PlanProduct],
    revenue: RevenueProjection,
    cost_by_key: dict[tuple[str, int], ProductCostComponents],
    *,
    plan_id: UUID | None = None,
) -> ProcurementProjection:
    stock_by_mat = {a.raw_material_id: a.stock_days for a in assumptions}
    recipe_map: dict[tuple[str, str], float] = {}
    for r in recipes:
        recipe_map[(str(r.product_id), str(r.raw_material_id))] = r.quantity_per_kg_product

    product_kg_per_unit: dict[str, float] = {}
    for p in products:
        if not p.id:
            continue
        pid = str(p.id)
        comp = cost_by_key.get((pid, 1))
        g = comp.packaging_g_per_unit if comp else 1000.0
        product_kg_per_unit[pid] = weight_kg_per_unit(p, g)

    rows: list[MaterialProcurementRow] = []
    totals_value = [0.0] * HORIZON
    category_totals: dict[str, float] = {c: 0.0 for c in ("mp", "arome", "packaging", "other")}

    for mat in materials:
        if not mat.id:
            continue
        mid = str(mat.id)
        stock_days = stock_by_mat.get(mat.id, 30)
        opening = 0.0
        year_cells: list[ProcurementYearCell] = []
        cons_by_product: dict[str, list[float]] = {
            str(p.id): [0.0] * HORIZON for p in products if p.id
        }

        for yi in range(HORIZON):
            year = yi + 1
            consumption = 0.0
            for series in revenue.products:
                pid = series.product_id
                if yi >= len(series.years):
                    continue
                qty_units = series.years[yi].quantity
                kg_u = product_kg_per_unit.get(pid, 1.0)
                prod_kg = production_kg_from_units(qty_units, kg_u)
                qty_per_kg = recipe_map.get((pid, mid), 0.0)
                part = prod_kg * qty_per_kg
                consumption += part
                if pid in cons_by_product:
                    cons_by_product[pid][yi] += part

            closing = consumption * stock_days / 365.0 if consumption > 0 else 0.0
            purchases_qty = max(0.0, consumption + closing - opening)
            unit_price = _price_for_year(mat, yi)
            purchase_value = purchases_qty * unit_price
            payable = purchase_value * mat.supplier_payment_days / 365.0

            year_cells.append(
                ProcurementYearCell(
                    year=year,
                    annual_consumption=round(consumption, 4),
                    opening_stock=round(opening, 4),
                    closing_stock=round(closing, 4),
                    purchases_qty=round(purchases_qty, 4),
                    purchase_value_ht=round(purchase_value, 2),
                    supplier_payable=round(payable, 2),
                    unit_price=round(unit_price, 4),
                )
            )
            totals_value[yi] += purchase_value
            category_totals[mat.category] = category_totals.get(mat.category, 0.0) + purchase_value
            opening = closing

        rows.append(
            MaterialProcurementRow(
                raw_material_id=mid,
                name=mat.name,
                unit=mat.unit,
                category=mat.category,
                stock_days=stock_days,
                years=year_cells,
                consumption_by_product={
                    k: [round(v, 4) for v in vals] for k, vals in cons_by_product.items()
                },
            )
        )

    totals_by_year = [
        {
            "year": yi + 1,
            "purchase_value_ht": round(totals_value[yi], 2),
            "purchases_qty": round(sum(r.years[yi].purchases_qty for r in rows if yi < len(r.years)), 4),
        }
        for yi in range(HORIZON)
    ]

    total_ht = sum(category_totals.values()) or 1.0
    chart_donut = [
        {
            "name": label,
            "category": cat,
            "value": round(category_totals.get(cat, 0.0), 2),
            "pct": round(category_totals.get(cat, 0.0) / total_ht * 100, 1),
        }
        for cat, label in (
            ("mp", "Matières premières"),
            ("arome", "Arômes"),
            ("packaging", "Emballages"),
            ("other", "Autres"),
        )
        if category_totals.get(cat, 0.0) > 0
    ]

    chart_trend = []
    for yi in range(HORIZON):
        point: dict = {"year": f"Y{yi + 1}"}
        for cat in ("mp", "arome", "packaging", "other"):
            point[cat] = round(
                sum(
                    r.years[yi].purchase_value_ht
                    for r in rows
                    if r.category == cat and yi < len(r.years)
                ),
                2,
            )
        point["total"] = round(totals_value[yi], 2)
        chart_trend.append(point)

    return ProcurementProjection(
        plan_id=plan_id,
        materials=materials,
        recipes=recipes,
        assumptions=assumptions,
        rows=rows,
        totals_by_year=totals_by_year,
        composition_by_category={k: round(v, 2) for k, v in category_totals.items()},
        chart_donut=chart_donut,
        chart_trend=chart_trend,
    )


def procurement_to_purchase_bases(
    projection: ProcurementProjection,
    products: list[PlanProduct],
    *,
    carton_share: float = 0.35,
) -> PurchaseBases:
    """Map procurement rows into TVA / balance-sheet purchase bases."""
    bases = PurchaseBases(carton_share_of_packaging=carton_share)
    bases.mp_by_product = {str(p.id): [0.0] * HORIZON for p in products if p.id}

    for row in projection.rows:
        cat: RawMaterialCategory = row.category
        for yi, cell in enumerate(row.years[:HORIZON]):
            ht = cell.purchase_value_ht
            if cat == "mp":
                total_cons = sum(
                    (row.consumption_by_product.get(pid, [0.0] * HORIZON)[yi])
                    for pid in row.consumption_by_product
                )
                if total_cons > 0:
                    for pid, series in row.consumption_by_product.items():
                        share = series[yi] / total_cons
                        if pid not in bases.mp_by_product:
                            bases.mp_by_product[pid] = [0.0] * HORIZON
                        bases.mp_by_product[pid][yi] += ht * share
                elif bases.mp_by_product:
                    first = next(iter(bases.mp_by_product))
                    bases.mp_by_product[first][yi] += ht
            elif cat == "arome":
                bases.arome[yi] += ht
            elif cat == "packaging":
                pack = ht * (1.0 - carton_share)
                cart = ht * carton_share
                bases.packaging[yi] += pack
                bases.cartons[yi] += cart
            else:
                bases.other_charges[yi] += ht

    if not bases.mp_by_product and products:
        mp_total = [0.0] * HORIZON
        for row in projection.rows:
            if row.category != "mp":
                continue
            for yi, cell in enumerate(row.years[:HORIZON]):
                mp_total[yi] += cell.purchase_value_ht
        pid = str(products[0].id) if products[0].id else "default"
        bases.mp_by_product[pid] = mp_total

    return bases
