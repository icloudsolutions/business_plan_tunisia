from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from bp_schema.liasse import PlanInputs


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRegister(BaseModel):
    """Public registration — clients only (no role field)."""

    email: str
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Le mot de passe doit contenir au moins 8 caractères")
        return v


class UserLogin(BaseModel):
    email: str
    password: str


class ExpertCreate(BaseModel):
    email: str
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Le mot de passe doit contenir au moins 8 caractères")
        return v


class UserResponse(BaseModel):
    id: UUID
    email: str
    role: str

    class Config:
        from_attributes = True


class PlanCreate(BaseModel):
    title: str = "Nouveau Business Plan"
    inputs: dict | None = None


class PlanUpdateInputs(BaseModel):
    inputs: dict


class PlanPatchResponse(BaseModel):
    plan: "PlanResponse"
    missingFields: list[str] = Field(default_factory=list)


class PlanVersionResponse(BaseModel):
    id: UUID
    plan_id: UUID
    version_number: int
    status_at_snapshot: str
    reason: str
    created_at: datetime

    class Config:
        from_attributes = True


class PlanResponse(BaseModel):
    id: UUID
    title: str
    status: str
    owner_id: UUID
    assigned_expert_id: UUID | None = None
    inputs: dict
    results: dict | None
    locked_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TransitionRequest(BaseModel):
    action: str


class SimulateRequest(BaseModel):
    name: str = "Scénario"
    patches: list[dict] = Field(default_factory=list)


class CommentCreate(BaseModel):
    field_path: str
    body: str


class CommentResponse(BaseModel):
    id: UUID
    field_path: str
    body: str
    resolved: bool
    author_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class JobResponse(BaseModel):
    id: UUID
    status: str
    task_type: str
    result: dict | None = None
    error: str | None = None


class ExportRequest(BaseModel):
    formats: list[str] = Field(default=["pdf", "xlsx"])


class CopilotRequest(BaseModel):
    state: str
    output_mode: str
    action: str
    input_data: dict
    plan_id: UUID | None = None


PlanPatchResponse.model_rebuild()
