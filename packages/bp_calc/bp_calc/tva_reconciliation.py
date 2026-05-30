"""Full TVA reconciliation (collectée / déductible / solde) over 7 years."""

from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

from bp_calc.capex import all_equipment
from bp_calc.cost import production_kg_from_units, weight_kg_per_unit
from bp_calc.tva import vat_on_amount
from bp_schema.cost import ProductCostComponents
from bp_schema.liasse import PlanInputs
from bp_schema.revenue import PlanProduct, RevenueProjection
from bp_schema.tva_module import (
    HORIZON,
    TvaConfig,
    TvaConfigCategory,
    TvaLineAmount,
    TvaProjection,
    TvaSystemScope,
    TvaYearBalance,
)

__all__ = [
    "PurchaseBases",
    "build_purchase_bases",
    "calculate_tva_projection",
]


@dataclass
class PurchaseBases:
    """Annual HT purchase bases by scope key (7 years each)."""

    mp_by_product: dict[str, list[float]] = field(default_factory=dict)
    packaging: list[float] = field(default_factory=lambda: [0.0] * HORIZON)
    arome: list[float] = field(default_factory=lambda: [0.0] * HORIZON)
    cartons: list[float] = field(default_factory=lambda: [0.0] * HORIZON)
    utilities: list[float] = field(default_factory=lambda: [0.0] * HORIZON)
    equipment: list[float] = field(default_factory=lambda: [0.0] * HORIZON)
    other_charges: list[float] = field(default_factory=lambda: [0.0] * HORIZON)
    carton_share_of_packaging: float = 0.35


def _line_amount(
    line_key: str,
    label: str,
    year: int,
    flow: str,
    ht: float,
    rate: float,
) -> TvaLineAmount:
    tva = vat_on_amount(ht, rate) if rate else 0.0
    return TvaLineAmount(
        line_key=line_key,
        label=label,
        year=year,
        flow=flow,
        ht=ht,
        tva=tva,
        ttc=ht + tva,
        tva_rate=rate,
    )


def build_purchase_bases(
    products: list[PlanProduct],
    revenue: RevenueProjection,
    cost_by_key: dict[tuple[str, int], ProductCostComponents],
    inputs: PlanInputs,
    *,
    other_charges_by_year: list[float] | None = None,
    carton_share: float = 0.35,
) -> PurchaseBases:
    bases = PurchaseBases(carton_share_of_packaging=carton_share)
    bases.mp_by_product = {str(p.id): [0.0] * HORIZON for p in products if p.id}

    for yi in range(HORIZON):
        year = yi + 1
        pack_total = 0.0
        arome_total = 0.0
        util_total = 0.0

        for series in revenue.products:
            pid = series.product_id
            if yi >= len(series.years):
                continue
            qty = series.years[yi].quantity
            product = next((p for p in products if str(p.id) == pid), None)
            comp = cost_by_key.get((pid, year))
            g = comp.packaging_g_per_unit if comp else 1000.0
            if product:
                kg_u = weight_kg_per_unit(product, g)
            else:
                kg_u = g / 1000.0
            prod_kg = production_kg_from_units(qty, kg_u)
            mp_price = comp.mp_price_per_kg if comp else 0.0
            arome_pct = comp.arome_rate_pct if comp else 0.0
            pack_price = comp.packaging_price_per_kg if comp else 0.0
            pack_g = comp.packaging_g_per_unit if comp else 1000.0

            mp_ht = prod_kg * mp_price
            if pid in bases.mp_by_product:
                bases.mp_by_product[pid][yi] = mp_ht
            arome_total += mp_ht * arome_pct
            pack_total += prod_kg * pack_price * (pack_g / 1000.0)

            if comp:
                util_total += (
                    comp.gas_monthly + comp.electricity_monthly + comp.water_monthly
                ) * 12.0

        bases.packaging[yi] = pack_total * (1.0 - carton_share)
        bases.cartons[yi] = pack_total * carton_share
        bases.arome[yi] = arome_total
        bases.utilities[yi] = util_total

    for item in all_equipment(inputs):
        ay = max(1, min(HORIZON, item.acquisitionYear)) - 1
        bases.equipment[ay] += item.cost

    if other_charges_by_year:
        for yi, val in enumerate(other_charges_by_year[:HORIZON]):
            bases.other_charges[yi] = val

    return bases


def _config_for_product(configs: list[TvaConfig], product_id: str) -> TvaConfig | None:
    for c in configs:
        if c.applies_to == product_id and (
            c.category == TvaConfigCategory.product
            or c.category == TvaConfigCategory.product.value
        ):
            return c
    return None


def _config_for_scope(configs: list[TvaConfig], scope: str) -> TvaConfig | None:
    for c in configs:
        if c.applies_to == scope and c.enabled:
            return c
    return None


def _sales_ht_by_product(revenue: RevenueProjection) -> dict[str, list[float]]:
    out: dict[str, list[float]] = {}
    for series in revenue.products:
        out[series.product_id] = [0.0] * HORIZON
        for pt in series.years:
            if 1 <= pt.year <= HORIZON:
                out[series.product_id][pt.year - 1] = pt.revenue_net
    return out


def calculate_tva_projection(
    configs: list[TvaConfig],
    revenue: RevenueProjection,
    purchases: PurchaseBases,
    *,
    plan_id: UUID | None = None,
) -> TvaProjection:
    sales_ht = _sales_ht_by_product(revenue)
    line_items: list[TvaLineAmount] = []
    by_year: list[TvaYearBalance] = []

    for yi in range(HORIZON):
        year = yi + 1
        collectee = 0.0
        deductible = 0.0
        coll_by: dict[str, float] = {}
        ded_by: dict[str, float] = {}
        total_sales_ht = 0.0
        total_purch_ht = 0.0

        for pid, rev_series in sales_ht.items():
            ht = rev_series[yi] if yi < len(rev_series) else 0.0
            cfg = _config_for_product(configs, pid)
            rate = cfg.tva_rate_sales if cfg and cfg.enabled else 0.18
            label = cfg.label if cfg and cfg.label else f"Ventes {pid[:8]}"
            key = f"sales:{pid}"
            line = _line_amount(key, label, year, "sales", ht, rate)
            line_items.append(line)
            collectee += line.tva
            coll_by[key] = line.tva
            total_sales_ht += ht

        for pid, mp_series in purchases.mp_by_product.items():
            ht = mp_series[yi] if yi < len(mp_series) else 0.0
            cfg = _config_for_product(configs, pid)
            rate = cfg.tva_rate_purchase if cfg and cfg.enabled else 0.18
            label = f"MP — {cfg.label if cfg and cfg.label else pid[:8]}"
            key = f"purchase:mp:{pid}"
            line = _line_amount(key, label, year, "purchase", ht, rate)
            line_items.append(line)
            deductible += line.tva
            ded_by[key] = line.tva
            total_purch_ht += ht

        scope_map = [
            (TvaSystemScope.packaging.value, purchases.packaging, "Emballages"),
            (TvaSystemScope.arome.value, purchases.arome, "Arômes"),
            (TvaSystemScope.cartons.value, purchases.cartons, "Cartons"),
            (TvaSystemScope.utilities.value, purchases.utilities, "Énergie & fluides"),
            (TvaSystemScope.all_equipment.value, purchases.equipment, "Équipements"),
            (TvaSystemScope.other_charges.value, purchases.other_charges, "Autres charges"),
        ]
        for scope, series, default_label in scope_map:
            ht = series[yi] if yi < len(series) else 0.0
            cfg = _config_for_scope(configs, scope)
            if not cfg:
                continue
            rate = cfg.tva_rate_purchase
            label = cfg.label or default_label
            key = f"purchase:{scope}"
            line = _line_amount(key, label, year, "purchase", ht, rate)
            line_items.append(line)
            deductible += line.tva
            ded_by[key] = line.tva
            total_purch_ht += ht

        solde = collectee - deductible
        sales_tva = collectee
        purch_tva = deductible
        sales_ttc = total_sales_ht + sales_tva
        purch_ttc = total_purch_ht + purch_tva

        by_year.append(
            TvaYearBalance(
                year=year,
                tva_collectee=collectee,
                tva_deductible=deductible,
                solde_tva=solde,
                is_credit=solde < 0,
                collectee_by_line=coll_by,
                deductible_by_line=ded_by,
                sales_ht=total_sales_ht,
                sales_ttc=sales_ttc,
                purchases_ht=total_purch_ht,
                purchases_ttc=purch_ttc,
                supplier_payables=purch_ttc / 12.0,
                customer_receivables=sales_ttc / 12.0,
            )
        )

    return TvaProjection(
        plan_id=plan_id,
        by_year=by_year,
        line_items=line_items,
        collectee_series=[y.tva_collectee for y in by_year],
        deductible_series=[y.tva_deductible for y in by_year],
        solde_series=[y.solde_tva for y in by_year],
        supplier_payables_series=[y.supplier_payables for y in by_year],
        customer_receivables_series=[y.customer_receivables for y in by_year],
    )
