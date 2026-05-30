from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_admin_api_key,
    verify_password,
)
from app.database import get_db
from app.models import User
from app.schemas import ExpertCreate, TokenResponse, UserLogin, UserRegister, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
async def register(body: UserRegister, db: AsyncSession = Depends(get_db)):
    """Public registration — always creates a client account."""
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


@router.post("/admin/experts", response_model=UserResponse)
async def create_expert(
    body: ExpertCreate,
    _: None = Depends(verify_admin_api_key),
    db: AsyncSession = Depends(get_db),
):
    """Create an expert account — requires header X-Admin-Key matching ADMIN_API_KEY."""
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


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return user
