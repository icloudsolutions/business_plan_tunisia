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

**Migrations** : `RUN_MIGRATIONS=true` pour appliquer Alembic au démarrage API.

**Exports** : après validation, `GET /api/plans/{id}/exports/{jobId}/download` (JWT requis).

**Scénarios** : `GET/POST /api/plans/{id}/scenarios` — pessimiste / base / optimiste + scénarios personnalisés ; calcul Celery ; comparaison VAN/TRI/DRCI ; expert « Recommander » pour export PDF/Excel. Migration `006_plan_scenarios`.

**Complétion Liasse** : `GET /api/plans/{id}/completion` (scores par section, champs requis/recommandés) ; rapport PDF expert : `GET /api/plans/{id}/completion/report.pdf`.

**Emails transactionnels** : transitions de workflow et commentaires déclenchent l’envoi via Celery (`queue: email`). `EMAIL_PROVIDER=log|smtp|resend`, `APP_BASE_URL` pour les liens. Stats dans **Administration → Analytics**. Migration `005_email_notifications`.

**Coûts unitaires multi-produits** : `GET/PUT /api/plans/{id}/cost-components`, `GET /api/plans/{id}/cost-autofill`, `GET /api/plans/{id}/unit-cost-projection`. Migration `009_plan_product_cost_components`. Étape « Coûts de production » (donut + marges).

**Revenus multi-produits** : `GET/POST/PATCH/DELETE /api/plans/{id}/products`, `PUT /api/plans/{id}/revenue-assumptions`, `GET /api/plans/{id}/revenue-projection` (aperçu sync ou Celery via `POST`). Migration `008_plan_products_revenue`. Étape Liasse « Produits & Prix ».

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
