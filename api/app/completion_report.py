"""PDF completeness report for experts."""

from __future__ import annotations

import io

from bp_schema.completion import SECTION_TITLES, compute_plan_completion
from bp_schema.liasse import PlanInputs


def _pdf_safe(text: str) -> str:
    return text.encode("latin-1", errors="replace").decode("latin-1")


def build_completeness_report_pdf(
    *,
    plan_title: str,
    plan_status: str,
    owner_email: str,
    inputs: PlanInputs,
) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    report = compute_plan_completion(inputs)
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    y = height - 48

    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, y, _pdf_safe("Rapport de complétude — Liasse Unique"))
    y -= 22
    c.setFont("Helvetica", 11)
    for line in (
        f"Plan : {plan_title}",
        f"Statut : {plan_status}",
        f"Client : {owner_email}",
        f"Complétion globale : {report['overall_pct']} %",
        f"Soumission possible : {'Oui' if report['can_submit'] else 'Non'}",
    ):
        y -= 16
        c.drawString(50, y, _pdf_safe(line))

    y -= 24
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, _pdf_safe("Par section"))
    y -= 18
    c.setFont("Helvetica", 10)

    for sec in report["sections"]:
        if y < 80:
            c.showPage()
            y = height - 48
            c.setFont("Helvetica", 10)
        title = SECTION_TITLES[sec["section"]][0]
        status = sec["status"].upper()
        line = f"- {title}: {sec['score_pct']}% [{status}]"
        y -= 14
        c.drawString(55, y, _pdf_safe(line))
        for path in sec["required_missing"]:
            if y < 60:
                c.showPage()
                y = height - 48
            y -= 12
            c.setFillColorRGB(0.8, 0.1, 0.1)
            c.drawString(70, y, _pdf_safe(f"  REQUIS manquant: {path}"))
            c.setFillColorRGB(0, 0, 0)
        for path in sec["recommended_missing"]:
            if y < 60:
                c.showPage()
                y = height - 48
            y -= 12
            c.setFillColorRGB(0.85, 0.45, 0.1)
            c.drawString(70, y, _pdf_safe(f"  Recommandé: {path}"))
            c.setFillColorRGB(0, 0, 0)

    if report["required_missing"]:
        y -= 20
        if y < 100:
            c.showPage()
            y = height - 48
        c.setFont("Helvetica-Bold", 11)
        c.drawString(50, y, _pdf_safe("Synthèse des champs requis manquants"))
        y -= 16
        c.setFont("Helvetica", 10)
        for item in report["required_missing"]:
            if y < 60:
                c.showPage()
                y = height - 48
            y -= 13
            c.drawString(55, y, _pdf_safe(f"• {item['label_fr']} ({item['path']})"))

    c.save()
    buf.seek(0)
    return buf.getvalue()
