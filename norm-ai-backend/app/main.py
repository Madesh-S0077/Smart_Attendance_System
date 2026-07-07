import logging
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.limiter import limiter
from app.routers import admin, attendance, auth, holidays, students, teachers, timeslots
from app.services.time_slot import TimeSlotService

logger = logging.getLogger("app.main")

import asyncio

# ── Lifespan / Startup slot generation ────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup / shutdown lifecycle."""
    # Run auto-slot generation for today on startup in a non-blocking background task
    logger.info("Scheduling auto-generate today slot in background...")
    
    async def run_generation():
        async with AsyncSessionLocal() as db:
            try:
                await TimeSlotService.auto_generate_today_slot(db)
                logger.info("Auto-generate today slot complete.")
            except Exception as e:
                logger.error(f"Failed to auto-generate today slot: {e}")
                
    asyncio.create_task(run_generation())
    yield


# ── App factory ───────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Smart Attendance System — REST API. "
        "AI inference runs inside the Tauri sidecar, not here."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Set up Rate Limiter State
app.state.limiter = limiter

# ── Content-Type Validation Middleware ────────────────────────────────────────
@app.middleware("http")
async def validate_post_content_type(request: Request, call_next):
    if request.method == "POST":
        # Only validate API endpoints, not static docs files
        if request.url.path.startswith("/api"):
            content_type = request.headers.get("content-type", "")
            if not content_type.startswith("application/json"):
                return JSONResponse(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    content={"success": False, "error": "Content-Type must be application/json"},
                )
    return await call_next(request)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Allow only Tauri origins:
origins = [
    "tauri://localhost",
    "https://tauri.localhost",
    "http://localhost:1420",
    "http://127.0.0.1:1420",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global exception handlers ─────────────────────────────────────────────────


@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "data": None,
            "error": "Too many requests. Please try again later.",
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    error_msgs = []
    for err in errors:
        loc = " -> ".join(str(l) for l in err.get("loc", []))
        msg = err.get("msg", "Validation error")
        error_msgs.append(f"{loc}: {msg}")
    error_detail = "; ".join(error_msgs)

    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "data": None,
            "error": f"Validation error: {error_detail}",
        },
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "data": None,
            "error": exc.detail,
        },
    )


@app.exception_handler(IntegrityError)
async def integrity_exception_handler(request: Request, exc: IntegrityError):
    logger.error(f"Database IntegrityError: {exc}")
    return JSONResponse(
        status_code=409,
        content={
            "success": False,
            "data": None,
            "error": "Duplicate entry detected. The resource already exists or violates constraints.",
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all: never leak stack traces to clients in production."""
    logger.error("Unhandled exception: %s", traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "data": None,
            "error": "An unexpected server error occurred. Please try again.",
        },
    )


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["system"])
async def health_check():
    return {
        "success": True,
        "data": {"status": "ok", "version": settings.APP_VERSION},
        "error": None,
    }


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(students.router, prefix="/api/students", tags=["students"])
app.include_router(attendance.router, prefix="/api/attendance", tags=["attendance"])
app.include_router(timeslots.router, prefix="/api/timeslots", tags=["timeslots"])
app.include_router(holidays.router, prefix="/api/holidays", tags=["holidays"])
app.include_router(teachers.router, prefix="/api/teachers", tags=["teachers"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
