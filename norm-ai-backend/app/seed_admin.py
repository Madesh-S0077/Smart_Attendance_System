"""
seed_admin.py — Creates the default administrator account.
Run once after `alembic upgrade head`:
    python -m app.seed_admin
"""
import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.admin import Admin


ADMIN_EMAIL    = "admin@rmkec.ac.in"
ADMIN_PASSWORD = "AdminPassword123!"
ADMIN_NAME     = "System Administrator"


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        # Check if already exists
        result = await db.execute(select(User).where(User.email == ADMIN_EMAIL))
        existing = result.scalar_one_or_none()
        if existing:
            print(f"[OK] Admin already exists: {ADMIN_EMAIL}")
            return

        # Create User row
        user = User(
            email=ADMIN_EMAIL,
            password_hash=hash_password(ADMIN_PASSWORD),
            role=UserRole.admin,
            is_active=True,
        )
        db.add(user)
        await db.flush()  # get user.id before creating Admin

        # Create Admin profile row
        admin = Admin(id=user.id, name=ADMIN_NAME)
        db.add(admin)

        await db.commit()
        print(f"[OK] Admin created successfully!")
        print(f"   Email   : {ADMIN_EMAIL}")
        print(f"   Password: {ADMIN_PASSWORD}")
        print(f"   Role    : admin")


if __name__ == "__main__":
    asyncio.run(seed())
