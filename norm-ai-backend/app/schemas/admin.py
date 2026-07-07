from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class AdminStatsResponse(BaseModel):
    total_students: int
    total_teachers: int
    today_present: int
    today_absent: int
    holidays_this_month: int


class AdminStudentAttendanceResponse(BaseModel):
    id: UUID
    name: str
    register_number: str
    department: str
    section: str
    today_status: str  # present / absent / not_marked
    marked_at: Optional[datetime] = None
    counsellor_name: Optional[str] = None


class AdminTeacherResponse(BaseModel):
    id: UUID
    name: str
    department: str
    position: str
    student_count: int


class SSIDConfigRequest(BaseModel):
    allowed_ssids: list[str]


class RecentActivityResponse(BaseModel):
    marked_at: Optional[datetime] = None
    student_name: str
    register_number: str
    status: str
    method: str


class SlotConfigRequest(BaseModel):
    start_time: str
    end_time: str
