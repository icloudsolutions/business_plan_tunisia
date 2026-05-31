"""Add missing columns on legacy DBs stamped at head without running migrations."""

from __future__ import annotations

import logging

from sqlalchemy import inspect, text

logger = logging.getLogger("bp.api.legacy_schema")

# (table, column, ALTER when column absent)
_COLUMN_PATCHES: list[tuple[str, str, str]] = [
    ("users", "display_name", "ALTER TABLE users ADD COLUMN display_name VARCHAR(255)"),
    (
        "users",
        "status",
        "ALTER TABLE users ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'active'",
    ),
    (
        "users",
        "last_active_at",
        "ALTER TABLE users ADD COLUMN last_active_at TIMESTAMP WITH TIME ZONE",
    ),
    (
        "business_plans",
        "official_scenario_id",
        "ALTER TABLE business_plans ADD COLUMN official_scenario_id UUID",
    ),
    (
        "business_plans",
        "updated_at",
        "ALTER TABLE business_plans ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()",
    ),
    (
        "plan_versions",
        "snapshot",
        "ALTER TABLE plan_versions ADD COLUMN snapshot JSONB",
    ),
    (
        "users",
        "preferred_locale",
        "ALTER TABLE users ADD COLUMN preferred_locale VARCHAR(8) NOT NULL DEFAULT 'fr'",
    ),
    ("users", "timezone", "ALTER TABLE users ADD COLUMN timezone VARCHAR(64)"),
    (
        "users",
        "email_notifications_enabled",
        "ALTER TABLE users ADD COLUMN email_notifications_enabled BOOLEAN NOT NULL DEFAULT true",
    ),
]


def _column_names(sync_conn, table: str) -> set[str]:
    if not inspect(sync_conn).has_table(table):
        return set()
    return {c["name"] for c in inspect(sync_conn).get_columns(table)}


def _patch_export_jobs_format_width(sync_conn) -> None:
    """DBs stamped at Alembic head without running upgrade keep format VARCHAR(16)."""
    if not inspect(sync_conn).has_table("export_jobs"):
        return
    for col in inspect(sync_conn).get_columns("export_jobs"):
        if col["name"] != "format":
            continue
        col_type = col.get("type")
        length = getattr(col_type, "length", None)
        if length is not None and int(length) < 128:
            sync_conn.execute(
                text("ALTER TABLE export_jobs ALTER COLUMN format TYPE VARCHAR(128)")
            )
            logger.info(
                "Legacy schema patch: export_jobs.format widened from VARCHAR(%s) to 128",
                length,
            )
        return


def apply_legacy_column_patches(sync_conn) -> None:
    """Align old databases with current ORM (migrations skipped at startup)."""
    _patch_export_jobs_format_width(sync_conn)
    for table, column, ddl in _COLUMN_PATCHES:
        if column in _column_names(sync_conn, table):
            continue
        sync_conn.execute(text(ddl))
        logger.info("Legacy schema patch: added %s.%s", table, column)

    # FK for official_scenario_id (migration 006) — ignore if scenarios table missing
    if inspect(sync_conn).has_table("business_plans") and inspect(sync_conn).has_table(
        "plan_scenarios"
    ):
        if "official_scenario_id" in _column_names(sync_conn, "business_plans"):
            fk_name = "fk_business_plans_official_scenario"
            existing = {
                fk.get("name")
                for fk in inspect(sync_conn).get_foreign_keys("business_plans")
            }
            if fk_name not in existing:
                try:
                    sync_conn.execute(
                        text(
                            "ALTER TABLE business_plans "
                            "ADD CONSTRAINT fk_business_plans_official_scenario "
                            "FOREIGN KEY (official_scenario_id) REFERENCES plan_scenarios (id) "
                            "ON DELETE SET NULL"
                        )
                    )
                    logger.info("Legacy schema patch: added %s", fk_name)
                except Exception as exc:
                    logger.warning("Could not add %s: %s", fk_name, exc)
