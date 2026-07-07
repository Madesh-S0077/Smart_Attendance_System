from datetime import date, datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class AttendanceVerifyRequest(BaseModel):
    face_embedding: list[float]
    date: date

    @field_validator("face_embedding")
    @classmethod
    def validate_embedding(cls, v: list[float]) -> list[float]:
        if len(v) != 512:
            raise ValueError("Face embedding must be exactly 512 elements.")
        if any(x < -10.0 or x > 10.0 for x in v):
            raise ValueError("Each face embedding float must be in the range [-10.0, 10.0].")
        return v


class AttendanceVerifyResponse(BaseModel):
    attendance_id: UUID
    marked_at: datetime
    similarity: float


class SlotInfo(BaseModel):
    id: str
    slot_name: str
    start_time: str
    end_time: str
    date: str


class AttendanceStatusResponse(BaseModel):
    slot: SlotInfo
    status: str  # present / absent / pending
    marked_at: Optional[datetime] = None
    is_holiday: bool = False
    holiday_reason: Optional[str] = None


class AttendanceHistoryItem(BaseModel):
    date: date
    status: str
    slot_name: str


class AttendanceOverrideRequest(BaseModel):
    student_id: UUID
    slot_id: UUID
    date: date
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ("present", "absent"):
            raise ValueError("Status must be either 'present' or 'absent'")
        return v


class AttendanceOverrideResponse(BaseModel):
    attendance_id: UUID
