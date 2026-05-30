"""Queue transactional emails via Celery."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.celery_client import celery_app
from app.config import settings
from app.models import EmailNotification, User

logger = logging.getLogger("bp.email")


def plan_url(plan_id: UUID, locale: str = "fr") -> str:
    base = settings.app_base_url.rstrip("/")
    loc = "ar" if locale == "ar" else "fr"
    return f"{base}/{loc}/plans/{plan_id}"


def tracking_pixel_url(notification_id: UUID) -> str:
    base = settings.app_base_url.rstrip("/")
    return f"{base}/api/email/track/{notification_id}/open.png"


def enqueue_email_send(notification_id: UUID) -> None:
    celery_app.send_task(
        "worker.tasks.send_transactional_email",
        args=[str(notification_id)],
        queue="email",
    )
    logger.debug("Queued email %s", notification_id)


async def schedule_email(
    db: AsyncSession,
    *,
    user: User,
    email_type: str,
    subject: str,
    context: dict,
    plan_id: UUID | None = None,
) -> EmailNotification:
    ctx = dict(context)
    locale = ctx.get("locale", "fr")
    if plan_id and "plan_url" not in ctx:
        ctx["plan_url"] = plan_url(plan_id, locale)
        ctx.setdefault("cta_url", ctx["plan_url"])
        ctx.setdefault("cta_label_fr", "Ouvrir le plan")
        ctx.setdefault("cta_label_ar", "فتح الخطة")
    ctx.setdefault("locale", locale)

    row = EmailNotification(
        plan_id=plan_id,
        user_id=user.id,
        type=email_type,
        recipient_email=user.email,
        subject=subject,
        context=ctx,
    )
    db.add(row)
    await db.flush()
    enqueue_email_send(row.id)
    return row
