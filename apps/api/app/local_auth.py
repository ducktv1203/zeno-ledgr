from datetime import datetime, timedelta, timezone
from uuid import uuid4

import bcrypt
import jwt
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.config import settings
from app.db import get_pool

router = APIRouter(prefix="/auth", tags=["auth"])


class AuthBody(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("ascii")


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("ascii"))
    except ValueError:
        return False


def _issue_token(user_id: str, email: str) -> str:
    secret = settings.supabase_jwt_secret
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT secret is not configured (set SUPABASE_JWT_SECRET)",
        )
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "role": "authenticated",
        "aud": settings.supabase_jwt_audience or "authenticated",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=7)).timestamp()),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


@router.post("/signup", response_model=AuthResponse)
async def signup(body: AuthBody) -> AuthResponse:
    email = body.email.lower().strip()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=422, detail="Invalid email")
    pool = await get_pool()
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT id FROM public.app_users WHERE email = $1",
            email,
        )
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        user_id = uuid4()
        password_hash = _hash_password(body.password)
        await conn.execute(
            """
            INSERT INTO public.app_users (id, email, password_hash)
            VALUES ($1, $2, $3)
            """,
            user_id,
            email,
            password_hash,
        )

    token = _issue_token(str(user_id), email)
    return AuthResponse(access_token=token, user_id=str(user_id), email=email)


@router.post("/signin", response_model=AuthResponse)
async def signin(body: AuthBody) -> AuthResponse:
    email = body.email.lower().strip()
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, email, password_hash FROM public.app_users WHERE email = $1",
            email,
        )
    if row is None or not _verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = _issue_token(str(row["id"]), row["email"])
    return AuthResponse(access_token=token, user_id=str(row["id"]), email=row["email"])
