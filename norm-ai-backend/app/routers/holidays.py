from datetime import date
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_required
from app.models.holiday import Holiday
from app.models.user import User, UserRole
from app.schemas.envelope import ResponseEnvelope
from app.schemas.holiday import HolidayCreateRequest, HolidayResponse

router = APIRouter()


@router.get("/", response_model=ResponseEnvelope[list[HolidayResponse]])
async def get_holidays(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[list[HolidayResponse]]:
    result = await db.execute(select(Holiday).order_by(Holiday.date.asc()))
    holidays = result.scalars().all()
    return ResponseEnvelope(success=True, data=holidays)


@router.post(
    "/",
    response_model=ResponseEnvelope[HolidayResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_holiday(
    req: HolidayCreateRequest,
    current_user: Annotated[
        User, Depends(role_required(UserRole.teacher, UserRole.admin))
    ],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[HolidayResponse]:
    # Validate past date
    if req.date < date.today() and current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Holidays cannot be set in the past.",
        )

    # Check duplicate
    existing = await db.execute(select(Holiday).where(Holiday.date == req.date))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Holiday already registered for this date.",
        )

    holiday = Holiday(
        date=req.date, reason=req.reason, created_by=str(current_user.id)
    )
    db.add(holiday)
    await db.commit()
    await db.refresh(holiday)
    return ResponseEnvelope(success=True, data=holiday)


@router.delete("/{target_date}", response_model=ResponseEnvelope[dict])
async def delete_holiday(
    target_date: date,
    current_user: Annotated[
        User, Depends(role_required(UserRole.teacher, UserRole.admin))
    ],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[dict]:
    result = await db.execute(select(Holiday).where(Holiday.date == target_date))
    holiday = result.scalar_one_or_none()
    if not holiday:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Holiday not found for this date.",
        )
    await db.delete(holiday)
    await db.commit()
    return ResponseEnvelope(
        success=True, data={"message": "Holiday deleted successfully"}
    )
