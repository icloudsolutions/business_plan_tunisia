"""Workflow and collaboration email triggers."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.email_queue import plan_url, schedule_email
from app.emails.content import (
    SUBJECT_BY_TYPE,
    field_display,
    section_display,
)
from app.models import BusinessPlan, PlanComment, PlanSectionReview, User


async def _flagged_sections(db: AsyncSession, plan_id: UUID) -> list[dict]:
    result = await db.execute(
        select(PlanSectionReview).where(
            PlanSectionReview.plan_id == plan_id,
            PlanSectionReview.status.in_(("flag", "reject")),
        )
    )
    return [section_display(r.section_key, r.status) for r in result.scalars().all()]


async def _admin_users(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User).where(User.role == "admin"))
    return list(result.scalars().all())


async def notify_plan_submitted(db: AsyncSession, plan: BusinessPlan) -> None:
    if not plan.assigned_expert_id:
        return
    expert = await db.get(User, plan.assigned_expert_id)
    owner = await db.get(User, plan.owner_id)
    if not expert:
        return
    subject, _ = SUBJECT_BY_TYPE["plan_submitted"]
    await schedule_email(
        db,
        user=expert,
        email_type="plan_submitted",
        subject=subject,
        plan_id=plan.id,
        context={
            "plan_title": plan.title,
            "owner_email": owner.email if owner else "—",
        },
    )


async def notify_corrections_required(
    db: AsyncSession,
    plan: BusinessPlan,
    *,
    expert_message: str | None = None,
) -> None:
    owner = await db.get(User, plan.owner_id)
    if not owner:
        return
    flagged = await _flagged_sections(db, plan.id)
    subject, _ = SUBJECT_BY_TYPE["corrections_required"]
    await schedule_email(
        db,
        user=owner,
        email_type="corrections_required",
        subject=subject,
        plan_id=plan.id,
        context={
            "plan_title": plan.title,
            "flagged_sections": flagged,
            "expert_message": expert_message or "",
        },
    )


async def notify_client_resubmitted(db: AsyncSession, plan: BusinessPlan) -> None:
    if not plan.assigned_expert_id:
        return
    expert = await db.get(User, plan.assigned_expert_id)
    if not expert:
        return
    subject, _ = SUBJECT_BY_TYPE["client_resubmitted"]
    await schedule_email(
        db,
        user=expert,
        email_type="client_resubmitted",
        subject=subject,
        plan_id=plan.id,
        context={"plan_title": plan.title},
    )


async def notify_plan_validated(db: AsyncSession, plan: BusinessPlan) -> None:
    owner = await db.get(User, plan.owner_id)
    if owner:
        subject, _ = SUBJECT_BY_TYPE["plan_validated"]
        await schedule_email(
            db,
            user=owner,
            email_type="plan_validated",
            subject=subject,
            plan_id=plan.id,
            context={
                "plan_title": plan.title,
                "cta_label_fr": "Télécharger la liasse",
                "cta_label_ar": "تحميل الملف",
            },
        )
    for admin in await _admin_users(db):
        subject, _ = SUBJECT_BY_TYPE["plan_validated"]
        await schedule_email(
            db,
            user=admin,
            email_type="plan_validated",
            subject=f"[Admin] {subject} — {plan.title}",
            plan_id=plan.id,
            context={
                "plan_title": plan.title,
                "cta_label_fr": "Voir le plan",
                "cta_label_ar": "عرض الخطة",
            },
        )


async def notify_new_comment(
    db: AsyncSession,
    plan: BusinessPlan,
    comment: PlanComment,
    author: User,
) -> None:
    preview = (comment.content or "")[:280]
    if len(comment.content or "") > 280:
        preview += "…"
    label_fr, label_ar = field_display(comment.field_key)

    if author.role == "expert":
        recipient = await db.get(User, plan.owner_id)
    elif author.role == "client":
        if not plan.assigned_expert_id:
            return
        recipient = await db.get(User, plan.assigned_expert_id)
    else:
        return

    if not recipient or recipient.id == author.id:
        return

    author_name = author.display_name or author.email.split("@")[0]
    subject, _ = SUBJECT_BY_TYPE["new_comment"]
    await schedule_email(
        db,
        user=recipient,
        email_type="new_comment",
        subject=subject,
        plan_id=plan.id,
        context={
            "plan_title": plan.title,
            "author_name": author_name,
            "field_label": label_fr,
            "field_label_ar": label_ar,
            "comment_preview": preview,
            "plan_url": plan_url(plan.id),
        },
    )
