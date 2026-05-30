"""Implementation timeline (Gantt) models."""

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

TimelinePhaseType = Literal["investment", "startup", "production", "commercial"]
DEFAULT_HORIZON_MONTHS = 18
DEFAULT_STARTUP_DELAY_DAYS = 90

PHASE_TYPE_COLORS: dict[str, str] = {
    "investment": "#1e3a5f",
    "startup": "#d97706",
    "production": "#059669",
    "commercial": "#7c3aed",
}


class TimelineSettings(BaseModel):
    plan_id: UUID | None = None
    plan_start_date: date
    startup_delay_days: int = Field(default=DEFAULT_STARTUP_DELAY_DAYS, ge=0, le=365)
    horizon_months: int = Field(default=DEFAULT_HORIZON_MONTHS, ge=6, le=36)


class TimelinePhase(BaseModel):
    id: UUID | None = None
    plan_id: UUID | None = None
    name: str
    start_date: date
    end_date: date
    phase_type: TimelinePhaseType = "investment"
    color: str = ""
    sort_order: int = 0

    def resolved_color(self) -> str:
        return self.color or PHASE_TYPE_COLORS.get(self.phase_type, "#64748b")


class TimelineMilestone(BaseModel):
    key: str
    label: str
    date: date
    month_index: float


class TimelineProjection(BaseModel):
    plan_id: UUID | None = None
    settings: TimelineSettings
    phases: list[TimelinePhase] = Field(default_factory=list)
    milestones: list[TimelineMilestone] = Field(default_factory=list)
    y1_revenue_factor: float = 1.0
    chart: dict = Field(default_factory=dict)
