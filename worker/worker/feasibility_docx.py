"""VIPA étude de faisabilité Word — delegates to tasks.export_word."""

from __future__ import annotations

from pathlib import Path

from bp_schema.liasse import PlanInputs, PlanResults

from tasks.export_excel import build_plan_data
from tasks.export_word import build_feasibility_docx_from_plan_data, generate_word_report

__all__ = ["build_feasibility_docx", "generate_word_report"]


def build_feasibility_docx(
    plan_id: str,
    inputs: PlanInputs,
    results: PlanResults,
    *,
    export_dir: Path,
    plan_title: str | None = None,
    extra_inputs: dict | None = None,
) -> str:
    plan_data = build_plan_data(
        inputs=inputs,
        results=results,
        plan_id=plan_id,
        title=plan_title,
    )
    if extra_inputs:
        raw = plan_data.get("inputs") or {}
        if isinstance(raw, dict):
            plan_data["inputs"] = {**raw, **extra_inputs}
        for key in (
            "market_study",
            "swot",
            "logo_path",
            "sector",
            "promoter",
            "cabinet",
            "site",
            "planning",
        ):
            if key in extra_inputs:
                plan_data[key] = extra_inputs[key]
    return build_feasibility_docx_from_plan_data(plan_data, export_dir)
