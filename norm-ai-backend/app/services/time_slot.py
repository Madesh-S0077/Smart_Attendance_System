from datetime import date, time
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_config import AppConfig
from app.models.holiday import Holiday
from app.models.time_slot import TimeSlot


DEFAULT_START = time(8, 30)
DEFAULT_END = time(10, 0)


def _parse_hhmm(value: str, fallback: time) -> time:
    try:
        h, m = value.strip().split(":")[:2]
        return time(int(h), int(m))
    except (ValueError, AttributeError):
        return fallback


class TimeSlotService:
    @staticmethod
    async def get_window(db: AsyncSession) -> tuple[time, time]:
        """Attendance window from the admin `slot_config`, else 08:30-10:00."""
        result = await db.execute(select(AppConfig).where(AppConfig.key == "slot_config"))
        cfg = result.scalar_one_or_none()
        if not cfg or not isinstance(cfg.value, dict):
            return DEFAULT_START, DEFAULT_END
        start = _parse_hhmm(cfg.value.get("start_time", ""), DEFAULT_START)
        end = _parse_hhmm(cfg.value.get("end_time", ""), DEFAULT_END)
        return (start, end) if start < end else (DEFAULT_START, DEFAULT_END)

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
        start, end = await TimeSlotService.get_window(db)
        slot = TimeSlot(
            date=target_date,
            slot_name="Morning Attendance",
            start_time=start,
            end_time=end,
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
        start, end = await TimeSlotService.get_window(db)
        slot = TimeSlot(
            date=today,
            slot_name="Morning Attendance",
            start_time=start,
            end_time=end,
        )
        db.add(slot)
        await db.commit()
