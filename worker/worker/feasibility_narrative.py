"""VIPA-style narrative blocks for étude de faisabilité (PDF / DOCX)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from bp_schema.liasse import PlanInputs, PlanResults

HORIZON = 7


def fmt_num(n: float | None, *, digits: int = 0) -> str:
    if n is None:
        return "—"
    return f"{n:,.{digits}f}".replace(",", " ")


def pct(n: float | None) -> str:
    if n is None:
        return "—"
    return f"{n * 100:.2f} %"


def year_val(series, y: int) -> float:
    years = getattr(series, "years", series) if not isinstance(series, list) else series
    if y < len(years):
        return float(years[y])
    return 0.0


@dataclass
class NarrativeContext:
    plan_id: str
    inputs: PlanInputs
    results: PlanResults
    plan_title: str | None = None

    @property
    def company(self) -> str:
        return self.inputs.company.name.strip() or "Projet"

    @property
    def legal_form(self) -> str:
        return self.inputs.company.legalForm or "—"

    @property
    def today(self) -> str:
        return datetime.now().strftime("%d/%m/%Y")

    @property
    def ref(self) -> str:
        return self.plan_id[:8].upper()

    @property
    def display_title(self) -> str:
        return self.plan_title or f"Business Plan — {self.company}"


def executive_summary(ctx: NarrativeContext) -> list[str]:
    ind = ctx.results.indicators
    tre = (
        "positive sur l'horizon de sept ans"
        if ctx.results.cashRunwayBreakYear is None
        else f"une rupture est signalée dès l'an {ctx.results.cashRunwayBreakYear}"
    )
    return [
        (
            f"La présente étude de faisabilité porte sur le projet « {ctx.company} », "
            f"structuré sous la forme {ctx.legal_form}. Elle a pour objet d'examiner la "
            "pertinence technique, commerciale, organisationnelle et financière du projet "
            "d'investissement, conformément aux exigences des guichets d'accompagnement "
            "à l'investissement en Tunisie."
        ),
        (
            f"Le programme d'investissement retenu s'élève à {fmt_num(ctx.results.totalInvestment)} "
            f"dinars tunisiens (TND). Les projections sur sept exercices font ressortir une "
            f"Valeur Actuelle Nette (VAN) de {fmt_num(ind.van)} TND, un Taux de Rentabilité "
            f"Interne (TRI) de {pct(ind.tri)} et un délai de récupération indicatif (DRCI) "
            f"de {fmt_num(ind.drciYears, digits=1) + ' ans' if ind.drciYears else 'non calculé'}. "
            f"La trésorerie cumulée apparaît {tre}."
        ),
        (
            "Les sections suivantes détaillent la présentation du promoteur, l'analyse de marché "
            "(cadre générique à adapter), l'organisation, les choix technologiques, le plan de "
            "financement et les comptes prévisionnels issus de la liasse unique."
        ),
    ]


def narrative_sections(ctx: NarrativeContext) -> list[tuple[str, list[str]]]:
    """(heading, paragraphs) in VIPA document order."""
    ops = ctx.inputs.operations
    fin = ctx.inputs.financing
    wc = ctx.inputs.workingCapital
    loan = fin.loan
    ind = ctx.results.indicators
    pers_count = sum(p.headcount for p in ctx.inputs.plAssumptions.personnel)
    y1_ca = year_val(ctx.results.revenue, 0)

    return [
        (
            "1. Présentation du promoteur et du porteur de projet",
            [
                (
                    f"Le promoteur du projet « {ctx.company} » exerce son activité dans le cadre "
                    f"d'une structure de type {ctx.legal_form}. Le porteur de projet dispose des "
                    "compétences managériales et techniques nécessaires à la conduite du projet, "
                    "et s'engage à mobiliser les ressources humaines et financières décrites dans "
                    "le présent dossier."
                ),
                (
                    "Les pièces justificatives complémentaires (statuts, CV des dirigeants, "
                    "attestations d'expérience, références commerciales) sont à joindre au dossier "
                    "selon les exigences du guichet d'investissement."
                ),
            ],
        ),
        (
            "2. Présentation du projet et du produit",
            [
                (
                    f"Le projet vise le développement d'une activité de production et de commercialisation "
                    f"portée par {ctx.company}. Le produit ou service proposé répond à une demande "
                    "identifiée sur le marché national et, le cas échéant, à l'export."
                ),
                (
                    f"Les hypothèses d'exploitation retenues dans la liasse prévoient un prix de vente "
                    f"unitaire de {fmt_num(ops.salePrice)} TND, un coût matière de {fmt_num(ops.rawMaterialCost)} TND "
                    f"et un taux de déchet de {pct(ops.wasteRate.value)}. Le chiffre d'affaires prévisionnel "
                    f"de la première année s'établit à {fmt_num(y1_ca)} TND."
                ),
            ],
        ),
        (
            "3. Étude de marché",
            [
                (
                    "L'analyse de marché repose sur une segmentation des clients cibles, une estimation "
                    "de la demande potentielle et une analyse concurrentielle. Le marché tunisien "
                    "présente des opportunités liées à la qualité du produit, à la proximité géographique "
                    "et à la capacité d'adaptation aux exigences des distributeurs."
                ),
                (
                    f"Pour le projet « {ctx.company} », la stratégie d'entrée sur le marché privilégie "
                    "une montée en charge progressive des volumes, en cohérence avec les capacités "
                    "de production et les délais de paiement clients retenus dans le plan de trésorerie."
                ),
                (
                    "Les données qualitatives (enquêtes, lettres d'intention, contrats préliminaires) "
                    "sont à compléter par le promoteur pour corroborer les hypothèses de chiffre d'affaires."
                ),
            ],
        ),
        (
            "4. Stratégie marketing et commerciale",
            [
                (
                    "La politique commerciale combine actions de notoriété, force de vente ou réseaux "
                    "de distribution, et politique tarifaire alignée sur les coûts complets et la "
                    "concurrence. Les frais de distribution et de marketing sont intégrés dans le "
                    "compte de résultat prévisionnel de la liasse."
                ),
                (
                    f"Le délai moyen de règlement clients est fixé à {wc.clientPaymentDays} jours, "
                    f"ce qui influence le besoin en fonds de roulement et la trésorerie d'exploitation."
                ),
            ],
        ),
        (
            "5. Organisation et ressources humaines",
            [
                (
                    f"L'organisation retenue prévoit un effectif total indicatif de {pers_count} "
                    "personnes, réparties selon les postes décrits dans la liasse. Les profils, "
                    "grilles salariales et charges sociales sont intégrés dans les charges d'exploitation."
                ),
                (
                    "Un plan de formation et de montée en compétences accompagnera la phase de "
                    "démarrage industrielle ou de montée en cadence des opérations."
                ),
            ],
        ),
        (
            "6. Choix technologique et process de production",
            [
                (
                    f"Le process de production s'appuie sur un rythme de {fmt_num(ops.workingDaysPerYear, digits=0)} "
                    f"jours ouvrés par an et {fmt_num(ops.hoursPerDay, digits=1)} heures par jour. "
                    "Les équipements et investissements incorporels ou corporels sont détaillés au "
                    "chapitre « Programme d'investissement »."
                ),
                (
                    "Le choix technologique vise un niveau de productivité compatible avec les normes "
                    "de qualité du secteur et une maintenance préventive des équipements critiques."
                ),
            ],
        ),
        (
            "7. Approvisionnements et implantation",
            [
                (
                    f"Les approvisionnements en matières premières sont planifiés avec un stock moyen "
                    f"de {fmt_num(wc.rawMaterialStockMonths, digits=1)} mois. Les délais fournisseurs "
                    f"sont estimés à {wc.supplierPaymentDays} jours."
                ),
                (
                    "Le site d'implantation doit répondre aux contraintes d'accès, de voirie, "
                    "d'alimentation en utilities et aux autorisations d'urbanisme et d'exploitation "
                    "en vigueur. Les coûts de location ou d'acquisition du foncier sont intégrés "
                    "dans le programme d'investissement le cas échéant."
                ),
            ],
        ),
        (
            "8. Analyse environnementale",
            [
                (
                    "Le projet est soumis aux textes relatifs à la protection de l'environnement et "
                    "à l'évaluation des impacts. Les émissions, rejets, nuisances sonores et gestion "
                    "des déchets doivent être maîtrisés par des équipements et procédures adaptés."
                ),
                (
                    f"Pour « {ctx.company} », une fiche d'impact simplifiée ou une étude d'impact "
                    "plus poussée pourra être exigée selon la nature de l'activité et l'arrêté "
                    "du Ministère de l'Environnement applicable."
                ),
            ],
        ),
        (
            "9. Plan de financement",
            [
                (
                    f"Le plan de financement structure les ressources en fonds propres ({pct(fin.equityRatio)}) "
                    f"et en dette ({pct(fin.debtRatio)}). Le montant d'emprunt retenu est de "
                    f"{fmt_num(loan.amount or ctx.results.totalInvestment * fin.debtRatio)} TND, "
                    f"au taux de {pct(loan.rate)} sur {loan.years} ans, avec un différé de remboursement "
                    f"du principal de {loan.graceMonthsPrincipal} mois."
                ),
                (
                    f"Le besoin en fonds de roulement est piloté par les délais clients ({wc.clientPaymentDays} j), "
                    f"stock produits finis ({wc.finishedGoodsStockDays} j) et variation des postes "
                    "d'exploitation sur l'horizon septennal."
                ),
            ],
        ),
        (
            "10. Analyse de sensibilité",
            [
                (
                    "Une analyse de sensibilité sur les variables clés (prix de vente, coût matière, "
                    "taux de change, taux d'intérêt, délais clients) permet de tester la robustesse "
                    "du modèle financier. Les simulations complémentaires peuvent être réalisées "
                    "dans l'outil Business Plan Tunisie."
                ),
                (
                    f"Avec un taux d'actualisation de {pct(ind.discountRate)}, la VAN et le TRI "
                    "reflètent la rentabilité économique du projet sous les hypothèses centrales."
                ),
            ],
        ),
    ]


def conclusion_paragraph(ctx: NarrativeContext) -> str:
    ind = ctx.results.indicators
    if (
        ind.van >= 0
        and ctx.results.balanceSheetBalanced
        and ctx.results.cashRunwayBreakYear is None
    ):
        return (
            f"Sous les hypothèses retenues, le projet « {ctx.company} » présente une VAN positive "
            f"({fmt_num(ind.van)} TND), une structure de bilan équilibrée et une trésorerie "
            "tenable sur sept ans. Le dossier peut être transmis pour examen par les instances "
            "compétentes, sous réserve de validation des pièces justificatives et des sections "
            "qualitatives (marché, technique, environnement) adaptées au guichet."
        )
    return (
        f"Le projet « {ctx.company} » présente des points de vigilance (VAN, trésorerie ou bilan). "
        "Il est recommandé d'ajuster les hypothèses d'exploitation, le BFR ou le plan de financement "
        "avant dépôt définitif. Les sections qualitatives du présent document restent à enrichir "
        "par le promoteur."
    )
