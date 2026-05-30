"""Helpers for plan collaboration (activity feed, comment payloads)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import PlanActivity, PlanComment, PlanSectionReview, PlanVersion, User
from app.realtime import broadcast_plan_event


async def log_activity(
    db: AsyncSession,
    plan_id: UUID,
    user_id: UUID | None,
    kind: str,
    message: str,
    meta: dict | None = None,
    *,
    broadcast: bool = True,
) -> PlanActivity:
    row = PlanActivity(
        plan_id=plan_id,
        user_id=user_id,
        kind=kind,
        message=message,
        meta=meta or {},
    )
    db.add(row)
    await db.flush()
    if broadcast:
        await broadcast_plan_event(
            plan_id,
            "activity.created",
            activity_to_dict(row, email=None),
        )
    return row


def comment_to_dict(c: PlanComment, email: str | None) -> dict:
    return {
        "id": str(c.id),
        "plan_id": str(c.plan_id),
        "field_key": c.field_key,
        "user_id": str(c.user_id),
        "user_email": email,
        "content": c.content,
        "parent_id": str(c.parent_id) if c.parent_id else None,
        "resolved": c.resolved,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def activity_to_dict(a: PlanActivity, email: str | None) -> dict:
    return {
        "id": str(a.id),
        "plan_id": str(a.plan_id),
        "user_id": str(a.user_id) if a.user_id else None,
        "user_email": email,
        "kind": a.kind,
        "message": a.message,
        "meta": a.meta or {},
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def section_review_to_dict(r: PlanSectionReview, email: str | None) -> dict:
    return {
        "id": str(r.id),
        "plan_id": str(r.plan_id),
        "section_key": r.section_key,
        "status": r.status,
        "user_id": str(r.user_id),
        "user_email": email,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


async def load_user_emails(db: AsyncSession, user_ids: set[UUID]) -> dict[UUID, str]:
    if not user_ids:
        return {}
    result = await db.execute(select(User).where(User.id.in_(user_ids)))
    return {u.id: u.email for u in result.scalars().all()}


async def fetch_comments(db: AsyncSession, plan_id: UUID) -> list[dict]:
    result = await db.execute(
        select(PlanComment)
        .where(PlanComment.plan_id == plan_id)
        .order_by(PlanComment.created_at.asc())
    )
    rows = result.scalars().all()
    emails = await load_user_emails(db, {c.user_id for c in rows})
    return [comment_to_dict(c, emails.get(c.user_id)) for c in rows]


async def build_activity_feed(db: AsyncSession, plan_id: UUID, limit: int = 25) -> list[dict]:
    activities = (
        await db.execute(
            select(PlanActivity)
            .where(PlanActivity.plan_id == plan_id)
            .order_by(PlanActivity.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()

    versions = (
        await db.execute(
            select(PlanVersion)
            .where(PlanVersion.plan_id == plan_id)
            .order_by(PlanVersion.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()

    comments = (
        await db.execute(
            select(PlanComment)
            .where(PlanComment.plan_id == plan_id, PlanComment.parent_id.is_(None))
            .order_by(PlanComment.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()

    user_ids: set[UUID] = set()
    for a in activities:
        if a.user_id:
            user_ids.add(a.user_id)
    for v in versions:
        user_ids.add(v.created_by_id)
    for c in comments:
        user_ids.add(c.user_id)
    emails = await load_user_emails(db, user_ids)

    items: list[tuple[datetime, dict]] = []
    for a in activities:
        items.append(
            (
                a.created_at,
                {
                    "source": "activity",
                    **activity_to_dict(a, emails.get(a.user_id) if a.user_id else None),
                },
            )
        )
    for v in versions:
        items.append(
            (
                v.created_at,
                {
                    "source": "version",
                    "id": str(v.id),
                    "kind": "version",
                    "message": f"Version {v.version_number} — {v.reason}",
                    "meta": {"status": v.status_at_snapshot, "reason": v.reason},
                    "user_email": emails.get(v.created_by_id),
                    "created_at": v.created_at.isoformat() if v.created_at else None,
                },
            )
        )
    for c in comments:
        items.append(
            (
                c.created_at,
                {
                    "source": "comment",
                    "kind": "comment",
                    "message": c.content[:120] + ("…" if len(c.content) > 120 else ""),
                    "meta": {"field_key": c.field_key, "resolved": c.resolved},
                    "user_email": emails.get(c.user_id),
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                },
            )
        )

    items.sort(key=lambda x: x[0], reverse=True)
    return [item[1] for item in items[:limit]]
