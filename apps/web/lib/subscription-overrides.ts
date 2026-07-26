"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import type { SubscriptionCadence } from "@/lib/detect-subscriptions";

/*
 * Detection is a heuristic, so the user gets the last word. Verdicts and
 * schedule edits stay in this browser and are never sent to the server.
 *
 *   dismissed  — never a subscription
 *   confirmed  — still paying, even though statements went quiet
 *   schedules  — overrides for cadence / previous due / next due / amount
 *   custom     — plans the user added by hand
 */

const STORAGE_KEY = "zenoledgr-subscription-overrides";
const CHANGE_EVENT = "zenoledgr:subscriptionoverrideschange";

export type SubscriptionSchedulePatch = {
  service?: string;
  amount?: string;
  stepDays?: number;
  cadence?: SubscriptionCadence;
  /** Previous due / last charge — preferred; next due is rolled from this. */
  lastChargeDate?: string;
  /** Set only when the user chooses next due instead of previous. */
  nextExpectedDate?: string;
};

export type CustomSubscription = {
  key: string;
  service: string;
  amount: string;
  stepDays: number;
  lastChargeDate: string;
};

type Overrides = {
  dismissed: string[];
  confirmed: string[];
  schedules: Record<string, SubscriptionSchedulePatch>;
  custom: CustomSubscription[];
};

const EMPTY: Overrides = { dismissed: [], confirmed: [], schedules: {}, custom: [] };

let cache: Overrides = EMPTY;
let cacheLoaded = false;

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((k): k is string => typeof k === "string") : [];
}

function asSchedulePatch(value: unknown): SubscriptionSchedulePatch | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const patch: SubscriptionSchedulePatch = {};
  if (typeof raw.service === "string") patch.service = raw.service;
  if (typeof raw.amount === "string") patch.amount = raw.amount;
  if (typeof raw.stepDays === "number" && Number.isFinite(raw.stepDays) && raw.stepDays > 0) {
    patch.stepDays = Math.round(raw.stepDays);
  }
  if (typeof raw.cadence === "string") patch.cadence = raw.cadence as SubscriptionCadence;
  if (typeof raw.lastChargeDate === "string") patch.lastChargeDate = raw.lastChargeDate;
  if (typeof raw.nextExpectedDate === "string") patch.nextExpectedDate = raw.nextExpectedDate;
  return Object.keys(patch).length > 0 ? patch : null;
}

function asCustom(value: unknown): CustomSubscription | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.key !== "string" ||
    typeof raw.service !== "string" ||
    typeof raw.amount !== "string" ||
    typeof raw.stepDays !== "number" ||
    typeof raw.lastChargeDate !== "string"
  ) {
    return null;
  }
  if (!(raw.stepDays > 0) || !raw.service.trim() || !raw.amount.trim()) return null;
  return {
    key: raw.key,
    service: raw.service.trim(),
    amount: raw.amount.trim(),
    stepDays: Math.round(raw.stepDays),
    lastChargeDate: raw.lastChargeDate,
  };
}

function isEmpty(next: Overrides): boolean {
  return (
    next.dismissed.length === 0 &&
    next.confirmed.length === 0 &&
    Object.keys(next.schedules).length === 0 &&
    next.custom.length === 0
  );
}

function load(): Overrides {
  if (cacheLoaded) return cache;
  if (typeof localStorage === "undefined") return EMPTY;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as Partial<Overrides>) : null;
    const schedules: Record<string, SubscriptionSchedulePatch> = {};
    if (parsed?.schedules && typeof parsed.schedules === "object") {
      for (const [key, value] of Object.entries(parsed.schedules)) {
        const patch = asSchedulePatch(value);
        if (patch) schedules[key] = patch;
      }
    }
    const custom = Array.isArray(parsed?.custom)
      ? parsed.custom.map(asCustom).filter((c): c is CustomSubscription => c !== null)
      : [];
    const next: Overrides = {
      dismissed: stringList(parsed?.dismissed),
      confirmed: stringList(parsed?.confirmed),
      schedules,
      custom,
    };
    cache = isEmpty(next) ? EMPTY : next;
  } catch {
    cache = EMPTY;
  }
  cacheLoaded = true;
  return cache;
}

function save(next: Overrides): void {
  cache = isEmpty(next) ? EMPTY : next;
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
  schedules: Record<string, SubscriptionSchedulePatch>;
  custom: CustomSubscription[];
  /** Not a subscription — hide it everywhere. */
  dismiss: (key: string) => void;
  /** Still paying for it — put it back on the calendar. */
  confirm: (key: string) => void;
  /** Forget the verdict and let detection decide again. */
  reset: (key: string) => void;
  resetAll: () => void;
  /** Patch cadence / previous due / amount for a detected or custom plan. */
  setSchedule: (key: string, patch: SubscriptionSchedulePatch) => void;
  clearSchedule: (key: string) => void;
  /** Add a hand-entered subscription (or replace one with the same key). */
  upsertCustom: (sub: CustomSubscription) => void;
  removeCustom: (key: string) => void;
};

export function useSubscriptionOverrides(): SubscriptionOverrides {
  const overrides = useSyncExternalStore(subscribe, load, () => EMPTY);

  const dismissed = useMemo(() => new Set(overrides.dismissed), [overrides]);
  const confirmed = useMemo(() => new Set(overrides.confirmed), [overrides]);

  // A key only ever holds one verdict, so each setter clears the other.
  const dismiss = useCallback((key: string) => {
    const current = load();
    save({
      ...current,
      dismissed: current.dismissed.includes(key) ? current.dismissed : [...current.dismissed, key],
      confirmed: without(current.confirmed, key),
    });
  }, []);

  const confirm = useCallback((key: string) => {
    const current = load();
    save({
      ...current,
      dismissed: without(current.dismissed, key),
      confirmed: current.confirmed.includes(key) ? current.confirmed : [...current.confirmed, key],
    });
  }, []);

  const reset = useCallback((key: string) => {
    const current = load();
    save({
      ...current,
      dismissed: without(current.dismissed, key),
      confirmed: without(current.confirmed, key),
    });
  }, []);

  const resetAll = useCallback(() => save(EMPTY), []);

  const setSchedule = useCallback((key: string, patch: SubscriptionSchedulePatch) => {
    const current = load();
    save({
      ...current,
      dismissed: without(current.dismissed, key),
      schedules: { ...current.schedules, [key]: { ...current.schedules[key], ...patch } },
    });
  }, []);

  const clearSchedule = useCallback((key: string) => {
    const current = load();
    const { [key]: _removed, ...schedules } = current.schedules;
    save({ ...current, schedules });
  }, []);

  const upsertCustom = useCallback((sub: CustomSubscription) => {
    const current = load();
    const withoutKey = current.custom.filter((c) => c.key !== sub.key);
    save({
      ...current,
      dismissed: without(current.dismissed, sub.key),
      confirmed: without(current.confirmed, sub.key),
      custom: [...withoutKey, sub],
    });
  }, []);

  const removeCustom = useCallback((key: string) => {
    const current = load();
    const { [key]: _removed, ...schedules } = current.schedules;
    save({
      ...current,
      custom: current.custom.filter((c) => c.key !== key),
      schedules,
      dismissed: without(current.dismissed, key),
      confirmed: without(current.confirmed, key),
    });
  }, []);

  return {
    dismissed,
    confirmed,
    schedules: overrides.schedules,
    custom: overrides.custom,
    dismiss,
    confirm,
    reset,
    resetAll,
    setSchedule,
    clearSchedule,
    upsertCustom,
    removeCustom,
  };
}
