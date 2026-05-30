"""Jinja2 HTML email renderer (FR + AR)."""

from __future__ import annotations

from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


def render_email(template_name: str, **context) -> tuple[str, str]:
    """Return (subject, html_body)."""
    tpl = _env.get_template(template_name)
    html = tpl.render(**context)
    subject = context.get("subject", "Business Plan Tunisie")
    return subject, html
