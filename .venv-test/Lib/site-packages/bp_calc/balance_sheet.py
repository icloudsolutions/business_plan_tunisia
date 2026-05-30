"""7-year balance sheet (bilan prévisionnel) from plan drivers."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from bp_calc.balance import check_balance_sheet
from bp_calc.bfr import compute_bfr
from bp_schema.balance_sheet import (
    HORIZON,
    BalanceLineItem,
    BalanceSheetProjection,
    BalanceSheetRatios,
    BalanceSheetSide,
    BalanceSheetYear,
)

__all__ = ["BalanceSheetDrivers", "build_balance_sheet"]


@dataclass
class BalanceSheetDrivers:
    revenue_ht: list[float]
    raw_purchases: list[float]
    packaging_purchases: list[float]
    net_profit: list[float]
    depreciation: list[float]
    cumulative_treasury: list[float]
    loan_balance_end: list[float]
    vat_payable: list[float]
    intangible_gross: float
    tangible_gross: float
    equity_capital: float
    client_payment_days: int = 30
    supplier_payment_days: int = 30
    finished_goods_stock_days: int = 10
    raw_material_stock_days: int = 30
    packaging_stock_days: int = 15
    arome_share_of_raw: float = 0.05
    tolerance: float = 1000.0


def _pad(values: list[float], length: int = HORIZON) -> list[float]:
    out = list(values[:length])
    while len(out) < length:
        out.append(out[-1] if out else 0.0)
    return out


def _stock_breakdown(
    rev: float,
    raw_p: float,
    pack_p: float,
    wc: BalanceSheetDrivers,
) -> tuple[float, float, float, float, float, float, float]:
    receivables = rev * wc.client_payment_days / 365.0
    payables = (raw_p + pack_p) * wc.supplier_payment_days / 365.0
    finished = rev * wc.finished_goods_stock_days / 365.0
    raw_stock = raw_p * wc.raw_material_stock_days / 365.0
    pack_stock = pack_p * wc.packaging_stock_days / 365.0
    arome_stock = raw_stock * wc.arome_share_of_raw
    stocks = raw_stock + pack_stock + finished + arome_stock
    return stocks, receivables, payables, raw_stock, pack_stock, finished, arome_stock


def build_balance_sheet(
    drivers: BalanceSheetDrivers,
    *,
    plan_id: UUID | None = None,
) -> BalanceSheetProjection:
    rev = _pad(drivers.revenue_ht)
    raw = _pad(drivers.raw_purchases)
    pack = _pad(drivers.packaging_purchases)
    net = _pad(drivers.net_profit)
    dep = _pad(drivers.depreciation)
    treasury = _pad(drivers.cumulative_treasury)
    loans = _pad(drivers.loan_balance_end)
    vat = _pad([max(0.0, v) for v in drivers.vat_payable])

    total_gross = drivers.intangible_gross + drivers.tangible_gross
    cum_dep = 0.0
    cum_profit = 0.0

    years: list[BalanceSheetYear] = []
    net_fixed_series: list[float] = []
    current_assets_series: list[float] = []

    for yi in range(HORIZON):
        year = yi + 1
        cum_dep += dep[yi]
        cum_profit += net[yi]

        int_share = drivers.intangible_gross / total_gross if total_gross > 0 else 0.5
        net_intangible = max(0.0, drivers.intangible_gross - cum_dep * int_share)
        net_tangible = max(0.0, drivers.tangible_gross - cum_dep * (1.0 - int_share))
        net_fixed = net_intangible + net_tangible

        stocks, receivables, payables, raw_s, pack_s, fin_s, arome_s = _stock_breakdown(
            rev[yi], raw[yi], pack[yi], drivers
        )
        treasury_y = max(0.0, treasury[yi])
        current_assets = stocks + receivables + treasury_y
        total_assets = net_fixed + current_assets

        retained = cum_profit
        lt_debt = loans[yi]
        vat_due = vat[yi]
        ct_debt = payables + vat_due

        equity_total = drivers.equity_capital + retained
        total_le = equity_total + lt_debt + ct_debt
        gap = total_assets - total_le
        balanced = abs(gap) <= drivers.tolerance or (
            total_assets > 0 and abs(gap) / total_assets <= 0.02
        )

        bfr = compute_bfr(
            rev[yi],
            raw[yi],
            pack[yi],
            drivers.client_payment_days,
            drivers.supplier_payment_days,
            drivers.finished_goods_stock_days,
            drivers.raw_material_stock_days,
            drivers.packaging_stock_days,
        )
        permanent = equity_total + lt_debt
        fdr = permanent - net_fixed
        tresorerie_nette = fdr - bfr

        ratios = BalanceSheetRatios(
            endettement=(lt_debt / equity_total) if equity_total > 0 else None,
            liquidite=(current_assets / ct_debt) if ct_debt > 0 else None,
            fonds_roulement=fdr,
            bfr=bfr,
            tresorerie_nette=tresorerie_nette,
        )

        assets = BalanceSheetSide(
            title="ACTIFS",
            total=round(total_assets, 2),
            sections=[
                BalanceLineItem(
                    key="fixed_assets",
                    label="Immobilisations nettes",
                    amount=round(net_fixed, 2),
                    children=[
                        BalanceLineItem(
                            key="intangible",
                            label="Immobilisations incorporelles (net)",
                            amount=round(net_intangible, 2),
                        ),
                        BalanceLineItem(
                            key="tangible",
                            label="Immobilisations corporelles (net)",
                            amount=round(net_tangible, 2),
                        ),
                        BalanceLineItem(
                            key="cum_dep",
                            label="Amortissements cumulés",
                            amount=round(-cum_dep, 2),
                        ),
                    ],
                ),
                BalanceLineItem(
                    key="current_assets",
                    label="Actifs courants",
                    amount=round(current_assets, 2),
                    children=[
                        BalanceLineItem(
                            key="stocks",
                            label="Stocks (MP, arômes, emballage, PF)",
                            amount=round(stocks, 2),
                            children=[
                                BalanceLineItem(key="stock_raw", label="Matières premières", amount=round(raw_s, 2)),
                                BalanceLineItem(key="stock_arome", label="Arômes", amount=round(arome_s, 2)),
                                BalanceLineItem(key="stock_pack", label="Emballage", amount=round(pack_s, 2)),
                                BalanceLineItem(key="stock_pf", label="Produits finis", amount=round(fin_s, 2)),
                            ],
                        ),
                        BalanceLineItem(
                            key="receivables",
                            label="Créances clients",
                            amount=round(receivables, 2),
                        ),
                        BalanceLineItem(
                            key="treasury",
                            label="Trésorerie",
                            amount=round(treasury_y, 2),
                        ),
                    ],
                ),
            ],
        )

        liabilities = BalanceSheetSide(
            title="PASSIFS",
            total=round(total_le, 2),
            sections=[
                BalanceLineItem(
                    key="equity",
                    label="Capitaux propres",
                    amount=round(equity_total, 2),
                    children=[
                        BalanceLineItem(
                            key="capital",
                            label="Capital social",
                            amount=round(drivers.equity_capital, 2),
                        ),
                        BalanceLineItem(
                            key="retained",
                            label="Résultats cumulés",
                            amount=round(retained, 2),
                        ),
                    ],
                ),
                BalanceLineItem(
                    key="lt_debt",
                    label="Dettes à long terme — Emprunts",
                    amount=round(lt_debt, 2),
                ),
                BalanceLineItem(
                    key="st_debt",
                    label="Dettes à court terme",
                    amount=round(ct_debt, 2),
                    children=[
                        BalanceLineItem(
                            key="payables",
                            label="Dettes fournisseurs",
                            amount=round(payables, 2),
                        ),
                        BalanceLineItem(
                            key="vat",
                            label="TVA à payer",
                            amount=round(vat_due, 2),
                        ),
                    ],
                ),
            ],
        )

        years.append(
            BalanceSheetYear(
                year=year,
                assets=assets,
                liabilities=liabilities,
                total_assets=round(total_assets, 2),
                total_liabilities_equity=round(total_le, 2),
                balanced=balanced,
                gap=round(gap, 2),
                ratios=ratios,
            )
        )
        net_fixed_series.append(net_fixed)
        current_assets_series.append(current_assets)

    return BalanceSheetProjection(
        plan_id=plan_id,
        years=years,
        composition_series={
            "net_fixed_assets": net_fixed_series,
            "current_assets": current_assets_series,
        },
    )
