from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models.admin import Admin
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.user import User, UserRole
from app.schemas.auth import (
    AdminRegisterRequest,
    LoginRequest,
    LoginResponse,
    StudentRegisterRequest,
    TeacherRegisterRequest,
)


class AuthService:
    @staticmethod
    async def register_student(
        db: AsyncSession, req: StudentRegisterRequest
    ) -> Student:
        # Check duplicate email
        existing_user = await db.execute(select(User).where(User.email == req.email))
        if existing_user.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        # Check duplicate register number
        existing_student = await db.execute(
            select(Student).where(Student.register_number == req.register_number)
        )
        if existing_student.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Register number already exists",
            )

        # Hash password and create User
        user = User(
            email=req.email,
            password_hash=hash_password(req.password),
            role=UserRole.student,
        )
        db.add(user)
        await db.flush()  # Populates user.id

        # Create Student profile
        student = Student(
            id=user.id,
            name=req.name,
            register_number=req.register_number,
            department=req.department,
            section=req.section,
            counsellor_id=req.counsellor_id,
            face_embedding=req.face_embedding,
        )
        db.add(student)
        await db.commit()
        await db.refresh(student)
        return student

    @staticmethod
    async def register_teacher(
        db: AsyncSession, req: TeacherRegisterRequest
    ) -> Teacher:
        # Check duplicate email
        existing_user = await db.execute(select(User).where(User.email == req.email))
        if existing_user.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        user = User(
            email=req.email,
            password_hash=hash_password(req.password),
            role=UserRole.teacher,
        )
        db.add(user)
        await db.flush()

        teacher = Teacher(
            id=user.id,
            name=req.name,
            department=req.department,
            position=req.position,
        )
        db.add(teacher)
        await db.commit()
        await db.refresh(teacher)
        return teacher

    @staticmethod
    async def register_admin(db: AsyncSession, req: AdminRegisterRequest) -> Admin:
        # Check duplicate email
        existing_user = await db.execute(select(User).where(User.email == req.email))
        if existing_user.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        user = User(
            email=req.email,
            password_hash=hash_password(req.password),
            role=UserRole.admin,
        )
        db.add(user)
        await db.flush()

        admin = Admin(
            id=user.id,
            name=req.name,
        )
        db.add(admin)
        await db.commit()
        await db.refresh(admin)
        return admin

    @staticmethod
    async def login(db: AsyncSession, req: LoginRequest) -> LoginResponse:
        # Fetch user
        result = await db.execute(select(User).where(User.email == req.email))
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found. Please register.",
            )

        if not verify_password(req.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password.",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is deactivated.",
            )

        # Generate tokens
        extra_claims = {"role": user.role.value, "email": user.email}
        access_token = create_access_token(str(user.id), extra_claims=extra_claims)
        refresh_token = create_refresh_token(str(user.id))

        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            role=user.role.value,
            user_id=user.id,
        )
