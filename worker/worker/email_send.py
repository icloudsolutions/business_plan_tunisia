"""SMTP, Resend, and log email delivery."""

from __future__ import annotations

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

logger = logging.getLogger("bp.worker.email")


def send_email(*, to: str, subject: str, html: str) -> None:
    provider = (os.getenv("EMAIL_PROVIDER") or "log").lower().strip()
    from_addr = os.getenv("EMAIL_FROM", "Business Plan Tunisie <noreply@businessplan.tn>")

    if provider == "log":
        logger.info("EMAIL [%s] %s — %d chars HTML", to, subject, len(html))
        return

    if provider == "resend":
        _send_resend(to=to, subject=subject, html=html, from_addr=from_addr)
        return

    if provider == "smtp":
        _send_smtp(to=to, subject=subject, html=html, from_addr=from_addr)
        return

    raise ValueError(f"EMAIL_PROVIDER inconnu: {provider}")


def _send_resend(*, to: str, subject: str, html: str, from_addr: str) -> None:
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("RESEND_API_KEY requis pour EMAIL_PROVIDER=resend")
    with httpx.Client(timeout=30.0) as client:
        r = client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"from": from_addr, "to": [to], "subject": subject, "html": html},
        )
        r.raise_for_status()


def _send_smtp(*, to: str, subject: str, html: str, from_addr: str) -> None:
    host = os.getenv("SMTP_HOST", "").strip()
    if not host:
        raise RuntimeError("SMTP_HOST requis pour EMAIL_PROVIDER=smtp")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "").strip()
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in ("1", "true", "yes")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to
    msg.attach(MIMEText(html, "html", "utf-8"))

    if use_tls:
        with smtplib.SMTP(host, port, timeout=30) as server:
            server.starttls()
            if user and password:
                server.login(user, password)
            server.sendmail(from_addr, [to], msg.as_string())
    else:
        with smtplib.SMTP(host, port, timeout=30) as server:
            if user and password:
                server.login(user, password)
            server.sendmail(from_addr, [to], msg.as_string())
