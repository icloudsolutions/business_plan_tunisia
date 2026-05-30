"""User profile preferences (locale, timezone, notifications)."""

from alembic import op
import sqlalchemy as sa

revision = "018_user_preferences"
down_revision = "017_plan_pricing_grid"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("preferred_locale", sa.String(8), nullable=False, server_default="fr"),
    )
    op.add_column("users", sa.Column("timezone", sa.String(64), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "email_notifications_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "email_notifications_enabled")
    op.drop_column("users", "timezone")
    op.drop_column("users", "preferred_locale")
