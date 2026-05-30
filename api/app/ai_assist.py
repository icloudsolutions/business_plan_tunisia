"""AI assist prompts and context for Liasse Unique (Tunisia)."""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from bp_schema.liasse import PlanInputs

from app.claude_client import call_claude, parse_structured_reply

FIELD_LABELS: dict[str, str] = {
    "operations.salePrice": "Prix de vente unitaire HT (proxy CA année 1)",
    "operations.capacityPerMinute": "Capacité de production (unités/min)",
    "operations.rawMaterialCost": "Coût matière première unitaire",
    "operations.packagingCost": "Coût emballage unitaire",
    "workingCapital.clientPaymentDays": "Créances clients (jours) — BFR",
    "workingCapital.supplierPaymentDays": "Dettes fournisseurs (jours) — BFR",
    "workingCapital.rawMaterialStockDays": "Stock matières premières (jours) — BFR",
    "workingCapital.packagingStockDays": "Stock emballages (jours) — BFR",
    "workingCapital.finishedGoodsStockDays": "Stock produits finis (jours) — BFR",
    "financing.equityRatio": "Part fonds propres (0–1)",
    "financing.loan.rate": "Taux d'intérêt emprunt (décimal)",
    "plAssumptions.distributionExpensePct": "Frais de distribution (% du CA)",
    "plAssumptions.marketingExpensePct": "Frais marketing (% du CA)",
    "plAssumptions.otherOperatingCharges": "Autres charges opérationnelles (TND/an)",
}

SYSTEM_BASE = """Tu es un expert en business plans et financement d'entreprises en Tunisie,
spécialisé dans la Liasse Unique (Instance Tunisienne de l'Investissement / APII).

Règles :
- Réponds en français, de façon pédagogique et concrète.
- Contexte : fiscalité tunisienne, TND, PME/GE, taux bancaires locaux (~8–10 %), inflation modérée.
- Utilise les champs déjà renseignés pour rester cohérent.
- Pour une valeur numérique à appliquer au formulaire, termine avec un bloc ```json``` :
  {"suggested_value": <nombre>, "unit": "...", "explanation": "...", "benchmarks": "..."}
- suggested_value doit être un nombre brut (pas de texte) sauf si le champ est textuel.
- Donne des repères de PME tunisiennes comparables quand c'est pertinent.
"""


def _summarize_inputs(inputs: PlanInputs) -> str:
    d = inputs.model_dump()
    company = inputs.company.name or "(non renseigné)"
    legal = inputs.company.legalForm
    equip = inputs.investments.equipment
    capex = sum(e.cost for e in equip)
    personnel = sum(p.headcount for p in inputs.plAssumptions.personnel)
    return f"""Entreprise : {company} ({legal})
Secteur déclaré : voir message utilisateur
Localisation : Tunisie
CAPEX équipements : {capex:,.0f} TND ({len(equip)} lignes)
Capacité : {inputs.operations.capacityPerMinute} u/min, {inputs.operations.workingDaysPerYear} j/an
Prix vente unitaire : {inputs.operations.salePrice} TND
Coûts unitaires MP/emballage : {inputs.operations.rawMaterialCost} / {inputs.operations.packagingCost}
BFR (jours) — clients:{inputs.workingCapital.clientPaymentDays}, fournisseurs:{inputs.workingCapital.supplierPaymentDays}, stock MP:{inputs.workingCapital.rawMaterialStockDays}
Financement FP/dette : {inputs.financing.equityRatio:.0%} / {inputs.financing.debtRatio:.0%}
Effectifs déclarés : {personnel} postes
JSON partiel : {json.dumps(d, ensure_ascii=False)[:3500]}"""


async def assist_field(
    *,
    inputs: PlanInputs,
    field_key: str,
    user_message: str,
    sector: str,
    company_type: str,
    location: str,
    chat_history: list[dict[str, str]] | None,
) -> dict[str, Any]:
    label = FIELD_LABELS.get(field_key, field_key)
    system = (
        SYSTEM_BASE
        + f"\nChamp cible : {field_key} ({label})\n"
        + f"Type entreprise : {company_type}\n"
        + f"Secteur : {sector}\n"
        + f"Localisation : {location}\n"
    )
    context = _summarize_inputs(inputs)
    messages: list[dict[str, str]] = [
        {
            "role": "user",
            "content": f"Contexte du dossier :\n{context}\n\nAide-moi à renseigner : {label}",
        }
    ]
    if chat_history:
        messages.extend(chat_history[-8:])
    messages.append({"role": "user", "content": user_message})

    raw = await call_claude(system, messages)
    parsed = parse_structured_reply(raw)
    return {
        "reply": parsed.get("reply") or raw,
        "suggested_value": parsed.get("suggested_value"),
        "benchmarks": parsed.get("benchmarks"),
        "raw": raw,
    }


async def generate_executive_summary(
    *,
    inputs: PlanInputs,
    sector: str,
    company_type: str,
    location: str,
) -> str:
    system = (
        SYSTEM_BASE
        + "\nRédige un résumé exécutif d'environ 200 mots en français, style rapport bancaire / APII, "
        "sans JSON, sans listes à puces excessives. Une seule section fluide."
    )
    context = _summarize_inputs(inputs)
    messages = [
        {
            "role": "user",
            "content": (
                f"Génère le résumé exécutif pour ce business plan.\n"
                f"Secteur : {sector}\nType : {company_type}\nLieu : {location}\n\n{context}"
            ),
        }
    ]
    return await call_claude(system, messages, max_tokens=600)
