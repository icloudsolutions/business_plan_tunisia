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

**Comptes démo** (si `RUN_SEED=true`) : `client@demo.tn` / `expert@demo.tn` — mot de passe `demo1234`. Les experts se créent via `POST /api/auth/admin/experts` + header `X-Admin-Key`.

Application : http://localhost:8088

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
