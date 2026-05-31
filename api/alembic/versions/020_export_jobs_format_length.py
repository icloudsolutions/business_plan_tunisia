"""Widen export_jobs.format for multi-format export lists (e.g. pdf,xlsx,docx,pptx)."""

from alembic import op
import sqlalchemy as sa

revision = "020_export_jobs_format_length"
down_revision = "019_document_templates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "export_jobs",
        "format",
        existing_type=sa.String(16),
        type_=sa.String(128),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "export_jobs",
        "format",
        existing_type=sa.String(128),
        type_=sa.String(16),
        existing_nullable=True,
    )
