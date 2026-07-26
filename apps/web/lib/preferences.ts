"use client";

import { useCallback, useSyncExternalStore } from "react";

export type PaymentsView = "table" | "compact" | "list";
export type PaymentsPageSize = "25" | "50" | "100" | "all";

export type Preferences = {
  /** Default density for the payments table. */
  paymentsView: PaymentsView;
  paymentsPageSize: PaymentsPageSize;
  /** Show the untouched bank descriptor beneath the cleaned merchant name. */
  showRawDescriptors: boolean;
  /** Minutes of inactivity before the key is dropped from memory. 0 = never. */
  autoLockMinutes: number;
};

export const DEFAULT_PREFERENCES: Preferences = {
  paymentsView: "table",
  paymentsPageSize: "25",
  showRawDescriptors: false,
  autoLockMinutes: 15,
};

const STORAGE_KEY = "zenoledgr-preferences";
const CHANGE_EVENT = "zenoledgr:preferenceschange";

let cache: Preferences = DEFAULT_PREFERENCES;
let cacheLoaded = false;

function coerce(raw: unknown): Preferences {
  if (!raw || typeof raw !== "object") return DEFAULT_PREFERENCES;
  const value = raw as Partial<Preferences>;

  return {
    paymentsView: (["table", "compact", "list"] as const).includes(value.paymentsView as PaymentsView)
      ? (value.paymentsView as PaymentsView)
      : DEFAULT_PREFERENCES.paymentsView,
    paymentsPageSize: (["25", "50", "100", "all"] as const).includes(
      value.paymentsPageSize as PaymentsPageSize,
    )
      ? (value.paymentsPageSize as PaymentsPageSize)
      : DEFAULT_PREFERENCES.paymentsPageSize,
    showRawDescriptors:
      typeof value.showRawDescriptors === "boolean"
        ? value.showRawDescriptors
        : DEFAULT_PREFERENCES.showRawDescriptors,
    autoLockMinutes:
      typeof value.autoLockMinutes === "number" && value.autoLockMinutes >= 0
        ? value.autoLockMinutes
        : DEFAULT_PREFERENCES.autoLockMinutes,
  };
}

function load(): Preferences {
  if (cacheLoaded) return cache;
  if (typeof localStorage === "undefined") return DEFAULT_PREFERENCES;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    cache = stored ? coerce(JSON.parse(stored)) : DEFAULT_PREFERENCES;
  } catch {
    cache = DEFAULT_PREFERENCES;
  }
  cacheLoaded = true;
  return cache;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onExternalChange = () => listener();
  window.addEventListener(CHANGE_EVENT, onExternalChange);
  window.addEventListener("storage", onExternalChange);
  return () => {
    listeners.delete(listener);
    window.removeEventListener(CHANGE_EVENT, onExternalChange);
    window.removeEventListener("storage", onExternalChange);
  };
}

export function writePreferences(patch: Partial<Preferences>): void {
  cache = coerce({ ...load(), ...patch });
  cacheLoaded = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Private mode or a full quota — the in-memory value still applies.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function resetPreferences(): void {
  cache = DEFAULT_PREFERENCES;
  cacheLoaded = true;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore — defaults already applied in memory.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Server render always sees the defaults, so the first client paint matches and
 * stored values apply on the next tick.
 */
export function usePreferences(): {
  preferences: Preferences;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
} {
  const preferences = useSyncExternalStore(subscribe, load, () => DEFAULT_PREFERENCES);

  const setPreference = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      writePreferences({ [key]: value } as Partial<Preferences>);
    },
    [],
  );

  return { preferences, setPreference };
}
