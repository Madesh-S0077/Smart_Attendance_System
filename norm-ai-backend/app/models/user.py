import enum
import uuid

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class UserRole(str, enum.Enum):
    student = "student"
    teacher = "teacher"
    admin = "admin"


class User(Base):
    """
    Central auth table. Every person has exactly one User row.
    Role-specific data lives in the student / teacher / admin sibling table.
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="userrole", create_type=False),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── Back-references (populated by child models) ───────────────────────────
    student: Mapped["Student"] = relationship(  # noqa: F821
        "Student", back_populates="user", uselist=False, lazy="selectin"
    )
    teacher: Mapped["Teacher"] = relationship(  # noqa: F821
        "Teacher", back_populates="user", uselist=False, lazy="selectin"
    )
    admin: Mapped["Admin"] = relationship(  # noqa: F821
        "Admin", back_populates="user", uselist=False, lazy="selectin"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User id={self.id} email={self.email!r} role={self.role.value}>"
