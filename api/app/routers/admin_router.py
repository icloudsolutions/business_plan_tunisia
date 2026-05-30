"""Platform administrator API."""

import csv
import io
import logging
import secrets
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from bp_schema.enums import BusinessPlanStatus

from app.admin_services import (
    build_analytics,
    build_email_delivery_stats,
    celery_queue_depth,
    completion_percent,
    latest_export_status,
    postgres_storage_bytes,
    user_plans_count,
)
from app.auth import get_current_user, hash_password, require_role
from app.collaboration import log_activity
from app.database import get_db
from app.log_buffer import recent_logs
from app.models import BusinessPlan, Notification, User
from app.email_queue import schedule_email
from app.notification_templates import TEMPLATES
from app.schemas import (
    AdminNotificationSend,
    AdminPlanExpertAssign,
    AdminPlanRow,
    AdminPlanStatusSet,
    AdminUserCreate,
    AdminUserPatch,
    AdminUserRow,
    BulkUserIds,
    SystemHealthResponse,
    UserResponse,
)

logger = logging.getLogger("bp.api")
router = APIRouter(prefix="/admin", tags=["admin"])


def _display_name(user: User) -> str:
    if user.display_name:
        return user.display_name
    return user.email.split("@")[0].replace(".", " ").title()


def _human_bytes(n: int) -> str:
    for unit in ("o", "Ko", "Mo", "Go"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} To"


@router.get("/users", response_model=list[AdminUserRow])
async def admin_list_users(
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    rows: list[AdminUserRow] = []
    for u in result.scalars().all():
        count = await user_plans_count(db, u.id)
        rows.append(
            AdminUserRow(
                id=u.id,
                email=u.email,
                role=u.role,
                display_name=_display_name(u),
                status=getattr(u, "status", None) or "active",
                last_active_at=u.last_active_at,
                created_at=u.created_at,
                plans_count=count,
            )
        )
    return rows


@router.patch("/users/{user_id}", response_model=AdminUserRow)
async def admin_patch_user(
    user_id: UUID,
    body: AdminUserPatch,
    admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if user.id == admin.id and body.status == "suspended":
        raise HTTPException(status_code=400, detail="Impossible de suspendre votre propre compte")
    if body.role is not None:
        user.role = body.role
    if body.status is not None:
        user.status = body.status
    if body.display_name is not None:
        user.display_name = body.display_name
    await db.commit()
    await db.refresh(user)
    count = await user_plans_count(db, user.id)
    return AdminUserRow(
        id=user.id,
        email=user.email,
        role=user.role,
        display_name=_display_name(user),
        status=user.status,
        last_active_at=user.last_active_at,
        created_at=user.created_at,
        plans_count=count,
    )


@router.post("/users", response_model=UserResponse)
async def admin_create_user_route(
    body: AdminUserCreate,
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    new_user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        role=body.role,
        status="active",
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@router.post("/users/bulk-reset-password")
async def bulk_reset_password(
    body: BulkUserIds,
    admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tpl = TEMPLATES["password_reset"]
    results: list[dict] = []
    for uid in body.user_ids:
        user = await db.get(User, uid)
        if not user:
            continue
        temp = secrets.token_urlsafe(10)
        user.hashed_password = hash_password(temp)
        notif = Notification(
            user_id=user.id,
            title=tpl["title"],
            body=f"{tpl['body']}\n\nMot de passe temporaire : {temp}",
            channel="both",
            template_key="password_reset",
            created_by_id=admin.id,
            email_sent=True,
        )
        db.add(notif)
        await schedule_email(
            db,
            user=user,
            email_type="admin_manual",
            subject=tpl["title"],
            context={
                "body_text": notif.body,
                "title_fr": tpl["title"],
                "title_ar": tpl["title"],
            },
        )
        results.append({"user_id": str(uid), "email": user.email, "sent": True})
    await db.commit()
    return {"reset": len(results), "users": results}


@router.get("/users/export.csv")
async def export_users_csv(
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.email))
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["name", "email", "role", "status", "plans_count", "last_active", "created_at"])
    for u in result.scalars().all():
        count = await user_plans_count(db, u.id)
        w.writerow(
            [
                _display_name(u),
                u.email,
                u.role,
                getattr(u, "status", "active"),
                count,
                u.last_active_at.isoformat() if u.last_active_at else "",
                u.created_at.isoformat() if u.created_at else "",
            ]
        )
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=users.csv"},
    )


@router.get("/plans", response_model=list[AdminPlanRow])
async def admin_list_plans(
    status: str | None = Query(None),
    expert_id: UUID | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    q = select(BusinessPlan)
    if status:
        q = q.where(BusinessPlan.status == status)
    if expert_id:
        q = q.where(BusinessPlan.assigned_expert_id == expert_id)
    if date_from:
        q = q.where(BusinessPlan.updated_at >= date_from)
    if date_to:
        q = q.where(BusinessPlan.updated_at <= date_to)
    q = q.order_by(BusinessPlan.updated_at.desc())
    result = await db.execute(q)
    plans = result.scalars().all()

    users_r = await db.execute(select(User))
    users_by_id = {u.id: u for u in users_r.scalars().all()}

    rows: list[AdminPlanRow] = []
    for p in plans:
        owner = users_by_id.get(p.owner_id)
        expert = users_by_id.get(p.assigned_expert_id) if p.assigned_expert_id else None
        export_st = await latest_export_status(db, p.id)
        rows.append(
            AdminPlanRow(
                id=p.id,
                title=p.title,
                status=p.status,
                owner_id=p.owner_id,
                owner_email=owner.email if owner else "—",
                expert_id=p.assigned_expert_id,
                expert_email=expert.email if expert else None,
                updated_at=p.updated_at,
                completion_pct=completion_percent(p.inputs or {}),
                export_status=export_st,
            )
        )
    return rows


@router.patch("/plans/{plan_id}/status")
async def admin_set_plan_status(
    plan_id: UUID,
    body: AdminPlanStatusSet,
    admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    plan = await db.get(BusinessPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan introuvable")
    old = plan.status
    plan.status = body.status
    if body.status == BusinessPlanStatus.VALIDATED.value:
        plan.locked_at = datetime.now(timezone.utc)
    elif old == BusinessPlanStatus.VALIDATED.value:
        plan.locked_at = None
    await log_activity(
        db,
        plan.id,
        admin.id,
        "status_change",
        f"Admin: {old} → {body.status}",
        {"admin": True},
        broadcast=False,
    )
    await db.commit()
    return {"id": str(plan.id), "status": plan.status}


@router.patch("/plans/{plan_id}/expert")
async def admin_assign_expert(
    plan_id: UUID,
    body: AdminPlanExpertAssign,
    admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    plan = await db.get(BusinessPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan introuvable")
    expert = await db.get(User, body.expert_id)
    if not expert or expert.role != "expert":
        raise HTTPException(status_code=400, detail="Expert invalide")
    plan.assigned_expert_id = expert.id
    await log_activity(
        db,
        plan.id,
        admin.id,
        "expert_assigned",
        f"Expert assigné : {expert.email}",
        {"expert_id": str(expert.id)},
        broadcast=False,
    )
    await db.commit()
    return {"id": str(plan.id), "expert_id": str(expert.id), "expert_email": expert.email}


@router.get("/analytics")
async def admin_analytics(
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    return await build_analytics(db)


@router.get("/email-stats")
async def admin_email_stats(
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    return await build_email_delivery_stats(db)


@router.get("/health", response_model=SystemHealthResponse)
async def admin_system_health(
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    pg_bytes = await postgres_storage_bytes(db)
    queues = await celery_queue_depth()
    return SystemHealthResponse(
        api={"status": "ok", "service": "api", "version": "0.2.0"},
        celery_queues=queues,
        postgres_bytes=pg_bytes,
        postgres_human=_human_bytes(pg_bytes),
    )


@router.get("/logs")
async def admin_logs(
    limit: int = Query(20, ge=1, le=100),
    _: User = Depends(require_role("admin")),
):
    return {"lines": recent_logs(limit)}


@router.get("/notification-templates")
async def list_notification_templates(
    _: User = Depends(require_role("admin")),
):
    return [
        {"key": k, "title": v["title"], "body": v["body"]}
        for k, v in TEMPLATES.items()
    ]


@router.post("/notifications")
async def send_notification(
    body: AdminNotificationSend,
    admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    title = body.title
    text_body = body.body
    if body.template_key and body.template_key in TEMPLATES:
        tpl = TEMPLATES[body.template_key]
        title = title or tpl["title"]
        text_body = text_body or tpl["body"]

    targets: list[User] = []
    if body.user_id:
        u = await db.get(User, body.user_id)
        if u:
            targets = [u]
    elif body.role_target:
        r = await db.execute(select(User).where(User.role == body.role_target))
        targets = list(r.scalars().all())
    else:
        raise HTTPException(status_code=422, detail="user_id ou role_target requis")

    created = 0
    for u in targets:
        notif = Notification(
            user_id=u.id,
            role_target=body.role_target,
            title=title,
            body=text_body,
            channel=body.channel,
            template_key=body.template_key,
            created_by_id=admin.id,
            email_sent=body.channel in ("email", "both"),
        )
        db.add(notif)
        if body.channel in ("email", "both"):
            await schedule_email(
                db,
                user=u,
                email_type="admin_manual",
                subject=title,
                context={
                    "plan_title": "",
                    "body_text": text_body,
                    "title_fr": title,
                    "title_ar": title,
                },
            )
        created += 1
    await db.commit()
    return {"sent": created}
