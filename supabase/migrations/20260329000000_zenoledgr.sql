-- ZenoLedgr: blind ledger + per-user PBKDF2 salt (non-secret)
-- Requires Supabase auth.users

CREATE TABLE IF NOT EXISTS public.user_crypto_meta (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  password_salt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  encrypted_blob TEXT NOT NULL,
  nonce TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ledger_entries_user_id_created_at_idx
  ON public.ledger_entries (user_id, created_at DESC);

ALTER TABLE public.user_crypto_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

-- Users can read/write only their own rows (direct Supabase client / PostgREST)
CREATE POLICY "user_crypto_meta_select_own"
  ON public.user_crypto_meta FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_crypto_meta_insert_own"
  ON public.user_crypto_meta FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_crypto_meta_update_own"
  ON public.user_crypto_meta FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "ledger_entries_select_own"
  ON public.ledger_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "ledger_entries_insert_own"
  ON public.ledger_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ledger_entries_delete_own"
  ON public.ledger_entries FOR DELETE
  USING (auth.uid() = user_id);
