from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class StudentProfileResponse(BaseModel):
    id: UUID
    email: str
    name: str
    register_number: str
    department: str
    section: str
    counsellor_id: Optional[UUID] = None
    counsellor_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class StudentUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    password: Optional[str] = Field(None, min_length=8)
    counsellor_id: Optional[UUID] = None
    face_embedding: Optional[list[float]] = None

    @field_validator("face_embedding")
    @classmethod
    def validate_embedding(cls, v: Optional[list[float]]) -> Optional[list[float]]:
        if v is not None:
            if len(v) != 512:
                raise ValueError("Face embedding must be exactly 512 elements.")
            if any(x < -10.0 or x > 10.0 for x in v):
                raise ValueError("Each face embedding float must be in the range [-10.0, 10.0].")
        return v
