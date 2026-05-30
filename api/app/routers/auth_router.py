from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    require_role,
    verify_admin_api_key,
    verify_password,
)
from app.database import get_db
from app.models import User
from app.schemas import (
    AdminUserCreate,
    ExpertCreate,
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
async def register(body: UserRegister, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        role="client",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    if getattr(user, "status", "active") == "suspended":
        raise HTTPException(status_code=403, detail="Compte suspendu — contactez l'administrateur")
    user.last_active_at = datetime.now(timezone.utc)
    await db.commit()
    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return user


@router.get("/admin/users", response_model=list[UserResponse])
async def list_users(
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()


@router.post("/admin/users", response_model=UserResponse)
async def admin_create_user(
    body: AdminUserCreate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    new_user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        role=body.role,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@router.post("/admin/experts", response_model=UserResponse)
async def create_expert_api_key(
    body: ExpertCreate,
    _: None = Depends(verify_admin_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Legacy: create expert via X-Admin-Key header."""
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        role="expert",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
