"""Alembic startup with legacy DB detection (create_all → Alembic transition)."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from app.config import settings
from app.database import Base, engine
import app.models  # noqa: F401 — register metadata for create_all

logger = logging.getLogger("bp.api.migrations")


def _migrations_enabled() -> bool:
    return os.getenv("RUN_MIGRATIONS", "true").lower() in ("1", "true", "yes")


def _alembic_config() -> Config:
    cfg = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", settings.database_url)
    return cfg


def _with_connection(connection, cfg: Config, fn) -> None:
    cfg.attributes["connection"] = connection
    fn(cfg)


async def run_startup_migrations() -> None:
    if not _migrations_enabled():
        return

    cfg = _alembic_config()

    async with engine.connect() as conn:
        has_alembic = await conn.run_sync(
            lambda sync_conn: inspect(sync_conn).has_table("alembic_version")
        )
        has_users = await conn.run_sync(
            lambda sync_conn: inspect(sync_conn).has_table("users")
        )

        if has_users and not has_alembic:
            logger.warning(
                "Legacy database detected (tables present, alembic_version missing). "
                "Stamping head before upgrade."
            )
            await conn.run_sync(
                lambda sync_conn: _with_connection(sync_conn, cfg, lambda c: command.stamp(c, "head"))
            )

        try:
            await conn.run_sync(
                lambda sync_conn: _with_connection(
                    sync_conn, cfg, lambda c: command.upgrade(c, "head")
                )
            )
            logger.info("Alembic migrations applied")
        except Exception as exc:
            err = str(exc).lower()
            if has_users and ("already exists" in err or "duplicate" in err):
                logger.warning(
                    "Alembic upgrade skipped (%s). Stamping head; create_all will fill gaps.",
                    exc,
                )
                await conn.run_sync(
                    lambda sync_conn: _with_connection(
                        sync_conn, cfg, lambda c: command.stamp(c, "head")
                    )
                )
            else:
                raise


async def ensure_orm_tables() -> None:
    """Create any ORM tables missing from the DB (checkfirst; safe after Alembic)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("ORM tables verified (create_all checkfirst)")
