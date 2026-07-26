"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import {
  SPEND_CATEGORIES,
  type SpendCategoryId,
} from "@/lib/spend-categories";

/*
 * Seed regex rules are a first guess. The user can reassign any merchant to a
 * category; that mapping wins forever (in this browser) and is never sent to
 * the server — same privacy model as subscription dismiss/confirm.
 */

const STORAGE_KEY = "zenoledgr-category-overrides";
const CHANGE_EVENT = "zenoledgr:categoryoverrideschange";

const VALID_IDS = new Set(SPEND_CATEGORIES.map((c) => c.id));

type Overrides = Record<string, SpendCategoryId>;

const EMPTY: Overrides = {};

let cache: Overrides = EMPTY;
let cacheLoaded = false;

function coerce(raw: unknown): Overrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY;
  const next: Overrides = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key === "string" && key && typeof value === "string" && VALID_IDS.has(value as SpendCategoryId)) {
      next[key] = value as SpendCategoryId;
    }
  }
  return Object.keys(next).length > 0 ? next : EMPTY;
}

function load(): Overrides {
  if (cacheLoaded) return cache;
  if (typeof localStorage === "undefined") return EMPTY;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    cache = stored ? coerce(JSON.parse(stored)) : EMPTY;
  } catch {
    cache = EMPTY;
  }
  cacheLoaded = true;
  return cache;
}

function save(next: Overrides): void {
  cache = Object.keys(next).length > 0 ? next : EMPTY;
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

export type CategoryOverrides = {
  /** merchantKey → category id */
  map: ReadonlyMap<string, SpendCategoryId>;
  setCategory: (merchantKey: string, category: SpendCategoryId) => void;
  /** Forget the override and fall back to seed rules. */
  clearCategory: (merchantKey: string) => void;
  resetAll: () => void;
};

export function useCategoryOverrides(): CategoryOverrides {
  const overrides = useSyncExternalStore(subscribe, load, () => EMPTY);

  const map = useMemo(() => new Map(Object.entries(overrides)), [overrides]);

  const setCategory = useCallback((merchantKey: string, category: SpendCategoryId) => {
    if (!merchantKey || !VALID_IDS.has(category)) return;
    const current = load();
    save({ ...current, [merchantKey]: category });
  }, []);

  const clearCategory = useCallback((merchantKey: string) => {
    if (!merchantKey) return;
    const current = load();
    if (!(merchantKey in current)) return;
    const next = { ...current };
    delete next[merchantKey];
    save(next);
  }, []);

  const resetAll = useCallback(() => save(EMPTY), []);

  return { map, setCategory, clearCategory, resetAll };
}
