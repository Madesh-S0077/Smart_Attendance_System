import enum
import uuid
from datetime import datetime

from sqlalchemy import Date, DateTime, Enum, Float, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class AttendanceStatus(str, enum.Enum):
    present = "present"
    absent = "absent"


class MarkedBy(str, enum.Enum):
    system = "system"
    teacher = "teacher"


class AttendanceLog(Base):
    """
    One row per (student, slot, date) triple.
    The UNIQUE constraint at the DB level rejects duplicate submissions
    with a unique-violation error, surfaced as HTTP 409 by the service layer.

    face_match_score is the cosine similarity returned by pgvector — kept
    for audit purposes only; the inference decision is made in the sidecar.
    """

    __tablename__ = "attendance_logs"
    __table_args__ = (
        UniqueConstraint(
            "student_id", "slot_id", "date",
            name="uq_attendance_student_slot_date",
        ),
        Index("idx_attendance_student_date", "student_id", "date"),
        Index("idx_attendance_slot_date", "slot_id", "date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    slot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("time_slots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[AttendanceStatus] = mapped_column(
        Enum(AttendanceStatus, name="attendancestatus", create_type=False),
        nullable=False,
        default=AttendanceStatus.absent,
    )
    marked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    marked_by: Mapped[MarkedBy] = mapped_column(
        Enum(MarkedBy, name="markedby", create_type=False),
        nullable=False,
        default=MarkedBy.system,
    )
    face_match_score: Mapped[float | None] = mapped_column(
        Float, nullable=True, comment="Cosine similarity from pgvector — audit only"
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    student: Mapped["Student"] = relationship(  # noqa: F821
        "Student", back_populates="attendance_logs"
    )
    slot: Mapped["TimeSlot"] = relationship(  # noqa: F821
        "TimeSlot", back_populates="attendance_logs"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<AttendanceLog student={self.student_id} "
            f"date={self.date} status={self.status.value}>"
        )
