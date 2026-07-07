import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, String, func, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Student(Base):
    """
    Profile data for users with role='student'.
    face_embedding stores the 512-dim float32 InsightFace vector
    used by pgvector for cosine-similarity searches.
    """

    __tablename__ = "students"
    __table_args__ = (
        Index("idx_students_counsellor", "counsellor_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    register_number: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    section: Mapped[str] = mapped_column(String(10), nullable=False)
    counsellor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teachers.id", ondelete="SET NULL"),
        nullable=True,
    )
    # ── pgvector column ── 512-dimensional InsightFace buffalo_m embedding ────
    face_embedding: Mapped[list[float] | None] = mapped_column(
        Vector(512), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(  # noqa: F821
        "User", back_populates="student"
    )
    counsellor: Mapped["Teacher"] = relationship(  # noqa: F821
        "Teacher", back_populates="counselled_students"
    )
    attendance_logs: Mapped[list["AttendanceLog"]] = relationship(  # noqa: F821
        "AttendanceLog", back_populates="student", lazy="selectin"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<Student id={self.id} reg={self.register_number!r} "
            f"dept={self.department!r} sec={self.section!r}>"
        )
