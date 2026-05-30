"""Derive business plan display titles from company name (with per-owner sequencing)."""

from __future__ import annotations

import re
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import BusinessPlan

DEFAULT_PLAN_TITLE = "Nouveau Business Plan"
_TITLE_SUFFIX = " — Business Plan"
_DATE_TITLE_RE = re.compile(r"^Business Plan\s+\d", re.IGNORECASE)
_AUTO_TITLE_RE = re.compile(r"^.+\s+—\s+Business Plan(?:\s+(\d+))?$")


def company_name_from_inputs(inputs: dict | None) -> str:
    if not inputs:
        return ""
    company = inputs.get("company")
    if not isinstance(company, dict):
        return ""
    return str(company.get("name") or "").strip()


def normalize_company_key(name: str) -> str:
    return " ".join(name.strip().lower().split())


def format_plan_title(company_display: str, sequence: int) -> str:
    """sequence 1 → « Acme — Business Plan », 2+ → « Acme — Business Plan 2 »."""
    display = company_display.strip()
    if len(display) < 2:
        return DEFAULT_PLAN_TITLE
    base = f"{display}{_TITLE_SUFFIX}"
    if sequence <= 1:
        return base[:255]
    return f"{base} {sequence}"[:255]


def is_auto_managed_title(title: str) -> bool:
    """True when the title was (or could be) system-generated, not user-customized."""
    t = (title or "").strip()
    if not t or t == DEFAULT_PLAN_TITLE:
        return True
    if _DATE_TITLE_RE.match(t):
        return True
    if _AUTO_TITLE_RE.match(t):
        return True
    return False


def is_client_supplied_create_title(title: str | None) -> bool:
    """Client sent an explicit custom title on create (do not overwrite)."""
    if title is None:
        return False
    t = title.strip()
    if not t or t == DEFAULT_PLAN_TITLE:
        return False
    if _DATE_TITLE_RE.match(t):
        return False
    if is_auto_managed_title(t):
        return False
    return True


async def count_plans_for_company(
    db: AsyncSession,
    owner_id: UUID,
    company_key: str,
    *,
    exclude_plan_id: UUID | None = None,
) -> int:
    result = await db.execute(
        select(BusinessPlan.id, BusinessPlan.inputs).where(BusinessPlan.owner_id == owner_id)
    )
    count = 0
    for pid, inputs in result.all():
        if exclude_plan_id is not None and pid == exclude_plan_id:
            continue
        if normalize_company_key(company_name_from_inputs(inputs)) == company_key:
            count += 1
    return count


async def allocate_plan_title(
    db: AsyncSession,
    owner_id: UUID,
    company_name: str,
    *,
    plan_id: UUID | None = None,
) -> str:
    display = company_name.strip()
    key = normalize_company_key(display)
    if len(key) < 2:
        return DEFAULT_PLAN_TITLE

    if plan_id is None:
        existing = await count_plans_for_company(db, owner_id, key)
        sequence = existing + 1
    else:
        others = await count_plans_for_company(
            db, owner_id, key, exclude_plan_id=plan_id
        )
        sequence = others + 1

    return format_plan_title(display, sequence)


async def maybe_sync_plan_title_from_company(
    db: AsyncSession,
    plan: BusinessPlan,
    inputs: dict,
) -> bool:
    """
    Update plan.title when company name is known and title is still auto-managed.
    Returns True if title changed.
    """
    if not is_auto_managed_title(plan.title):
        return False
    company = company_name_from_inputs(inputs)
    if len(normalize_company_key(company)) < 2:
        return False
    new_title = await allocate_plan_title(
        db, plan.owner_id, company, plan_id=plan.id
    )
    if new_title == plan.title:
        return False
    plan.title = new_title
    return True
