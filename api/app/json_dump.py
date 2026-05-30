"""JSON-safe dumps for ORM JSONB columns (UUID, date, etc.)."""

from pydantic import BaseModel


def pydantic_json_dump(model: BaseModel) -> dict:
    return model.model_dump(mode="json")
