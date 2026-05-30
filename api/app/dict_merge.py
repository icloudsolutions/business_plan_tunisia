from __future__ import annotations

from typing import Any


def deep_merge(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    """Merge patch into base; nested dicts are merged recursively."""
    out = dict(base)
    for key, value in patch.items():
        prev = out.get(key)
        if (
            isinstance(value, dict)
            and isinstance(prev, dict)
            and not isinstance(prev, list)
        ):
            out[key] = deep_merge(prev, value)
        else:
            out[key] = value
    return out
