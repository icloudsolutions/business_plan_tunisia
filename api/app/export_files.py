"""Parse export job file_path (JSON map or legacy semicolon-separated paths)."""

import json
from pathlib import Path


def parse_export_files(file_path: str | None) -> dict[str, str]:
    if not file_path or not file_path.strip():
        return {}
    raw = file_path.strip()
    if raw.startswith("{"):
        try:
            data = json.loads(raw)
            return {k: str(v) for k, v in data.items() if v}
        except json.JSONDecodeError:
            pass
    out: dict[str, str] = {}
    for part in raw.split(";"):
        p = part.strip()
        if not p:
            continue
        suf = Path(p).suffix.lower()
        if suf == ".pdf":
            out["pdf"] = p
        elif suf in (".xlsx", ".xls"):
            out["xlsx"] = p
        elif suf == ".docx":
            out["docx"] = p
        elif suf == ".pptx":
            out["pptx"] = p
        elif suf == ".zip":
            out["zip"] = p
    return out
