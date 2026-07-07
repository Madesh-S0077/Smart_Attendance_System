from datetime import date
from typing import Annotated, Optional
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_required
from app.models.time_slot import TimeSlot
from app.models.user import User, UserRole
from app.schemas.envelope import ResponseEnvelope
from app.schemas.time_slot import TimeSlotGenerateRequest, TimeSlotResponse
from app.services.time_slot import TimeSlotService

router = APIRouter()


@router.get("/", response_model=ResponseEnvelope[list[TimeSlotResponse]])
async def get_all_timeslots(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[list[TimeSlotResponse]]:
    result = await db.execute(select(TimeSlot).order_by(TimeSlot.date.desc()))
    slots = result.scalars().all()
    return ResponseEnvelope(success=True, data=slots)


@router.get("/today", response_model=ResponseEnvelope[Optional[TimeSlotResponse]])
async def get_today_timeslot(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[Optional[TimeSlotResponse]]:
    today = date.today()
    result = await db.execute(select(TimeSlot).where(TimeSlot.date == today))
    slot = result.scalar_one_or_none()
    return ResponseEnvelope(success=True, data=slot)


@router.post("/generate", response_model=ResponseEnvelope[TimeSlotResponse])
async def generate_timeslot(
    req: TimeSlotGenerateRequest,
    current_user: Annotated[User, Depends(role_required(UserRole.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[TimeSlotResponse]:
    target_date = req.date or date.today()
    slot = await TimeSlotService.generate_time_slot(db, target_date)
    return ResponseEnvelope(success=True, data=slot)
