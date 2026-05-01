"use client";

import { useCallback, useState } from "react";
import wiki from "@/data/merchant-wiki.json";
import { apiIngest, apiRetrieve } from "@/lib/api";
import { decryptLedgerPayload, encryptLedgerPayload } from "@/lib/crypto";
import { refineMerchant } from "@/lib/refiner";
import type { DecryptedLedgerRow } from "@/lib/types";

export function useLedger(accessToken: string | null, encryptionActive: boolean) {
  const [rows, setRows] = useState<DecryptedLedgerRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadFirstPage = useCallback(async () => {
    if (!accessToken || !encryptionActive) return;
    setLoadingRows(true);
    setLoadError(null);
    try {
      const data = await apiRetrieve(accessToken, { limit: 50 });
      const decoded: DecryptedLedgerRow[] = [];
      for (const r of data.entries) {
        const plaintext = await decryptLedgerPayload(r.encrypted_blob, r.nonce);
        const refined = refineMerchant(plaintext.merchantRaw, wiki);
        decoded.push({
          id: r.id,
          createdAt: r.created_at,
          merchantRaw: plaintext.merchantRaw,
          merchantDisplay: refined.displayName,
          merchantMatched: refined.matched,
          amount: plaintext.amount,
          date: plaintext.date,
        });
      }
      setRows(decoded);
      setCursor(data.next_cursor);
      setHasMore(Boolean(data.next_cursor));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load ledger");
    } finally {
      setLoadingRows(false);
    }
  }, [accessToken, encryptionActive]);

  const loadNextPage = useCallback(async () => {
    if (!accessToken || !encryptionActive || !cursor) return;
    setLoadingRows(true);
    try {
      const data = await apiRetrieve(accessToken, { limit: 50, cursor });
      const decoded: DecryptedLedgerRow[] = [];
      for (const r of data.entries) {
        const plaintext = await decryptLedgerPayload(r.encrypted_blob, r.nonce);
        const refined = refineMerchant(plaintext.merchantRaw, wiki);
        decoded.push({
          id: r.id,
          createdAt: r.created_at,
          merchantRaw: plaintext.merchantRaw,
          merchantDisplay: refined.displayName,
          merchantMatched: refined.matched,
          amount: plaintext.amount,
          date: plaintext.date,
        });
      }
      setRows((prev) => [...prev, ...decoded]);
      setCursor(data.next_cursor);
      setHasMore(Boolean(data.next_cursor));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load more entries");
    } finally {
      setLoadingRows(false);
    }
  }, [accessToken, encryptionActive, cursor]);

  const addEntry = useCallback(
    async (payload: { merchantRaw: string; amount: string; date: string }) => {
      if (!accessToken || !encryptionActive) return;
      const encrypted = await encryptLedgerPayload(payload);
      await apiIngest(accessToken, encrypted);
      await loadFirstPage();
    },
    [accessToken, encryptionActive, loadFirstPage],
  );

  return {
    rows,
    loadError,
    loadingRows,
    hasMore,
    loadFirstPage,
    loadNextPage,
    addEntry,
  };
}

