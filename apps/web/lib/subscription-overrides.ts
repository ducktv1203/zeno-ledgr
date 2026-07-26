"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/*
 * Detection is a heuristic, so the user gets the last word. Dismissals are
 * keyed by the detector's stable bucket key and kept in this browser — they
 * are a display preference, not ledger data, and never reach the server.
 */

const STORAGE_KEY = "zenoledgr-subscription-overrides";
const CHANGE_EVENT = "zenoledgr:subscriptionoverrideschange";

type Overrides = { dismissed: string[] };

const EMPTY: Overrides = { dismissed: [] };

let cache: Overrides = EMPTY;
let cacheLoaded = false;

function load(): Overrides {
  if (cacheLoaded) return cache;
  if (typeof localStorage === "undefined") return EMPTY;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as Partial<Overrides>) : null;
    cache = Array.isArray(parsed?.dismissed)
      ? { dismissed: parsed.dismissed.filter((k): k is string => typeof k === "string") }
      : EMPTY;
  } catch {
    cache = EMPTY;
  }
  cacheLoaded = true;
  return cache;
}

function save(next: Overrides): void {
  cache = next;
  cacheLoaded = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode — the in-memory value still applies for this session.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function useSubscriptionOverrides(): {
  dismissed: Set<string>;
  dismiss: (key: string) => void;
  restore: (key: string) => void;
  restoreAll: () => void;
} {
  const overrides = useSyncExternalStore(subscribe, load, () => EMPTY);
  const dismissed = useMemo(() => new Set(overrides.dismissed), [overrides]);

  const dismiss = useCallback((key: string) => {
    const current = load();
    if (current.dismissed.includes(key)) return;
    save({ dismissed: [...current.dismissed, key] });
  }, []);

  const restore = useCallback((key: string) => {
    const current = load();
    save({ dismissed: current.dismissed.filter((k) => k !== key) });
  }, []);

  const restoreAll = useCallback(() => save(EMPTY), []);

  return { dismissed, dismiss, restore, restoreAll };
}
