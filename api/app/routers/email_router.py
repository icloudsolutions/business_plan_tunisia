"""Email open tracking (1x1 pixel)."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import EmailNotification

router = APIRouter(prefix="/email", tags=["email"])

# Minimal transparent PNG
_PIXEL = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
    b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


@router.get("/track/{notification_id}/open.png")
async def track_email_open(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(EmailNotification, notification_id)
    if row and not row.opened_at:
        row.opened_at = datetime.now(timezone.utc)
        await db.commit()
    return Response(content=_PIXEL, media_type="image/png")
