import calendar
from datetime import date
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import role_required
from app.models.attendance import AttendanceLog, AttendanceStatus
from app.models.holiday import Holiday
from app.models.time_slot import TimeSlot
from app.models.user import User, UserRole
from app.schemas.attendance import (
    AttendanceHistoryItem,
    AttendanceOverrideRequest,
    AttendanceOverrideResponse,
    AttendanceStatusResponse,
    AttendanceVerifyRequest,
    AttendanceVerifyResponse,
)
from app.schemas.envelope import ResponseEnvelope
from app.services.attendance import AttendanceService

router = APIRouter()


@router.post("/verify", response_model=ResponseEnvelope[AttendanceVerifyResponse])
async def verify_attendance(
    req: AttendanceVerifyRequest,
    current_user: Annotated[User, Depends(role_required(UserRole.student))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[AttendanceVerifyResponse]:
    res = await AttendanceService.verify_attendance(db, current_user.id, req)
    return ResponseEnvelope(success=True, data=res)


@router.get("/status", response_model=ResponseEnvelope[AttendanceStatusResponse])
async def get_status(
    date: date,
    current_user: Annotated[User, Depends(role_required(UserRole.student))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[AttendanceStatusResponse]:
    # Check Sunday
    if date.weekday() == 6:
        return ResponseEnvelope(
            success=True,
            data=AttendanceStatusResponse(
                status="Sunday", slot_name="Sunday Holiday"
            ),
        )

    # Check Holiday
    holiday_result = await db.execute(select(Holiday).where(Holiday.date == date))
    holiday = holiday_result.scalar_one_or_none()
    if holiday:
        return ResponseEnvelope(
            success=True,
            data=AttendanceStatusResponse(
                status="holiday", slot_name=holiday.reason or "Holiday"
            ),
        )

    # Check TimeSlot
    slot_result = await db.execute(select(TimeSlot).where(TimeSlot.date == date))
    slot = slot_result.scalar_one_or_none()
    if not slot:
        return ResponseEnvelope(
            success=True,
            data=AttendanceStatusResponse(
                status="not_marked", slot_name="No Slot Configured"
            ),
        )

    # Check Log
    log_result = await db.execute(
        select(AttendanceLog).where(
            AttendanceLog.student_id == current_user.id,
            AttendanceLog.slot_id == slot.id,
            AttendanceLog.date == date,
        )
    )
    log = log_result.scalar_one_or_none()

    status_str = log.status.value if log else "absent"
    marked_at = log.marked_at if log else None

    return ResponseEnvelope(
        success=True,
        data=AttendanceStatusResponse(
            slot_id=slot.id,
            slot_name=slot.slot_name,
            status=status_str,
            marked_at=marked_at,
        ),
    )


@router.get("/history", response_model=ResponseEnvelope[list[AttendanceHistoryItem]])
async def get_history(
    month: Annotated[
        str,
        Query(
            ...,
            pattern=r"^\d{4}-\d{2}$",
            description="Month in YYYY-MM format",
        ),
    ],
    current_user: Annotated[User, Depends(role_required(UserRole.student))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[list[AttendanceHistoryItem]]:
    try:
        year, m = map(int, month.split("-"))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid month format. Use YYYY-MM.",
        ) from exc

    _, last_day = calendar.monthrange(year, m)
    start_date = date(year, m, 1)
    end_date = date(year, m, last_day)

    # Fetch holidays in month
    holidays_result = await db.execute(
        select(Holiday).where(Holiday.date.between(start_date, end_date))
    )
    holidays = {h.date: h for h in holidays_result.scalars().all()}

    # Fetch time slots in month
    slots_result = await db.execute(
        select(TimeSlot).where(TimeSlot.date.between(start_date, end_date))
    )
    slots = {s.date: s for s in slots_result.scalars().all()}

    # Fetch attendance logs in month
    logs_result = await db.execute(
        select(AttendanceLog).where(
            AttendanceLog.student_id == current_user.id,
            AttendanceLog.date.between(start_date, end_date),
        )
    )
    logs = {l.date: l for l in logs_result.scalars().all()}

    history = []
    for day in range(1, last_day + 1):
        curr_date = date(year, m, day)

        if curr_date.weekday() == 6:  # Sunday
            history.append(
                AttendanceHistoryItem(
                    date=curr_date, status="Sunday", slot_name="Sunday Holiday"
                )
            )
        elif curr_date in holidays:
            history.append(
                AttendanceHistoryItem(
                    date=curr_date,
                    status="holiday",
                    slot_name=holidays[curr_date].reason or "Holiday",
                )
            )
        elif curr_date in slots:
            slot = slots[curr_date]
            log = logs.get(curr_date)
            status_str = log.status.value if log else "absent"
            history.append(
                AttendanceHistoryItem(
                    date=curr_date, status=status_str, slot_name=slot.slot_name
                )
            )
        else:
            history.append(
                AttendanceHistoryItem(
                    date=curr_date, status="not_marked", slot_name="-"
                )
            )

    return ResponseEnvelope(success=True, data=history)


@router.put("/override", response_model=ResponseEnvelope[AttendanceOverrideResponse])
async def override_attendance(
    req: AttendanceOverrideRequest,
    current_user: Annotated[
        User, Depends(role_required(UserRole.teacher, UserRole.admin))
    ],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[AttendanceOverrideResponse]:
    attendance_id = await AttendanceService.override_attendance(
        db, current_user, req
    )
    return ResponseEnvelope(
        success=True, data=AttendanceOverrideResponse(attendance_id=attendance_id)
    )
