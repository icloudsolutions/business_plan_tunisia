"""
VIPA reference structure for étude de faisabilité exports.

Based on: Etude de faisabilité VIPA VDEF 15012015.doc
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from bp_schema.liasse import PlanInputs, PlanResults

from worker.feasibility_narrative import (
    HORIZON,
    NarrativeContext,
    fmt_num,
    pct,
    year_val,
)

# Placeholder when data is not in the liasse
def ph(hint: str) -> str:
    return f"............... (à compléter — mettre à jour la valeur : {hint})"


def txt(value: str | None, hint: str) -> str:
    if value and str(value).strip():
        return str(value).strip()
    return ph(hint)


def num(
    value: float | None,
    hint: str,
    *,
    digits: int = 0,
    allow_zero: bool = True,
) -> str:
    if value is None:
        return ph(hint)
    if not allow_zero and abs(value) < 1e-9:
        return ph(hint)
    return fmt_num(value, digits=digits)


@dataclass
class TableBlock:
    headers: list[str]
    rows: list[list[str]]
    caption: str | None = None


@dataclass
class SectionBlock:
    title: str
    level: int = 1
    part: str = ""
    paragraphs: list[str] = field(default_factory=list)
    tables: list[TableBlock] = field(default_factory=list)
    bullets: list[str] = field(default_factory=list)


@dataclass
class SommaireEntry:
    section: str
    subsection: str | None = None
    page: str = "—"


# VIPA sommaire (structure du document de référence)
VIPA_SOMMAIRE: list[SommaireEntry] = [
    SommaireEntry("PRESENTATION DU PROJET", "Présentation de l'étude", "3"),
    SommaireEntry("", "Présentation du projet objet de l'étude", "3"),
    SommaireEntry("", "Planning prévisionnel de réalisation", "4"),
    SommaireEntry("", "Avantages financiers", "4"),
    SommaireEntry("ÉTUDE DE MARCHÉ", "Contexte de consommation et demande", "5"),
    SommaireEntry("", "Indices des prix à la consommation (IPC)", "6"),
    SommaireEntry("", "Habitudes alimentaires et clientèle", "7"),
    SommaireEntry("", "Analyse SWOT", "8"),
    SommaireEntry("PROGRAMME D'INVESTISSEMENT", "Investissement global", "9"),
    SommaireEntry("", "Agencement et aménagement de la construction", "10"),
    SommaireEntry("", "Matériel industriel", "11"),
    SommaireEntry("", "Matériel de transport", "12"),
    SommaireEntry("", "Matériels et mobiliers de bureau", "13"),
    SommaireEntry("", "Frais préliminaires", "14"),
    SommaireEntry("FINANCEMENT", "Plan de financement", "15"),
    SommaireEntry("", "Besoin en fonds de roulement", "16"),
    SommaireEntry("COMPTES PRÉVISIONNELS", "Chiffre d'affaires", "17"),
    SommaireEntry("", "Achats consommés", "18"),
    SommaireEntry("", "Marge brute", "19"),
    SommaireEntry("", "Charges de personnel", "20"),
    SommaireEntry("", "Dotations aux amortissements", "21"),
    SommaireEntry("", "Autres charges d'exploitation", "22"),
    SommaireEntry("", "Crédit bancaire", "23"),
    SommaireEntry("SYNTHÈSE ET CONCLUSION", "Indicateurs de rentabilité (VAN, TRI, DRCI)", "24"),
]


class VipaStudyBuilder:
    """Build VIPA-structured study content from plan data."""

    def __init__(
        self,
        ctx: NarrativeContext,
        *,
        extra_inputs: dict[str, Any] | None = None,
    ):
        self.ctx = ctx
        self.inputs = ctx.inputs
        self.results = ctx.results
        self.extra = extra_inputs or {}

    @property
    def company(self) -> str:
        return self.ctx.company

    @property
    def report_month_year(self) -> str:
        return datetime.now().strftime("%B %Y").capitalize()

    def _avg_revenue(self) -> float:
        vals = [year_val(self.results.revenue, y) for y in range(HORIZON)]
        nonzero = [v for v in vals if v > 0]
        if not nonzero:
            return 0.0
        return sum(nonzero) / len(nonzero)

    def _total_headcount(self) -> int:
        return sum(p.headcount for p in self.inputs.plAssumptions.personnel)

    def _equity_amount(self) -> float:
        return self.results.totalInvestment * self.inputs.financing.equityRatio

    def _debt_amount(self) -> float:
        loan = self.inputs.financing.loan
        return float(
            loan.amount
            if loan.amount is not None
            else self.results.totalInvestment * self.inputs.financing.debtRatio
        )

    def cover_block(self) -> list[str]:
        return [
            self.company.upper(),
            "« " + self.company + " »",
            "",
            "Etude de faisabilité",
            "",
            self.report_month_year,
            "",
            ph("cabinet / auteur de l'étude (ex. Cabinet MAS)"),
        ]

    def project_fiche_table(self) -> TableBlock:
        ops = self.inputs.operations
        y1_ca = year_val(self.results.revenue, 0)
        activity = txt(
            self.extra.get("activity") or self.extra.get("sector"),
            "activité principale (ex. valorisation et conditionnement)",
        )
        return TableBlock(
            headers=["Rubrique", "Valeur"],
            rows=[
                ["Type du projet", txt(self.extra.get("projectType"), "type du projet (Création / Extension)")],
                ["Activité", activity],
                [
                    "Cadre juridique",
                    f"{self.ctx.legal_form} — "
                    + txt(
                        self.extra.get("legalFramework"),
                        "référence code des incitations / textes applicables",
                    ),
                ],
                ["Implantation", txt(self.extra.get("site"), "zone industrielle / gouvernorat")],
                [
                    "Capital social",
                    num(self._equity_amount(), "capital social (fonds propres)", allow_zero=False)
                    + " DT",
                ],
                [
                    "Participation",
                    txt(self.extra.get("shareholding"), "structure de participation (ex. 100 % tunisienne)"),
                ],
                [
                    "Coût du projet",
                    num(self.results.totalInvestment, "coût total du projet", allow_zero=False) + " DT",
                ],
                [
                    "Nombre d'emplois",
                    str(self._total_headcount())
                    if self._total_headcount() > 0
                    else ph("effectifs prévisionnels"),
                ],
                [
                    "Produits finis",
                    txt(self.extra.get("finishedProducts"), "description des produits finis et conditionnements"),
                ],
                [
                    "Chiffre d'affaires année 1 (HT)",
                    num(y1_ca, "chiffre d'affaires année 1", allow_zero=False) + " DT",
                ],
                [
                    "Prix de vente unitaire",
                    num(ops.salePrice, "prix de vente unitaire", allow_zero=False) + " DT",
                ],
            ],
            caption="Fiche projet",
        )

    def presentation_etude_paragraphs(self) -> list[str]:
        inv = num(self.results.totalInvestment, "investissement global", allow_zero=False)
        ca = num(self._avg_revenue(), "chiffre d'affaires annuel moyen", allow_zero=False)
        site = txt(self.extra.get("site"), "lieu d'implantation")
        activity = txt(self.extra.get("activity"), "objet du projet / activité")
        return [
            (
                f"Cette étude portera sur le projet porté par « {self.company} » : {activity}. "
                f"Ce projet, dont l'investissement global est de {inv} DT, sera implanté à {site}."
            ),
            (
                f"Ce projet permettra de réaliser un chiffre d'affaires annuel moyen prévisionnel de "
                f"{ca} DT sur l'horizon de sept ans retenu dans la liasse unique."
            ),
            (
                "Cette étude a été établie à partir des données saisies dans Business Plan Tunisie "
                "(hypothèses d'exploitation, investissements, financement et comptes prévisionnels). "
                "Les rubriques qualitatives (marché, technique, environnement) sont fournies sous forme "
                "de trame VIPA à adapter par le promoteur."
            ),
            (
                "Les différentes rubriques développées ci-après permettent de cerner et de présenter "
                "les composantes du projet : l'entreprise, les aspects techniques, économiques et "
                "financiers de l'exploitation."
            ),
        ]

    def planning_paragraphs(self) -> list[str]:
        return [
            "Le planning de réalisation du projet se présente comme suit :",
            ph("planning prévisionnel détaillé (phases, mois, jalons)"),
            (
                "Les dates de démarrage des travaux, d'installation et de montée en cadence "
                "sont à préciser dans la liasse ou en annexe."
            ),
        ]

    def avantages_financiers_table(self) -> TableBlock:
        return TableBlock(
            headers=["Nature de l'avantage", "Au titre de l'encouragement des investissements"],
            rows=[
                [
                    "a. Prime d'investissement",
                    ph("prime d'investissement (% et plafond)"),
                ],
                [
                    "b. Prime d'étude et d'assistance technique",
                    ph("prime étude / assistance technique"),
                ],
                [
                    "c. Prime au titre des investissements immatériels",
                    ph("prime investissements immatériels"),
                ],
            ],
            caption="Avantages financiers (Code des incitations aux investissements)",
        )

    def marche_paragraphs(self) -> list[str]:
        return [
            (
                "Représentant une part importante du PIB en Tunisie, la consommation privée occupe "
                "une place de première importance parmi les grands agrégats économiques et joue un "
                "rôle prépondérant dans la dynamique économique."
            ),
            (
                "L'évolution du comportement alimentaire des consommateurs, notamment la tendance "
                "vers les produits « prêts à la consommation », soutient la demande pour les activités "
                "de transformation et de conditionnement agro-alimentaire."
            ),
            ph("analyse sectorielle locale et nationale (données INS / études)"),
        ]

    def ipc_table(self) -> TableBlock:
        return TableBlock(
            headers=["Année", "Produits alimentaires", "Fruits frais et secs", "Légumes"],
            rows=[
                ["2006-2013", ph("indice IPC"), ph("indice fruits secs"), ph("indice légumes")],
                [
                    "Source",
                    "Institut National de la Statistique (INS)",
                    "—",
                    "—",
                ],
            ],
            caption="Variations des indices des prix à la consommation (IPC) — à compléter",
        )

    def marche_bullets(self) -> list[str]:
        return [
            (
                "Nouvelles habitudes alimentaires : "
                + ph("commentaire sur la demande saisonnière et les cérémonies")
            ),
            (
                "Bienfaits / arguments produit : "
                + ph("arguments nutritionnels et différenciation")
            ),
            (
                "Clientèle : "
                + ph("segmentation clients cibles (âges, canaux, zones)")
            ),
            (
                "Rentabilité du secteur : "
                + ph("analyse concurrentielle et marges du secteur")
            ),
        ]

    def swot_table(self) -> TableBlock:
        return TableBlock(
            headers=["", "Contenu"],
            rows=[
                [
                    "FORCES",
                    ph("forces du projet (innovation, variété, rentabilité…)"),
                ],
                [
                    "FAIBLESSES",
                    ph("faiblesses (concurrence importée, dépendances…)"),
                ],
                [
                    "Opportunités",
                    ph("opportunités de marché"),
                ],
                [
                    "Menaces",
                    ph("menaces (nouveaux entrants, réglementation…)"),
                ],
            ],
            caption="Analyse SWOT",
        )

    def _capex_rows(self) -> list[list[str]]:
        rows: list[list[str]] = []
        for eq in self.inputs.investments.equipment:
            if eq.cost > 0 or eq.name.strip():
                rows.append(
                    [
                        eq.name,
                        "1",
                        num(eq.cost, eq.name, allow_zero=False),
                    ]
                )
        for line in self.inputs.investments.intangible:
            if line.amount > 0:
                rows.append([line.label, "1", num(line.amount, line.label, allow_zero=False)])
        for line in self.inputs.investments.tangible:
            if line.amount > 0:
                rows.append([line.label, "1", num(line.amount, line.label, allow_zero=False)])
        return rows

    def investissement_sections(self) -> list[SectionBlock]:
        total = num(self.results.totalInvestment, "investissement total", allow_zero=False)
        capex = self._capex_rows()
        blocks = [
            SectionBlock(
                "Investissement",
                level=2,
                part="invest",
                paragraphs=[
                    (
                        f"L'investissement total pour la réalisation du projet s'élève à "
                        f"{total} DT et se détaille comme suit :"
                    ),
                ],
            ),
            SectionBlock(
                "Agencement et aménagement de la construction",
                level=2,
                paragraphs=[
                    ph("montant et détail des agencements (climatisation, électricité, sécurité…)"),
                ],
                tables=[
                    TableBlock(
                        ["Poste", "Valeur en DT"],
                        [["Total agencements", ph("total agencements")]],
                    )
                ],
            ),
            SectionBlock(
                "Matériel industriel",
                level=2,
                paragraphs=[
                    (
                        f"Le montant des acquisitions d'équipements industriels est estimé à "
                        f"{num(self.results.totalInvestment, 'matériel industriel', allow_zero=False)} DT "
                        "et se détaille comme suit :"
                        if capex
                        else ph("détail du matériel industriel")
                    ),
                ],
                tables=[
                    TableBlock(
                        ["Matériels industriels", "Quantité", "Valeur en DT"],
                        capex if capex else [["—", "—", ph("lignes équipements")]],
                    )
                ],
            ),
            SectionBlock(
                "Matériel de transport",
                level=2,
                paragraphs=[ph("véhicules et montant matériel de transport")],
                tables=[
                    TableBlock(
                        ["Matériels de transport", "Quantité", "Valeur en DT"],
                        [["—", "—", ph("fourgons / véhicules")]],
                    )
                ],
            ),
            SectionBlock(
                "Matériels et mobiliers de bureau",
                level=2,
                paragraphs=[ph("ordinateurs, bureaux, mobilier administratif")],
                tables=[
                    TableBlock(
                        ["Poste", "Valeur en DT"],
                        [["Total bureau", ph("mobilier de bureau")]],
                    )
                ],
            ),
            SectionBlock(
                "Frais préliminaires",
                level=2,
                paragraphs=[
                    "Les frais préliminaires se détaillent comme suit :",
                ],
                tables=[
                    TableBlock(
                        ["Frais préliminaires", "Valeur en DT"],
                        [
                            ["Prospection commerciale et publicité", ph("prospection / publicité")],
                            ["Etude de rentabilité", ph("coût étude")],
                            ["Formation du personnel", ph("formation")],
                            ["Frais de constitution", ph("frais de constitution")],
                            ["Total", ph("total frais préliminaires")],
                        ],
                    )
                ],
            ),
        ]
        return blocks

    def financement_table(self) -> TableBlock:
        fin = self.inputs.financing
        eq = self._equity_amount()
        debt = self._debt_amount()
        total = self.results.totalInvestment or (eq + debt)
        pct_eq = pct(fin.equityRatio) if total else ph("% fonds propres")
        pct_debt = pct(fin.debtRatio) if total else ph("% crédit")
        return TableBlock(
            headers=["Source de financement", "Valeur (DT)", "%"],
            rows=[
                ["Fonds propres", num(eq, "fonds propres", allow_zero=False), pct_eq],
                ["Crédit à moyen terme", num(debt, "emprunt", allow_zero=False), pct_debt],
                [
                    "Total",
                    num(total, "total financement", allow_zero=False),
                    "100 %",
                ],
            ],
            caption="Plan de financement",
        )

    def bfr_paragraph(self) -> str:
        wc = self.inputs.workingCapital
        days = wc.clientPaymentDays + wc.finishedGoodsStockDays
        return (
            f"Le besoin en fonds de roulement est piloté par un délai clients de "
            f"{wc.clientPaymentDays} jours, un stock produits finis de "
            f"{wc.finishedGoodsStockDays} jours et un stock matières de "
            f"{fmt_num(wc.rawMaterialStockMonths, digits=1)} mois. "
            + ph("commentaire BFR / crédit TVA structurel si applicable")
        )

    def ca_table(self) -> TableBlock:
        headers = ["Produit / poste", *[f"An {i + 1}" for i in range(HORIZON)]]
        rev_row = [
            "Chiffre d'affaires net HT",
            *[
                num(year_val(self.results.revenue, y), f"CA an {y + 1}", allow_zero=False)
                for y in range(HORIZON)
            ],
        ]
        prod_rows: list[list[str]] = []
        catalog = []
        products_block = self.extra.get("products")
        if isinstance(products_block, dict):
            catalog = products_block.get("catalog") or []
        if isinstance(catalog, list) and catalog:
            for item in catalog[:12]:
                if isinstance(item, dict):
                    name = str(item.get("name") or item.get("label") or "Produit").strip()
                else:
                    name = str(item)
                if name:
                    prod_rows.append(
                        [name, *[ph(f"CA {name} an {y + 1}") for y in range(HORIZON)]]
                    )
        elif any(year_val(self.results.qtySold, y) > 0 for y in range(HORIZON)):
            prod_rows.append(
                [
                    "Quantités vendues",
                    *[
                        num(year_val(self.results.qtySold, y), f"qté an {y + 1}", digits=0)
                        for y in range(HORIZON)
                    ],
                ]
            )
        else:
            prod_rows.append(
                ["Détail par produit", *[ph(f"CA produit an {y + 1}") for y in range(HORIZON)]]
            )
        return TableBlock(
            headers=headers,
            rows=[*prod_rows, rev_row],
            caption="Chiffre d'affaires prévisionnel",
        )

    def achats_table(self) -> TableBlock:
        headers = ["Poste", *[f"An {i + 1}" for i in range(HORIZON)]]
        mp = [
            num(year_val(self.results.purchaseValueMP, y), f"achats MP an {y + 1}")
            for y in range(HORIZON)
        ]
        if any(v != ph(f"achats MP an {i + 1}") for i, v in enumerate(mp)):
            rows = [["Achats matières premières", *mp]]
        else:
            rows = [["Achats consommés (détail)", *[ph(f"achats an {y + 1}") for y in range(HORIZON)]]]
        return TableBlock(headers=headers, rows=rows, caption="Achats consommés")

    def marge_brute_table(self) -> TableBlock:
        headers = ["Indicateur", *[f"An {i + 1}" for i in range(HORIZON)]]
        marge_row = []
        for y in range(HORIZON):
            rev = year_val(self.results.revenue, y)
            achats = year_val(self.results.purchaseValueMP, y)
            if rev > 0 and achats >= 0:
                rate = max(0.0, (rev - achats) / rev * 100)
                marge_row.append(f"{rate:.1f} %")
            else:
                marge_row.append(ph(f"taux marge brute an {y + 1}"))
        return TableBlock(
            headers=headers,
            rows=[["Taux de marge brute (indicatif)", *marge_row]],
            caption="Marge brute prévisionnelle",
        )

    def personnel_effectif_table(self) -> TableBlock:
        pers = self.inputs.plAssumptions.personnel
        if not pers:
            return TableBlock(
                headers=["Fonctions", *[f"An {i + 1}" for i in range(HORIZON)]],
                rows=[["Effectif total", *[ph("effectif") for _ in range(HORIZON)]]],
                caption="Structure prévisionnelle du personnel",
            )
        rows = []
        for p in pers:
            if p.role.strip() or p.headcount:
                rows.append([p.role, *[str(p.headcount)] * HORIZON])
        total = self._total_headcount()
        rows.append(["Total", *[str(total)] * HORIZON])
        return TableBlock(
            headers=["Fonctions", *[f"An {i + 1}" for i in range(HORIZON)]],
            rows=rows,
            caption="Structure prévisionnelle du personnel",
        )

    def personnel_charges_table(self) -> TableBlock:
        # Salary mass approximated from personnel lines * headcount
        rows = []
        total_salary = sum(p.headcount * p.annualSalary for p in self.inputs.plAssumptions.personnel)
        for y in range(HORIZON):
            rows.append(num(total_salary, f"masse salariale an {y + 1}", allow_zero=False))
        return TableBlock(
            headers=["Rubrique", *[f"An {i + 1}" for i in range(HORIZON)]],
            rows=[
                ["Salaire brut (estimation liasse)", *rows],
                ["CNSS et charges (à valider)", *[ph("charges sociales") for _ in range(HORIZON)]],
            ],
            caption="Évolution des charges de personnel",
        )

    def amortissements_table(self) -> TableBlock:
        headers = ["Investissements", "Valeur", "Taux", *[f"An {i + 1}" for i in range(HORIZON)]]
        dep_row = [
            "Dotations totales",
            num(self.results.totalInvestment, "base amortissable"),
            ph("taux amortissement"),
            *[
                num(year_val(self.results.depreciation, y), f"amort. an {y + 1}")
                for y in range(HORIZON)
            ],
        ]
        return TableBlock(headers=headers, rows=[dep_row], caption="Dotations aux amortissements")

    def autres_charges_table(self) -> TableBlock:
        return TableBlock(
            headers=["Désignation", *[f"An {i + 1}" for i in range(HORIZON)]],
            rows=[
                [
                    "Frais de marketing",
                    *[
                        num(year_val(self.results.marketingExpense, y), f"marketing an {y + 1}")
                        for y in range(HORIZON)
                    ],
                ],
                [
                    "Transport / distribution sur vente",
                    *[
                        num(year_val(self.results.distributionExpense, y), f"distribution an {y + 1}")
                        for y in range(HORIZON)
                    ],
                ],
                [
                    "Autres charges d'exploitation",
                    *[
                        ph(f"autres charges an {y + 1}")
                        for y in range(HORIZON)
                    ],
                ],
                [
                    "Total",
                    *[
                        num(
                            year_val(self.results.marketingExpense, y)
                            + year_val(self.results.distributionExpense, y),
                            f"total charges an {y + 1}",
                        )
                        for y in range(HORIZON)
                    ],
                ],
            ],
            caption="Autres charges d'exploitation",
        )

    def credit_paragraphs(self) -> list[str]:
        loan = self.inputs.financing.loan
        return [
            (
                f"Le montant du crédit bancaire retenu s'élève à "
                f"{num(self._debt_amount(), 'montant emprunt', allow_zero=False)} DT avec les "
                "conditions suivantes :"
            ),
            f"Durée de remboursement : {loan.years} ans avec un différé principal de "
            f"{loan.graceMonthsPrincipal} mois.",
            f"Taux d'intérêt retenu : {pct(loan.rate)}.",
            ph("modalités TMM / garanties / banque partenaire"),
        ]

    def indicateurs_table(self) -> TableBlock:
        ind = self.results.indicators
        return TableBlock(
            headers=["Indicateur", "Valeur"],
            rows=[
                ["Investissement total (DT)", num(self.results.totalInvestment, "CAPEX", allow_zero=False)],
                ["Valeur Actuelle Nette (VAN)", num(ind.van, "VAN")],
                ["Taux de Rentabilité Interne (TRI)", pct(ind.tri)],
                [
                    "Délai de récupération (DRCI)",
                    num(ind.drciYears, "DRCI", digits=1) + " ans"
                    if ind.drciYears
                    else ph("DRCI"),
                ],
                ["Taux d'actualisation", pct(ind.discountRate)],
                [
                    "Bilan prévisionnel équilibré",
                    "Oui" if self.results.balanceSheetBalanced else "Non",
                ],
                [
                    "Trésorerie sur 7 ans",
                    "Positive"
                    if self.results.cashRunwayBreakYear is None
                    else f"Rupture an {self.results.cashRunwayBreakYear}",
                ],
            ],
            caption="Synthèse des indicateurs de rentabilité",
        )

    def all_sections(self) -> list[SectionBlock]:
        """Full VIPA document body (after cover and sommaire)."""
        sections: list[SectionBlock] = []

        sections.append(
            SectionBlock(
                "PRESENTATION DU PROJET",
                part="presentation",
                paragraphs=[],
            )
        )
        sections.append(
            SectionBlock(
                "Présentation de l'étude",
                level=2,
                part="presentation",
                paragraphs=self.presentation_etude_paragraphs(),
            )
        )
        sections.append(
            SectionBlock(
                "Présentation du projet objet de l'étude",
                level=2,
                part="presentation",
                paragraphs=[],
                tables=[self.project_fiche_table()],
            )
        )
        sections.append(
            SectionBlock(
                "Planning prévisionnel de réalisation",
                level=2,
                part="presentation",
                paragraphs=self.planning_paragraphs(),
            )
        )
        sections.append(
            SectionBlock(
                "Avantages financiers",
                level=2,
                part="presentation",
                paragraphs=[
                    "Ce projet d'investissement peut bénéficier des avantages financiers prévus "
                    "par le Code des incitations aux investissements (à vérifier selon le secteur "
                    "et la localisation) :",
                ],
                bullets=[
                    "Une prime d'investissement au titre des équipements et investissements prioritaires ;",
                    "Une prime au titre de la participation de l'État aux frais d'étude ;",
                    "Une prime au titre des investissements immatériels.",
                ],
                tables=[self.avantages_financiers_table()],
            )
        )

        sections.append(
            SectionBlock(
                "ÉTUDE DE MARCHÉ",
                part="marche",
                paragraphs=self.marche_paragraphs(),
                tables=[self.ipc_table()],
                bullets=self.marche_bullets(),
            )
        )
        sections.append(
            SectionBlock(
                "Analyse SWOT",
                level=2,
                part="marche",
                paragraphs=[],
                tables=[self.swot_table()],
            )
        )

        sections.append(SectionBlock("PROGRAMME D'INVESTISSEMENT", part="invest", paragraphs=[]))
        for blk in self.investissement_sections():
            blk.part = "invest"
            sections.append(blk)

        sections.append(
            SectionBlock(
                "FINANCEMENT",
                part="finance",
                paragraphs=[
                    "Le financement du projet sera réalisé par fonds propres et par crédit bancaire :",
                ],
                tables=[self.financement_table()],
            )
        )
        sections.append(
            SectionBlock(
                "Besoin en fonds de roulement",
                level=2,
                part="finance",
                paragraphs=[self.bfr_paragraph()],
            )
        )

        sections.append(
            SectionBlock(
                "COMPTES PRÉVISIONNELS",
                part="comptes",
                paragraphs=[],
            )
        )
        sections.append(
            SectionBlock(
                "Chiffre d'affaires",
                level=2,
                part="comptes",
                paragraphs=[
                    "Le chiffre d'affaires prévisionnel net des ristournes pour la période "
                    "sur sept ans se présente comme suit (valeurs en DT) :",
                    f"Ristourne commerciale retenue : {pct(self.inputs.plAssumptions.commercialDiscount)}.",
                    ph("hypothèses de volumes, prix et évolution annuelle"),
                ],
                tables=[self.ca_table()],
            )
        )
        sections.append(
            SectionBlock(
                "Achats consommés",
                level=2,
                part="comptes",
                paragraphs=[
                    "Les achats consommés comprennent les matières premières, les emballages, "
                    "l'énergie et les consommables :",
                ],
                tables=[self.achats_table()],
            )
        )
        sections.append(
            SectionBlock(
                "Marge brute",
                level=2,
                part="comptes",
                paragraphs=[
                    "La marge brute prévisionnelle est présentée dans le tableau suivant :",
                ],
                tables=[self.marge_brute_table()],
            )
        )
        sections.append(
            SectionBlock(
                "Charges de personnel",
                level=2,
                part="comptes",
                paragraphs=[
                    "La structure prévisionnelle du personnel se répartit comme suit :",
                ],
                tables=[self.personnel_effectif_table(), self.personnel_charges_table()],
            )
        )
        sections.append(
            SectionBlock(
                "Dotations aux amortissements des immobilisations",
                level=2,
                part="comptes",
                paragraphs=[
                    "Le détail des dotations aux amortissements sur l'horizon du projet :",
                ],
                tables=[self.amortissements_table()],
            )
        )
        sections.append(
            SectionBlock(
                "Autres charges d'exploitation",
                level=2,
                part="comptes",
                paragraphs=[
                    "Les autres charges d'exploitation se détaillent par sous-rubriques :",
                ],
                tables=[self.autres_charges_table()],
            )
        )
        sections.append(
            SectionBlock(
                "Crédit bancaire",
                level=2,
                part="comptes",
                paragraphs=self.credit_paragraphs(),
            )
        )

        sections.append(
            SectionBlock(
                "SYNTHÈSE ET CONCLUSION",
                part="synthese",
                paragraphs=[
                    self._conclusion_text(),
                ],
                tables=[self.indicateurs_table(), self._pl_summary_table()],
            )
        )
        return sections

    def _pl_summary_table(self) -> TableBlock:
        headers = ["Poste", *[f"An {i + 1}" for i in range(HORIZON)]]
        rows = [
            [
                "Chiffre d'affaires HT",
                *[num(year_val(self.results.revenue, y), f"CA {y}") for y in range(HORIZON)],
            ],
            [
                "Résultat net",
                *[num(year_val(self.results.netProfit, y), f"RN {y}") for y in range(HORIZON)],
            ],
            [
                "Trésorerie cumulée",
                *[
                    num(year_val(self.results.cumulativeTreasury, y), f"trés. {y}")
                    for y in range(HORIZON)
                ],
            ],
        ]
        return TableBlock(headers=headers, rows=rows, caption="Compte de résultat et trésorerie")

    def _conclusion_text(self) -> str:
        ind = self.results.indicators
        if (
            ind.van >= 0
            and self.results.balanceSheetBalanced
            and self.results.cashRunwayBreakYear is None
        ):
            return (
                f"Sous les hypothèses retenues, le projet « {self.company} » présente une VAN "
                f"positive ({fmt_num(ind.van)} DT) et une trésorerie tenable sur sept ans. "
                "Le dossier peut être présenté pour examen, sous réserve de compléter les "
                "rubriques marquées « à compléter » et de joindre les pièces justificatives."
            )
        return (
            f"Le projet « {self.company} » appelle une vigilance sur la rentabilité ou la "
            "trésorerie. Il est recommandé d'ajuster les hypothèses avant dépôt définitif."
        )
