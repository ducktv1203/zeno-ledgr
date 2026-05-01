# `apps/web` — ZenoLedgr frontend

Next.js App Router frontend for:
- Supabase Auth
- Client-side ZenoCrypto flow
- Route-based auth/onboarding + app shell
- Dashboard with decrypted local view, refiner, chart, and pagination

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

## Routes

- `/signin` — sign in flow
- `/signup` — account creation with confirm-password
- `/verify` — post-signup email confirmation guidance
- `/dashboard` — protected app dashboard
- `/settings` — protected settings/security surface

## Important files

- `lib/crypto.ts` — PBKDF2 (600k) + AES-256-GCM utilities
- `features/auth/*` — sign-in/sign-up forms and auth client hooks
- `features/ledger/*` — dashboard module and paginated ledger hook
- `lib/api.ts` + `lib/types.ts` — typed backend API contract
- `lib/refiner.ts` + `data/merchant-wiki.json` — local merchant mapping
- `app/dev/crypto/page.tsx` — development round-trip crypto check

