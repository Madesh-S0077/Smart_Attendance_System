from pydantic_settings import BaseSettings
from pydantic import Field, field_validator


class Settings(BaseSettings):
    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://normai:normai_pass@localhost:5432/normai_db",
        description="Async PostgreSQL connection string",
    )

    # ── JWT ───────────────────────────────────────────────────────────────────
    SECRET_KEY: str = Field(
        ...,
        description="HMAC secret — use `openssl rand -hex 32` in production",
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if len(v) < 64:
            raise ValueError("SECRET_KEY must be at least 64 characters long")
        return v

    # ── App meta ──────────────────────────────────────────────────────────────
    APP_NAME: str = "Norm AI — Smart Attendance System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()  # type: ignore[call-arg]
