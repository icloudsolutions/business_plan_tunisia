"""Annual cash flow statement (Y0–Y7) aligned with Excel Liasse."""

from __future__ import annotations

from uuid import UUID

from bp_calc.bfr import BfrDetail, bfr_levels_with_year_zero, bfr_variation_series, compute_bfr_detail
from bp_calc.capex import all_equipment, annual_depreciation_schedule, total_capex
from bp_calc.indicators import payback_period_years
from bp_schema.cash_flow import BfrComponents, CashFlowProjection, CashFlowYearRow

HORIZON = 7

__all__ = ["CashFlowInputs", "build_annual_cash_flow"]


class CashFlowInputs:
    def __init__(
        self,
        *,
        revenue_ht: list[float],
        revenue_ttc: list[float] | None = None,
        raw_purchases: list[float],
        packaging_purchases: list[float],
        net_profit: list[float],
        depreciation: list[float],
        principal_repayment: list[float],
        equity: float,
        total_investment: float,
        loan_drawdown: float,
        client_payment_days: int = 30,
        supplier_payment_days: int = 30,
        finished_goods_stock_days: int = 10,
        raw_material_stock_days: int = 30,
        packaging_stock_days: int = 15,
        vat_rate: float = 0.19,
        bfr_client_days_override: int | None = None,
        use_compact_bfr: bool = False,
        compact_bfr_days: float = 33.0,
    ):
        self.revenue_ht = _pad(revenue_ht)
        self.revenue_ttc = _pad(revenue_ttc or [h * (1 + vat_rate) for h in self.revenue_ht])
        self.raw_purchases = _pad(raw_purchases)
        self.packaging_purchases = _pad(packaging_purchases)
        self.net_profit = _pad(net_profit)
        self.depreciation = _pad(depreciation)
        self.principal_repayment = _pad(principal_repayment)
        self.equity = equity
        self.total_investment = total_investment
        self.loan_drawdown = loan_drawdown
        self.client_payment_days = bfr_client_days_override or client_payment_days
        self.supplier_payment_days = supplier_payment_days
        self.finished_goods_stock_days = finished_goods_stock_days
        self.raw_material_stock_days = raw_material_stock_days
        self.packaging_stock_days = packaging_stock_days
        self.use_compact_bfr = use_compact_bfr
        self.compact_bfr_days = compact_bfr_days
        self.equipment: list = []


def _pad(values: list[float], length: int = HORIZON) -> list[float]:
    out = list(values[:length])
    while len(out) < length:
        out.append(out[-1] if out else 0.0)
    return out


def _net_fixed_assets_end(inputs: CashFlowInputs, year_index: int) -> float:
    """Net book value of fixed assets at end of plan year (1-based index in loop)."""
    gross = sum(e.cost for e in inputs.equipment) if inputs.equipment else inputs.total_investment
    dep = annual_depreciation_schedule_from_inputs(inputs)
    cum_dep = sum(dep[: year_index + 1])
    return max(0.0, gross - cum_dep)


def annual_depreciation_schedule_from_inputs(inputs: CashFlowInputs) -> list[float]:
    from bp_schema.liasse import PlanInputs, Investments

    if not inputs.equipment:
        return _pad(inputs.depreciation)
    stub = PlanInputs(investments=Investments(equipment=inputs.equipment))
    return annual_depreciation_schedule(stub)


def build_annual_cash_flow(
    inputs: CashFlowInputs,
    *,
    plan_id: UUID | None = None,
    scenario: str = "base",
) -> CashFlowProjection:
    bfr_operating: list[float] = []
    bfr_details: list[BfrDetail] = []

    for yi in range(HORIZON):
        if inputs.use_compact_bfr:
            from bp_calc.bfr import compute_bfr_compact

            total = compute_bfr_compact(inputs.revenue_ttc[yi], inputs.compact_bfr_days)
            detail = BfrDetail(
                revenue_ht=inputs.revenue_ht[yi],
                revenue_ttc=inputs.revenue_ttc[yi],
                client_receivables=inputs.revenue_ttc[yi] * inputs.client_payment_days / 365.0,
                stocks=0.0,
                raw_stock=0.0,
                packaging_stock=0.0,
                finished_stock=0.0,
                arome_stock=0.0,
                supplier_payables=0.0,
                total=total,
            )
        else:
            detail = compute_bfr_detail(
                inputs.revenue_ht[yi],
                inputs.revenue_ttc[yi],
                inputs.raw_purchases[yi],
                inputs.packaging_purchases[yi],
                client_days=inputs.client_payment_days,
                supplier_days=inputs.supplier_payment_days,
                finished_goods_stock_days=inputs.finished_goods_stock_days,
                raw_material_stock_days=inputs.raw_material_stock_days,
                packaging_stock_days=inputs.packaging_stock_days,
            )
        bfr_operating.append(detail.total)
        bfr_details.append(detail)

    bfr_all = bfr_levels_with_year_zero(bfr_operating)
    bfr_vars = bfr_variation_series(bfr_all)

    terminal_year = HORIZON
    vcn_terminal = _net_fixed_assets_end(inputs, HORIZON - 1)
    bfr_terminal = bfr_all[HORIZON] if len(bfr_all) > HORIZON else bfr_all[-1]

    rows: list[CashFlowYearRow] = []
    cumulative = 0.0
    break_even: int | None = None

    period_labels = ["Y0"] + [f"Y{y}" for y in range(1, HORIZON + 1)]

    for pi in range(HORIZON + 1):
        if pi == 0:
            operating = 0.0
            equity_in = inputs.equity
            debt_in = inputs.loan_drawdown
            invest = -inputs.total_investment
            bfr_var = -bfr_vars[1] if len(bfr_vars) > 1 else 0.0
            principal = 0.0
            bfr_rec = 0.0
            vcn = 0.0
        else:
            yi = pi - 1
            operating = inputs.net_profit[yi] + inputs.depreciation[yi]
            equity_in = 0.0
            debt_in = 0.0
            invest = 0.0
            bfr_var = -bfr_vars[pi]
            principal = -inputs.principal_repayment[yi]
            bfr_rec = bfr_terminal if pi == terminal_year else 0.0
            vcn = vcn_terminal if pi == terminal_year else 0.0

        net = operating + equity_in + debt_in + invest + bfr_var + principal + bfr_rec + vcn
        cumulative += net

        if break_even is None and cumulative >= 0 and pi > 0:
            break_even = pi

        rows.append(
            CashFlowYearRow(
                year=pi,
                label=period_labels[pi] if pi < len(period_labels) else f"Y{pi}",
                operating_cf=round(operating, 2),
                equity_inflow=round(equity_in, 2),
                debt_drawdown=round(debt_in, 2),
                initial_investment=round(invest, 2),
                bfr_variation=round(bfr_var, 2),
                principal_repayment=round(principal, 2),
                bfr_recovery=round(bfr_rec, 2),
                net_book_value_recovery=round(vcn, 2),
                net_cash_flow=round(net, 2),
                cumulative_treasury=round(cumulative, 2),
            )
        )

    bfr_series = []
    for yi in range(HORIZON):
        d = bfr_details[yi]
        bfr_series.append(
            BfrComponents(
                year=yi + 1,
                revenue_ht=round(d.revenue_ht, 2),
                revenue_ttc=round(d.revenue_ttc, 2),
                client_receivables=round(d.client_receivables, 2),
                stocks=round(d.stocks, 2),
                raw_stock=round(d.raw_stock, 2),
                packaging_stock=round(d.packaging_stock, 2),
                finished_stock=round(d.finished_stock, 2),
                arome_stock=round(d.arome_stock, 2),
                supplier_payables=round(d.supplier_payables, 2),
                total_bfr=round(d.total, 2),
                bfr_variation=round(bfr_vars[yi + 1], 2),
            )
        )

    chart_waterfall = []
    for row in rows:
        chart_waterfall.append(
            {
                "period": row.label,
                "net": row.net_cash_flow,
                "cumulative": row.cumulative_treasury,
                "operating": row.operating_cf,
                "bfr_var": row.bfr_variation,
                "investment": row.initial_investment,
            }
        )

    receivables_s = [0.0] + [b.client_receivables for b in bfr_series]
    stocks_s = [0.0] + [b.stocks for b in bfr_series]
    payables_s = [0.0] + [-b.supplier_payables for b in bfr_series]

    if break_even is None:
        for row in rows[1:]:
            if row.cumulative_treasury >= 0:
                break_even = row.year
                break

    return CashFlowProjection(
        plan_id=plan_id,
        scenario=scenario,
        bfr_client_days=inputs.client_payment_days,
        rows=rows,
        bfr_series=bfr_series,
        treasury_break_even_year=break_even,
        chart_waterfall=chart_waterfall,
        composition_bfr={
            "receivables": receivables_s,
            "stocks": stocks_s,
            "payables": payables_s,
            "total_bfr": [0.0] + [b.total_bfr for b in bfr_series],
        },
    )
