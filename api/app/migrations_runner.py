"""Alembic startup with legacy DB detection (create_all → Alembic transition)."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text

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


def _alembic_head(cfg: Config) -> str:
    head = ScriptDirectory.from_config(cfg).get_current_head()
    if not head:
        raise RuntimeError("Alembic script has no head revision")
    return head


def _with_connection(connection, cfg: Config, fn) -> None:
    cfg.attributes["connection"] = connection
    fn(cfg)


def _stamp_head_sql(sync_conn, revision: str) -> None:
    """Insert alembic_version without Alembic env (avoids async txn conflicts)."""
    if not inspect(sync_conn).has_table("alembic_version"):
        sync_conn.execute(
            text(
                "CREATE TABLE alembic_version ("
                "version_num VARCHAR(32) NOT NULL, "
                "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))"
            )
        )
    sync_conn.execute(text("DELETE FROM alembic_version"))
    sync_conn.execute(
        text("INSERT INTO alembic_version (version_num) VALUES (:rev)"),
        {"rev": revision},
    )


def _upgrade_error_recoverable(exc: Exception, *, has_existing_data: bool) -> bool:
    if not has_existing_data:
        return False
    err = str(exc).lower()
    return any(marker in err for marker in _LEGACY_UPGRADE_SKIP_MARKERS)


async def _stamp_head_direct(cfg: Config) -> str:
    revision = _alembic_head(cfg)
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: _stamp_head_sql(sync_conn, revision))
    return revision


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
            "Stamping head via SQL; create_all will add any missing tables."
        )
        rev = await _stamp_head_direct(cfg)
        logger.info("Legacy database stamped at Alembic head (%s)", rev)
        return

    try:
        async with engine.begin() as conn:
            await conn.run_sync(
                lambda sync_conn: _with_connection(
                    sync_conn, cfg, lambda c: command.upgrade(c, "head")
                )
            )
        logger.info("Alembic migrations applied (upgrade head)")
    except Exception as exc:
        if _upgrade_error_recoverable(exc, has_existing_data=has_users):
            logger.warning(
                "Alembic upgrade skipped (%s). Stamping head via SQL; create_all will fill gaps.",
                exc,
            )
            rev = await _stamp_head_direct(cfg)
            logger.info("Database stamped at head after recoverable upgrade error (%s)", rev)
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
