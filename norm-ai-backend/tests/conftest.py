import os

os.environ.setdefault("SECRET_KEY", "x" * 64)
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://normai:normai_pass@localhost:5432/normai_db"
)
