from datetime import date
from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_required
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.user import User, UserRole
from app.schemas.envelope import ResponseEnvelope
from app.schemas.teacher import TeacherResponse, TeacherStudentAttendanceResponse

router = APIRouter()


@router.get("/", response_model=ResponseEnvelope[list[TeacherResponse]])
async def get_teachers(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[list[TeacherResponse]]:
    result = await db.execute(select(Teacher).order_by(Teacher.name.asc()))
    teachers = result.scalars().all()
    return ResponseEnvelope(success=True, data=teachers)


@router.get(
    "/my-students",
    response_model=ResponseEnvelope[list[TeacherStudentAttendanceResponse]],
)
async def get_my_students(
    current_user: Annotated[User, Depends(role_required(UserRole.teacher))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[list[TeacherStudentAttendanceResponse]]:
    today = date.today()
    stmt = (
        select(Student)
        .options(selectinload(Student.attendance_logs))
        .where(Student.counsellor_id == current_user.id)
    )
    result = await db.execute(stmt)
    students = result.scalars().all()

    res = []
    for s in students:
        today_log = next((l for l in s.attendance_logs if l.date == today), None)
        status_str = today_log.status.value if today_log else "not_marked"
        marked_at = today_log.marked_at if today_log else None
        res.append(
            TeacherStudentAttendanceResponse(
                id=s.id,
                name=s.name,
                register_number=s.register_number,
                section=s.section,
                today_status=status_str,
                marked_at=marked_at,
            )
        )
    return ResponseEnvelope(success=True, data=res)
