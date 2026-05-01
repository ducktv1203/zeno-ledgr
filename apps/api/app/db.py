import asyncpg

from app.config import settings

_pool: asyncpg.Pool | None = None


def _build_database_dsn() -> str:
    dsn = settings.database_url.strip()
    if not dsn:
        raise RuntimeError("DATABASE_URL must be set")
    if "sslmode=" not in dsn and "localhost" not in dsn and "127.0.0.1" not in dsn:
        separator = "&" if "?" in dsn else "?"
        dsn = f"{dsn}{separator}sslmode=require"
    return dsn


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        dsn = _build_database_dsn()
        _pool = await asyncpg.create_pool(
            dsn=dsn,
            min_size=settings.database_pool_min,
            max_size=settings.database_pool_max,
            timeout=settings.database_pool_timeout_seconds,
            command_timeout=settings.database_command_timeout_seconds,
        )
    return _pool


async def ping_database() -> bool:
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return True
    except Exception:
        return False


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
