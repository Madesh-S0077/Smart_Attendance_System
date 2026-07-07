import uuid
from datetime import time

from sqlalchemy import Date, String, Time, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TimeSlot(Base):
    """
    One row per school day.
    The UNIQUE constraint on `date` ensures only one slot per calendar day.
    Slots for Sundays and holidays are skipped by the generation service.
    """

    __tablename__ = "time_slots"
    __table_args__ = (
        UniqueConstraint("date", name="uq_time_slots_date"),
        Index("idx_timeslots_date", "date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    date: Mapped[Date] = mapped_column(Date, nullable=False)
    slot_name: Mapped[str] = mapped_column(
        String(100), nullable=False, default="Morning Attendance"
    )
    start_time: Mapped[time] = mapped_column(
        Time, nullable=False, default=time(8, 30)
    )
    end_time: Mapped[time] = mapped_column(
        Time, nullable=False, default=time(10, 0)
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    attendance_logs: Mapped[list["AttendanceLog"]] = relationship(  # noqa: F821
        "AttendanceLog", back_populates="slot", lazy="selectin"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<TimeSlot date={self.date} name={self.slot_name!r}>"
