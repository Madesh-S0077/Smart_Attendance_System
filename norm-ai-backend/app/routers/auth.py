from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import role_required
from app.core.security import create_access_token, decode_token
from app.core.limiter import limiter
from app.models.user import User, UserRole
from app.schemas.auth import (
    AdminRegisterRequest,
    LoginRequest,
    LoginResponse,
    RefreshResponse,
    RegisterResponse,
    StudentRegisterRequest,
    TeacherRegisterRequest,
)
from app.schemas.envelope import ResponseEnvelope
from app.services.auth import AuthService

router = APIRouter()
_bearer = HTTPBearer(auto_error=True)


@router.post(
    "/register/student",
    response_model=ResponseEnvelope[RegisterResponse],
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/minute")
async def register_student(
    request: Request,
    req: StudentRegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[RegisterResponse]:
    student = await AuthService.register_student(db, req)
    return ResponseEnvelope(
        success=True,
        data=RegisterResponse(user_id=student.id, student_id=student.id),
    )


@router.post(
    "/register/teacher",
    response_model=ResponseEnvelope[RegisterResponse],
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/minute")
async def register_teacher(
    request: Request,
    req: TeacherRegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[RegisterResponse]:
    teacher = await AuthService.register_teacher(db, req)
    return ResponseEnvelope(
        success=True,
        data=RegisterResponse(user_id=teacher.id, teacher_id=teacher.id),
    )


@router.post(
    "/register/admin",
    response_model=ResponseEnvelope[RegisterResponse],
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/minute")
async def register_admin(
    request: Request,
    req: AdminRegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[
        User, Depends(role_required(UserRole.admin))
    ],  # Require admin role
) -> ResponseEnvelope[RegisterResponse]:
    admin = await AuthService.register_admin(db, req)
    return ResponseEnvelope(
        success=True,
        data=RegisterResponse(user_id=admin.id, admin_id=admin.id),
    )


@router.post("/login", response_model=ResponseEnvelope[LoginResponse])
@limiter.limit("10/minute")
async def login(
    request: Request,
    req: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[LoginResponse]:
    res = await AuthService.login(db, req)
    return ResponseEnvelope(success=True, data=res)


@router.post("/refresh", response_model=ResponseEnvelope[RefreshResponse])
@limiter.limit("10/minute")
async def refresh(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[RefreshResponse]:
    try:
        payload = decode_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type. A refresh token is required here.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject missing.",
        )

    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format in token.",
        )

    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive.",
        )

    extra_claims = {"role": user.role.value, "email": user.email}
    new_access_token = create_access_token(str(user.id), extra_claims=extra_claims)

    return ResponseEnvelope(
        success=True,
        data=RefreshResponse(access_token=new_access_token),
    )
