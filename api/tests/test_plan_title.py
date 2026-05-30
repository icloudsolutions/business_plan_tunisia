from app.plan_title import (
    DEFAULT_PLAN_TITLE,
    format_plan_title,
    is_auto_managed_title,
    is_client_supplied_create_title,
    normalize_company_key,
)


def test_format_plan_title_sequence():
    assert format_plan_title("VIPA Industries", 1) == "VIPA Industries — Business Plan"
    assert format_plan_title("VIPA Industries", 2) == "VIPA Industries — Business Plan 2"
    assert format_plan_title("VIPA Industries", 3) == "VIPA Industries — Business Plan 3"


def test_format_plan_title_short_company():
    assert format_plan_title("A", 1) == DEFAULT_PLAN_TITLE


def test_normalize_company_key():
    assert normalize_company_key("  VIPA   Industries ") == "vipa industries"


def test_is_auto_managed_title():
    assert is_auto_managed_title("Nouveau Business Plan")
    assert is_auto_managed_title("Business Plan 30/05/2026")
    assert is_auto_managed_title("VIPA — Business Plan")
    assert is_auto_managed_title("VIPA — Business Plan 2")
    assert not is_auto_managed_title("Étude faisabilité VIPA 2026")


def test_is_client_supplied_create_title():
    assert not is_client_supplied_create_title(None)
    assert not is_client_supplied_create_title("Business Plan 30/05/2026")
    assert is_client_supplied_create_title("Étude faisabilité VIPA 2026")
