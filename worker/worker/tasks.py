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


def _sync_revenue_projection(db: Session, plan_id: UUID) -> dict:
    from bp_calc.revenue import calculate_revenue_projection as calc_rev
    from bp_schema.liasse import PlanInputs
    from bp_schema.revenue import PlanProduct, RevenueAssumptions

    BusinessPlan, _, _, _, _, _ = _import_models()
    import sys

    sys.path.insert(0, "/app/api")
    from app.models import PlanProduct as PlanProductORM
    from app.models import PlanRevenueAssumptions as PlanRevenueAssumptionsORM

    plan = db.get(BusinessPlan, plan_id)
    products_orm = (
        db.query(PlanProductORM)
        .filter(PlanProductORM.plan_id == plan_id)
        .order_by(PlanProductORM.sort_order)
        .all()
    )
    assump_orm = db.get(PlanRevenueAssumptionsORM, plan_id)
    products = [
        PlanProduct(
            id=p.id,
            plan_id=p.plan_id,
            name=p.name,
            unit=p.unit,
            unit_price_sell=p.unit_price_sell,
            ristourne_pct=p.ristourne_pct,
            monthly_qty_y1=p.monthly_qty_y1,
        )
        for p in products_orm
    ]
    if assump_orm:
        assumptions = RevenueAssumptions(
            plan_id=assump_orm.plan_id,
            nominal_capacity=assump_orm.nominal_capacity,
            capacity_basis=assump_orm.capacity_basis,
            production_days=assump_orm.production_days,
            growth_rate_y2=assump_orm.growth_rate_y2,
            growth_rate_y3=assump_orm.growth_rate_y3,
            growth_rate_y4=assump_orm.growth_rate_y4,
            growth_rate_y5=assump_orm.growth_rate_y5,
            growth_rate_y6=assump_orm.growth_rate_y6,
            growth_rate_y7=assump_orm.growth_rate_y7,
        )
    else:
        assumptions = RevenueAssumptions(plan_id=plan_id)
        if plan and plan.inputs:
            try:
                assumptions.production_days = float(
                    PlanInputs.model_validate(plan.inputs).operations.workingDaysPerYear or 250
                )
            except Exception:
                pass
    proj = calc_rev(products, assumptions, plan_id=plan_id)
    return proj.model_dump()


@celery_app.task(
    name="worker.tasks.calculate_revenue_projection",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def calculate_revenue_projection(self, plan_id: str, job_id: str):
    _, CalcJob, _, _, _, _ = _import_models()
    import sys

    sys.path.insert(0, "/app/api")
    from app.models import PlanRevenueAssumptions as PlanRevenueAssumptionsORM

    with _get_sync_session() as db:
        job = db.get(CalcJob, UUID(job_id))
        pid = UUID(plan_id)
        try:
            if job:
                job.status = "STARTED"
                db.commit()
            dump = _sync_revenue_projection(db, pid)
            assump = db.get(PlanRevenueAssumptionsORM, pid)
            if not assump:
                assump = PlanRevenueAssumptionsORM(plan_id=pid)
                db.add(assump)
            assump.projection_cache = dump
            if job:
                job.status = "COMPLETED"
                job.result = dump
                job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return dump
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

            raw_inputs = plan.inputs if isinstance(plan.inputs, dict) else {}
            inputs = PlanInputs.model_validate(raw_inputs)
            results = PlanResults.model_validate(results_data)
            extra_inputs = {
                k: v
                for k, v in raw_inputs.items()
                if k not in PlanInputs.model_fields
            }
            files: dict[str, str] = {}
            if "pdf" in formats:
                files["pdf"] = _export_pdf(
                    plan_id,
                    inputs,
                    results,
                    plan_title=plan.title,
                    extra_inputs=extra_inputs,
                )
            if "xlsx" in formats:
                files["xlsx"] = _export_xlsx(
                    plan_id,
                    inputs,
                    results,
                    plan_title=plan.title,
                    extra_inputs=extra_inputs,
                )
            if "docx" in formats:
                from tasks.export_excel import build_plan_data
                from tasks.export_word import build_feasibility_docx_from_plan_data

                plan_data = build_plan_data(
                    inputs=inputs,
                    results=results,
                    plan_id=plan_id,
                    title=plan.title,
                )
                if extra_inputs:
                    raw = plan_data.get("inputs") or {}
                    if isinstance(raw, dict):
                        plan_data["inputs"] = {**raw, **extra_inputs}
                    for key in ("market_study", "swot", "logo_path", "sector", "promoter", "cabinet"):
                        if key in extra_inputs:
                            plan_data[key] = extra_inputs[key]
                files["docx"] = build_feasibility_docx_from_plan_data(
                    plan_data, EXPORT_DIR
                )

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


def _export_xlsx(
    plan_id: str,
    inputs: PlanInputs,
    results: PlanResults,
    *,
    plan_title: str | None = None,
    extra_inputs: dict | None = None,
) -> str:
    from tasks.export_excel import build_plan_data, generate_excel_report

    company = inputs.company.name.strip() or "projet"
    slug = "".join(c if c.isalnum() else "_" for c in company)[:40].strip("_") or "projet"
    out = EXPORT_DIR / f"business_plan_{plan_id}_{slug}.xlsx"
    plan_data = build_plan_data(
        inputs=inputs,
        results=results,
        plan_id=plan_id,
        title=plan_title,
    )
    if extra_inputs:
        plan_data["inputs"] = {**plan_data.get("inputs", {}), **extra_inputs}
    generate_excel_report(plan_data, str(out))
    return str(out.resolve())


def _export_pdf(
    plan_id: str,
    inputs: PlanInputs,
    results: PlanResults,
    *,
    plan_title: str | None = None,
    extra_inputs: dict | None = None,
) -> str:
    from worker.export_builders import build_export_pdf

    return build_export_pdf(
        plan_id,
        inputs,
        results,
        EXPORT_DIR,
        plan_title=plan_title,
        extra_inputs=extra_inputs,
    )
