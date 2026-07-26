"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/*
 * Detection is a heuristic, so the user gets the last word. Two verdicts are
 * remembered: `dismissed` (never a subscription) and `confirmed` (still paying
 * for it, even though the statements stop). Both are keyed by the detector's
 * stable bucket key, kept in this browser, and never sent to the server.
 */

const STORAGE_KEY = "zenoledgr-subscription-overrides";
const CHANGE_EVENT = "zenoledgr:subscriptionoverrideschange";

type Overrides = { dismissed: string[]; confirmed: string[] };

const EMPTY: Overrides = { dismissed: [], confirmed: [] };

let cache: Overrides = EMPTY;
let cacheLoaded = false;

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((k): k is string => typeof k === "string") : [];
}

function load(): Overrides {
  if (cacheLoaded) return cache;
  if (typeof localStorage === "undefined") return EMPTY;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as Partial<Overrides>) : null;
    const next = {
      dismissed: stringList(parsed?.dismissed),
      confirmed: stringList(parsed?.confirmed),
    };
    cache = next.dismissed.length || next.confirmed.length ? next : EMPTY;
  } catch {
    cache = EMPTY;
  }
  cacheLoaded = true;
  return cache;
}

function save(next: Overrides): void {
  cache = next.dismissed.length || next.confirmed.length ? next : EMPTY;
  cacheLoaded = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
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

function without(list: string[], key: string): string[] {
  return list.filter((k) => k !== key);
}

export type SubscriptionOverrides = {
  dismissed: Set<string>;
  confirmed: Set<string>;
  /** Not a subscription — hide it everywhere. */
  dismiss: (key: string) => void;
  /** Still paying for it — put it back on the calendar. */
  confirm: (key: string) => void;
  /** Forget the verdict and let detection decide again. */
  reset: (key: string) => void;
  resetAll: () => void;
};

export function useSubscriptionOverrides(): SubscriptionOverrides {
  const overrides = useSyncExternalStore(subscribe, load, () => EMPTY);

  const dismissed = useMemo(() => new Set(overrides.dismissed), [overrides]);
  const confirmed = useMemo(() => new Set(overrides.confirmed), [overrides]);

  // A key only ever holds one verdict, so each setter clears the other.
  const dismiss = useCallback((key: string) => {
    const current = load();
    save({
      dismissed: current.dismissed.includes(key) ? current.dismissed : [...current.dismissed, key],
      confirmed: without(current.confirmed, key),
    });
  }, []);

  const confirm = useCallback((key: string) => {
    const current = load();
    save({
      dismissed: without(current.dismissed, key),
      confirmed: current.confirmed.includes(key) ? current.confirmed : [...current.confirmed, key],
    });
  }, []);

  const reset = useCallback((key: string) => {
    const current = load();
    save({ dismissed: without(current.dismissed, key), confirmed: without(current.confirmed, key) });
  }, []);

  const resetAll = useCallback(() => save(EMPTY), []);

  return { dismissed, confirmed, dismiss, confirm, reset, resetAll };
}
