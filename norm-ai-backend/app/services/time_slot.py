from datetime import date, time
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.holiday import Holiday
from app.models.time_slot import TimeSlot


class TimeSlotService:
    @staticmethod
    async def generate_time_slot(db: AsyncSession, target_date: date) -> TimeSlot:
        # Check Sunday
        if target_date.weekday() == 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot generate time slot for Sundays.",
            )

        # Check Holiday
        holiday_result = await db.execute(
            select(Holiday).where(Holiday.date == target_date)
        )
        if holiday_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot generate time slot for holidays.",
            )

        # Check existing slot
        existing_result = await db.execute(
            select(TimeSlot).where(TimeSlot.date == target_date)
        )
        if existing_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Time slot already exists for this date.",
            )

        # Create time slot
        slot = TimeSlot(
            date=target_date,
            slot_name="Morning Attendance",
            start_time=time(8, 30),
            end_time=time(10, 0),
        )
        db.add(slot)
        await db.commit()
        await db.refresh(slot)
        return slot

    @staticmethod
    async def auto_generate_today_slot(db: AsyncSession) -> None:
        today = date.today()
        if today.weekday() == 6:  # Sunday
            return

        # Check Holiday
        holiday_result = await db.execute(
            select(Holiday).where(Holiday.date == today)
        )
        if holiday_result.scalar_one_or_none():
            return

        # Check existing slot
        existing_result = await db.execute(
            select(TimeSlot).where(TimeSlot.date == today)
        )
        if existing_result.scalar_one_or_none():
            return

        # Add slot
        slot = TimeSlot(
            date=today,
            slot_name="Morning Attendance",
            start_time=time(8, 30),
            end_time=time(10, 0),
        )
        db.add(slot)
        await db.commit()
