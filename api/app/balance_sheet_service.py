"""Assemble balance sheet drivers from plan modules and calc engine."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from bp_calc.balance_sheet import BalanceSheetDrivers, build_balance_sheet
from bp_calc.capex import all_equipment, total_capex
from bp_calc.projections import compute_yearly_pl_breakdown
from bp_calc.tva_reconciliation import build_purchase_bases
from bp_schema.liasse import PlanInputs

from app.cost_service import cost_lookup, load_cost_components
from app.loan_service import load_plan_loans
from app.revenue_service import (
    _assumptions_from_orm,
    get_or_create_assumptions,
    load_products,
)
from app.tva_service import compute_tva_projection
from bp_calc.loan import aggregate_loan_projections


async def _revenue_and_purchases(db: AsyncSession, plan_id: UUID, inputs: PlanInputs):
    products = await load_products(db, plan_id)
    assump_row = await get_or_create_assumptions(db, plan_id, inputs.model_dump())
    assumptions = _assumptions_from_orm(assump_row, plan_id)
    if products:
        from bp_calc.revenue import calculate_revenue_projection

        rev_proj = calculate_revenue_projection(products, assumptions, plan_id=plan_id)
        revenue_ht = list(rev_proj.total_revenue_net)
        components = await load_cost_components(db, plan_id)
        other_dump = None
        try:
            from app.other_charges_service import compute_other_charges_projection

            other_dump = await compute_other_charges_projection(db, plan_id, inputs.model_dump())
        except Exception:
            pass
        other_by_year = [y["total"] for y in (other_dump or {}).get("by_year", [])]
        purchases = build_purchase_bases(
            products,
            rev_proj,
            cost_lookup(components),
            inputs,
            other_charges_by_year=other_by_year or None,
        )
        raw = [sum(purchases.mp_by_product.get(pid, [0] * 7)[yi] for pid in purchases.mp_by_product) for yi in range(7)]
        pack = purchases.packaging
        return revenue_ht, raw, pack
    # Legacy single-product path from engine loop
    from bp_calc.engine import HORIZON, _capacity_units

    units = [_capacity_units(inputs.operations, y) for y in range(HORIZON)]
    discount = inputs.plAssumptions.commercialDiscount
    revenue_ht = []
    raw = []
    pack = []
    for y in range(HORIZON):
        g = (1.03) ** y
        rev = units[y] * inputs.operations.salePrice * (1 - discount) * g
        revenue_ht.append(rev)
        raw.append(units[y] * inputs.operations.rawMaterialCost * g)
        pack.append(units[y] * inputs.operations.packagingCost * g)
    return revenue_ht, raw, pack


async def compute_balance_sheet(
    db: AsyncSession,
    plan_id: UUID,
    plan_inputs: dict,
    *,
    discount_rate: float = 0.10,
    revenue_growth: float = 0.03,
) -> dict:
    inputs = PlanInputs.model_validate(plan_inputs or {})
    results, yearly = compute_yearly_pl_breakdown(
        inputs, discount_rate=discount_rate, revenue_growth=revenue_growth
    )

    revenue_ht, raw_p, pack_p = await _revenue_and_purchases(db, plan_id, inputs)

    loans = await load_plan_loans(db, plan_id)
    if loans:
        combined = aggregate_loan_projections(loans, plan_id=plan_id)
        loan_bal = combined.annual_ending_balance
    else:
        from bp_calc.loan import build_loan_schedule

        debt = total_capex(inputs) * inputs.financing.debtRatio
        amount = inputs.financing.loan.amount or debt
        _, _, loan_bal = build_loan_schedule(
            amount,
            inputs.financing.loan.rate,
            inputs.financing.loan.years,
            inputs.financing.loan.graceMonthsPrincipal,
            frequency="quarterly",
        )

    vat_payable = [0.0] * 7
    try:
        tva_dump = await compute_tva_projection(db, plan_id, plan_inputs)
        for y in tva_dump.get("by_year", []):
            yi = y["year"] - 1
            if 0 <= yi < 7:
                vat_payable[yi] = max(0.0, y.get("solde_tva", 0))
    except Exception:
        vat_payable = [row.get("vat", 0) for row in yearly]

    intangible = sum(e.cost for e in all_equipment(inputs) if e.assetType == "intangible")
    tangible = sum(e.cost for e in all_equipment(inputs) if e.assetType == "tangible")
    equity = total_capex(inputs) * inputs.financing.equityRatio

    treasury = list(results.cumulativeTreasury.years)
    net_profit = list(results.netProfit.years)
    dep = list(results.depreciation.years)

    # Align legacy revenue with engine if multi-product empty
    if not revenue_ht or sum(revenue_ht) == 0:
        revenue_ht = list(results.revenue.years)

    drivers = BalanceSheetDrivers(
        revenue_ht=revenue_ht,
        raw_purchases=raw_p,
        packaging_purchases=pack_p,
        net_profit=net_profit,
        depreciation=dep,
        cumulative_treasury=treasury,
        loan_balance_end=loan_bal,
        vat_payable=vat_payable,
        intangible_gross=intangible,
        tangible_gross=tangible,
        equity_capital=equity,
        client_payment_days=inputs.workingCapital.clientPaymentDays,
        supplier_payment_days=inputs.workingCapital.supplierPaymentDays,
        finished_goods_stock_days=inputs.workingCapital.finishedGoodsStockDays,
        raw_material_stock_days=inputs.workingCapital.rawMaterialStockDays,
        packaging_stock_days=inputs.workingCapital.packagingStockDays,
    )

    projection = build_balance_sheet(drivers, plan_id=plan_id)
    dump = projection.model_dump()
    dump["engine_balance_check"] = results.balanceSheetBalanced
    return dump
