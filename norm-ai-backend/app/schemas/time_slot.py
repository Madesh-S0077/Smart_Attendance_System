from datetime import date, time
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class TimeSlotResponse(BaseModel):
    id: UUID
    date: date
    slot_name: str
    start_time: time
    end_time: time

    class Config:
        from_attributes = True


class TimeSlotGenerateRequest(BaseModel):
    date: Optional[date] = None
