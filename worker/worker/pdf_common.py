"""Shared PDF table helpers for export builders."""

from __future__ import annotations

from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle

from bp_schema.liasse import PlanInputs, PlanResults
from worker.feasibility_narrative import HORIZON, fmt_num, year_val

YEAR_HEADERS = [f"An {i + 1}" for i in range(HORIZON)]


def pdf_safe(text: str) -> str:
    return str(text).encode("latin-1", errors="replace").decode("latin-1")


def investment_rows(inputs: PlanInputs) -> list[list[str]]:
    rows: list[list[str]] = []
    for eq in inputs.investments.equipment:
        if eq.cost > 0 or eq.name.strip():
            rows.append(
                [
                    eq.name,
                    "Incorporel" if eq.assetType == "intangible" else "Corporel",
                    fmt_num(eq.cost),
                    str(eq.usefulLifeYears),
                    f"An {eq.acquisitionYear}",
                ]
            )
    for line in inputs.investments.intangible:
        if line.amount > 0:
            rows.append(
                [line.label, "Incorporel", fmt_num(line.amount), str(line.usefulLifeYears), "—"]
            )
    for line in inputs.investments.tangible:
        if line.amount > 0:
            rows.append(
                [line.label, "Corporel", fmt_num(line.amount), str(line.usefulLifeYears), "—"]
            )
    return rows


def personnel_rows(inputs: PlanInputs) -> list[list[str]]:
    return [
        [p.role, str(p.headcount), fmt_num(p.annualSalary)]
        for p in inputs.plAssumptions.personnel
        if p.role.strip() or p.headcount or p.annualSalary
    ]


def pl_metric_rows(results: PlanResults) -> list[tuple[str, list[float]]]:
    return [
        ("Chiffre d'affaires HT (TND)", [year_val(results.revenue, y) for y in range(HORIZON)]),
        ("Resultat net (TND)", [year_val(results.netProfit, y) for y in range(HORIZON)]),
        (
            "Cash-flow exploitation (TND)",
            [year_val(results.operatingCashFlow, y) for y in range(HORIZON)],
        ),
        (
            "Tresorerie cumulee (TND)",
            [year_val(results.cumulativeTreasury, y) for y in range(HORIZON)],
        ),
        ("BFR (TND)", [year_val(results.bfr, y) for y in range(HORIZON)]),
        ("Variation BFR (TND)", [year_val(results.bfrVariation, y) for y in range(HORIZON)]),
        ("Amortissements (TND)", [year_val(results.depreciation, y) for y in range(HORIZON)]),
        ("Interets (TND)", [year_val(results.interestExpense, y) for y in range(HORIZON)]),
        (
            "Remboursement principal (TND)",
            [year_val(results.principalRepayment, y) for y in range(HORIZON)],
        ),
    ]


def pdf_table(data: list[list], col_widths: list[float] | None = None) -> Table:
    t = Table(data, colWidths=col_widths)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A5F")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 9),
                ("FONTSIZE", (0, 1), (-1, -1), 8),
                ("ALIGN", (0, 0), (0, -1), "LEFT"),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F1F5F9")]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return t
