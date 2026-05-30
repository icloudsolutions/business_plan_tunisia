"""Field-level audit trail and JSON diff helpers."""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PlanAuditLog


def _serialize_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return str(value)
    return json.dumps(value, ensure_ascii=False, default=str)


def flatten_document(obj: Any, prefix: str = "") -> dict[str, Any]:
    """Flatten nested dict to dot paths (lists stored as JSON blob at path)."""
    out: dict[str, Any] = {}
    if isinstance(obj, dict):
        for key, val in obj.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            out.update(flatten_document(val, path))
    elif isinstance(obj, list):
        if prefix:
            out[prefix] = obj
    elif prefix:
        out[prefix] = obj
    return out


def diff_documents(old: dict[str, Any] | None, new: dict[str, Any] | None) -> list[tuple[str, Any, Any]]:
    old_flat = flatten_document(old or {})
    new_flat = flatten_document(new or {})
    paths = set(old_flat) | set(new_flat)
    changes: list[tuple[str, Any, Any]] = []
    for path in sorted(paths):
        ov = old_flat.get(path)
        nv = new_flat.get(path)
        if ov != nv:
            changes.append((path, ov, nv))
    return changes


def build_plan_snapshot(plan) -> dict[str, Any]:
    return {
        "title": plan.title,
        "status": plan.status,
        "inputs": dict(plan.inputs or {}),
        "results": dict(plan.results) if plan.results else None,
    }


async def log_inputs_patch(
    db: AsyncSession,
    *,
    plan_id: UUID,
    user_id: UUID,
    old_inputs: dict | None,
    new_inputs: dict,
) -> int:
    changes = diff_documents(old_inputs, new_inputs)
    for path, old_val, new_val in changes:
        db.add(
            PlanAuditLog(
                plan_id=plan_id,
                user_id=user_id,
                field_path=f"inputs.{path}",
                old_value=_serialize_value(old_val),
                new_value=_serialize_value(new_val),
            )
        )
    await db.flush()
    return len(changes)


async def log_meta_patch(
    db: AsyncSession,
    *,
    plan_id: UUID,
    user_id: UUID,
    field_path: str,
    old_value: Any,
    new_value: Any,
) -> None:
    if old_value == new_value:
        return
    db.add(
        PlanAuditLog(
            plan_id=plan_id,
            user_id=user_id,
            field_path=field_path,
            old_value=_serialize_value(old_value),
            new_value=_serialize_value(new_value),
        )
    )
    await db.flush()


def diff_against_current(current: dict[str, Any], version_snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    changes = diff_documents(version_snapshot, current)
    return [
        {
            "path": path,
            "old_value": _serialize_value(old),
            "new_value": _serialize_value(new),
            "kind": "removed" if new is None else ("added" if old is None else "changed"),
        }
        for path, old, new in changes
    ]
