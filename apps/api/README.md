# `apps/api` — ZenoLedgr blind orchestrator

FastAPI backend for encrypted ledger blobs.

## Endpoints

- `GET /health`
- `POST /crypto/init` — creates per-user non-secret PBKDF2 salt if missing
- `GET /crypto/salt` — returns existing user salt
- `POST /ingest` — stores `{ encrypted_blob, nonce }`
- `GET /retrieve` — returns encrypted rows for authenticated user

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
DATABASE_URL=postgresql://zenouser:zenopass@localhost:5432/zenoledgr
SUPABASE_JWT_SECRET=your-supabase-jwt-secret-from-project-settings
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

- JWT is validated using `SUPABASE_JWT_SECRET` (HS256 path in this MVP).
- API remains content-agnostic: it never stores plaintext merchant/amount/date fields.

