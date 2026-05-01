import secrets
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, UUID4

from app.auth import get_current_user_id
from app.config import settings
from app.db import close_pool, get_pool, ping_database

# --- Schemas (opaque blobs only; no amount/merchant fields) ---


class IngestBody(BaseModel):
    encrypted_blob: str = Field(..., min_length=24, max_length=16384)
    nonce: str = Field(..., min_length=12, max_length=256)


class LedgerRow(BaseModel):
    id: UUID4
    encrypted_blob: str
    nonce: str
    created_at: str


class IngestResponse(BaseModel):
    id: UUID4


class RetrieveResponse(BaseModel):
    entries: list[LedgerRow]
    next_cursor: str | None = None


class SaltResponse(BaseModel):
    password_salt: str


class InitSaltResponse(BaseModel):
    password_salt: str
    created: bool


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    yield
    await close_pool()


app = FastAPI(title="ZenoLedgr API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/livez")
async def livez() -> dict[str, str]:
    return {"status": "alive"}


@app.get("/readyz")
async def readyz() -> dict[str, str]:
    db_ok = await ping_database()
    if not db_ok:
        raise HTTPException(status_code=503, detail="Database not ready")
    return {"status": "ready"}


@app.get("/crypto/salt", response_model=SaltResponse)
async def get_crypto_salt(user_id: str = Depends(get_current_user_id)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT password_salt FROM public.user_crypto_meta WHERE user_id = $1",
            uuid.UUID(user_id),
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Crypto metadata not found; call POST /crypto/init first")
    return SaltResponse(password_salt=row["password_salt"])


@app.post("/crypto/init", response_model=InitSaltResponse)
async def init_crypto_salt(user_id: str = Depends(get_current_user_id)):
    """Create per-user PBKDF2 salt (non-secret) if missing."""
    pool = await get_pool()
    raw = secrets.token_bytes(16)
    import base64

    salt_b64 = base64.b64encode(raw).decode("ascii")

    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT password_salt FROM public.user_crypto_meta WHERE user_id = $1",
            uuid.UUID(user_id),
        )
        if existing:
            return InitSaltResponse(password_salt=existing["password_salt"], created=False)

        await conn.execute(
            """
            INSERT INTO public.user_crypto_meta (user_id, password_salt)
            VALUES ($1, $2)
            """,
            uuid.UUID(user_id),
            salt_b64,
        )

    return InitSaltResponse(password_salt=salt_b64, created=True)


@app.post("/ingest", status_code=201, response_model=IngestResponse)
async def ingest(
    body: IngestBody,
    user_id: str = Depends(get_current_user_id),
) -> IngestResponse:
    pool = await get_pool()
    new_id = uuid.uuid4()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO public.ledger_entries (id, user_id, encrypted_blob, nonce)
            VALUES ($1, $2, $3, $4)
            """,
            new_id,
            uuid.UUID(user_id),
            body.encrypted_blob,
            body.nonce,
        )
    return IngestResponse(id=new_id)


@app.get("/retrieve", response_model=RetrieveResponse)
async def retrieve(
    user_id: str = Depends(get_current_user_id),
    limit: int = 50,
    cursor: str | None = None,
) -> RetrieveResponse:
    safe_limit = max(1, min(limit, 200))
    pool = await get_pool()
    async with pool.acquire() as conn:
        if cursor:
            rows = await conn.fetch(
                """
                SELECT id, encrypted_blob, nonce, created_at
                FROM public.ledger_entries
                WHERE user_id = $1 AND created_at < $2::timestamptz
                ORDER BY created_at DESC
                LIMIT $3
                """,
                uuid.UUID(user_id),
                cursor,
                safe_limit + 1,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT id, encrypted_blob, nonce, created_at
                FROM public.ledger_entries
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2
                """,
                uuid.UUID(user_id),
                safe_limit + 1,
            )
    has_more = len(rows) > safe_limit
    page_rows = rows[:safe_limit]
    entries = [
        LedgerRow(
            id=r["id"],
            encrypted_blob=r["encrypted_blob"],
            nonce=r["nonce"],
            created_at=r["created_at"].isoformat(),
        )
        for r in page_rows
    ]
    next_cursor = page_rows[-1]["created_at"].isoformat() if has_more and page_rows else None
    return RetrieveResponse(entries=entries, next_cursor=next_cursor)
