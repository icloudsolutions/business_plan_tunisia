"""Predefined admin notification templates."""

TEMPLATES: dict[str, dict[str, str]] = {
    "plan_validated": {
        "title": "Plan validé",
        "body": "Votre business plan a été validé par l'expert. Vous pouvez télécharger l'export PDF/Excel.",
    },
    "action_required": {
        "title": "Action requise",
        "body": "Des corrections sont attendues sur votre dossier. Connectez-vous pour consulter les commentaires.",
    },
    "under_review": {
        "title": "Plan en revue",
        "body": "Votre plan a été soumis et est en cours d'examen par un expert.",
    },
    "welcome": {
        "title": "Bienvenue sur Business Plan Tunisie",
        "body": "Votre compte est actif. Créez votre premier plan depuis le tableau de bord.",
    },
    "password_reset": {
        "title": "Réinitialisation du mot de passe",
        "body": "Un administrateur a demandé la réinitialisation de votre mot de passe. Utilisez le mot de passe temporaire communiqué par email.",
    },
    "custom": {
        "title": "Message administrateur",
        "body": "",
    },
}
