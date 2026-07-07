"""initial_schema

Revision ID: 0001
Revises:
Create Date: 2026-07-06

Fix: Use postgresql.ENUM(create_type=False) in op.create_table() columns.
     This is the only pattern that reliably suppresses SQLAlchemy's
     before_create table event that fires CREATE TYPE automatically.
     The actual CREATE TYPE is issued by our DO $$ blocks before any table DDL.
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# ── Pre-built column type objects — create_type=False suppresses auto-DDL ─────
_userrole  = postgresql.ENUM("student", "teacher", "admin", name="userrole",        create_type=False)
_attstatus = postgresql.ENUM("present", "absent",           name="attendancestatus", create_type=False)
_markedby  = postgresql.ENUM("system",  "teacher",          name="markedby",         create_type=False)


def upgrade() -> None:
    # ── 0. pgvector extension ─────────────────────────────────────────────────
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # ── 1. Enum types — created once via idempotent PL/pgSQL DO block ─────────
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN
                CREATE TYPE userrole AS ENUM ('student', 'teacher', 'admin');
            END IF;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendancestatus') THEN
                CREATE TYPE attendancestatus AS ENUM ('present', 'absent');
            END IF;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'markedby') THEN
                CREATE TYPE markedby AS ENUM ('system', 'teacher');
            END IF;
        END $$;
    """)

    # ── 2. users ──────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", _userrole, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # ── 3. teachers ───────────────────────────────────────────────────────────
    op.create_table(
        "teachers",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("department", sa.String(100), nullable=False),
        sa.Column("position", sa.String(100), nullable=False),
    )

    # ── 4. admins ─────────────────────────────────────────────────────────────
    op.create_table(
        "admins",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
    )

    # ── 5. students ───────────────────────────────────────────────────────────
    op.create_table(
        "students",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("register_number", sa.String(50), nullable=False),
        sa.Column("department", sa.String(100), nullable=False),
        sa.Column("section", sa.String(10), nullable=False),
        sa.Column(
            "counsellor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("teachers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        # pgvector: 512-dimensional float32 InsightFace face embedding
        sa.Column("face_embedding", Vector(512), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_students_register_number", "students", ["register_number"], unique=True)
    op.create_index("ix_students_counsellor_id", "students", ["counsellor_id"])

    # ── 6. time_slots ─────────────────────────────────────────────────────────
    op.create_table(
        "time_slots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column(
            "slot_name", sa.String(100), nullable=False, server_default="Morning Attendance"
        ),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.UniqueConstraint("date", name="uq_time_slots_date"),
    )
    op.create_index("ix_time_slots_date", "time_slots", ["date"])

    # ── 7. attendance_logs ────────────────────────────────────────────────────
    op.create_table(
        "attendance_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("students.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "slot_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("time_slots.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("status", _attstatus, nullable=False, server_default="absent"),
        sa.Column("marked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("marked_by", _markedby, nullable=False, server_default="system"),
        sa.Column(
            "face_match_score",
            sa.Float(),
            nullable=True,
            comment="Cosine similarity from pgvector — audit only",
        ),
        # CRITICAL: duplicate attendance blocked at DB level → HTTP 409
        sa.UniqueConstraint(
            "student_id", "slot_id", "date",
            name="uq_attendance_student_slot_date",
        ),
    )
    op.create_index("ix_attendance_logs_student_id", "attendance_logs", ["student_id"])
    op.create_index("ix_attendance_logs_slot_id", "attendance_logs", ["slot_id"])
    op.create_index("ix_attendance_logs_date", "attendance_logs", ["date"])

    # ── 8. holidays ───────────────────────────────────────────────────────────
    op.create_table(
        "holidays",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("reason", sa.String(255), nullable=True),
        sa.Column(
            "created_by",
            sa.String(36),
            nullable=True,
            comment="UUID of the teacher or admin who created this holiday",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("date", name="uq_holidays_date"),
    )
    op.create_index("ix_holidays_date", "holidays", ["date"], unique=True)


def downgrade() -> None:
    op.drop_table("holidays")
    op.drop_table("attendance_logs")
    op.drop_table("time_slots")
    op.drop_table("students")
    op.drop_table("admins")
    op.drop_table("teachers")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS markedby;")
    op.execute("DROP TYPE IF EXISTS attendancestatus;")
    op.execute("DROP TYPE IF EXISTS userrole;")
    # vector extension intentionally NOT dropped — may be shared
