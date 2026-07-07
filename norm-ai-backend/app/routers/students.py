from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import role_required
from app.core.security import hash_password
from app.models.student import Student
from app.models.user import User, UserRole
from app.schemas.envelope import ResponseEnvelope
from app.schemas.student import StudentProfileResponse, StudentUpdateRequest

router = APIRouter()


@router.get("/me", response_model=ResponseEnvelope[StudentProfileResponse])
async def get_me(
    current_user: Annotated[User, Depends(role_required(UserRole.student))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[StudentProfileResponse]:
    result = await db.execute(
        select(Student)
        .options(selectinload(Student.counsellor))
        .where(Student.id == current_user.id)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found.",
        )

    counsellor_name = student.counsellor.name if student.counsellor else None

    return ResponseEnvelope(
        success=True,
        data=StudentProfileResponse(
            id=student.id,
            email=current_user.email,
            name=student.name,
            register_number=student.register_number,
            department=student.department,
            section=student.section,
            counsellor_id=student.counsellor_id,
            counsellor_name=counsellor_name,
            created_at=student.created_at,
        ),
    )


@router.put("/me", response_model=ResponseEnvelope[StudentProfileResponse])
async def update_me(
    req: StudentUpdateRequest,
    current_user: Annotated[User, Depends(role_required(UserRole.student))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[StudentProfileResponse]:
    result = await db.execute(
        select(Student)
        .options(selectinload(Student.counsellor))
        .where(Student.id == current_user.id)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found.",
        )

    # Update Student fields
    if req.name is not None:
        student.name = req.name
    if req.counsellor_id is not None:
        student.counsellor_id = req.counsellor_id
    if req.face_embedding is not None:
        student.face_embedding = req.face_embedding

    # Update User password if provided
    if req.password is not None:
        current_user.password_hash = hash_password(req.password)
        db.add(current_user)

    db.add(student)
    await db.commit()
    await db.refresh(student)

    counsellor_name = student.counsellor.name if student.counsellor else None

    return ResponseEnvelope(
        success=True,
        data=StudentProfileResponse(
            id=student.id,
            email=current_user.email,
            name=student.name,
            register_number=student.register_number,
            department=student.department,
            section=student.section,
            counsellor_id=student.counsellor_id,
            counsellor_name=counsellor_name,
            created_at=student.created_at,
        ),
    )


@router.get("/all", response_model=ResponseEnvelope[list[StudentProfileResponse]])
async def get_all_students(
    current_user: Annotated[
        User, Depends(role_required(UserRole.admin, UserRole.teacher))
    ],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[list[StudentProfileResponse]]:
    query = select(Student).options(
        selectinload(Student.user), selectinload(Student.counsellor)
    )
    if current_user.role == UserRole.teacher:
        query = query.where(Student.counsellor_id == current_user.id)

    result = await db.execute(query)
    students = result.scalars().all()

    res = []
    for s in students:
        counsellor_name = s.counsellor.name if s.counsellor else None
        res.append(
            StudentProfileResponse(
                id=s.id,
                email=s.user.email,
                name=s.name,
                register_number=s.register_number,
                department=s.department,
                section=s.section,
                counsellor_id=s.counsellor_id,
                counsellor_name=counsellor_name,
                created_at=s.created_at,
            )
        )
    return ResponseEnvelope(success=True, data=res)
