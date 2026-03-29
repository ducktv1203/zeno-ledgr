-- Local Postgres (Docker) — no auth.users; API enforces user_id from JWT
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.user_crypto_meta (
  user_id UUID PRIMARY KEY,
  password_salt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  encrypted_blob TEXT NOT NULL,
  nonce TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ledger_entries_user_id_created_at_idx
  ON public.ledger_entries (user_id, created_at DESC);
