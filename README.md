# Business Plan Tunisie

Plateforme collaborative de business plan sur 7 ans, conforme à la Liasse Unique (TIA), avec workflow Client / Expert et calculs isolés dans un worker Celery.

## Architecture (Docker Compose)

| Service | Rôle | Exposition |
|---------|------|------------|
| **nginx** | Reverse proxy, SSL-ready | Host ports **8088** (HTTP), **8443** (HTTPS) — configurable via `.env` |
| **frontend** | Next.js — formulaires Liasse | Réseau interne |
| **api** | FastAPI — state machine, REST | Réseau interne |
| **worker** | Celery — calculs 7 ans, exports | Réseau interne |
| **redis** | Broker + cache simulations | Réseau interne |
| **postgres** | Persistance | Réseau interne |

Réseau privé : `bp_network`. Volumes : `postgres_data`, `redis_data`, `exports_data`.

## Démarrage

```bash
cp .env.example .env
# Edit .env: set JWT_SECRET, POSTGRES_PASSWORD, ADMIN_API_KEY (min. 32 chars recommended)
docker compose up --build -d
```

**Sécurité** : voir [docs/SECURITY.md](docs/SECURITY.md). En production : `RUN_SEED=false`, `APP_ENV=production`, secrets forts obligatoires.

**Migrations** : `RUN_MIGRATIONS=true` (default in Docker) applies Alembic at API startup. Set `RUN_MIGRATIONS=false` only for local dev without Alembic.

**Exports** : après validation, `GET /api/plans/{id}/exports/{jobId}/download` (JWT requis).

**Scénarios** : `GET/POST /api/plans/{id}/scenarios` — pessimiste / base / optimiste + scénarios personnalisés ; calcul Celery ; comparaison VAN/TRI/DRCI ; expert « Recommander » pour export PDF/Excel. Migration `006_plan_scenarios`.

**Complétion Liasse** : `GET /api/plans/{id}/completion` (scores par section, champs requis/recommandés) ; rapport PDF expert : `GET /api/plans/{id}/completion/report.pdf`.

**Emails transactionnels** : transitions de workflow et commentaires déclenchent l’envoi via Celery (`queue: email`). `EMAIL_PROVIDER=log|smtp|resend`, `APP_BASE_URL` pour les liens. Stats dans **Administration → Analytics**. Migration `005_email_notifications`.

**Coûts unitaires multi-produits** : `GET/PUT /api/plans/{id}/cost-components`, `GET /api/plans/{id}/cost-autofill`, `GET /api/plans/{id}/unit-cost-projection`. Migration `009_plan_product_cost_components`. Étape « Coûts de production » (donut + marges).

**Revenus multi-produits** : `GET/POST/PATCH/DELETE /api/plans/{id}/products`, `PUT /api/plans/{id}/revenue-assumptions`, `GET /api/plans/{id}/revenue-projection` (aperçu sync ou Celery via `POST`). Migration `008_plan_products_revenue`. Étape Liasse « Produits & Prix ».

**Grille prix & marché** : `GET /api/plans/{id}/pricing`, `PATCH /api/plans/{id}/pricing-grid/{row_id}`, `POST /api/plans/{id}/pricing/sync-products`. Migration `017_plan_pricing_grid`. Étape « Prix de Vente » : grille achat/vente/marché, marge colorée, sensibilité prix, graphique chaîne de prix (coût → distributeur → rayon).

**Bilan prévisionnel** : `GET /api/plans/{id}/balance-sheet?scenario=base|pessimistic|optimistic`. Onglet « Bilan prévisionnel » du cockpit finance (ACTIFS / PASSIFS Y1–Y7, ratios BFR, composition empilée).

**Flux de trésorerie** : `GET /api/plans/{id}/cash-flow?scenario=…&bfr_client_days=20|33|45`. Tableau Y0–Y7 (exploitation, ΔBFR, investissement, dettes), waterfall + BFR empilé, point d’équilibre cumul, sensibilité délai clients (onglet Trésorerie).

**Indicateurs clés** : `GET /api/plans/{id}/kpis?scenario=base|pessimistic|optimistic`. VAN, TRI, DRCI, IP, TRC, performances Y1–Y7, capacité, DSCR, badge finançable (onglet Indicateurs / accueil cockpit).

**Planning de réalisation** : `GET/PUT /api/plans/{id}/timeline`, phases CRUD, `GET …/timeline/gantt.svg`. Gantt M1–M18, délai de démarrage (prorata CA Y1), jalons — étape wizard « Planning de réalisation ».

**Approvisionnements** : `GET /api/plans/{id}/procurement`, matières premières, nomenclatures produit×MP, stocks (jours), plan d'achats Y1–Y7 — alimente TVA, bilan et P&L (achats consommés).

**Structure de financement** : `GET /api/plans/{id}/financing-structure`, `GET/POST/PATCH/DELETE /api/plans/{id}/financing-sources`, `POST /api/plans/{id}/financing-structure/sync-liasse`. Migration `016_plan_financing_sources`. Validation : somme des sources = investissement + BFR initial (Y1), ratio fonds propres ≥ 25 %, éligibilité BFPME/SICAR/BTS/SOTUGAR/FOPRODI. Étape Financement : récap besoin, tableau sources, donut structure, checker — CMT/leasing synchronisés vers `plan_loans`.

**Emprunts & amortissement** : `GET/POST/PATCH/DELETE /api/plans/{id}/loans`, `GET /api/plans/{id}/loan-projection`, `POST /api/plans/{id}/loans/sync-liasse`. Migration `013_plan_loans`. Étape Financement : tranches (max 3), tableau trimestriel, pivot annuel, graphique dual-axis. Moteur `bp_calc.loan` alimente P&L / trésorerie (intérêts, principal, encours).

**TVA & fiscalité** : `GET/PUT /api/plans/{id}/tva/config`, `GET/PUT /api/plans/{id}/tva/settings`, `GET /api/plans/{id}/tva/projection`, `GET /api/plans/{id}/tva/export?format=csv|html`. Migration `012_plan_tva`. Étape « TVA & Fiscalité » (taux par produit/poste, solde annuel, waterfall, créances/dettes 1 mois TTC).

**Autres charges d'exploitation** : `GET/PUT /api/plans/{id}/other-charges/config`, `PUT /api/plans/{id}/other-charges/settings`, `GET /api/plans/{id}/other-charges/projection`, `POST /api/plans/{id}/other-charges/sync-liasse`. Migration `011_plan_other_charges`. Étape « Autres charges » (11 catégories, LF 2012 TFP/FOPROLOS, tableau Y1–Y7).

**Masse salariale (RH)** : `GET/POST/PATCH/DELETE /api/plans/{id}/staff-roles`, `PUT /api/plans/{id}/headcount-plan`, `PUT /api/plans/{id}/payroll-assumptions`, `GET /api/plans/{id}/payroll-projection`, `POST /api/plans/{id}/payroll/sync-liasse`, `GET /api/plans/{id}/payroll/export?format=csv|html`. Migration `010_plan_payroll`. Étape « Ressources humaines » (effectifs Y1–Y7, CNSS, graphiques, export Liasse PDF). Les coûts imputables production alimentent le coût unitaire (`unit-cost-projection`).

**Audit trail & versions** : chaque `PATCH` sur les champs du plan alimente `plan_audit_log` ; snapshots automatiques aux transitions de statut et à la soumission ; point manuel via l’icône horloge (« Créer un point de sauvegarde »). API : `GET/POST /api/plans/{id}/versions`, `GET .../versions/{vid}/diff`, `POST .../restore` (expert/admin), `GET /api/plans/{id}/audit-log`. Migration `007_plan_audit_log`.

**Aide IA (Claude)** : dans le parcours Liasse, bouton « Aide IA » sur les champs financiers complexes ; `POST /api/plans/{id}/ai-assist`. Définir `ANTHROPIC_API_KEY` et optionnellement `ANTHROPIC_MODEL` (défaut `claude-sonnet-4-20250514`). Sans clé, l’API renvoie des réponses de démonstration. Migration `004_ai_suggestions` requise (`RUN_MIGRATIONS=true`).

**Comptes démo** (si `RUN_SEED=true`) : `client@demo.tn`, `expert@demo.tn`, `admin@demo.tn` — mot de passe `demo1234`. L’administrateur gère les utilisateurs depuis **Administration** (`/admin`) ou via `GET/POST /api/auth/admin/users` (JWT admin). Création expert legacy : `POST /api/auth/admin/experts` + header `X-Admin-Key`.

Application : http://localhost:8088 (redirige vers `/fr` ou `/ar` selon la langue)

**Internationalisation (next-intl)** : routes `/fr/...` et `/ar/...` (défaut `fr`). Fichiers `frontend/messages/fr.json`, `ar.json` et `liasse-{locale}.json`. Commutateur FR/AR dans la barre supérieure (cookie `NEXT_LOCALE` + `localStorage`). RTL automatique pour l'arabe. Formats : `src/lib/format.ts` (dates, montants DT). Emails : modèles bilingues (`templates/*.html`) + versions arabes seules (`templates/ar/*.html`) via `context.locale`.

**Cockpit coûts (UI démo)** : http://localhost:8088/finance — production, masse salariale, graphiques Recharts (données fictives, calculs côté client).

API health : http://localhost:8088/api/health

Override ports in `.env`: `NGINX_HTTP_PORT`, `NGINX_HTTPS_PORT`.

## Workflow (State Machine)

- `DRAFT` — Client : saisie, auto-save
- `UNDER_REVIEW` — Expert : audit, simulations
- `ADJUSTMENT` — Collaboratif : corrections
- `VALIDATED` — Verrouillé : exports PDF/Excel uniquement

## Packages

- `packages/bp_schema` — Modèles Pydantic Liasse Unique
- `packages/bp_calc` — Moteur financier 7 ans (P&L, BFR, VAN, TRI, DRCI)

## Tests locaux (calcul)

```bash
pip install -e packages/bp_schema -e packages/bp_calc pytest
pytest packages/bp_calc/tests -q
```

## Références

- `liasse_unique_PME.pdf`, `liasse_Unique_GE.pdf` — formulaires TIA
- `output_example_Business plan VIPA VDEF 1 MOM.xlsx` — modèle financier de référence
