"""
Taxonomie des secteurs d'activité (Tunisie / TIA) et schémas de templates documentaires.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

DocumentType = Literal["EXCEL", "WORD", "PPTX", "ALL"]
TypeEntreprise = Literal["PME", "GE", "STARTUP"]
TypeFinancement = Literal["CMT_SEUL", "LEASING", "MIXTE", "FONDS_PROPRES"]
HypotheseCategorie = Literal["INVESTISSEMENT", "CA", "CHARGES", "FINANCEMENT", "FISCALITE", "EXPLOITATION"]

SECTEURS_ACTIVITE: dict[str, dict[str, Any]] = {
    "INDUSTRIE_AGROALIMENTAIRE": {
        "label": "Industrie agroalimentaire",
        "sous_secteurs": [
            "transformation_fruits_legumes",
            "boulangerie_patisserie",
            "conserves_condiments",
            "huiles_graisses",
            "boissons",
            "produits_laitiers",
            "viandes_poissons",
            "alimentation_animale",
        ],
        "code_TIA": "A",
        "avantages_fiscaux": ["prime_investissement_10pct", "prime_etude_70pct"],
    },
    "INDUSTRIE_TEXTILE": {
        "label": "Textile et habillement",
        "sous_secteurs": [
            "confection_vetements",
            "tissage_bonneterie",
            "tannerie_maroquinerie",
            "chaussures",
        ],
        "code_TIA": "B",
    },
    "INDUSTRIE_MECANIQUE": {
        "label": "Mécanique et métallurgie",
        "sous_secteurs": [
            "fabrication_metallique",
            "maintenance_industrielle",
            "fonderie",
            "sous_traitance_automobile",
        ],
        "code_TIA": "C",
    },
    "SERVICES": {
        "label": "Services aux entreprises",
        "sous_secteurs": [
            "informatique_numerique",
            "consulting_formation",
            "logistique_transport",
            "tourisme_hotellerie",
            "sante_cliniques",
            "education_enseignement",
        ],
        "code_TIA": "S",
    },
    "AGRICULTURE": {
        "label": "Agriculture et pêche",
        "sous_secteurs": [
            "cultures_maraicheres",
            "arboriculture",
            "elevage",
            "peche_aquaculture",
            "serres",
        ],
        "code_TIA": "AG",
    },
    "ARTISANAT": {
        "label": "Artisanat et métiers",
        "sous_secteurs": [
            "poterie_ceramique",
            "tapis_tissage",
            "bijouterie",
            "menuiserie",
        ],
        "code_TIA": "AR",
    },
    "BTP": {
        "label": "BTP et matériaux de construction",
        "sous_secteurs": [
            "construction_batiment",
            "materiaux_construction",
            "promotion_immobiliere",
        ],
        "code_TIA": "BTP",
    },
    "COMMERCE": {
        "label": "Commerce et distribution",
        "sous_secteurs": [
            "commerce_detail",
            "grande_distribution",
            "import_export",
            "franchise",
        ],
        "code_TIA": "COM",
    },
}

SOUS_SECTEUR_LABELS: dict[str, str] = {
    "transformation_fruits_legumes": "Transformation fruits & légumes",
    "boulangerie_patisserie": "Boulangerie / pâtisserie",
    "conserves_condiments": "Conserves & condiments",
    "huiles_graisses": "Huiles & graisses",
    "boissons": "Boissons",
    "produits_laitiers": "Produits laitiers",
    "viandes_poissons": "Viandes & poissons",
    "alimentation_animale": "Alimentation animale",
    "confection_vetements": "Confection",
    "tissage_bonneterie": "Tissage & bonneterie",
    "tannerie_maroquinerie": "Maroquinerie",
    "chaussures": "Chaussures",
    "fabrication_metallique": "Fabrication métallique",
    "maintenance_industrielle": "Maintenance industrielle",
    "fonderie": "Fonderie",
    "sous_traitance_automobile": "Sous-traitance automobile",
    "informatique_numerique": "Informatique & numérique",
    "consulting_formation": "Conseil & formation",
    "logistique_transport": "Logistique & transport",
    "tourisme_hotellerie": "Tourisme & hébergement",
    "sante_cliniques": "Santé & cliniques",
    "education_enseignement": "Éducation",
    "cultures_maraicheres": "Maraîchage",
    "arboriculture": "Arboriculture",
    "elevage": "Élevage",
    "peche_aquaculture": "Pêche & aquaculture",
    "serres": "Serres",
    "poterie_ceramique": "Poterie & céramique",
    "tapis_tissage": "Tapis & tissage",
    "bijouterie": "Bijouterie",
    "menuiserie": "Menuiserie",
    "construction_batiment": "Construction",
    "materiaux_construction": "Matériaux de construction",
    "promotion_immobiliere": "Promotion immobilière",
    "commerce_detail": "Commerce de détail",
    "grande_distribution": "Grande distribution",
    "import_export": "Import / export",
    "franchise": "Franchise",
}


class TemplateHypothesesInvestissement(BaseModel):
    montant_min_DT: float = 50_000
    montant_max_DT: float = 2_000_000
    part_immo_corporelles_pct: float = 65
    part_bfr_pct: float = 30
    duree_amortissement_equipements_ans: int = 10
    montant_cible_DT: float | None = None


class TemplateHypothesesFinancement(BaseModel):
    taux_fonds_propres_min_pct: float = 30
    taux_CMT_max_pct: float = 70
    taux_interet_CMT_pct: float = 8.3
    duree_CMT_max_ans: int = 7
    duree_grace_max_ans: int = 1


class TemplateHypothesesExploitation(BaseModel):
    taux_croissance_ca_annuel_pct: float = 15
    taux_marge_brute_pct: float = 35
    bfr_jours_ca: float = 35
    taux_ristourne_pct: float = 10
    taux_marketing_sur_ca_pct: float = 3.5
    taux_transport_sur_ca_pct: float = 3.0
    taux_maintenance_sur_equipements_pct: float = 4.0
    emplois_crees: int | None = None


class TemplateHypothesesFiscalite(BaseModel):
    taux_is_pct: float = 25
    taux_tva_achats_pct: float = 18
    taux_tva_ventes_pct: float = 6
    taux_cnss_pct: float = 19.75


class TemplateHypothesesBundle(BaseModel):
    investissement: TemplateHypothesesInvestissement = Field(
        default_factory=TemplateHypothesesInvestissement
    )
    financement: TemplateHypothesesFinancement = Field(
        default_factory=TemplateHypothesesFinancement
    )
    exploitation: TemplateHypothesesExploitation = Field(
        default_factory=TemplateHypothesesExploitation
    )
    fiscalite: TemplateHypothesesFiscalite = Field(default_factory=TemplateHypothesesFiscalite)


class TemplateHypotheseRow(BaseModel):
    """Ligne normalisée pour table template_hypotheses."""

    categorie: HypotheseCategorie
    cle: str
    valeur_defaut: float
    unite: str = "%"
    description: str = ""
    min_valeur: float | None = None
    max_valeur: float | None = None
    source: str = "TIA 2023"


def validate_secteur(secteur: str) -> str:
    if secteur not in SECTEURS_ACTIVITE:
        raise ValueError(f"Secteur inconnu: {secteur}")
    return secteur


def validate_sous_secteur(secteur: str, sous_secteur: str) -> str:
    validate_secteur(secteur)
    allowed = SECTEURS_ACTIVITE[secteur]["sous_secteurs"]
    if sous_secteur not in allowed:
        raise ValueError(f"Sous-secteur {sous_secteur} invalide pour {secteur}")
    return sous_secteur


def list_taxonomy() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for key, meta in SECTEURS_ACTIVITE.items():
        out.append(
            {
                "id": key,
                "label": meta["label"],
                "code_TIA": meta.get("code_TIA"),
                "avantages_fiscaux": meta.get("avantages_fiscaux", []),
                "sous_secteurs": [
                    {
                        "id": ss,
                        "label": SOUS_SECTEUR_LABELS.get(ss, ss.replace("_", " ").title()),
                    }
                    for ss in meta["sous_secteurs"]
                ],
            }
        )
    return out


def hypotheses_to_rows(hyp: dict[str, Any]) -> list[TemplateHypotheseRow]:
    """Aplatit le JSON hypotheses en lignes pour template_hypotheses."""
    rows: list[TemplateHypotheseRow] = []
    mapping: list[tuple[str, HypotheseCategorie, str, str]] = [
        ("investissement", "INVESTISSEMENT", "montant_cible_DT", "DT"),
        ("investissement", "INVESTISSEMENT", "part_immo_corporelles_pct", "%"),
        ("financement", "FINANCEMENT", "taux_interet_CMT_pct", "%"),
        ("financement", "FINANCEMENT", "taux_fonds_propres_min_pct", "%"),
        ("exploitation", "EXPLOITATION", "taux_croissance_ca_annuel_pct", "%"),
        ("exploitation", "EXPLOITATION", "taux_marge_brute_pct", "%"),
        ("exploitation", "CHARGES", "taux_marketing_sur_ca_pct", "%"),
        ("fiscalite", "FISCALITE", "taux_is_pct", "%"),
    ]
    for section, cat, cle, unite in mapping:
        block = hyp.get(section) or {}
        if cle not in block:
            continue
        rows.append(
            TemplateHypotheseRow(
                categorie=cat,
                cle=cle,
                valeur_defaut=float(block[cle]),
                unite=unite,
                description=f"{section}.{cle}",
                source="BCT 2024" if "taux" in cle else "TIA 2023",
            )
        )
    return rows


def hypotheses_preview(hyp: dict[str, Any]) -> dict[str, float | int | str]:
    exp = hyp.get("exploitation") or {}
    fin = hyp.get("financement") or {}
    inv = hyp.get("investissement") or {}
    target = inv.get("montant_cible_DT") or inv.get("montant_min_DT")
    return {
        "taux_marge_brute_pct": exp.get("taux_marge_brute_pct"),
        "taux_croissance_ca_annuel_pct": exp.get("taux_croissance_ca_annuel_pct"),
        "taux_interet_CMT_pct": fin.get("taux_interet_CMT_pct"),
        "investissement_DT": target,
    }
