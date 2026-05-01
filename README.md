# ZenoLedgr

The Zero-Knowledge Financial Truth.

ZenoLedgr is a privacy-first (PriFi) ledger MVP:
- Client-side encryption with native Web Crypto (`PBKDF2` + `AES-256-GCM`)
- Blind backend that stores only opaque encrypted blobs
- Supabase/Postgres schema with row-level security

## Monorepo layout

- `apps/web` — Next.js App Router frontend + shadcn-style UI
- `apps/api` — FastAPI service for `/ingest`, paginated `/retrieve`, and crypto salt endpoints
- `supabase/migrations` — SQL schema + RLS policies
- `docker` — local Postgres + API orchestration

## Prerequisites

- Node.js 20+
- pnpm 9+
- Python 3.11+
- Docker Desktop (optional, recommended for local DB/API stack)

## 1) Environment setup

Copy `.env.example` values into app-specific env files:

- `apps/web/.env.local`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_API_URL=http://localhost:8000`

- `apps/api/.env`
  - `DATABASE_URL`
  - `SUPABASE_JWT_VERIFY_MODE=jwks`
  - `SUPABASE_JWKS_URL`
  - `SUPABASE_JWT_ISSUER`
  - `SUPABASE_JWT_AUDIENCE`
  - `SUPABASE_JWT_SECRET` (optional HS256 fallback only)
  - `CORS_ORIGINS=http://localhost:3000`

## 2) Install dependencies

From repo root:

```bash
pnpm install
```

If your network is flaky and `pnpm` retries frequently, rerun the same command; it resumes from cache.

## 3) Start services

### Option A — Docker (Postgres + API)

```bash
docker compose -f docker/docker-compose.yml up --build
```

Then start web app in a separate terminal:

```bash
pnpm --filter web dev
```

### Option B — Mixed local (Docker Postgres, local API)

Start only Postgres:

```bash
docker compose -f docker/docker-compose.yml up postgres
```

Run API locally:

```bash
pnpm run api:dev
```

Run web:

```bash
pnpm --filter web dev
```

## 4) Apply DB schema

Run SQL in `supabase/migrations/20260329000000_zenoledgr.sql` against your Supabase DB.

For pure local Docker Postgres, `docker/init-local.sql` is auto-applied on first container init.

## 5) Verify

- Web: `http://localhost:3000`
- Auth routes: `http://localhost:3000/signin`, `/signup`, `/verify`
- Dashboard: `http://localhost:3000/dashboard` (protected)
- Crypto self-test page (dev only): `http://localhost:3000/dev/crypto`
- API liveness/readiness: `http://localhost:8000/livez`, `http://localhost:8000/readyz`

## Security model (MVP)

- Master password and derived AES key never leave the browser.
- AES key is kept in memory for the tab session.
- Backend stores only:
  - `encrypted_blob`
  - `nonce`
  - metadata (`id`, `user_id`, `created_at`)

