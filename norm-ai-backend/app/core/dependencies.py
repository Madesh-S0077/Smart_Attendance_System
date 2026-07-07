from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole

_bearer = HTTPBearer(auto_error=True)


# ── Token extraction ──────────────────────────────────────────────────────────
async def _get_token_payload(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> dict:
    """Extract and verify the Bearer JWT from the Authorization header."""
    try:
        payload = decode_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token cannot be used for API access. Please use your access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


# ── Current user ──────────────────────────────────────────────────────────────
async def get_current_user(
    payload: Annotated[dict, Depends(_get_token_payload)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    Resolve the JWT subject to a live User row.

    Raises 401 if the user no longer exists or is deactivated.
    """
    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing subject claim.",
        )

    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject is not a valid UUID.",
        )

    result = await db.execute(select(User).where(User.id == uid))
    user: User | None = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The account associated with this token no longer exists.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Contact an administrator.",
        )
    return user


# ── Role guard factory ────────────────────────────────────────────────────────
def role_required(*allowed_roles: UserRole):
    """
    Dependency factory that restricts an endpoint to specific roles.

    Usage::

        @router.get("/admin-only")
        async def admin_view(user: Annotated[User, Depends(role_required(UserRole.admin))]):
            ...
    """

    async def _check_role(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role not in allowed_roles:
            allowed = ", ".join(r.value for r in allowed_roles)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied. This endpoint requires one of these roles: {allowed}. "
                    f"Your current role is '{current_user.role.value}'."
                ),
            )
        return current_user

    return _check_role
