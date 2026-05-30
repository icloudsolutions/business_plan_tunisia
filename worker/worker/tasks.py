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
from worker.email_send import send_email

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
    from app.models import BusinessPlan, CalcJob, EmailNotification, ExportJob, PlanScenario, Simulation

    return BusinessPlan, CalcJob, EmailNotification, ExportJob, PlanScenario, Simulation


def _import_email_builder():
    import sys

    sys.path.insert(0, "/app/api")
    from app.email_queue import tracking_pixel_url
    from app.emails.content import build_email_html

    return build_email_html, tracking_pixel_url


def _fail_job(db: Session, job, error: str) -> None:
    if job:
        job.status = "FAILED"
        if hasattr(job, "error"):
            job.error = error
        if hasattr(job, "completed_at"):
            job.completed_at = datetime.now(timezone.utc)
        db.commit()


def _fail_export_job(db: Session, job, error: str) -> None:
    if job:
        job.status = "FAILED"
        job.file_path = None
        db.commit()


@celery_app.task(
    name="worker.tasks.send_transactional_email",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def send_transactional_email(self, notification_id: str):
    _, _, EmailNotification, _, _, _ = _import_models()
    build_email_html, tracking_pixel_url = _import_email_builder()

    with _get_sync_session() as db:
        row = db.get(EmailNotification, UUID(notification_id))
        if not row:
            logger.warning("EmailNotification %s introuvable", notification_id)
            return {"error": "not found"}
        if row.sent_at:
            return {"status": "already_sent"}

        try:
            pixel = tracking_pixel_url(row.id)
            subject, html = build_email_html(
                row.type,
                context=row.context or {},
                tracking_pixel_url=pixel,
            )
            if row.subject:
                subject = row.subject
            send_email(to=row.recipient_email, subject=subject, html=html)
            row.sent_at = datetime.now(timezone.utc)
            row.error = None
            db.commit()
            return {"status": "sent", "id": notification_id}
        except Exception as e:
            row.error = str(e)[:2000]
            db.commit()
            logger.exception("Email send failed %s", notification_id)
            raise


@celery_app.task(
    name="worker.tasks.recalculate_plan",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def recalculate_plan(self, plan_id: str, job_id: str, overrides: dict | None = None):
    BusinessPlan, CalcJob, _, _, _, _ = _import_models()
    discount = float(os.getenv("DISCOUNT_RATE", "0.10"))

    with _get_sync_session() as db:
        job = db.get(CalcJob, UUID(job_id))
        plan = db.get(BusinessPlan, UUID(plan_id))
        if not plan:
            _fail_job(db, job, "Plan introuvable")
            return {"error": "plan not found"}
        if plan.status == "VALIDATED" and not (overrides or {}).get("allow_locked"):
            _fail_job(db, job, "Plan verrouillé")
            return {"error": "locked"}

        try:
            if job:
                job.status = "STARTED"
                db.commit()

            ov = overrides or (job.payload if job and job.payload else {}) or {}
            inputs = PlanInputs.model_validate(plan.inputs)
            revenue_growth = 0.03

            if ov:
                from bp_calc.projections import apply_scenario_to_inputs

                growth_mult = float(ov.get("growth_mult", 1.0))
                revenue_growth = 0.03 * growth_mult
                inputs = apply_scenario_to_inputs(
                    inputs,
                    revenue_scale=float(ov.get("revenue_scale", 1.0)),
                    loan_rate_scale=float(ov.get("loan_rate_mult", 1.0)),
                )

            results = calculate_plan(inputs, discount_rate=discount, revenue_growth=revenue_growth)
            result_dump = results.model_dump()

            persist = ov.get("persist", True)
            if persist:
                plan.results = result_dump
                r = redis.from_url(REDIS_URL)
                r.setex(_cache_key(plan_id, plan.inputs), 3600, json.dumps(plan.results))

            if job:
                job.status = "COMPLETED"
                job.result = result_dump
                job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return result_dump
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
    BusinessPlan, CalcJob, _, _, _, Simulation = _import_models()
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
    name="worker.tasks.calculate_plan_scenario",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def calculate_plan_scenario(self, plan_id: str, scenario_id: str, job_id: str):
    from bp_calc.scenarios import calculate_scenario as run_scenario_calc

    BusinessPlan, CalcJob, _, _, PlanScenario, _ = _import_models()
    discount = float(os.getenv("DISCOUNT_RATE", "0.10"))

    with _get_sync_session() as db:
        job = db.get(CalcJob, UUID(job_id))
        plan = db.get(BusinessPlan, UUID(plan_id))
        scenario = db.get(PlanScenario, UUID(scenario_id))
        if not plan or not scenario or scenario.plan_id != plan.id:
            _fail_job(db, job, "Scénario introuvable")
            return {"error": "not found"}

        try:
            if job:
                job.status = "STARTED"
            scenario.calc_status = "STARTED"
            db.commit()

            inputs = PlanInputs.model_validate(plan.inputs)
            results, _ = run_scenario_calc(
                inputs, scenario.multipliers or {}, discount_rate=discount
            )
            result_dump = results.model_dump()
            scenario.results = result_dump
            scenario.calc_status = "COMPLETED"
            if scenario.is_official:
                plan.results = result_dump

            if job:
                job.status = "COMPLETED"
                job.result = result_dump
                job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return result_dump
        except Exception as e:
            scenario.calc_status = "FAILED"
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
    BusinessPlan, _, _, ExportJob, PlanScenario, _ = _import_models()

    with _get_sync_session() as db:
        job = db.get(ExportJob, UUID(job_id))
        plan = db.get(BusinessPlan, UUID(plan_id))
        if not plan:
            _fail_export_job(db, job, "Plan introuvable")
            return {"error": "no plan"}

        results_data = plan.results
        if plan.official_scenario_id:
            official = db.get(PlanScenario, plan.official_scenario_id)
            if official and official.results:
                results_data = official.results
        if not results_data:
            _fail_export_job(db, job, "Résultats manquants")
            return {"error": "no results"}

        try:
            if job:
                job.status = "STARTED"
                db.commit()

            inputs = PlanInputs.model_validate(plan.inputs)
            results = PlanResults.model_validate(results_data)
            files: dict[str, str] = {}
            if "pdf" in formats:
                files["pdf"] = _export_pdf(plan_id, inputs, results)
            if "xlsx" in formats:
                files["xlsx"] = _export_xlsx(plan_id, inputs, results)

            if not files:
                _fail_export_job(db, job, "Aucun format demandé")
                return {"error": "no formats"}

            if job:
                job.status = "COMPLETED"
                job.file_path = json.dumps(files)
            db.commit()
            return {"files": files}
        except Exception:
            _fail_export_job(db, job, "Erreur génération export")
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
    return str(path.resolve())


def _pdf_safe(text: str) -> str:
    """Helvetica only supports Latin-1; replace unsupported chars."""
    return text.encode("latin-1", errors="replace").decode("latin-1")


def _export_pdf(plan_id: str, inputs: PlanInputs, results: PlanResults) -> str:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    path = EXPORT_DIR / f"plan_{plan_id}.pdf"
    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    y = height - 50
    company = inputs.company.name.strip() or "Sans nom"
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, y, _pdf_safe(f"Business Plan — {company}"))
    y -= 28
    c.setFont("Helvetica", 11)
    lines = [
        f"Forme juridique: {inputs.company.legalForm}",
        f"Investissement total: {results.totalInvestment:,.0f} TND",
        f"VAN (10%): {results.indicators.van:,.0f} TND",
        f"TRI: {(results.indicators.tri or 0) * 100:.2f}%",
        f"DRCI: {results.indicators.drciYears or 'N/A'} ans",
        f"Bilan equilibre: {'Oui' if results.balanceSheetBalanced else 'Non'}",
        f"BFR coherent: {'Oui' if results.bfrCoherent else 'Non'}",
    ]
    for line in lines:
        y -= 18
        c.drawString(50, y, _pdf_safe(line))

    y -= 24
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, _pdf_safe("Projection 7 ans — Resultat net (TND)"))
    y -= 18
    c.setFont("Helvetica", 10)
    for i, val in enumerate(results.netProfit.years[:7]):
        y -= 14
        if y < 60:
            c.showPage()
            y = height - 50
            c.setFont("Helvetica", 10)
        rev = results.revenue.years[i] if i < len(results.revenue.years) else 0
        c.drawString(
            50,
            y,
            _pdf_safe(f"An {i + 1}: CA {rev:,.0f} | RN {val:,.0f}"),
        )

    c.save()
    return str(path.resolve())
