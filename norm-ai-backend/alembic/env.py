"""
Alembic environment configuration for Norm AI backend.

Key design decisions:
- Uses async engine (asyncpg) via run_sync wrapper for DDL operations.
- Imports all models from app.models so autogenerate detects every table.
- DATABASE_URL is loaded from app.core.config (reads .env) — never hardcoded here.
- pgvector extension creation is handled in the initial migration, not here.
"""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# ── Load app settings & models ────────────────────────────────────────────────
from app.core.config import settings

# Import every model so SQLAlchemy's metadata knows about all tables.
from app.models import (  # noqa: F401 — side-effect imports required
    Base,
    User,
    Teacher,
    Admin,
    Student,
    TimeSlot,
    AttendanceLog,
    Holiday,
)

# ── Alembic config object ──────────────────────────────────────────────────────
config = context.config

# Override the sqlalchemy.url from .env (not from alembic.ini)
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata for autogenerate
target_metadata = Base.metadata


# ── Offline mode ──────────────────────────────────────────────────────────────
def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode — generates SQL without a live DB."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ── Online mode ───────────────────────────────────────────────────────────────
def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create an async engine and run migrations via run_sync."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """Entry point for online mode."""
    asyncio.run(run_async_migrations())


# ── Entry point ───────────────────────────────────────────────────────────────
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
