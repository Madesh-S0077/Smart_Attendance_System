from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class TeacherResponse(BaseModel):
    id: UUID
    name: str
    department: str
    position: str

    class Config:
        from_attributes = True


class TeacherMeResponse(BaseModel):
    """Full profile returned for the logged-in teacher."""
    id: UUID
    name: str
    department: str
    position: str
    email: str

    class Config:
        from_attributes = True


class TeacherStudentAttendanceResponse(BaseModel):
    id: UUID
    name: str
    register_number: str
    section: str
    today_status: str  # present / absent / not_marked
    marked_at: Optional[datetime] = None

