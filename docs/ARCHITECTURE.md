# Architecture technique

## Flux de calcul

1. Le client saisit les hypothèses (Liasse Unique) via le frontend.
2. L'API valide le JSON (`bp_schema`) et persiste en PostgreSQL.
3. Les recalculs et simulations sont envoyés à Celery (`worker.tasks`).
4. Le worker exécute `bp_calc.calculate_plan` sur 7 ans et met à jour `plan.results`.
5. À l'état `VALIDATED`, les exports PDF/Excel sont générés dans le volume `exports_data`.

## State machine

Voir `api/app/state_machine.py` pour les transitions autorisées.

## Modes moteur IA (copilot)

`POST /api/copilot` accepte `output_mode`: `DATA_MODE`, `AUDIT_MODE`, `REPORT_MODE`.
