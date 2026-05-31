"""Widen export_jobs.format for multi-format export lists (e.g. pdf,xlsx,docx,pptx)."""

from alembic import op
import sqlalchemy as sa

revision = "020_export_jobs_format_length"
down_revision = "019_document_templates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Raw SQL: reliable on PostgreSQL when prior stamp skipped alter_column.
    op.execute(
        "ALTER TABLE export_jobs ALTER COLUMN format TYPE VARCHAR(128)"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE export_jobs ALTER COLUMN format TYPE VARCHAR(16)"
    )
