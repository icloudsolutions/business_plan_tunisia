"""Alembic startup with legacy / existing DB detection."""

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


def _read_current_revision(sync_conn) -> str | None:
    if not inspect(sync_conn).has_table("alembic_version"):
        return None
    row = sync_conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).fetchone()
    return str(row[0]) if row else None


def _stamp_head_sql(sync_conn, revision: str) -> None:
    """Set alembic_version without invoking Alembic env (async-safe)."""
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


async def _stamp_head_direct(cfg: Config) -> str:
    revision = _alembic_head(cfg)
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: _stamp_head_sql(sync_conn, revision))
    return revision


async def _sync_existing_database(cfg: Config, current: str | None) -> None:
    """Existing data: apply pending Alembic revisions, or stamp if version table missing."""
    head = _alembic_head(cfg)
    if current == head:
        logger.info("Existing database already at Alembic head (%s)", head)
        return
    if current is not None and current != head:
        logger.info(
            "Existing database behind head (revision=%s, head=%s) — running upgrade",
            current,
            head,
        )
        async with engine.begin() as conn:
            await conn.run_sync(
                lambda sync_conn: _with_connection(
                    sync_conn, cfg, lambda c: command.upgrade(c, "head")
                )
            )
        logger.info("Alembic upgrade applied to %s", head)
        return
    logger.warning(
        "Existing database without alembic_version (head=%s). "
        "Stamping head; legacy patches will align column types.",
        head,
    )
    await _stamp_head_direct(cfg)
    logger.info("Database stamped at Alembic head (%s)", head)


async def run_startup_migrations() -> None:
    if not _migrations_enabled():
        return

    cfg = _alembic_config()
    head = _alembic_head(cfg)

    async with engine.connect() as conn:
        has_users = await conn.run_sync(
            lambda sync_conn: inspect(sync_conn).has_table("users")
        )
        current = await conn.run_sync(lambda sync_conn: _read_current_revision(sync_conn))

    if has_users:
        await _sync_existing_database(cfg, current)
        return

    logger.info("Empty database detected — running Alembic upgrade to %s", head)
    async with engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: _with_connection(
                sync_conn, cfg, lambda c: command.upgrade(c, "head")
            )
        )
    logger.info("Alembic migrations applied (upgrade head)")


async def ensure_orm_tables() -> None:
    """Create any ORM tables missing from the DB (checkfirst; safe after Alembic)."""
    from app.legacy_schema import apply_legacy_column_patches

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await conn.run_sync(apply_legacy_column_patches)
        logger.info("ORM tables verified (create_all + legacy column patches)")
    except Exception:
        logger.exception("create_all failed during startup")
        raise
