"""Map notification types to templates and subjects."""

from __future__ import annotations

from app.emails.renderer import render_email

SECTION_LABELS: dict[str, tuple[str, str]] = {
    "general": ("Informations générales", "معلومات عامة"),
    "investments": ("Investissements", "الاستثمارات"),
    "financing": ("Financement", "التمويل"),
    "operations": ("Exploitation", "الاستغلال"),
    "hr": ("Ressources humaines", "الموارد البشرية"),
    "financial": ("Indicateurs financiers", "المؤشرات المالية"),
    "_global": ("Message global", "رسالة عامة"),
}

FIELD_LABELS: dict[str, tuple[str, str]] = {
    "_global": ("Commentaire global", "تعليق عام"),
}


def section_display(key: str, status: str) -> dict:
    fr, ar = SECTION_LABELS.get(key, (key, key))
    return {"key": key, "label_fr": fr, "label_ar": ar, "status": status}


def field_display(key: str) -> tuple[str, str]:
    return FIELD_LABELS.get(key, (key.replace(".", " › "), key))


TEMPLATE_BY_TYPE: dict[str, str] = {
    "admin_manual": "admin_manual.html",
    "plan_submitted": "plan_submitted.html",
    "corrections_required": "corrections_required.html",
    "client_resubmitted": "client_resubmitted.html",
    "plan_validated": "plan_validated.html",
    "new_comment": "new_comment.html",
}

SUBJECT_BY_TYPE: dict[str, tuple[str, str]] = {
    "admin_manual": (
        "Message administrateur",
        "رسالة من الإدارة",
    ),
    "plan_submitted": (
        "Nouveau plan soumis pour validation",
        "خطة جديدة للمراجعة",
    ),
    "corrections_required": (
        "Corrections requises sur votre business plan",
        "تعديلات مطلوبة على خطة الأعمال",
    ),
    "client_resubmitted": (
        "Le client a soumis les corrections",
        "العميل أرسل التصحيحات",
    ),
    "plan_validated": (
        "Votre plan a été validé — téléchargez votre liasse",
        "تم التحقق من خطتكم — حمّلوا الملف النهائي",
    ),
    "new_comment": (
        "Nouveau commentaire sur votre plan",
        "تعليق جديد على الخطة",
    ),
}


def build_email_html(
    email_type: str,
    *,
    context: dict,
    tracking_pixel_url: str | None = None,
) -> tuple[str, str]:
    """Render email. context['locale']: 'fr' | 'ar' | 'both' (default bilingual)."""
    locale = (context.get("locale") or "both").lower()
    subj_fr, subj_ar = SUBJECT_BY_TYPE.get(email_type, ("Notification", "إشعار"))
    if context.get("title_fr"):
        subj_fr = context["title_fr"]
    if context.get("title_ar"):
        subj_ar = context["title_ar"]

    if locale == "ar":
        template = f"ar/{email_type}.html"
        subject = subj_ar
    else:
        template = TEMPLATE_BY_TYPE.get(email_type, "plan_submitted.html")
        subject = subj_fr

    ctx = {
        **context,
        "subject": context.get("subject") or subject,
        "title_fr": context.get("title_fr") or subj_fr,
        "title_ar": context.get("title_ar") or subj_ar,
        "footer_fr": "Business Plan Tunisie — Liasse Unique / APII",
        "footer_ar": "خطة الأعمال تونس — الحزمة الموحدة / الوكالة",
        "tracking_pixel_url": tracking_pixel_url,
    }
    _, html = render_email(template, **ctx)
    return subject, html
