"""12 templates sectoriels de base (TIA / pratiques bancaires tunisiennes)."""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DocumentTemplate, User
from app.template_services import sync_hypothesis_rows

logger = logging.getLogger("bp.api.seed.templates")

DEFAULT_SECTIONS = [
    "resume_executif",
    "investissement",
    "financement",
    "marche",
    "exploitation",
    "rentabilite",
    "fiscalite",
    "sensibilite",
    "planning",
]


def _hyp(
    *,
    inv_min: float,
    inv_max: float,
    inv_target: float | None = None,
    corp_pct: float = 65,
    bfr_pct: float = 30,
    amort: int = 10,
    equity_pct: float = 30,
    rate: float = 8.3,
    years: int = 7,
    grace: float = 1,
    growth: float = 15,
    margin: float = 35,
    bfr_days: float = 35,
    discount: float = 10,
    marketing: float = 3.5,
    transport: float = 3.0,
    is_rate: float = 25,
    tva_buy: float = 18,
    tva_sell: float = 6,
    emplois: int | None = None,
) -> dict:
    return {
        "investissement": {
            "montant_min_DT": inv_min,
            "montant_max_DT": inv_max,
            "montant_cible_DT": inv_target or (inv_min + inv_max) / 2,
            "part_immo_corporelles_pct": corp_pct,
            "part_bfr_pct": bfr_pct,
            "duree_amortissement_equipements_ans": amort,
        },
        "financement": {
            "taux_fonds_propres_min_pct": equity_pct,
            "taux_CMT_max_pct": 100 - equity_pct,
            "taux_interet_CMT_pct": rate,
            "duree_CMT_max_ans": years,
            "duree_grace_max_ans": grace,
        },
        "exploitation": {
            "taux_croissance_ca_annuel_pct": growth,
            "taux_marge_brute_pct": margin,
            "bfr_jours_ca": bfr_days,
            "taux_ristourne_pct": discount,
            "taux_marketing_sur_ca_pct": marketing,
            "taux_transport_sur_ca_pct": transport,
            "taux_maintenance_sur_equipements_pct": 4.0,
            "emplois_crees": emplois,
        },
        "fiscalite": {
            "taux_is_pct": is_rate,
            "taux_tva_achats_pct": tva_buy,
            "taux_tva_ventes_pct": tva_sell,
            "taux_cnss_pct": 19.75,
        },
    }


BASE_TEMPLATES: list[dict] = [
    {
        "code": "AGROALIMENTAIRE_PME_TRANSFORMATION",
        "name": "Business Plan Agroalimentaire PME — Transformation",
        "version": "v2.1",
        "secteur": "INDUSTRIE_AGROALIMENTAIRE",
        "sous_secteur": "transformation_fruits_legumes",
        "type_entreprise": "PME",
        "type_financement": "MIXTE",
        "description": "Fruits secs, conserves, condiments — paramètres type VIPA.",
        "hypotheses": _hyp(
            inv_min=400_000,
            inv_max=800_000,
            inv_target=600_000,
            growth=15,
            margin=35,
            emplois=25,
        ),
    },
    {
        "code": "AGROALIMENTAIRE_PME_BOULANGERIE",
        "name": "Boulangerie / Pâtisserie PME",
        "version": "v1.0",
        "secteur": "INDUSTRIE_AGROALIMENTAIRE",
        "sous_secteur": "boulangerie_patisserie",
        "type_entreprise": "PME",
        "type_financement": "CMT_SEUL",
        "hypotheses": _hyp(
            inv_min=80_000,
            inv_max=300_000,
            inv_target=180_000,
            corp_pct=55,
            bfr_pct=25,
            growth=8,
            margin=40,
            bfr_days=20,
            equity_pct=35,
            emplois=8,
        ),
    },
    {
        "code": "AGROALIMENTAIRE_GE_INDUSTRIE",
        "name": "Industrie agroalimentaire — Grande entreprise",
        "version": "v1.0",
        "secteur": "INDUSTRIE_AGROALIMENTAIRE",
        "sous_secteur": "conserves_condiments",
        "type_entreprise": "GE",
        "type_financement": "MIXTE",
        "hypotheses": _hyp(
            inv_min=1_000_000,
            inv_max=5_000_000,
            inv_target=2_500_000,
            corp_pct=70,
            bfr_pct=25,
            growth=12,
            margin=32,
            equity_pct=40,
            emplois=55,
        ),
    },
    {
        "code": "TEXTILE_PME_CONFECTION",
        "name": "Confection textile PME",
        "version": "v1.0",
        "secteur": "INDUSTRIE_TEXTILE",
        "sous_secteur": "confection_vetements",
        "type_entreprise": "PME",
        "type_financement": "CMT_SEUL",
        "hypotheses": _hyp(
            inv_min=200_000,
            inv_max=500_000,
            inv_target=350_000,
            margin=28,
            growth=10,
            bfr_days=45,
            emplois=40,
        ),
    },
    {
        "code": "SERVICE_IT_STARTUP",
        "name": "Startup numérique / IT",
        "version": "v1.0",
        "secteur": "SERVICES",
        "sous_secteur": "informatique_numerique",
        "type_entreprise": "STARTUP",
        "type_financement": "FONDS_PROPRES",
        "hypotheses": _hyp(
            inv_min=30_000,
            inv_max=150_000,
            inv_target=80_000,
            corp_pct=25,
            bfr_pct=15,
            growth=25,
            margin=55,
            bfr_days=25,
            equity_pct=60,
            grace=0,
            emplois=6,
        ),
    },
    {
        "code": "SERVICE_CONSULTANCE",
        "name": "Cabinet de conseil / formation",
        "version": "v1.0",
        "secteur": "SERVICES",
        "sous_secteur": "consulting_formation",
        "type_entreprise": "PME",
        "type_financement": "FONDS_PROPRES",
        "hypotheses": _hyp(
            inv_min=15_000,
            inv_max=80_000,
            inv_target=40_000,
            corp_pct=20,
            bfr_pct=10,
            growth=12,
            margin=60,
            bfr_days=30,
            equity_pct=70,
            emplois=4,
        ),
    },
    {
        "code": "COMMERCE_DETAIL_PME",
        "name": "Commerce de détail PME",
        "version": "v1.0",
        "secteur": "COMMERCE",
        "sous_secteur": "commerce_detail",
        "type_entreprise": "PME",
        "type_financement": "MIXTE",
        "hypotheses": _hyp(
            inv_min=100_000,
            inv_max=400_000,
            inv_target=220_000,
            corp_pct=40,
            bfr_pct=45,
            margin=22,
            growth=8,
            bfr_days=50,
            emplois=6,
        ),
    },
    {
        "code": "AGRICULTURE_MARAICHAGE",
        "name": "Maraîchage sous serre",
        "version": "v1.0",
        "secteur": "AGRICULTURE",
        "sous_secteur": "serres",
        "type_entreprise": "PME",
        "type_financement": "MIXTE",
        "hypotheses": _hyp(
            inv_min=150_000,
            inv_max=600_000,
            inv_target=350_000,
            growth=10,
            margin=30,
            bfr_days=40,
            equity_pct=35,
            emplois=12,
        ),
    },
    {
        "code": "ARTISANAT_POTERIE",
        "name": "Unité artisanale — Poterie / céramique",
        "version": "v1.0",
        "secteur": "ARTISANAT",
        "sous_secteur": "poterie_ceramique",
        "type_entreprise": "PME",
        "type_financement": "FONDS_PROPRES",
        "hypotheses": _hyp(
            inv_min=20_000,
            inv_max=80_000,
            inv_target=45_000,
            corp_pct=50,
            bfr_pct=20,
            growth=6,
            margin=45,
            equity_pct=50,
            emplois=3,
        ),
    },
    {
        "code": "BTP_MATERIAUX",
        "name": "Fabrication matériaux de construction",
        "version": "v1.0",
        "secteur": "BTP",
        "sous_secteur": "materiaux_construction",
        "type_entreprise": "PME",
        "type_financement": "CMT_SEUL",
        "hypotheses": _hyp(
            inv_min=800_000,
            inv_max=2_500_000,
            inv_target=1_500_000,
            corp_pct=75,
            amort=15,
            growth=8,
            margin=25,
            bfr_days=55,
            emplois=30,
        ),
    },
    {
        "code": "TOURISME_HEBERGEMENT",
        "name": "Hébergement touristique (maison d'hôtes)",
        "version": "v1.0",
        "secteur": "SERVICES",
        "sous_secteur": "tourisme_hotellerie",
        "type_entreprise": "PME",
        "type_financement": "MIXTE",
        "hypotheses": _hyp(
            inv_min=200_000,
            inv_max=800_000,
            inv_target=450_000,
            growth=18,
            margin=38,
            bfr_days=30,
            marketing=5.0,
            emplois=10,
        ),
    },
    {
        "code": "SANTE_CLINIQUE_PME",
        "name": "Clinique / cabinet médical PME",
        "version": "v1.0",
        "secteur": "SERVICES",
        "sous_secteur": "sante_cliniques",
        "type_entreprise": "PME",
        "type_financement": "LEASING",
        "hypotheses": _hyp(
            inv_min=300_000,
            inv_max=1_200_000,
            inv_target=650_000,
            corp_pct=60,
            growth=10,
            margin=42,
            bfr_days=35,
            emplois=15,
        ),
    },
]


async def seed_document_templates(db: AsyncSession) -> int:
    """Insère les templates de base si absents (idempotent par code)."""
    admin = (
        await db.execute(select(User).where(User.role == "admin").limit(1))
    ).scalar_one_or_none()
    created = 0
    for spec in BASE_TEMPLATES:
        code = spec["code"]
        existing = (
            await db.execute(select(DocumentTemplate).where(DocumentTemplate.code == code))
        ).scalar_one_or_none()
        if existing:
            continue
        tpl = DocumentTemplate(
            id=uuid.uuid4(),
            code=code,
            name=spec["name"],
            version=spec.get("version", "v1.0"),
            secteur=spec["secteur"],
            sous_secteur=spec["sous_secteur"],
            type_entreprise=spec["type_entreprise"],
            type_financement=spec["type_financement"],
            document_type=spec.get("document_type", "ALL"),
            hypotheses=spec["hypotheses"],
            sections_incluses=spec.get("sections_incluses", DEFAULT_SECTIONS),
            description=spec.get("description"),
            created_by_id=admin.id if admin else None,
            is_active=True,
            is_public=True,
            usage_count=0,
        )
        db.add(tpl)
        await db.flush()
        for row in sync_hypothesis_rows(tpl):
            db.add(row)
        created += 1
    if created:
        await db.commit()
        logger.info("Seeded %d document templates", created)
    return created
