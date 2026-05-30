import json

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from bp_schema.enums import OutputMode
from bp_schema.liasse import PlanInputs, PlanResults
from bp_schema.validation import validate_draft_inputs

from app.access_control import get_plan_for_user
from app.audit import run_financial_audit
from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.schemas import CopilotRequest

router = APIRouter(prefix="/copilot", tags=["copilot"])


@router.post("")
async def copilot(
    body: CopilotRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Moteur d'intelligence — JWT required. Optional plan_id enforces plan-level access."""
    if body.plan_id is not None:
        await get_plan_for_user(body.plan_id, user, db)

    inputs = PlanInputs.model_validate(body.input_data.get("inputs", body.input_data))
    results_data = body.input_data.get("results")
    results = PlanResults.model_validate(results_data) if results_data else None

    if body.output_mode == OutputMode.DATA_MODE.value:
        missing = validate_draft_inputs(inputs)
        payload = {
            "workflowState": body.state,
            "action": body.action,
            "missingFields": missing,
            "inputs": inputs.model_dump(),
            "results": results.model_dump() if results else None,
        }
        return Response(content=json.dumps(payload, ensure_ascii=False), media_type="application/json")

    audit = run_financial_audit(inputs, results)

    if body.output_mode == OutputMode.AUDIT_MODE.value:
        lines = [
            "# Rapport d'audit exécutif",
            "",
            f"**État du workflow:** {body.state}",
            f"**Décision:** [{audit['decision']}]",
            "",
            "## Checklist de cohérence financière",
        ]
        for k, v in audit["checks"].items():
            lines.append(f"- {k}: {'OK' if v else 'NON CONFORME'}")
        lines.append("")
        lines.append("## Recommandations")
        for r in audit.get("recommendations", []):
            lines.append(f"- {r}")
        if audit.get("indicators"):
            lines.append("")
            lines.append("## Indicateurs")
            for k, v in audit["indicators"].items():
                lines.append(f"- {k}: {v}")
        return {"report": "\n".join(lines), "decision": audit["decision"]}

    company = inputs.company.name or "la société"
    van = results.indicators.van if results else 0
    tri = results.indicators.tri if results else None
    report = (
        f"# Synthèse du Business Plan — {company}\n\n"
        f"Le présent dossier, soumis à l'examen du comité de crédit et conforme aux exigences "
        f"de la Liasse Unique (Instance Tunisienne de l'Investissement), projette l'activité "
        f"sur une horizon de sept exercices.\n\n"
        f"La forme juridique retenue est la {inputs.company.legalForm}. "
        f"L'investissement initial s'élève à {sum(i.amount for i in inputs.investments.intangible) + sum(i.amount for i in inputs.investments.tangible):,.0f} TND, "
        f"financé à {inputs.financing.equityRatio*100:.0f}% par fonds propres et "
        f"{inputs.financing.debtRatio*100:.0f}% par endettement bancaire.\n\n"
    )
    if results:
        report += (
            f"La Valeur Actuelle Nette (VAN), actualisée à {results.indicators.discountRate*100:.0f}%, "
            f"s'établit à {van:,.0f} TND. "
        )
        if tri:
            report += f"Le Taux Interne de Rentabilité (TRI) est de {tri*100:.2f}%. "
        if results.cashRunwayBreakYear:
            report += (
                f"Une vigilance s'impose : la trésorerie devient tendue dès l'année "
                f"{results.cashRunwayBreakYear}.\n"
            )
        else:
            report += "La trajectoire de trésorerie demeure positive sur l'horizon projeté.\n"
    report += "\n\n*Nous restons à votre disposition pour tout complément d'information.*"
    return {"report": report}
