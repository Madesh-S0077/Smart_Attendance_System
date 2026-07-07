import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Teacher(Base):
    """Profile data for users with role='teacher'."""

    __tablename__ = "teachers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    position: Mapped[str] = mapped_column(String(100), nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(  # noqa: F821
        "User", back_populates="teacher"
    )
    counselled_students: Mapped[list["Student"]] = relationship(  # noqa: F821
        "Student", back_populates="counsellor", lazy="selectin"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Teacher id={self.id} name={self.name!r} dept={self.department!r}>"
