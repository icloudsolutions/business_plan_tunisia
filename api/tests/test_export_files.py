from app.export_files import parse_export_files


def test_parse_json_paths():
    raw = '{"pdf": "/app/exports/plan_a.pdf", "xlsx": "/app/exports/plan_a.xlsx"}'
    assert parse_export_files(raw) == {
        "pdf": "/app/exports/plan_a.pdf",
        "xlsx": "/app/exports/plan_a.xlsx",
    }


def test_parse_legacy_semicolon():
    raw = "/app/exports/plan_a.xlsx;/app/exports/plan_a.pdf"
    assert parse_export_files(raw)["xlsx"].endswith(".xlsx")
    assert parse_export_files(raw)["pdf"].endswith(".pdf")


def test_parse_legacy_docx_pptx():
    raw = (
        "/app/exports/plan.docx;/app/exports/plan.pptx;/app/exports/plan.pdf"
    )
    parsed = parse_export_files(raw)
    assert parsed["docx"].endswith(".docx")
    assert parsed["pptx"].endswith(".pptx")
    assert parsed["pdf"].endswith(".pdf")
