import uuid
from datetime import datetime

from sqlalchemy import Date, DateTime, String, UniqueConstraint, func, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Holiday(Base):
    """
    Calendar holidays. When a date has a Holiday row, the slot-generation
    service skips creating a TimeSlot for that day.

    `created_by` is stored as a plain UUID string to allow either a teacher
    or an admin to create holiday entries without a polymorphic FK.
    """

    __tablename__ = "holidays"
    __table_args__ = (
        UniqueConstraint("date", name="uq_holidays_date"),
        Index("idx_holidays_date", "date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    date: Mapped[Date] = mapped_column(Date, unique=True, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Flexible FK — can point to either a teacher or admin user.id
    created_by: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        comment="UUID of the teacher or admin who created this holiday entry",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Holiday date={self.date} reason={self.reason!r}>"
