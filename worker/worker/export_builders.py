"""Rich PDF and Excel export builders for validated business plans."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from bp_schema.liasse import PlanInputs, PlanResults
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

HORIZON = 7
_YEAR_HEADERS = [f"An {i + 1}" for i in range(HORIZON)]


def _fmt(n: float | None, *, digits: int = 0) -> str:
    if n is None:
        return "—"
    return f"{n:,.{digits}f}".replace(",", " ")


def _pct(n: float | None) -> str:
    if n is None:
        return "—"
    return f"{n * 100:.2f}%"


def _year_val(series, y: int) -> float:
    years = getattr(series, "years", series) if not isinstance(series, list) else series
    if y < len(years):
        return float(years[y])
    return 0.0


def _pdf_safe(text: str) -> str:
    return str(text).encode("latin-1", errors="replace").decode("latin-1")


def _investment_rows(inputs: PlanInputs) -> list[list[str]]:
    rows: list[list[str]] = []
    for eq in inputs.investments.equipment:
        if eq.cost > 0 or eq.name.strip():
            rows.append(
                [
                    eq.name,
                    "Incorporel" if eq.assetType == "intangible" else "Corporel",
                    _fmt(eq.cost),
                    str(eq.usefulLifeYears),
                    f"An {eq.acquisitionYear}",
                ]
            )
    for line in inputs.investments.intangible:
        if line.amount > 0:
            rows.append(
                [line.label, "Incorporel", _fmt(line.amount), str(line.usefulLifeYears), "—"]
            )
    for line in inputs.investments.tangible:
        if line.amount > 0:
            rows.append(
                [line.label, "Corporel", _fmt(line.amount), str(line.usefulLifeYears), "—"]
            )
    return rows


def _personnel_rows(inputs: PlanInputs) -> list[list[str]]:
    return [
        [p.role, str(p.headcount), _fmt(p.annualSalary)]
        for p in inputs.plAssumptions.personnel
        if p.role.strip() or p.headcount or p.annualSalary
    ]


def _pl_metric_rows(results: PlanResults) -> list[tuple[str, list[float]]]:
    return [
        ("Chiffre d'affaires HT (TND)", [_year_val(results.revenue, y) for y in range(HORIZON)]),
        ("Résultat net (TND)", [_year_val(results.netProfit, y) for y in range(HORIZON)]),
        (
            "Cash-flow exploitation (TND)",
            [_year_val(results.operatingCashFlow, y) for y in range(HORIZON)],
        ),
        (
            "Trésorerie cumulée (TND)",
            [_year_val(results.cumulativeTreasury, y) for y in range(HORIZON)],
        ),
        ("BFR (TND)", [_year_val(results.bfr, y) for y in range(HORIZON)]),
        ("Variation BFR (TND)", [_year_val(results.bfrVariation, y) for y in range(HORIZON)]),
        ("Amortissements (TND)", [_year_val(results.depreciation, y) for y in range(HORIZON)]),
        ("Intérêts (TND)", [_year_val(results.interestExpense, y) for y in range(HORIZON)]),
        (
            "Remboursement principal (TND)",
            [_year_val(results.principalRepayment, y) for y in range(HORIZON)],
        ),
    ]


def _xlsx_style_header(ws, row: int = 1) -> None:
    fill = PatternFill("solid", fgColor="1E3A5F")
    font = Font(bold=True, color="FFFFFF")
    for cell in ws[row]:
        cell.fill = fill
        cell.font = font
        cell.alignment = Alignment(horizontal="center", vertical="center")


def _xlsx_autowidth(ws, min_width: int = 10, max_width: int = 42) -> None:
    for col in ws.columns:
        letter = get_column_letter(col[0].column)
        width = min_width
        for cell in col:
            if cell.value is not None:
                width = max(width, min(len(str(cell.value)) + 2, max_width))
        ws.column_dimensions[letter].width = width


def _xlsx_write_kv_sheet(ws, title: str, rows: list[tuple[str, str]]) -> None:
    ws.append([title])
    ws["A1"].font = Font(bold=True, size=14)
    ws.append([])
    ws.append(["Rubrique", "Valeur"])
    _xlsx_style_header(ws, row=3)
    for label, value in rows:
        ws.append([label, value])
    _xlsx_autowidth(ws)


def _xlsx_write_table(ws, headers: list, rows: list[list]) -> int:
    ws.append(headers)
    header_row = ws.max_row
    _xlsx_style_header(ws, row=header_row)
    for row in rows:
        ws.append(row)
    _xlsx_autowidth(ws)
    return header_row


def build_export_xlsx(
    plan_id: str,
    inputs: PlanInputs,
    results: PlanResults,
    path: Path,
    *,
    plan_title: str | None = None,
    extra_inputs: dict | None = None,
) -> str:
    from worker.feasibility_study_render import build_feasibility_xlsx

    return build_feasibility_xlsx(
        plan_id,
        inputs,
        results,
        path,
        plan_title=plan_title,
        extra_inputs=extra_inputs,
    )


def _pdf_table(data: list[list], col_widths: list[float] | None = None) -> Table:
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


def build_export_pdf(
    plan_id: str,
    inputs: PlanInputs,
    results: PlanResults,
    path: Path,
    *,
    plan_title: str | None = None,
    extra_inputs: dict | None = None,
) -> str:
    from worker.feasibility_study_render import build_etude_faisabilite_pdf

    return build_etude_faisabilite_pdf(
        plan_id,
        inputs,
        results,
        path,
        plan_title=plan_title,
        extra_inputs=extra_inputs,
    )


