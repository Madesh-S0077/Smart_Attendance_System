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
from app.models.attendance import AttendanceLog, MarkedBy
from app.models.app_config import AppConfig
from app.schemas.admin import (
    AdminStatsResponse,
    AdminStudentAttendanceResponse,
    AdminTeacherResponse,
    SSIDConfigRequest,
    RecentActivityResponse,
    SlotConfigRequest,
)
from app.schemas.envelope import ResponseEnvelope
from app.services.admin import AdminService

router = APIRouter()


@router.get("/stats", response_model=ResponseEnvelope[AdminStatsResponse])
async def get_stats(
    current_user: Annotated[User, Depends(role_required(UserRole.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[AdminStatsResponse]:
    res = await AdminService.get_stats(db)
    return ResponseEnvelope(success=True, data=res)


@router.get(
    "/all-students",
    response_model=ResponseEnvelope[list[AdminStudentAttendanceResponse]],
)
async def get_all_students(
    current_user: Annotated[User, Depends(role_required(UserRole.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[list[AdminStudentAttendanceResponse]]:
    today = date.today()
    stmt = select(Student).options(
        selectinload(Student.attendance_logs),
        selectinload(Student.counsellor)
    )
    result = await db.execute(stmt)
    students = result.scalars().all()

    res = []
    for s in students:
        today_log = next((l for l in s.attendance_logs if l.date == today), None)
        status_str = today_log.status.value if today_log else "not_marked"
        marked_at = today_log.marked_at if today_log else None
        res.append(
            AdminStudentAttendanceResponse(
                id=s.id,
                name=s.name,
                register_number=s.register_number,
                department=s.department,
                section=s.section,
                today_status=status_str,
                marked_at=marked_at,
                counsellor_name=s.counsellor.name if s.counsellor else "Not Assigned",
            )
        )
    return ResponseEnvelope(success=True, data=res)


@router.get(
    "/all-teachers", response_model=ResponseEnvelope[list[AdminTeacherResponse]]
)
async def get_all_teachers(
    current_user: Annotated[User, Depends(role_required(UserRole.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[list[AdminTeacherResponse]]:
    stmt = select(Teacher).options(selectinload(Teacher.counselled_students))
    result = await db.execute(stmt)
    teachers = result.scalars().all()

    res = []
    for t in teachers:
        res.append(
            AdminTeacherResponse(
                id=t.id,
                name=t.name,
                department=t.department,
                position=t.position,
                student_count=len(t.counselled_students),
            )
        )
    return ResponseEnvelope(success=True, data=res)


@router.put("/ssid-config", response_model=ResponseEnvelope[list[str]])
async def update_ssid_config(
    req: SSIDConfigRequest,
    current_user: Annotated[User, Depends(role_required(UserRole.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[list[str]]:
    res = await AdminService.set_ssid_config(db, req.allowed_ssids)
    return ResponseEnvelope(success=True, data=res)


@router.get("/recent-activity", response_model=ResponseEnvelope[list[RecentActivityResponse]])
async def get_recent_activity(
    current_user: Annotated[User, Depends(role_required(UserRole.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[list[RecentActivityResponse]]:
    stmt = (
        select(AttendanceLog)
        .options(selectinload(AttendanceLog.student))
        .order_by(AttendanceLog.marked_at.desc())
        .limit(20)
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()

    res = []
    for l in logs:
        res.append(
            RecentActivityResponse(
                marked_at=l.marked_at,
                student_name=l.student.name if l.student else "Unknown",
                register_number=l.student.register_number if l.student else "Unknown",
                status=l.status.value,
                method="AI" if l.marked_by == MarkedBy.system else "Teacher"
            )
        )
    return ResponseEnvelope(success=True, data=res)


@router.get("/ssid-config", response_model=ResponseEnvelope[list[str]])
async def get_ssid_config(
    current_user: Annotated[User, Depends(role_required(UserRole.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[list[str]]:
    result = await db.execute(
        select(AppConfig).where(AppConfig.key == "allowed_ssids")
    )
    config = result.scalar_one_or_none()
    val = config.value if config else ["RMKEC", "RMKEC2G"]
    return ResponseEnvelope(success=True, data=val)


@router.put("/slot-config", response_model=ResponseEnvelope[dict])
async def update_slot_config(
    req: SlotConfigRequest,
    current_user: Annotated[User, Depends(role_required(UserRole.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResponseEnvelope[dict]:
    result = await db.execute(
        select(AppConfig).where(AppConfig.key == "slot_config")
    )
    config = result.scalar_one_or_none()

    val = {"start_time": req.start_time, "end_time": req.end_time}

    if config:
        config.value = val
    else:
        config = AppConfig(key="slot_config", value=val)
        db.add(config)

    await db.commit()
    return ResponseEnvelope(success=True, data=val)
