from celery import Celery

from app.config import settings

celery_app = Celery("bp_worker", broker=settings.celery_broker_url, backend=settings.redis_url)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Africa/Tunis",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,
    task_soft_time_limit=240,
    task_routes={
        "worker.tasks.recalculate_plan": {"queue": "calc"},
        "worker.tasks.run_simulation": {"queue": "calc"},
        "worker.tasks.generate_export": {"queue": "export"},
        "worker.tasks.export_all_documents": {"queue": "export"},
        "worker.tasks.export_parallel_excel": {"queue": "export"},
        "worker.tasks.export_parallel_word": {"queue": "export"},
        "worker.tasks.export_parallel_pptx": {"queue": "export"},
        "worker.tasks.create_zip_archive": {"queue": "export"},
        "worker.tasks.send_transactional_email": {"queue": "email"},
        "worker.tasks.calculate_plan_scenario": {"queue": "calc"},
        "worker.tasks.calculate_revenue_projection": {"queue": "calc"},
    },
)
