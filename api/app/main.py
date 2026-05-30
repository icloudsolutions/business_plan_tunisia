import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import validate_security_settings
from app.database import Base, engine
from app.log_buffer import install_log_buffer
from app.routers import (
    admin_router,
    ai_router,
    auth_router,
    collaboration_router,
    email_router,
    copilot_router,
    jobs_router,
    plans_router,
    projections_router,
    scenarios_router,
    history_router,
    products_router,
    cost_router,
    payroll_router,
    other_charges_router,
    ws_router,
)

import app.db_hooks  # noqa: F401 — register ORM validators

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("bp.api")


async def _run_migrations() -> None:
    if os.getenv("RUN_MIGRATIONS", "").lower() not in ("1", "true", "yes"):
        return
    try:
        from alembic import command
        from alembic.config import Config

        alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
        await engine.dispose()
        command.upgrade(alembic_cfg, "head")
        logger.info("Alembic migrations applied")
    except Exception as e:
        logger.warning("Alembic migration skipped or failed: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    install_log_buffer()
    validate_security_settings()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _run_migrations()
    if os.getenv("RUN_SEED", "").lower() in ("1", "true", "yes"):
        from app.init_seed import seed

        await seed()
    yield


app = FastAPI(title="Business Plan Tunisie API", version="0.2.0", lifespan=lifespan)

_cors_raw = os.getenv("CORS_ORIGINS", "http://localhost,http://127.0.0.1")
_cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Admin-Key"],
)

app.include_router(auth_router.router, prefix="/api")
app.include_router(admin_router.router, prefix="/api")
app.include_router(plans_router.router, prefix="/api")
app.include_router(projections_router.router, prefix="/api")
app.include_router(scenarios_router.router, prefix="/api")
app.include_router(history_router.router, prefix="/api")
app.include_router(products_router.router, prefix="/api")
app.include_router(cost_router.router, prefix="/api")
app.include_router(payroll_router.router, prefix="/api")
app.include_router(other_charges_router.router, prefix="/api")
app.include_router(ai_router.router, prefix="/api")
app.include_router(email_router.router, prefix="/api")
app.include_router(collaboration_router.router, prefix="/api")
app.include_router(jobs_router.router, prefix="/api")
app.include_router(copilot_router.router, prefix="/api")
app.include_router(ws_router.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "api", "version": "0.2.0"}
