export type ApiLedgerRow = {
  id: string;
  encrypted_blob: string;
  nonce: string;
  created_at: string;
};

export type RetrieveResponse = {
  entries: ApiLedgerRow[];
  next_cursor: string | null;
};

export type DecryptedLedgerRow = {
  id: string;
  createdAt: string;
  merchantRaw: string;
  merchantDisplay: string;
  merchantMatched: boolean;
  amount: string;
  date: string;
};

