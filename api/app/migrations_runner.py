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

_LEGACY_UPGRADE_SKIP_MARKERS = (
    "already exists",
    "duplicate",
    "duplicate column",
    "42701",  # PostgreSQL duplicate_column
    "42p07",  # PostgreSQL duplicate_table
)


def _migrations_enabled() -> bool:
    return os.getenv("RUN_MIGRATIONS", "true").lower() in ("1", "true", "yes")


def _alembic_config() -> Config:
    cfg = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", settings.database_url)
    return cfg


def _with_connection(connection, cfg: Config, fn) -> None:
    cfg.attributes["connection"] = connection
    fn(cfg)


def _upgrade_error_recoverable(exc: Exception, *, has_existing_data: bool) -> bool:
    if not has_existing_data:
        return False
    err = str(exc).lower()
    return any(marker in err for marker in _LEGACY_UPGRADE_SKIP_MARKERS)


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
        legacy = has_users and not has_alembic

        if legacy:
            logger.warning(
                "Legacy database detected (tables present, alembic_version missing). "
                "Stamping head; create_all will add any missing tables."
            )
            await conn.run_sync(
                lambda sync_conn: _with_connection(
                    sync_conn, cfg, lambda c: command.stamp(c, "head")
                )
            )
            await conn.commit()
            logger.info("Legacy database stamped at Alembic head")
        else:
            try:
                await conn.run_sync(
                    lambda sync_conn: _with_connection(
                        sync_conn, cfg, lambda c: command.upgrade(c, "head")
                    )
                )
                await conn.commit()
                logger.info("Alembic migrations applied (upgrade head)")
            except Exception as exc:
                if _upgrade_error_recoverable(exc, has_existing_data=has_users):
                    logger.warning(
                        "Alembic upgrade skipped (%s). Stamping head; create_all will fill gaps.",
                        exc,
                    )
                    await conn.run_sync(
                        lambda sync_conn: _with_connection(
                            sync_conn, cfg, lambda c: command.stamp(c, "head")
                        )
                    )
                    await conn.commit()
                    logger.info("Alembic stamped at head after recoverable upgrade error")
                else:
                    logger.exception("Alembic upgrade failed")
                    raise


async def ensure_orm_tables() -> None:
    """Create any ORM tables missing from the DB (checkfirst; safe after Alembic)."""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("ORM tables verified (create_all checkfirst)")
    except Exception:
        logger.exception("create_all failed during startup")
        raise
