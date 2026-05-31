"""Document templates and sector hypotheses."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "019_document_templates"
down_revision = "018_user_preferences"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(80), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("version", sa.String(32), nullable=False, server_default="v1.0"),
        sa.Column("secteur", sa.String(64), nullable=False),
        sa.Column("sous_secteur", sa.String(64), nullable=False),
        sa.Column("type_entreprise", sa.String(16), nullable=False),
        sa.Column("type_financement", sa.String(32), nullable=False),
        sa.Column("document_type", sa.String(16), nullable=False, server_default="ALL"),
        sa.Column("hypotheses", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("sections_incluses", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("usage_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_document_templates_secteur", "document_templates", ["secteur"])
    op.create_index("ix_document_templates_active", "document_templates", ["is_active"])
    op.create_index("ix_document_templates_code", "document_templates", ["code"], unique=True)

    op.create_table(
        "template_hypotheses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "template_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("document_templates.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("categorie", sa.String(32), nullable=False),
        sa.Column("cle", sa.String(80), nullable=False),
        sa.Column("valeur_defaut", sa.Float(), nullable=False),
        sa.Column("unite", sa.String(16), nullable=False, server_default="%"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("min_valeur", sa.Float(), nullable=True),
        sa.Column("max_valeur", sa.Float(), nullable=True),
        sa.Column("source", sa.String(64), nullable=True),
    )
    op.create_index("ix_template_hypotheses_template_id", "template_hypotheses", ["template_id"])


def downgrade() -> None:
    op.drop_index("ix_template_hypotheses_template_id", table_name="template_hypotheses")
    op.drop_table("template_hypotheses")
    op.drop_index("ix_document_templates_code", table_name="document_templates")
    op.drop_index("ix_document_templates_active", table_name="document_templates")
    op.drop_index("ix_document_templates_secteur", table_name="document_templates")
    op.drop_table("document_templates")
