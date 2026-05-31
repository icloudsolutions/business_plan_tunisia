"""VIPA-style étude de faisabilité PDF with narrative, tables and charts."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from bp_schema.liasse import PlanInputs, PlanResults
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.shapes import Drawing, String
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from worker.feasibility_narrative import (
    HORIZON,
    NarrativeContext,
    conclusion_paragraph,
    executive_summary,
    fmt_num,
    narrative_sections,
    pct,
    year_val,
)
from worker.pdf_common import (
    YEAR_HEADERS,
    investment_rows,
    pdf_safe,
    pdf_table,
    personnel_rows,
    pl_metric_rows,
)

_CHART_W = 16 * cm
_CHART_H = 7 * cm


def _bar_chart_drawing(
    title: str,
    labels: list[str],
    values: list[float],
    *,
    fill: str = "#4F46E5",
) -> Drawing:
    d = Drawing(_CHART_W, _CHART_H)
    d.add(
        String(
            0,
            _CHART_H - 14,
            pdf_safe(title),
            fontSize=10,
            fillColor=colors.HexColor("#1E3A5F"),
        )
    )
    bc = VerticalBarChart()
    bc.x = 30
    bc.y = 20
    bc.height = _CHART_H - 50
    bc.width = _CHART_W - 50
    bc.data = [values]
    bc.categoryAxis.categoryNames = labels
    bc.categoryAxis.labels.boxAnchor = "n"
    bc.categoryAxis.labels.angle = 0
    bc.categoryAxis.labels.fontSize = 7
    bc.valueAxis.labels.fontSize = 7
    vmax = max(values) if values and max(values) > 0 else 1
    bc.valueAxis.valueMax = vmax * 1.15
    bc.valueAxis.valueMin = 0
    bc.bars[0].fillColor = colors.HexColor(fill)
    bc.bars[0].strokeColor = colors.HexColor(fill)
    bc.bars[0].strokeWidth = 0
    d.add(bc)
    return d


def build_etude_faisabilite_pdf(
    plan_id: str,
    inputs: PlanInputs,
    results: PlanResults,
    path: Path,
    *,
    plan_title: str | None = None,
) -> str:
    ctx = NarrativeContext(
        plan_id=plan_id,
        inputs=inputs,
        results=results,
        plan_title=plan_title,
    )
    company = ctx.company
    ind = results.indicators
    slug = "".join(c if c.isalnum() else "_" for c in company)[:40].strip("_") or "projet"
    out_path = path / f"etude_faisabilite_{plan_id}_{slug}.pdf"

    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=A4,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )
    styles = getSampleStyleSheet()
    cover_title = ParagraphStyle(
        "CoverTitle",
        parent=styles["Heading1"],
        fontSize=20,
        alignment=1,
        spaceAfter=16,
        textColor=colors.HexColor("#1E3A5F"),
    )
    cover_sub = ParagraphStyle(
        "CoverSub",
        parent=styles["Normal"],
        fontSize=14,
        alignment=1,
        spaceAfter=8,
    )
    h1 = ParagraphStyle(
        "H1",
        parent=styles["Heading1"],
        fontSize=14,
        spaceBefore=16,
        spaceAfter=10,
        textColor=colors.HexColor("#1E3A5F"),
    )
    h2 = ParagraphStyle(
        "H2",
        parent=styles["Heading2"],
        fontSize=11,
        spaceBefore=12,
        spaceAfter=6,
        textColor=colors.HexColor("#1E3A5F"),
    )
    body = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        spaceAfter=6,
    )
    toc = ParagraphStyle(
        "TOC",
        parent=body,
        leftIndent=12,
        spaceAfter=3,
    )

    story: list = []

    # —— Page de garde ——
    story.append(Spacer(1, 3 * cm))
    story.append(Paragraph(pdf_safe("ETUDE DE FAISABILITE"), cover_title))
    story.append(Paragraph(pdf_safe(company), cover_sub))
    story.append(Spacer(1, 12))
    story.append(
        Paragraph(
            pdf_safe(
                f"{ctx.display_title}<br/>"
                f"Forme juridique : {ctx.legal_form}<br/>"
                f"Date du rapport : {ctx.today}<br/>"
                f"Reference dossier : {ctx.ref}"
            ),
            ParagraphStyle("Meta", parent=body, alignment=1),
        )
    )
    story.append(PageBreak())

    # —— Table des matieres (synthetique) ——
    story.append(Paragraph(pdf_safe("Table des matieres"), h1))
    toc_items = [
        "Resume executif",
        "Presentation du promoteur",
        "Presentation du projet et du produit",
        "Etude de marche",
        "Strategie marketing et commerciale",
        "Organisation et ressources humaines",
        "Choix technologique et process",
        "Programme d'investissement",
        "Approvisionnements et implantation",
        "Analyse environnementale",
        "Plan de financement",
        "Comptes previsionnels et graphiques",
        "Analyse de sensibilite",
        "Conclusion",
    ]
    for item in toc_items:
        story.append(Paragraph(pdf_safe(f"• {item}"), toc))
    story.append(PageBreak())

    # —— Resume executif ——
    story.append(Paragraph(pdf_safe("Resume executif"), h1))
    for para in executive_summary(ctx):
        story.append(Paragraph(pdf_safe(para), body))
    story.append(Spacer(1, 8))
    summary_data = [
        ["Indicateur", "Valeur"],
        ["Investissement total (TND)", fmt_num(results.totalInvestment)],
        ["VAN (TND)", fmt_num(ind.van)],
        ["TRI", pct(ind.tri)],
        ["DRCI (ans)", fmt_num(ind.drciYears, digits=1) if ind.drciYears else "—"],
        ["Bilan equilibre", "Oui" if results.balanceSheetBalanced else "Non"],
        ["BFR coherent", "Oui" if results.bfrCoherent else "Non"],
        [
            "Tresorerie 7 ans",
            "OK"
            if results.cashRunwayBreakYear is None
            else f"Alerte an {results.cashRunwayBreakYear}",
        ],
    ]
    story.append(pdf_table(summary_data, [8 * cm, 8 * cm]))
    story.append(PageBreak())

    # —— Chapitres narratifs ——
    for heading, paragraphs in narrative_sections(ctx):
        story.append(Paragraph(pdf_safe(heading), h1))
        for para in paragraphs:
            story.append(Paragraph(pdf_safe(para), body))
        story.append(Spacer(1, 6))

    story.append(PageBreak())

    # —— Investissements ——
    story.append(Paragraph(pdf_safe("Programme d'investissement"), h1))
    inv = investment_rows(inputs)
    if inv:
        inv_data = [
            ["Designation", "Nature", "TND", "Amort.", "An"],
            *inv[:14],
        ]
        if len(inv) > 14:
            inv_data.append(["...", f"{len(inv) - 14} lignes supplementaires", "", "", ""])
        story.append(
            pdf_table(inv_data, [5 * cm, 2.5 * cm, 2.5 * cm, 1.5 * cm, 1.5 * cm])
        )
    else:
        story.append(
            Paragraph(
                pdf_safe("Aucun investissement detaille dans la liasse."),
                body,
            )
        )
    story.append(
        Paragraph(
            pdf_safe(f"Total investissement retenu : {fmt_num(results.totalInvestment)} TND."),
            body,
        )
    )
    story.append(Spacer(1, 10))

    # —— Financement ——
    fin = inputs.financing
    wc = inputs.workingCapital
    story.append(Paragraph(pdf_safe("Plan de financement (detail)"), h2))
    fin_data = [
        ["Poste", "Valeur"],
        ["Fonds propres", pct(fin.equityRatio)],
        ["Dette", pct(fin.debtRatio)],
        [
            "Montant emprunt (TND)",
            fmt_num(fin.loan.amount or results.totalInvestment * fin.debtRatio),
        ],
        ["Taux emprunt", pct(fin.loan.rate)],
        ["Duree emprunt", f"{fin.loan.years} ans"],
        ["Delai clients (j)", str(wc.clientPaymentDays)],
        ["Delai fournisseurs (j)", str(wc.supplierPaymentDays)],
        ["Stock PF (j)", str(wc.finishedGoodsStockDays)],
        ["Stock MP (mois)", fmt_num(wc.rawMaterialStockMonths, digits=1)],
    ]
    story.append(pdf_table(fin_data, [8 * cm, 8 * cm]))
    story.append(PageBreak())

    # —— Comptes previsionnels ——
    story.append(Paragraph(pdf_safe("Comptes previsionnels et rentabilite (7 ans)"), h1))
    pl_data: list[list] = [["Poste"] + YEAR_HEADERS]
    for label, vals in pl_metric_rows(results):
        pl_data.append([label] + [fmt_num(v) for v in vals])
    col_w = [4 * cm] + [1.9 * cm] * HORIZON
    story.append(pdf_table(pl_data, col_w))
    story.append(Spacer(1, 14))

    labels = [f"An {i + 1}" for i in range(HORIZON)]
    rev_vals = [year_val(results.revenue, y) for y in range(HORIZON)]
    np_vals = [year_val(results.netProfit, y) for y in range(HORIZON)]
    tre_vals = [year_val(results.cumulativeTreasury, y) for y in range(HORIZON)]

    story.append(
        _bar_chart_drawing(
            "Graphique 1 — Chiffre d'affaires HT (TND)",
            labels,
            rev_vals,
            fill="#4F46E5",
        )
    )
    story.append(Spacer(1, 12))
    story.append(
        _bar_chart_drawing(
            "Graphique 2 — Resultat net (TND)",
            labels,
            np_vals,
            fill="#059669",
        )
    )
    story.append(Spacer(1, 12))
    story.append(
        _bar_chart_drawing(
            "Graphique 3 — Tresorerie cumulee (TND)",
            labels,
            tre_vals,
            fill="#D97706",
        )
    )

    pers = personnel_rows(inputs)
    if pers:
        story.append(Spacer(1, 10))
        story.append(Paragraph(pdf_safe("Masse salariale"), h2))
        pers_data = [["Poste", "Effectif", "Salaire TND"]] + pers[:12]
        story.append(pdf_table(pers_data, [6 * cm, 2 * cm, 4 * cm]))

    story.append(PageBreak())
    story.append(Paragraph(pdf_safe("Conclusion et recommandation"), h1))
    story.append(Paragraph(pdf_safe(conclusion_paragraph(ctx)), body))
    story.append(Spacer(1, 12))
    story.append(
        Paragraph(
            pdf_safe(
                "Document genere automatiquement par Business Plan Tunisie — "
                f"{datetime.now().strftime('%d/%m/%Y %H:%M')}. "
                "Les parties qualitatives (marche, technique, environnement) sont fournies "
                "a titre generique et doivent etre adaptees par le promoteur."
            ),
            ParagraphStyle("Foot", parent=body, fontSize=8, textColor=colors.grey),
        )
    )

    doc.build(story)
    return str(out_path.resolve())
