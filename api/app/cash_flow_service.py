"""Annual cash flow statement from plan modules + calc engine."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from bp_calc.capex import all_equipment, total_capex
from bp_calc.cash_flow import CashFlowInputs, build_annual_cash_flow
from bp_calc.projections import compute_yearly_pl_breakdown
from bp_calc.tva import weighted_vat_rate
from bp_schema.liasse import PlanInputs

from app.balance_sheet_service import _revenue_and_purchases
from app.loan_service import load_plan_loans
from bp_calc.loan import aggregate_loan_projections, build_loan_schedule


async def compute_cash_flow_projection(
    db: AsyncSession,
    plan_id: UUID,
    plan_inputs: dict,
    *,
    discount_rate: float = 0.10,
    revenue_growth: float = 0.03,
    bfr_client_days: int | None = None,
    use_compact_bfr: bool = False,
    scenario: str = "base",
) -> dict:
    inputs = PlanInputs.model_validate(plan_inputs or {})
    results, _yearly = compute_yearly_pl_breakdown(
        inputs, discount_rate=discount_rate, revenue_growth=revenue_growth
    )

    revenue_ht, raw_p, pack_p = await _revenue_and_purchases(db, plan_id, inputs)
    if not revenue_ht or sum(revenue_ht) == 0:
        revenue_ht = list(results.revenue.years)

    vat_rate = weighted_vat_rate(inputs.company.taxRegime.tvaRates)
    revenue_ttc = [h * (1.0 + vat_rate) for h in revenue_ht]

    total_inv = total_capex(inputs)
    equity = total_inv * inputs.financing.equityRatio
    debt = total_inv * inputs.financing.debtRatio

    loans = await load_plan_loans(db, plan_id)
    if loans:
        combined = aggregate_loan_projections(loans, plan_id=plan_id)
        loan_drawdown = sum(loan.amount for loan in loans)
        principal = combined.annual_principal
    else:
        loan_drawdown = inputs.financing.loan.amount or debt
        amount = loan_drawdown
        _, principal, _ = build_loan_schedule(
            amount,
            inputs.financing.loan.rate,
            inputs.financing.loan.years,
            inputs.financing.loan.graceMonthsPrincipal,
            frequency="quarterly",
        )

    wc = inputs.workingCapital
    cf_inputs = CashFlowInputs(
        revenue_ht=revenue_ht,
        revenue_ttc=revenue_ttc,
        raw_purchases=raw_p,
        packaging_purchases=pack_p,
        net_profit=list(results.netProfit.years),
        depreciation=list(results.depreciation.years),
        principal_repayment=principal,
        equity=equity,
        total_investment=total_inv,
        loan_drawdown=loan_drawdown,
        client_payment_days=wc.clientPaymentDays,
        supplier_payment_days=wc.supplierPaymentDays,
        finished_goods_stock_days=wc.finishedGoodsStockDays,
        raw_material_stock_days=wc.rawMaterialStockDays,
        packaging_stock_days=wc.packagingStockDays,
        vat_rate=vat_rate,
        bfr_client_days_override=bfr_client_days,
        use_compact_bfr=use_compact_bfr,
        compact_bfr_days=float(bfr_client_days or 33),
    )
    cf_inputs.equipment = all_equipment(inputs)

    projection = build_annual_cash_flow(cf_inputs, plan_id=plan_id, scenario=scenario)
    dump = projection.model_dump()
    dump["legacy_cumulative"] = list(results.cumulativeTreasury.years)
    return dump
