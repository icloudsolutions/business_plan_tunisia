"""Collaboration: threaded comments, section reviews, activity sync."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bp_schema.enums import BusinessPlanStatus

from app.access_control import get_plan_for_user
from app.auth import get_current_user
from app.collaboration import (
    activity_to_dict,
    build_activity_feed,
    comment_to_dict,
    fetch_comments,
    log_activity,
    load_user_emails,
    section_review_to_dict,
)
from app.database import get_db
from app.models import PlanComment, PlanSectionReview, User
from app.realtime import SECTION_KEYS, broadcast_plan_event, list_presence
from app.schemas import (
    CommentCreate,
    CommentPatch,
    CommentResponse,
    CollaborationSyncResponse,
    SectionReviewUpsert,
    SectionReviewResponse,
)
from app.email_triggers import notify_new_comment
from app.workflow_policy import PlanAction, assert_collaboration_state, assert_plan_action

router = APIRouter(prefix="/plans", tags=["collaboration"])


def _comment_response(c: PlanComment, email: str) -> CommentResponse:
    return CommentResponse(
        id=c.id,
        plan_id=c.plan_id,
        field_key=c.field_key,
        user_id=c.user_id,
        user_email=email,
        content=c.content,
        parent_id=c.parent_id,
        resolved=c.resolved,
        created_at=c.created_at,
    )


@router.get("/{plan_id}/comments", response_model=list[CommentResponse])
async def list_comments(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    result = await db.execute(
        select(PlanComment)
        .where(PlanComment.plan_id == plan_id)
        .order_by(PlanComment.created_at.asc())
    )
    rows = result.scalars().all()
    emails = await load_user_emails(db, {c.user_id for c in rows})
    return [_comment_response(c, emails.get(c.user_id, "")) for c in rows]


@router.post("/{plan_id}/comments", response_model=CommentResponse)
async def create_comment(
    plan_id: UUID,
    body: CommentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_collaboration_state(plan)
    assert_plan_action(plan, user, PlanAction.COMMENT)

    if body.parent_id:
        parent = await db.get(PlanComment, body.parent_id)
        if not parent or parent.plan_id != plan.id:
            raise HTTPException(status_code=404, detail="Commentaire parent introuvable")
        field_key = parent.field_key
    else:
        field_key = body.field_key
        if not field_key:
            raise HTTPException(status_code=422, detail="field_key requis pour un nouveau fil")

    comment = PlanComment(
        plan_id=plan.id,
        field_key=field_key,
        user_id=user.id,
        content=body.content.strip(),
        parent_id=body.parent_id,
    )
    db.add(comment)
    await db.flush()
    await log_activity(
        db,
        plan.id,
        user.id,
        "comment",
        f"Commentaire sur {field_key}",
        {"field_key": field_key, "comment_id": str(comment.id)},
        broadcast=False,
    )
    await db.commit()
    await db.refresh(comment)

    await notify_new_comment(db, plan, comment, user)
    await db.commit()

    payload = comment_to_dict(comment, user.email)
    await broadcast_plan_event(plan.id, "comment.created", payload)
    return _comment_response(comment, user.email)


@router.patch("/{plan_id}/comments/{comment_id}", response_model=CommentResponse)
async def patch_comment(
    plan_id: UUID,
    comment_id: UUID,
    body: CommentPatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_collaboration_state(plan)

    result = await db.execute(
        select(PlanComment).where(
            PlanComment.id == comment_id,
            PlanComment.plan_id == plan_id,
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Commentaire introuvable")

    if body.resolved is not None:
        comment.resolved = body.resolved
    if body.content is not None and body.content.strip():
        if comment.user_id != user.id and user.role != "expert":
            raise HTTPException(status_code=403, detail="Modification non autorisée")
        comment.content = body.content.strip()

    await db.commit()
    await db.refresh(comment)
    emails = await load_user_emails(db, {comment.user_id})
    email = emails.get(comment.user_id, "")
    payload = comment_to_dict(comment, email)
    await broadcast_plan_event(plan.id, "comment.updated", payload)
    return _comment_response(comment, email)


@router.get("/{plan_id}/section-reviews", response_model=list[SectionReviewResponse])
async def list_section_reviews(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    result = await db.execute(
        select(PlanSectionReview).where(PlanSectionReview.plan_id == plan_id)
    )
    rows = result.scalars().all()
    emails = await load_user_emails(db, {r.user_id for r in rows})
    return [
        SectionReviewResponse(
            id=r.id,
            plan_id=r.plan_id,
            section_key=r.section_key,
            status=r.status,
            user_id=r.user_id,
            user_email=emails.get(r.user_id),
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@router.put("/{plan_id}/section-reviews/{section_key}", response_model=SectionReviewResponse)
async def upsert_section_review(
    plan_id: UUID,
    section_key: str,
    body: SectionReviewUpsert,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if section_key not in SECTION_KEYS:
        raise HTTPException(status_code=422, detail=f"section_key invalide: {section_key}")

    plan = await get_plan_for_user(plan_id, user, db)
    assert_collaboration_state(plan)
    assert_plan_action(plan, user, PlanAction.SECTION_REVIEW)

    if body.status not in ("approve", "flag", "reject"):
        raise HTTPException(status_code=422, detail="status doit être approve, flag ou reject")

    result = await db.execute(
        select(PlanSectionReview).where(
            PlanSectionReview.plan_id == plan_id,
            PlanSectionReview.section_key == section_key,
        )
    )
    row = result.scalar_one_or_none()
    if row:
        row.status = body.status
        row.user_id = user.id
    else:
        row = PlanSectionReview(
            plan_id=plan.id,
            section_key=section_key,
            status=body.status,
            user_id=user.id,
        )
        db.add(row)

    labels = {"approve": "Approuvé", "flag": "Signalé", "reject": "Refusé"}
    await log_activity(
        db,
        plan.id,
        user.id,
        "section_review",
        f"Section {section_key}: {labels[body.status]}",
        {"section_key": section_key, "status": body.status},
        broadcast=False,
    )
    await db.commit()
    await db.refresh(row)

    payload = section_review_to_dict(row, user.email)
    await broadcast_plan_event(plan.id, "section_review.updated", payload)
    return SectionReviewResponse(
        id=row.id,
        plan_id=row.plan_id,
        section_key=row.section_key,
        status=row.status,
        user_id=row.user_id,
        user_email=user.email,
        updated_at=row.updated_at,
    )


@router.get("/{plan_id}/activity")
async def get_activity(
    plan_id: UUID,
    limit: int = 25,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    return await build_activity_feed(db, plan_id, limit=min(limit, 50))


@router.get("/{plan_id}/collaboration/sync", response_model=CollaborationSyncResponse)
async def collaboration_sync(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    comments = await fetch_comments(db, plan_id)
    result = await db.execute(
        select(PlanSectionReview).where(PlanSectionReview.plan_id == plan_id)
    )
    reviews = result.scalars().all()
    emails = await load_user_emails(db, {r.user_id for r in reviews})
    activity = await build_activity_feed(db, plan_id, limit=25)
    presence = await list_presence(str(plan_id))

    return CollaborationSyncResponse(
        plan_status=plan.status,
        comments=comments,
        section_reviews=[
            section_review_to_dict(r, emails.get(r.user_id)) for r in reviews
        ],
        activity=activity,
        presence=presence,
    )
