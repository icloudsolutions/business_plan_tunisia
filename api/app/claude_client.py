"""Anthropic Claude API client."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger("bp.claude")

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"


async def call_claude(
    system: str,
    messages: list[dict[str, str]],
    *,
    max_tokens: int = 1200,
) -> str:
    if not settings.anthropic_api_key:
        return _mock_response(messages, system)

    payload = {
        "model": settings.anthropic_model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": messages,
    }
    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(
            ANTHROPIC_URL,
            headers={
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        blocks = data.get("content", [])
        parts = [b.get("text", "") for b in blocks if b.get("type") == "text"]
        return "\n".join(parts).strip()


def parse_structured_reply(text: str) -> dict[str, Any]:
    """Extract JSON block or SUGGESTED_VALUE line from model output."""
    out: dict[str, Any] = {"reply": text, "suggested_value": None, "benchmarks": None}

    json_match = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
    if json_match:
        try:
            parsed = json.loads(json_match.group(1))
            out["reply"] = parsed.get("explanation") or text
            out["suggested_value"] = parsed.get("suggested_value")
            out["benchmarks"] = parsed.get("benchmarks")
            return out
        except json.JSONDecodeError:
            pass

    val_match = re.search(r"SUGGESTED_VALUE:\s*([^\n]+)", text, re.IGNORECASE)
    if val_match:
        raw = val_match.group(1).strip()
        try:
            out["suggested_value"] = float(raw.replace(",", ".").replace(" ", ""))
        except ValueError:
            out["suggested_value"] = raw
        out["reply"] = re.sub(r"SUGGESTED_VALUE:.*", "", text, flags=re.IGNORECASE).strip()

    bench_match = re.search(r"BENCHMARKS:\s*(.+?)(?:\n\n|$)", text, re.DOTALL | re.IGNORECASE)
    if bench_match:
        out["benchmarks"] = bench_match.group(1).strip()

    return out


def _mock_response(messages: list[dict[str, str]], system: str) -> str:
    last = messages[-1]["content"] if messages else ""
    logger.warning("ANTHROPIC_API_KEY absent — réponse de démonstration")
    if "résumé" in last.lower() or "executive" in system.lower():
        return (
            "Cette entreprise tunisienne présente un projet structuré conforme à la Liasse Unique. "
            "L'investissement initial est couvert par un mix fonds propres / dette adapté au secteur. "
            "Les hypothèses de production et de BFR reflètent une PME en phase de lancement. "
            "La trajectoire sur sept ans mérite un suivi rapproché de la trésorerie et du marché local."
        )
    return """Voici une estimation indicative pour une PME tunisienne comparable :

- Fourchette observée sur le marché local : alignée avec des projets similaires financés via l'APII.
- Méthode : comparables sectoriels + capacité de production déclarée.

```json
{
  "suggested_value": 1.15,
  "unit": "TND/unité HT",
  "explanation": "Pour une activité de production à Tunis, un prix HT unitaire autour de 1,15 TND est cohérent avec des PME du même segment (marge brute cible 25–35 %). Ajustez selon votre positionnement premium ou discount.",
  "benchmarks": "PME agroalimentaire Grand Tunis : 0,9–1,4 TND/unité ; distribution retail : délais clients 30–45 j."
}
```

*Mode démo — configurez ANTHROPIC_API_KEY pour Claude en production.*"""
