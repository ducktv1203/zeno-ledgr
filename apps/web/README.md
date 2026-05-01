# `apps/web` — ZenoLedgr frontend

Next.js App Router frontend for:
- Supabase Auth
- Client-side ZenoCrypto flow
- Dashboard with decrypted local view, refiner, and chart

## Run

From repo root:

```bash
pnpm --filter web dev
```

or from this directory:

```bash
pnpm dev
```

## Required env (`apps/web/.env.local`)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

If Supabase keys are missing, the dashboard shows a setup prompt.

## Important files

- `lib/crypto.ts` — PBKDF2 (600k) + AES-256-GCM utilities
- `components/dashboard-client.tsx` — auth, unlock, ingest/retrieve flow
- `lib/refiner.ts` + `data/merchant-wiki.json` — local merchant mapping
- `app/dev/crypto/page.tsx` — development round-trip crypto check

