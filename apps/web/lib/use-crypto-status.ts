"use client";

import { useSyncExternalStore } from "react";

import { isCryptoUnlocked, subscribeToCryptoStatus } from "@/lib/crypto";

/**
 * Live lock state. The key lives in module memory, so anything outside the
 * dashboard (the nav badge) has to subscribe rather than read once on mount.
 */
export function useCryptoUnlocked(): boolean {
  return useSyncExternalStore(
    subscribeToCryptoStatus,
    isCryptoUnlocked,
    () => false,
  );
}
