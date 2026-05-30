from bp_schema.enums import AuditDecision
from bp_schema.liasse import PlanInputs, PlanResults


def run_financial_audit(inputs: PlanInputs, results: PlanResults | None) -> dict:
    checks = {
        "balanceSheetBalanced": True,
        "positiveTreasuryHorizon": True,
        "bfrCoherent": True,
        "investmentDefined": True,
        "financingBalanced": True,
    }
    recommendations: list[str] = []

    total_inv = sum(i.amount for i in inputs.investments.intangible) + sum(
        i.amount for i in inputs.investments.tangible
    )
    if total_inv <= 0:
        checks["investmentDefined"] = False
        recommendations.append("Renseigner les investissements incorporels et corporels.")

    if abs(inputs.financing.equityRatio + inputs.financing.debtRatio - 1.0) > 0.001:
        checks["financingBalanced"] = False
        recommendations.append("Ajuster la répartition Fonds propres / Dette (total = 100%).")

    if results is None:
        return {
            "decision": AuditDecision.NEEDS_ADJUSTMENT.value,
            "checks": checks,
            "recommendations": recommendations + ["Lancer un calcul complet du plan sur 7 ans."],
        }

    checks["balanceSheetBalanced"] = results.balanceSheetBalanced
    checks["bfrCoherent"] = getattr(results, "bfrCoherent", True)
    if not checks["bfrCoherent"]:
        recommendations.append("BFR incohérent : vérifier délais clients/fournisseurs et niveaux de stock.")
    if results.cashRunwayBreakYear is not None:
        checks["positiveTreasuryHorizon"] = False
        recommendations.append(
            f"Trésorerie négative détectée dès l'année {results.cashRunwayBreakYear}. "
            "Ajuster le BFR, les délais clients ou le schéma de financement."
        )

    if any(v < 0 for v in results.cumulativeTreasury.years):
        checks["positiveTreasuryHorizon"] = False

    if results.indicators.van < 0:
        recommendations.append("VAN négative : revoir les hypothèses de marge et d'investissement.")

    all_ok = all(checks.values())
    if all_ok and results.indicators.van >= 0:
        decision = AuditDecision.VALIDATE.value
    elif checks["investmentDefined"] and results.cashRunwayBreakYear:
        decision = AuditDecision.NEEDS_ADJUSTMENT.value
    elif not checks["investmentDefined"]:
        decision = AuditDecision.REJECT.value
    else:
        decision = AuditDecision.NEEDS_ADJUSTMENT.value

    return {
        "decision": decision,
        "checks": checks,
        "recommendations": recommendations,
        "indicators": {
            "van": results.indicators.van,
            "tri": results.indicators.tri,
            "drciYears": results.indicators.drciYears,
        },
    }
