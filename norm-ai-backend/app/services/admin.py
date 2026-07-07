from datetime import date
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_config import AppConfig
from app.models.attendance import AttendanceLog, AttendanceStatus
from app.models.holiday import Holiday
from app.models.student import Student
from app.models.teacher import Teacher
from app.schemas.admin import AdminStatsResponse


class AdminService:
    @staticmethod
    async def get_stats(db: AsyncSession) -> AdminStatsResponse:
        today = date.today()
        current_month = today.month
        current_year = today.year

        # Count total students
        total_students_result = await db.execute(select(func.count(Student.id)))
        total_students = total_students_result.scalar() or 0

        # Count total teachers
        total_teachers_result = await db.execute(select(func.count(Teacher.id)))
        total_teachers = total_teachers_result.scalar() or 0

        # Count today's present students
        today_present_result = await db.execute(
            select(func.count(AttendanceLog.id)).where(
                AttendanceLog.date == today,
                AttendanceLog.status == AttendanceStatus.present,
            )
        )
        today_present = today_present_result.scalar() or 0

        # Today absent = total - present
        today_absent = max(0, total_students - today_present)

        # Count holidays this month
        holidays_result = await db.execute(
            select(func.count(Holiday.id)).where(
                func.extract("month", Holiday.date) == current_month,
                func.extract("year", Holiday.date) == current_year,
            )
        )
        holidays_this_month = holidays_result.scalar() or 0

        return AdminStatsResponse(
            total_students=total_students,
            total_teachers=total_teachers,
            today_present=today_present,
            today_absent=today_absent,
            holidays_this_month=holidays_this_month,
        )

    @staticmethod
    async def set_ssid_config(db: AsyncSession, allowed_ssids: list[str]) -> list[str]:
        result = await db.execute(
            select(AppConfig).where(AppConfig.key == "allowed_ssids")
        )
        config = result.scalar_one_or_none()

        if config:
            config.value = allowed_ssids
        else:
            config = AppConfig(key="allowed_ssids", value=allowed_ssids)
            db.add(config)

        await db.commit()
        return allowed_ssids
