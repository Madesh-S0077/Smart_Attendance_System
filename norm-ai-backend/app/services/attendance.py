from datetime import date, datetime
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import AttendanceLog, AttendanceStatus, MarkedBy
from app.models.holiday import Holiday
from app.models.student import Student
from app.models.time_slot import TimeSlot
from app.models.user import User, UserRole
from app.schemas.attendance import (
    AttendanceOverrideRequest,
    AttendanceVerifyRequest,
    AttendanceVerifyResponse,
)


class AttendanceService:
    @staticmethod
    async def verify_attendance(
        db: AsyncSession, student_id: UUID, req: AttendanceVerifyRequest
    ) -> AttendanceVerifyResponse:
        # 1. Check if date is Sunday (6 corresponds to Sunday in Python's weekday: 0-indexed starting Monday)
        if req.date.weekday() == 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sundays are holidays.",
            )

        # 2. Check if date is a holiday
        holiday_result = await db.execute(
            select(Holiday).where(Holiday.date == req.date)
        )
        if holiday_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This day is marked as a holiday.",
            )

        # 3. Fetch time slot for today
        slot_result = await db.execute(
            select(TimeSlot).where(TimeSlot.date == req.date)
        )
        slot = slot_result.scalar_one_or_none()
        if not slot:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No attendance slot configured for today.",
            )

        # 4. Check if current server time is in slot window
        current_time = datetime.now().time()
        if not (slot.start_time <= current_time <= slot.end_time):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Attendance window is 8:30 AM – 10:00 AM.",
            )

        # 5. Check if attendance already marked present
        existing_log_result = await db.execute(
            select(AttendanceLog).where(
                AttendanceLog.student_id == student_id,
                AttendanceLog.slot_id == slot.id,
                AttendanceLog.date == req.date,
            )
        )
        existing_log = existing_log_result.scalar_one_or_none()
        if existing_log and existing_log.status == AttendanceStatus.present:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Attendance already marked for this slot.",
            )

        # 6. Fetch student to get face embedding
        student_result = await db.execute(
            select(Student).where(Student.id == student_id)
        )
        student = student_result.scalar_one_or_none()
        if not student or student.face_embedding is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Student profile or face embedding not found.",
            )

        # 7. Compute pgvector similarity: 1 - cosine_distance
        similarity_query = select(
            1 - Student.face_embedding.cosine_distance(req.face_embedding)
        ).where(Student.id == student_id)
        similarity = await db.scalar(similarity_query)

        if similarity is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to compute similarity.",
            )

        # 8. Check similarity threshold
        if similarity < 0.45:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Face verification failed. Please retake.",
            )

        # 9. Log attendance (update existing absent log, or insert new one)
        marked_at = datetime.now()
        if existing_log:
            existing_log.status = AttendanceStatus.present
            existing_log.marked_by = MarkedBy.system
            existing_log.face_match_score = similarity
            existing_log.marked_at = marked_at
            attendance_id = existing_log.id
        else:
            new_log = AttendanceLog(
                student_id=student_id,
                slot_id=slot.id,
                date=req.date,
                status=AttendanceStatus.present,
                marked_by=MarkedBy.system,
                face_match_score=similarity,
                marked_at=marked_at,
            )
            db.add(new_log)
            await db.flush()
            attendance_id = new_log.id

        await db.commit()

        return AttendanceVerifyResponse(
            attendance_id=attendance_id,
            marked_at=marked_at,
            similarity=float(similarity),
        )

    @staticmethod
    async def override_attendance(
        db: AsyncSession, current_user: User, req: AttendanceOverrideRequest
    ) -> UUID:
        # Check permissions: Teachers can only override their own counselled students
        if current_user.role == UserRole.teacher:
            student_result = await db.execute(
                select(Student).where(Student.id == req.student_id)
            )
            student = student_result.scalar_one_or_none()
            if not student:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Student not found.",
                )
            if student.counsellor_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. You can only override attendance for your counselled students.",
                )

        # Upsert logic
        existing_log_result = await db.execute(
            select(AttendanceLog).where(
                AttendanceLog.student_id == req.student_id,
                AttendanceLog.slot_id == req.slot_id,
                AttendanceLog.date == req.date,
            )
        )
        existing_log = existing_log_result.scalar_one_or_none()

        marked_at = datetime.now()
        status_enum = AttendanceStatus(req.status)

        if existing_log:
            existing_log.status = status_enum
            existing_log.marked_by = MarkedBy.teacher
            existing_log.marked_at = marked_at
            attendance_id = existing_log.id
        else:
            new_log = AttendanceLog(
                student_id=req.student_id,
                slot_id=req.slot_id,
                date=req.date,
                status=status_enum,
                marked_by=MarkedBy.teacher,
                marked_at=marked_at,
            )
            db.add(new_log)
            await db.flush()
            attendance_id = new_log.id

        await db.commit()
        return attendance_id
