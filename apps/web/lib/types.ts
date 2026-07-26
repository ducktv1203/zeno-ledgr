export type ApiLedgerRow = {
  id: string;
  encrypted_blob: string;
  nonce: string;
  created_at: string;
  statement_id?: string | null;
};

export type RetrieveResponse = {
  entries: ApiLedgerRow[];
  next_cursor: string | null;
};

export type StatementRow = {
  id: string;
  filename: string;
  page_count: number | null;
  payment_count: number;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
};

import type { CashFlow } from "@/lib/crypto";

export type DecryptedLedgerRow = {
  id: string;
  createdAt: string;
  merchantRaw: string;
  merchantDisplay: string;
  merchantMatched: boolean;
  amount: string;
  date: string;
  statementId: string | null;
  /** in = refund / wage / transfer received — never counted as spend. */
  flow: CashFlow;
};
