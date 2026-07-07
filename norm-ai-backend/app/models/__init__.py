# app/models/__init__.py
# Re-export all models so that Alembic's env.py can import everything
# from a single location.

from app.models.base import Base
from app.models.user import User, UserRole
from app.models.teacher import Teacher
from app.models.admin import Admin
from app.models.student import Student
from app.models.time_slot import TimeSlot
from app.models.attendance import AttendanceLog, AttendanceStatus, MarkedBy
from app.models.holiday import Holiday
from app.models.app_config import AppConfig

__all__ = [
    "Base",
    "User",
    "UserRole",
    "Teacher",
    "Admin",
    "Student",
    "TimeSlot",
    "AttendanceLog",
    "AttendanceStatus",
    "MarkedBy",
    "Holiday",
    "AppConfig",
]
