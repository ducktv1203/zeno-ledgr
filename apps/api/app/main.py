import secrets
import uuid
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, UUID4

from app.auth import get_current_user_id
from app.config import settings
from app.db import close_pool, get_pool, ping_database
from app.local_auth import router as local_auth_router

# --- Schemas (opaque blobs only; no amount/merchant fields) ---


class IngestBody(BaseModel):
    encrypted_blob: str = Field(..., min_length=24, max_length=16384)
    nonce: str = Field(..., min_length=12, max_length=256)
    statement_id: UUID4 | None = None


class LedgerRow(BaseModel):
    id: UUID4
    encrypted_blob: str
    nonce: str
    created_at: str
    statement_id: UUID4 | None = None


class IngestResponse(BaseModel):
    id: UUID4


class RetrieveResponse(BaseModel):
    entries: list[LedgerRow]
    next_cursor: str | None = None


class DeleteEntriesBody(BaseModel):
    """Bulk delete. Capped so one request cannot scan an unbounded id list."""

    ids: list[UUID4] = Field(..., min_length=1, max_length=5_000)


class DeleteEntriesResponse(BaseModel):
    deleted: int


class CreateStatementBody(BaseModel):
    filename: str = Field(..., min_length=1, max_length=512)
    page_count: int | None = Field(default=None, ge=0, le=10_000)
    payment_count: int = Field(default=0, ge=0, le=100_000)
    period_start: str | None = Field(default=None, max_length=10)
    period_end: str | None = Field(default=None, max_length=10)


class StatementRow(BaseModel):
    id: UUID4
    filename: str
    page_count: int | None
    payment_count: int
    period_start: str | None = None
    period_end: str | None = None
    created_at: str


class SaltResponse(BaseModel):
    password_salt: str


class InitSaltResponse(BaseModel):
    password_salt: str
    created: bool


def _iso_date(value: object) -> str | None:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()  # type: ignore[no-any-return]
    text = str(value)
    return text[:10] if text else None


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            ALTER TABLE public.statements
              ADD COLUMN IF NOT EXISTS period_start DATE,
              ADD COLUMN IF NOT EXISTS period_end DATE
            """
        )
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

app.include_router(local_auth_router)


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


@app.get("/statements", response_model=list[StatementRow])
async def list_statements(user_id: str = Depends(get_current_user_id)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, filename, page_count, payment_count, period_start, period_end, created_at
            FROM public.statements
            WHERE user_id = $1::uuid
            ORDER BY created_at DESC
            """,
            str(user_id),
        )
    return [
        StatementRow(
            id=r["id"],
            filename=r["filename"],
            page_count=r["page_count"],
            payment_count=r["payment_count"],
            period_start=_iso_date(r["period_start"]),
            period_end=_iso_date(r["period_end"]),
            created_at=r["created_at"].isoformat(),
        )
        for r in rows
    ]


@app.post("/statements", status_code=201, response_model=StatementRow)
async def create_statement(
    body: CreateStatementBody,
    user_id: str = Depends(get_current_user_id),
):
    pool = await get_pool()
    new_id = uuid.uuid4()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO public.statements (
              id, user_id, filename, page_count, payment_count, period_start, period_end
            )
            VALUES ($1, $2::uuid, $3, $4, $5, $6::date, $7::date)
            RETURNING id, filename, page_count, payment_count, period_start, period_end, created_at
            """,
            new_id,
            str(user_id),
            body.filename.strip()[:512],
            body.page_count,
            body.payment_count,
            body.period_start,
            body.period_end,
        )
    return StatementRow(
        id=row["id"],
        filename=row["filename"],
        page_count=row["page_count"],
        payment_count=row["payment_count"],
        period_start=_iso_date(row["period_start"]),
        period_end=_iso_date(row["period_end"]),
        created_at=row["created_at"].isoformat(),
    )


@app.delete("/statements/{statement_id}", status_code=204)
async def delete_statement(
    statement_id: UUID4,
    user_id: str = Depends(get_current_user_id),
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            """
            DELETE FROM public.statements
            WHERE id = $1 AND user_id = $2::uuid
            """,
            statement_id,
            str(user_id),
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Statement not found")
    return None


@app.post("/ingest", status_code=201, response_model=IngestResponse)
async def ingest(
    body: IngestBody,
    user_id: str = Depends(get_current_user_id),
) -> IngestResponse:
    pool = await get_pool()
    new_id = uuid.uuid4()
    async with pool.acquire() as conn:
        if body.statement_id is not None:
            owned = await conn.fetchrow(
                """
                SELECT id FROM public.statements
                WHERE id = $1 AND user_id = $2::uuid
                """,
                body.statement_id,
                str(user_id),
            )
            if owned is None:
                raise HTTPException(status_code=404, detail="Statement not found")
        await conn.execute(
            """
            INSERT INTO public.ledger_entries (id, user_id, statement_id, encrypted_blob, nonce)
            VALUES ($1, $2::uuid, $3, $4, $5)
            """,
            new_id,
            str(user_id),
            body.statement_id,
            body.encrypted_blob,
            body.nonce,
        )
    return IngestResponse(id=new_id)


@app.delete("/entries/{entry_id}", status_code=204)
async def delete_entry(
    entry_id: UUID4,
    user_id: str = Depends(get_current_user_id),
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            """
            DELETE FROM public.ledger_entries
            WHERE id = $1 AND user_id = $2::uuid
            """,
            entry_id,
            str(user_id),
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Entry not found")
    return None


@app.post("/entries/delete", response_model=DeleteEntriesResponse)
async def delete_entries(
    body: DeleteEntriesBody,
    user_id: str = Depends(get_current_user_id),
) -> DeleteEntriesResponse:
    """Clearing out a bad import row by row would be thousands of requests."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            """
            DELETE FROM public.ledger_entries
            WHERE user_id = $1::uuid AND id = ANY($2::uuid[])
            """,
            str(user_id),
            body.ids,
        )
    # asyncpg reports "DELETE <n>"; anything else means nothing matched.
    deleted = int(result.split()[1]) if result.startswith("DELETE ") else 0
    return DeleteEntriesResponse(deleted=deleted)


@app.get("/retrieve", response_model=RetrieveResponse)
async def retrieve(
    user_id: str = Depends(get_current_user_id),
    limit: int = 50,
    cursor: str | None = None,
    statement_id: UUID4 | None = None,
) -> RetrieveResponse:
    safe_limit = max(1, min(limit, 200))
    pool = await get_pool()
    async with pool.acquire() as conn:
        if cursor:
            try:
                datetime.fromisoformat(cursor.replace("Z", "+00:00"))
            except ValueError as e:
                raise HTTPException(status_code=400, detail="Invalid cursor") from e
            if statement_id is not None:
                rows = await conn.fetch(
                    """
                    SELECT id, encrypted_blob, nonce, created_at, statement_id
                    FROM public.ledger_entries
                    WHERE user_id = $1::uuid
                      AND statement_id = $2
                      AND created_at < ($3::text)::timestamptz
                    ORDER BY created_at DESC
                    LIMIT $4::int
                    """,
                    str(user_id),
                    statement_id,
                    cursor,
                    safe_limit + 1,
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT id, encrypted_blob, nonce, created_at, statement_id
                    FROM public.ledger_entries
                    WHERE user_id = $1::uuid
                      AND created_at < ($2::text)::timestamptz
                    ORDER BY created_at DESC
                    LIMIT $3::int
                    """,
                    str(user_id),
                    cursor,
                    safe_limit + 1,
                )
        else:
            if statement_id is not None:
                rows = await conn.fetch(
                    """
                    SELECT id, encrypted_blob, nonce, created_at, statement_id
                    FROM public.ledger_entries
                    WHERE user_id = $1::uuid AND statement_id = $2
                    ORDER BY created_at DESC
                    LIMIT $3::int
                    """,
                    str(user_id),
                    statement_id,
                    safe_limit + 1,
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT id, encrypted_blob, nonce, created_at, statement_id
                    FROM public.ledger_entries
                    WHERE user_id = $1::uuid
                    ORDER BY created_at DESC
                    LIMIT $2::int
                    """,
                    str(user_id),
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
            statement_id=r["statement_id"],
        )
        for r in page_rows
    ]
    next_cursor = page_rows[-1]["created_at"].isoformat() if has_more and page_rows else None
    return RetrieveResponse(entries=entries, next_cursor=next_cursor)
