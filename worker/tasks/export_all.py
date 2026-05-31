"""
Export composite : Excel + Word + PowerPoint en parallèle (Celery chord) puis ZIP.
"""

from __future__ import annotations

import json
import os
import zipfile
from pathlib import Path
from uuid import UUID

import redis
from celery import chord, group
from sqlalchemy.orm import Session

from bp_schema.liasse import PlanInputs, PlanResults
from worker.celery_app import celery_app

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
EXPORT_DIR = Path(os.getenv("EXPORT_STORAGE_PATH", "/app/exports"))
EXPORT_DIR.mkdir(parents=True, exist_ok=True)

_PROGRESS_TTL = 3600
_VALID_AUDIENCES = frozenset({"banque", "investisseur", "client"})


def _redis_client() -> redis.Redis:
    return redis.from_url(REDIS_URL, decode_responses=True)


def _progress_key(job_id: str) -> str:
    return f"export:progress:{job_id}"


def _set_progress(job_id: str, *, pct: int, files_ready: list[str]) -> None:
    try:
        _redis_client().setex(
            _progress_key(job_id),
            _PROGRESS_TTL,
            json.dumps({"progress_pct": pct, "files_ready": files_ready}),
        )
    except redis.RedisError:
        pass


def _get_progress(job_id: str) -> dict:
    try:
        raw = _redis_client().get(_progress_key(job_id))
        if raw:
            return json.loads(raw)
    except (redis.RedisError, json.JSONDecodeError):
        pass
    return {"progress_pct": 0, "files_ready": []}


def _get_sync_session() -> Session:
    from worker.tasks import _get_sync_session as _session

    return _session()


def _import_models():
    from worker.tasks import _import_models as _models

    return _models()


def _fail_export_job(db: Session, job, error: str) -> None:
    from worker.tasks import _fail_export_job as _fail

    _fail(db, job, error)


def _complete_export_job(db: Session, job, files: dict[str, str]) -> None:
    if job:
        job.status = "COMPLETED"
        job.file_path = json.dumps(files)
        db.commit()
    _set_progress(str(job.id), pct=100, files_ready=list(files.keys()))


def load_plan_data(plan_id: str) -> dict:
    """Charge inputs/résultats depuis PostgreSQL et construit plan_data (pas d'appel HTTP)."""
    BusinessPlan, _, _, _, PlanScenario, _ = _import_models()
    from tasks.export_excel import build_plan_data

    with _get_sync_session() as db:
        plan = db.get(BusinessPlan, UUID(plan_id))
        if not plan:
            raise ValueError("Plan introuvable")
        results_data = plan.results
        if plan.official_scenario_id:
            official = db.get(PlanScenario, plan.official_scenario_id)
            if official and official.results:
                results_data = official.results
        if not results_data:
            raise ValueError("Résultats manquants")
        raw_inputs = plan.inputs if isinstance(plan.inputs, dict) else {}
        inputs = PlanInputs.model_validate(raw_inputs)
        results = PlanResults.model_validate(results_data)
        extra_inputs = {
            k: v for k, v in raw_inputs.items() if k not in PlanInputs.model_fields
        }
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
            for key in (
                "market_study",
                "swot",
                "logo_path",
                "sector",
                "promoter",
                "cabinet",
                "site",
                "team",
                "planning",
                "presentation_audience",
                "project_description",
            ):
                if key in extra_inputs:
                    plan_data[key] = extra_inputs[key]
        return plan_data


def _record_partial(job_id: str, fmt: str, path: str, pct: int) -> None:
    prog = _get_progress(job_id)
    ready = list(prog.get("files_ready") or [])
    if fmt not in ready:
        ready.append(fmt)
    _set_progress(job_id, pct=max(pct, int(prog.get("progress_pct") or 0)), files_ready=ready)


@celery_app.task(
    name="worker.tasks.export_parallel_excel",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 1},
    soft_time_limit=240,
    time_limit=300,
)
def export_parallel_excel(self, plan_data: dict, output_path: str, job_id: str) -> str:
    from tasks.export_excel import celery_export_excel

    path = celery_export_excel(plan_data, output_path)
    _record_partial(job_id, "xlsx", path, 33)
    return path


@celery_app.task(
    name="worker.tasks.export_parallel_word",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 1},
    soft_time_limit=240,
    time_limit=300,
)
def export_parallel_word(self, plan_data: dict, output_path: str, job_id: str) -> str:
    from tasks.export_word import celery_export_word

    path = celery_export_word(plan_data, output_path)
    _record_partial(job_id, "docx", path, 66)
    return path


@celery_app.task(
    name="worker.tasks.export_parallel_pptx",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 1},
    soft_time_limit=240,
    time_limit=300,
)
def export_parallel_pptx(
    self, plan_data: dict, audience: str, output_path: str, job_id: str
) -> str:
    from tasks.export_pptx import celery_export_pptx

    aud = audience if audience in _VALID_AUDIENCES else "banque"
    path = celery_export_pptx(plan_data, aud, output_path)
    _record_partial(job_id, "pptx", path, 90)
    return path


@celery_app.task(name="worker.tasks.create_zip_archive")
def create_zip_archive(
    results: list,
    export_dir: str,
    plan_id: str,
    job_id: str,
    audience: str,
    archive_names: dict[str, str],
) -> str:
    """
    Callback chord : compresse les fichiers générés et met à jour ExportJob.
    results: [xlsx_path, docx_path, pptx_path]
    """
    _, _, _, ExportJob, _, _ = _import_models()
    export_path = Path(export_dir)
    zip_path = EXPORT_DIR / plan_id / f"{job_id}_pack_complet.zip"
    zip_path.parent.mkdir(parents=True, exist_ok=True)

    files_map: dict[str, str] = {}
    keys = ("xlsx", "docx", "pptx")
    for key, result_path in zip(keys, results or []):
        if result_path and Path(result_path).is_file():
            files_map[key] = str(Path(result_path).resolve())

    pptx_arc = archive_names.get("pptx") or f"presentation_{audience}.pptx"
    arc_by_key = {
        "xlsx": archive_names.get("xlsx", "business_plan.xlsx"),
        "docx": archive_names.get("docx", "etude_faisabilite.docx"),
        "pptx": pptx_arc,
    }

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for key, filepath in files_map.items():
            zf.write(filepath, arc_by_key.get(key, Path(filepath).name))

    if not files_map:
        with _get_sync_session() as db:
            job = db.get(ExportJob, UUID(job_id))
            _fail_export_job(db, job, "Aucun fichier généré")
        raise RuntimeError("Aucun fichier exporté")

    files_map["zip"] = str(zip_path.resolve())

    with _get_sync_session() as db:
        job = db.get(ExportJob, UUID(job_id))
        _complete_export_job(db, job, files_map)

    return str(zip_path.resolve())


@celery_app.task(name="worker.tasks.export_all_failed")
def export_all_failed(request, exc, traceback, job_id: str) -> None:
    _, _, _, ExportJob, _, _ = _import_models()
    with _get_sync_session() as db:
        job = db.get(ExportJob, UUID(job_id))
        _fail_export_job(db, job, str(exc) if exc else "Export pack échoué")
    _set_progress(job_id, pct=0, files_ready=[])


@celery_app.task(
    name="worker.tasks.export_all_documents",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 1},
    soft_time_limit=120,
    time_limit=180,
)
def export_all_documents(
    self,
    plan_id: str,
    job_id: str,
    audience: str = "banque",
) -> dict:
    """
    Lance Excel + Word + PPTX en parallèle puis compression ZIP.
    """
    if audience not in _VALID_AUDIENCES:
        audience = "banque"

    _, _, _, ExportJob, _, _ = _import_models()

    with _get_sync_session() as db:
        job = db.get(ExportJob, UUID(job_id))
        if not job:
            return {"error": "job_not_found", "job_id": job_id}
        job.status = "STARTED"
        db.commit()

    _set_progress(job_id, pct=5, files_ready=[])

    try:
        plan_data = load_plan_data(plan_id)
    except Exception as exc:
        with _get_sync_session() as db:
            job = db.get(ExportJob, UUID(job_id))
            _fail_export_job(db, job, str(exc))
        raise

    export_dir = EXPORT_DIR / plan_id / job_id
    export_dir.mkdir(parents=True, exist_ok=True)

    xlsx_path = str(export_dir / "business_plan.xlsx")
    docx_path = str(export_dir / "etude_faisabilite.docx")
    pptx_name = f"presentation_{audience}.pptx"
    pptx_path = str(export_dir / pptx_name)

    archive_names = {
        "xlsx": "business_plan.xlsx",
        "docx": "etude_faisabilite.docx",
        "pptx": pptx_name,
    }

    header = group(
        export_parallel_excel.s(plan_data, xlsx_path, job_id),
        export_parallel_word.s(plan_data, docx_path, job_id),
        export_parallel_pptx.s(plan_data, audience, pptx_path, job_id),
    )
    callback = create_zip_archive.s(
        str(export_dir), plan_id, job_id, audience, archive_names
    ).link_error(export_all_failed.s(job_id))
    async_result = chord(header)(callback)

    with _get_sync_session() as db:
        job = db.get(ExportJob, UUID(job_id))
        if job:
            job.celery_task_id = async_result.id
            db.commit()

    return {
        "job_id": job_id,
        "celery_task_id": async_result.id,
        "status": "STARTED",
        "plan_id": plan_id,
        "audience": audience,
    }


def read_export_progress(job_id: str) -> dict:
    """Utilisé par l'API pour le polling (Redis + statut implicite)."""
    return _get_progress(job_id)
