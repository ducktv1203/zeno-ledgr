import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import ValidationError
from uuid import UUID

from app.config import settings

security = HTTPBearer(auto_error=False)
jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global jwks_client
    if jwks_client is None:
        if not settings.supabase_jwks_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="SUPABASE_JWKS_URL is not configured",
            )
        jwks_client = PyJWKClient(settings.supabase_jwks_url)
    return jwks_client


def _validate_sub_claim(payload: dict) -> str:
    sub = payload.get("sub")
    if not sub or not isinstance(sub, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        )
    try:
        UUID(sub)
    except (ValueError, ValidationError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        ) from e
    return sub


def decode_supabase_jwt(token: str) -> str:
    """Validate Supabase access token and return subject (user UUID)."""
    try:
        mode = settings.supabase_jwt_verify_mode.lower()
        if mode == "jwks":
            signing_key = _get_jwks_client().get_signing_key_from_jwt(token).key
            payload = jwt.decode(
                token,
                signing_key,
                algorithms=["RS256", "ES256"],
                audience=settings.supabase_jwt_audience,
                issuer=settings.supabase_jwt_issuer or None,
                options={"require": ["exp", "sub"]},
            )
        else:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience=settings.supabase_jwt_audience,
                options={"require": ["exp", "sub"]},
            )
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from e

    return _validate_sub_claim(payload)


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required",
        )
    return decode_supabase_jwt(credentials.credentials)
