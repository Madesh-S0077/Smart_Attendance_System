from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class TeacherResponse(BaseModel):
    id: UUID
    name: str
    department: str

    class Config:
        from_attributes = True


class TeacherStudentAttendanceResponse(BaseModel):
    id: UUID
    name: str
    register_number: str
    section: str
    today_status: str  # present / absent / not_marked
    marked_at: Optional[datetime] = None  # we will import datetime in file if needed, let's use string or datetime
