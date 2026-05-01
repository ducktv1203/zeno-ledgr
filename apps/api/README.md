# `apps/api` — ZenoLedgr blind orchestrator

FastAPI backend for encrypted ledger blobs.

## Endpoints

- `GET /livez`
- `GET /readyz`
- `POST /crypto/init` — creates per-user non-secret PBKDF2 salt if missing
- `GET /crypto/salt` — returns existing user salt
- `POST /ingest` — stores `{ encrypted_blob, nonce }`
- `GET /retrieve?limit=50&cursor=<iso>` — returns paginated encrypted rows

## Local run

Create and activate a virtual environment:

```bash
python -m venv .venv
```

PowerShell:

```bash
.venv\Scripts\Activate.ps1
```

Install Python deps:

```bash
pip install -r requirements.txt
```

Create `.env` in this directory (or copy from `.env.example`):

```bash
# PowerShell
Copy-Item .env.example .env

# bash
cp .env.example .env
ENV=development
DATABASE_URL=postgresql://postgres:your-db-password@db.your-project-ref.supabase.co:5432/postgres?sslmode=require
SUPABASE_JWT_VERIFY_MODE=jwks
SUPABASE_JWKS_URL=https://your-project-ref.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_JWT_ISSUER=https://your-project-ref.supabase.co/auth/v1
SUPABASE_JWT_AUDIENCE=authenticated
SUPABASE_JWT_SECRET=
CORS_ORIGINS=http://localhost:3000
```

Start API:

```bash
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

From repo root you can also run:

```bash
pnpm run api:dev
```

## Notes

- JWT defaults to JWKS verification for Supabase cloud. For local legacy HS256 testing, set `SUPABASE_JWT_VERIFY_MODE=hs256` and provide `SUPABASE_JWT_SECRET`.
- API remains content-agnostic: it never stores plaintext merchant/amount/date fields.

