"use client";

import { useCallback, useState } from "react";
import wiki from "@/data/merchant-wiki.json";
import {
  apiCreateStatement,
  apiDeleteStatement,
  apiIngest,
  apiListStatements,
  apiRetrieve,
} from "@/lib/api";
import { decryptLedgerPayload, encryptLedgerPayload } from "@/lib/crypto";
import { isPlausiblePayment } from "@/lib/parse-statement";
import { refineMerchant } from "@/lib/refiner";
import type { DecryptedLedgerRow, StatementRow } from "@/lib/types";

const FETCH_PAGE = 200;

async function decodeEntries(
  entries: {
    id: string;
    encrypted_blob: string;
    nonce: string;
    created_at: string;
    statement_id?: string | null;
  }[],
): Promise<DecryptedLedgerRow[]> {
  const decoded: DecryptedLedgerRow[] = [];
  for (const r of entries) {
    const plaintext = await decryptLedgerPayload(r.encrypted_blob, r.nonce);
    if (!isPlausiblePayment(plaintext.merchantRaw, plaintext.amount, plaintext.date)) {
      continue;
    }
    const refined = refineMerchant(plaintext.merchantRaw, wiki);
    decoded.push({
      id: r.id,
      createdAt: r.created_at,
      merchantRaw: plaintext.merchantRaw,
      merchantDisplay: refined.displayName,
      merchantMatched: refined.matched,
      amount: plaintext.amount,
      date: plaintext.date,
      statementId: r.statement_id ?? null,
    });
  }
  return decoded;
}

export function useLedger(accessToken: string | null, encryptionActive: boolean) {
  const [rows, setRows] = useState<DecryptedLedgerRow[]>([]);
  const [statements, setStatements] = useState<StatementRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);

  const refreshStatements = useCallback(async () => {
    if (!accessToken) return;
    const list = await apiListStatements(accessToken);
    setStatements(list);
  }, [accessToken]);

  const loadFirstPage = useCallback(async () => {
    if (!accessToken || !encryptionActive) return;
    setLoadingRows(true);
    setLoadError(null);
    try {
      const all: DecryptedLedgerRow[] = [];
      let next: string | null = null;
      let guard = 0;
      do {
        const data = await apiRetrieve(accessToken, {
          limit: FETCH_PAGE,
          cursor: next,
        });
        all.push(...(await decodeEntries(data.entries)));
        next = data.next_cursor;
        guard += 1;
      } while (next && guard < 100);

      setRows(all);
      await refreshStatements();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load ledger");
    } finally {
      setLoadingRows(false);
    }
  }, [accessToken, encryptionActive, refreshStatements]);

  const addEntry = useCallback(
    async (payload: { merchantRaw: string; amount: string; date: string }) => {
      if (!accessToken || !encryptionActive) return;
      const encrypted = await encryptLedgerPayload(payload);
      await apiIngest(accessToken, encrypted);
      await loadFirstPage();
    },
    [accessToken, encryptionActive, loadFirstPage],
  );

  const addEntries = useCallback(
    async (
      payloads: { merchantRaw: string; amount: string; date: string }[],
      meta: { filename: string; pageCount?: number | null },
      onProgress?: (done: number, total: number) => void,
    ) => {
      if (!accessToken || !encryptionActive || payloads.length === 0) {
        return { imported: 0, statementId: null as string | null };
      }
      const statement = await apiCreateStatement(accessToken, {
        filename: meta.filename,
        page_count: meta.pageCount ?? null,
        payment_count: payloads.length,
      });
      let imported = 0;
      for (const payload of payloads) {
        const encrypted = await encryptLedgerPayload(payload);
        await apiIngest(accessToken, {
          ...encrypted,
          statement_id: statement.id,
        });
        imported += 1;
        onProgress?.(imported, payloads.length);
      }
      await loadFirstPage();
      return { imported, statementId: statement.id };
    },
    [accessToken, encryptionActive, loadFirstPage],
  );

  const removeStatement = useCallback(
    async (statementId: string) => {
      if (!accessToken) return;
      await apiDeleteStatement(accessToken, statementId);
      await loadFirstPage();
    },
    [accessToken, loadFirstPage],
  );

  return {
    rows,
    statements,
    loadError,
    loadingRows,
    loadFirstPage,
    addEntry,
    addEntries,
    removeStatement,
    refreshStatements,
  };
}
