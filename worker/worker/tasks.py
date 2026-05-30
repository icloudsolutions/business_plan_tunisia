"""Celery tasks for 7-year calculations and exports."""

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

import redis
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from bp_calc.engine import apply_patch, calculate_plan, compare_results
from bp_calc.patch import PatchError
from bp_schema.liasse import PlanInputs, PlanResults

from worker.celery_app import celery_app

def _sync_database_url() -> str:
    url = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://bp_user:bp_secret@postgres:5432/business_plan",
    )
    return url.replace("postgresql+asyncpg", "postgresql+psycopg2")


DATABASE_URL = _sync_database_url()

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
EXPORT_DIR = Path(os.getenv("EXPORT_STORAGE_PATH", "/app/exports"))
EXPORT_DIR.mkdir(parents=True, exist_ok=True)

sync_engine = create_engine(DATABASE_URL, pool_pre_ping=True)


def _cache_key(plan_id: str, inputs: dict) -> str:
    payload = json.dumps(inputs, sort_keys=True, default=str)
    digest = hashlib.sha256(payload.encode()).hexdigest()
    return f"calc:{plan_id}:{digest}"


def _get_sync_session() -> Session:
    return Session(sync_engine)


def _import_models():
    import sys

    sys.path.insert(0, "/app/api")
    from app.models import BusinessPlan, CalcJob, ExportJob, Simulation

    return BusinessPlan, CalcJob, ExportJob, Simulation


def _fail_job(db: Session, job, error: str) -> None:
    if job:
        job.status = "FAILED"
        job.error = error
        job.completed_at = datetime.now(timezone.utc)
        db.commit()


@celery_app.task(
    name="worker.tasks.recalculate_plan",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def recalculate_plan(self, plan_id: str, job_id: str):
    BusinessPlan, CalcJob, _, _ = _import_models()
    discount = float(os.getenv("DISCOUNT_RATE", "0.10"))

    with _get_sync_session() as db:
        job = db.get(CalcJob, UUID(job_id))
        plan = db.get(BusinessPlan, UUID(plan_id))
        if not plan:
            _fail_job(db, job, "Plan introuvable")
            return {"error": "plan not found"}
        if plan.status == "VALIDATED":
            _fail_job(db, job, "Plan verrouillé")
            return {"error": "locked"}

        try:
            if job:
                job.status = "STARTED"
                db.commit()

            inputs = PlanInputs.model_validate(plan.inputs)
            results = calculate_plan(inputs, discount_rate=discount)
            plan.results = results.model_dump()

            r = redis.from_url(REDIS_URL)
            r.setex(_cache_key(plan_id, plan.inputs), 3600, json.dumps(plan.results))

            if job:
                job.status = "COMPLETED"
                job.result = plan.results
                job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return plan.results
        except Exception as e:
            _fail_job(db, job, str(e))
            raise


@celery_app.task(
    name="worker.tasks.run_simulation",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def run_simulation(self, plan_id: str, job_id: str, spec: dict):
    BusinessPlan, CalcJob, _, Simulation = _import_models()
    discount = float(os.getenv("DISCOUNT_RATE", "0.10"))

    with _get_sync_session() as db:
        job = db.get(CalcJob, UUID(job_id))
        plan = db.get(BusinessPlan, UUID(plan_id))
        if not plan:
            _fail_job(db, job, "Plan introuvable")
            return {"error": "plan not found"}

        try:
            if job:
                job.status = "STARTED"
                db.commit()

            baseline_inputs = PlanInputs.model_validate(plan.inputs)
            baseline_results = (
                PlanResults.model_validate(plan.results)
                if plan.results
                else calculate_plan(baseline_inputs, discount)
            )

            scenario_inputs = baseline_inputs
            for patch in spec.get("patches", []):
                try:
                    scenario_inputs = apply_patch(
                        scenario_inputs,
                        patch.get("path", ""),
                        value=patch.get("value"),
                        multiplier=patch.get("multiplier"),
                    )
                except PatchError as pe:
                    _fail_job(db, job, str(pe))
                    return {"error": str(pe)}

            scenario_results = calculate_plan(scenario_inputs, discount)
            delta = compare_results(baseline_results, scenario_results)

            sim = Simulation(
                plan_id=plan.id,
                name=spec.get("name", "Scénario"),
                patch=spec.get("patches", []),
                inputs=scenario_inputs.model_dump(),
                results=scenario_results.model_dump(),
                delta_vs_baseline=delta,
            )
            db.add(sim)

            if job:
                job.status = "COMPLETED"
                job.result = {"simulation": scenario_results.model_dump(), "delta": delta}
                job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return job.result if job else delta
        except Exception as e:
            _fail_job(db, job, str(e))
            raise


@celery_app.task(
    name="worker.tasks.generate_export",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 2},
)
def generate_export(self, plan_id: str, job_id: str, formats: list):
    BusinessPlan, _, ExportJob, _ = _import_models()

    with _get_sync_session() as db:
        job = db.get(ExportJob, UUID(job_id))
        plan = db.get(BusinessPlan, UUID(plan_id))
        if not plan or not plan.results:
            _fail_job(db, job, "Résultats manquants")
            return {"error": "no results"}

        try:
            if job:
                job.status = "STARTED"
                db.commit()

            inputs = PlanInputs.model_validate(plan.inputs)
            results = PlanResults.model_validate(plan.results)
            paths = []
            if "xlsx" in formats:
                paths.append(_export_xlsx(plan_id, inputs, results))
            if "pdf" in formats:
                paths.append(_export_pdf(plan_id, inputs, results))

            if job:
                job.status = "COMPLETED"
                job.file_path = ";".join(paths)
            db.commit()
            return {"files": paths}
        except Exception as e:
            if job:
                job.status = "FAILED"
                db.commit()
            raise


def _export_xlsx(plan_id: str, inputs: PlanInputs, results: PlanResults) -> str:
    from openpyxl import Workbook

    path = EXPORT_DIR / f"plan_{plan_id}.xlsx"
    wb = Workbook()
    ws = wb.active
    ws.title = "P&L"
    ws.append(["Année", "CA HT", "Résultat Net", "CF Exploitation", "Trésorerie cumulée", "BFR"])
    for y in range(7):
        ws.append([
            y + 1,
            results.revenue.years[y] if y < len(results.revenue.years) else 0,
            results.netProfit.years[y] if y < len(results.netProfit.years) else 0,
            results.operatingCashFlow.years[y] if y < len(results.operatingCashFlow.years) else 0,
            results.cumulativeTreasury.years[y] if y < len(results.cumulativeTreasury.years) else 0,
            results.bfr.years[y] if y < len(results.bfr.years) else 0,
        ])
    ws2 = wb.create_sheet("Indicateurs")
    ws2.append(["VAN", results.indicators.van])
    ws2.append(["TRI", results.indicators.tri or "N/A"])
    ws2.append(["DRCI", results.indicators.drciYears or "N/A"])
    ws2.append(["Bilan équilibré", results.balanceSheetBalanced])
    ws2.append(["BFR cohérent", results.bfrCoherent])
    wb.save(path)
    return str(path)


def _export_pdf(plan_id: str, inputs: PlanInputs, results: PlanResults) -> str:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    path = EXPORT_DIR / f"plan_{plan_id}.pdf"
    c = canvas.Canvas(str(path), pagesize=A4)
    _, h = A4
    y = h - 50
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, y, f"Business Plan — {inputs.company.name}")
    y -= 30
    c.setFont("Helvetica", 11)
    for line in [
        f"Forme juridique: {inputs.company.legalForm}",
        f"Investissement: {results.totalInvestment:,.0f} TND",
        f"VAN: {results.indicators.van:,.0f} TND",
        f"TRI: {(results.indicators.tri or 0)*100:.2f}%",
    ]:
        y -= 20
        c.drawString(50, y, line)
    c.save()
    return str(path)
