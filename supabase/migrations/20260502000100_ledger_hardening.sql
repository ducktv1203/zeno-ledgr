ALTER TABLE public.ledger_entries
  ADD CONSTRAINT ledger_entries_encrypted_blob_length_check
    CHECK (char_length(encrypted_blob) BETWEEN 24 AND 16384),
  ADD CONSTRAINT ledger_entries_nonce_length_check
    CHECK (char_length(nonce) BETWEEN 12 AND 256);

CREATE INDEX IF NOT EXISTS ledger_entries_user_id_created_at_id_idx
  ON public.ledger_entries (user_id, created_at DESC, id DESC);

