-- Local Postgres (Docker) — no auth.users; API enforces user_id from JWT
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_crypto_meta (
  user_id UUID PRIMARY KEY,
  password_salt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  page_count INT,
  payment_count INT NOT NULL DEFAULT 0,
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS statements_user_id_created_at_idx
  ON public.statements (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  statement_id UUID REFERENCES public.statements (id) ON DELETE CASCADE,
  encrypted_blob TEXT NOT NULL,
  nonce TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ledger_entries_user_id_created_at_idx
  ON public.ledger_entries (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ledger_entries_statement_id_idx
  ON public.ledger_entries (statement_id);
