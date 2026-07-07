from datetime import date
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class HolidayResponse(BaseModel):
    id: UUID
    date: date
    reason: Optional[str] = None

    class Config:
        from_attributes = True


class HolidayCreateRequest(BaseModel):
    date: date
    reason: Optional[str] = None
