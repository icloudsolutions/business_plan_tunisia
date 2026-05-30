"""Claude AI assistance for plan data entry."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from bp_schema.liasse import PlanInputs

from app.access_control import get_plan_for_user
from app.ai_assist import assist_field, generate_executive_summary
from app.auth import get_current_user
from app.database import get_db
from app.models import AiSuggestion, BusinessPlan, User
from app.schemas import AiAssistRequest, AiAssistResponse, AiSuggestionAccept

router = APIRouter(prefix="/plans", tags=["ai"])


@router.post("/{plan_id}/ai-assist", response_model=AiAssistResponse)
async def plan_ai_assist(
    plan_id: UUID,
    body: AiAssistRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    inputs = PlanInputs.model_validate(plan.inputs or {})

    if body.action == "executive_summary":
        summary = await generate_executive_summary(
            inputs=inputs,
            sector=body.sector or "activité générale",
            company_type=body.company_type or "PME",
            location=body.location or "Tunisie",
        )
        row = AiSuggestion(
            plan_id=plan.id,
            user_id=user.id,
            field_key=None,
            action="executive_summary",
            user_message=None,
            suggestion_text=summary,
            suggested_value=None,
            accepted=False,
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return AiAssistResponse(
            reply=summary,
            executive_summary=summary,
            suggestion_id=row.id,
        )

    if not body.field_key:
        raise HTTPException(status_code=422, detail="field_key requis pour field_assist")
    if not body.message or not body.message.strip():
        raise HTTPException(status_code=422, detail="message requis")

    result = await assist_field(
        inputs=inputs,
        field_key=body.field_key,
        user_message=body.message.strip(),
        sector=body.sector or "activité générale",
        company_type=body.company_type or "PME",
        location=body.location or "Tunis, Tunisie",
        chat_history=body.chat_history,
    )

    suggested_str = None
    if result.get("suggested_value") is not None:
        suggested_str = str(result["suggested_value"])

    row = AiSuggestion(
        plan_id=plan.id,
        user_id=user.id,
        field_key=body.field_key,
        action="field_assist",
        user_message=body.message,
        suggestion_text=result["reply"],
        suggested_value=suggested_str,
        accepted=False,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)

    return AiAssistResponse(
        reply=result["reply"],
        suggested_value=result.get("suggested_value"),
        benchmarks=result.get("benchmarks"),
        suggestion_id=row.id,
    )


@router.patch("/{plan_id}/ai-suggestions/{suggestion_id}")
async def accept_ai_suggestion(
    plan_id: UUID,
    suggestion_id: UUID,
    body: AiSuggestionAccept,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    row = await db.get(AiSuggestion, suggestion_id)
    if not row or row.plan_id != plan_id:
        raise HTTPException(status_code=404, detail="Suggestion introuvable")
    row.accepted = body.accepted
    await db.commit()
    return {"id": str(row.id), "accepted": row.accepted}
