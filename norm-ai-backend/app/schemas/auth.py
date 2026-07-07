from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_validator


class StudentRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str = Field(..., min_length=1)
    register_number: str = Field(..., min_length=1)
    department: str = Field(..., min_length=1)
    section: str = Field(..., min_length=1)
    counsellor_id: Optional[UUID] = None
    face_embedding: list[float]

    @field_validator("face_embedding")
    @classmethod
    def validate_embedding(cls, v: list[float]) -> list[float]:
        if len(v) != 512:
            raise ValueError("Face embedding must be exactly 512 elements.")
        if any(x < -10.0 or x > 10.0 for x in v):
            raise ValueError("Each face embedding float must be in the range [-10.0, 10.0].")
        return v


class TeacherRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str = Field(..., min_length=1)
    department: str = Field(..., min_length=1)
    position: str = Field(..., min_length=1)


class AdminRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str = Field(..., min_length=1)


class RegisterResponse(BaseModel):
    user_id: UUID
    student_id: Optional[UUID] = None
    teacher_id: Optional[UUID] = None
    admin_id: Optional[UUID] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    role: str
    user_id: UUID


class RefreshResponse(BaseModel):
    access_token: str
