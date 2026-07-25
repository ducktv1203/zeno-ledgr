import type { DecryptedLedgerRow } from "@/lib/types";

export type SubscriptionCadence =
  | "weekly"
  | "fortnightly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "unknown";

export type DetectedSubscription = {
  service: string;
  amount: string;
  cadence: SubscriptionCadence;
  confidence: "high" | "medium" | "low";
  chargeCount: number;
  firstPurchaseDate: string;
  lastChargeDate: string;
  /** Next due date on or after today (recurrence rolled forward from statement history). */
  nextExpectedDate: string | null;
  /** Start of the billing period that contains today (previous due → next due). */
  currentPeriodStart: string | null;
  /** End of the current billing period (day before next due, inclusive). */
  currentPeriodEnd: string | null;
  /** Cadence step in days used for recurrence. */
  stepDays: number | null;
  rawMerchants: string[];
};

/** Merchants that are spending, not subscriptions — never list these here. */
const NEVER_SUBSCRIPTION =
  /\b(woolworths?|coles|aldi|iga|costco|afterpay?|zip\b|klarna|translink|queensland rail|citycat|ferry|uber\s*\*?trip|uber\s*eats|menulog|doordash|deliveroo|mcdonald|hungry jack|kfc|subway|bp\b|shell\b|7-eleven|7 eleven|parking|toll|atm\b|withdraw|transfer|osko|payid|salary|wage|payroll)\b/i;

/**
 * Known subscription brands → canonical id + display name.
 * Matching uses the raw bank string + display label.
 */
const SUBSCRIPTION_BRANDS: { id: string; name: string; match: RegExp }[] = [
  { id: "youtube", name: "YouTube", match: /youtube|yt\s*premium|google\s*\*?\s*youtu/i },
  { id: "netflix", name: "Netflix", match: /netflix/i },
  { id: "spotify", name: "Spotify", match: /spotify/i },
  { id: "disney", name: "Disney+", match: /disney\+?|disneyplus/i },
  { id: "adobe", name: "Adobe", match: /\badobe\b/i },
  { id: "amazon-prime", name: "Amazon Prime", match: /amazon\s*prime|prime\s*video|amzn.*prime/i },
  { id: "apple", name: "Apple", match: /apple\.com\/bill|apple\s*(music|tv|one|icloud)|itunes/i },
  { id: "microsoft", name: "Microsoft", match: /microsoft|xbox|office\s*365|microsoft\s*365/i },
  { id: "google-one", name: "Google One", match: /google\s*one|google\s*\*?\s*storage/i },
  { id: "dropbox", name: "Dropbox", match: /dropbox/i },
  { id: "notion", name: "Notion", match: /notion/i },
  { id: "openai", name: "OpenAI", match: /openai|chatgpt|claude\.ai/i },
  { id: "github", name: "GitHub", match: /github/i },
  { id: "icloud", name: "iCloud", match: /icloud/i },
  { id: "stan", name: "Stan", match: /\bstan\b/i },
  { id: "binge", name: "Binge", match: /\bbinge\b/i },
  { id: "optus", name: "Optus", match: /\boptus\b/i },
  { id: "telstra", name: "Telstra", match: /\btelstra\b/i },
  { id: "vodafone", name: "Vodafone", match: /vodafone/i },
];

function parseAmount(a: string): number {
  return Number.parseFloat(a.replace(/,/g, "")) || 0;
}

function dayMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Walk the recurrence forward from the last known charge until the next due
 * is on or after `asOf` (defaults to today). Statement history can be months
 * old — this keeps "next expected" in the current cycle.
 */
export function rollForwardExpected(
  lastChargeDate: string,
  stepDays: number,
  asOf: string = todayIso(),
): { nextDue: string; periodStart: string; periodEnd: string } {
  let due = addDays(lastChargeDate, stepDays);
  let guard = 0;
  while (dayMs(due) < dayMs(asOf) && guard < 600) {
    due = addDays(due, stepDays);
    guard += 1;
  }
  const periodStart = addDays(due, -stepDays);
  const periodEnd = addDays(due, -1);
  return { nextDue: due, periodStart, periodEnd };
}

/** Expected due dates that fall inside [rangeStart, rangeEnd] inclusive. */
export function expectedDatesInRange(
  sub: DetectedSubscription,
  rangeStart: string,
  rangeEnd: string,
): string[] {
  if (!sub.stepDays || !sub.lastChargeDate) return [];
  const step = sub.stepDays;
  let cursor = sub.lastChargeDate;
  let guard = 0;
  while (dayMs(cursor) > dayMs(rangeStart) && guard < 600) {
    cursor = addDays(cursor, -step);
    guard += 1;
  }
  while (dayMs(cursor) < dayMs(rangeStart) && guard < 800) {
    cursor = addDays(cursor, step);
    guard += 1;
  }
  const out: string[] = [];
  guard = 0;
  while (dayMs(cursor) <= dayMs(rangeEnd) && guard < 200) {
    out.push(cursor);
    cursor = addDays(cursor, step);
    guard += 1;
  }
  return out;
}

export function formatPeriod(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function cadenceFromGap(days: number): SubscriptionCadence {
  if (days >= 5 && days <= 10) return "weekly";
  if (days >= 11 && days <= 18) return "fortnightly";
  if (days >= 25 && days <= 36) return "monthly";
  if (days >= 80 && days <= 100) return "quarterly";
  if (days >= 350 && days <= 380) return "yearly";
  return "unknown";
}

function gapDaysForCadence(c: SubscriptionCadence): number | null {
  switch (c) {
    case "weekly":
      return 7;
    case "fortnightly":
      return 14;
    case "monthly":
      return 30;
    case "quarterly":
      return 91;
    case "yearly":
      return 365;
    default:
      return null;
  }
}

function amountsClose(a: number, b: number): boolean {
  if (a === 0 && b === 0) return true;
  const diff = Math.abs(a - b);
  return diff <= 0.51 || diff / Math.max(a, b) <= 0.08;
}

function resolveBrand(raw: string, display: string): { id: string; name: string } | null {
  const hay = `${raw} ${display}`;
  for (const brand of SUBSCRIPTION_BRANDS) {
    if (brand.match.test(hay)) return { id: brand.id, name: brand.name };
  }
  return null;
}

function genericKey(display: string, raw: string): string {
  return (display || raw)
    .toLowerCase()
    .replace(/\*+[a-z0-9]+/gi, " ")
    .replace(/\b(p|ref|txn|id|au|nz)\d+\b/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Detect subscriptions only — not groceries, transit, Afterpay, one-off shops.
 * Known brands (YouTube/Netflix/…) are grouped across bank-string variants.
 */
export function detectSubscriptions(rows: DecryptedLedgerRow[]): DetectedSubscription[] {
  type Bucket = {
    service: string;
    knownBrand: boolean;
    amounts: number[];
    dates: string[];
    raw: Set<string>;
  };

  const buckets = new Map<string, Bucket>();

  for (const row of rows) {
    const amount = parseAmount(row.amount);
    if (!(amount > 0) || !row.date) continue;

    const hay = `${row.merchantRaw} ${row.merchantDisplay}`;
    if (NEVER_SUBSCRIPTION.test(hay)) continue;

    const brand = resolveBrand(row.merchantRaw, row.merchantDisplay);
    const key = brand ? `brand:${brand.id}` : `gen:${genericKey(row.merchantDisplay, row.merchantRaw)}`;
    if (!brand && key.length < 6) continue;

    const service = brand?.name ?? row.merchantDisplay ?? row.merchantRaw;
    const existing = buckets.get(key);
    if (existing) {
      existing.amounts.push(amount);
      existing.dates.push(row.date);
      existing.raw.add(row.merchantRaw);
    } else {
      buckets.set(key, {
        service,
        knownBrand: Boolean(brand),
        amounts: [amount],
        dates: [row.date],
        raw: new Set([row.merchantRaw]),
      });
    }
  }

  const out: DetectedSubscription[] = [];

  for (const bucket of buckets.values()) {
    const chargeCount = bucket.amounts.length;
    const dates = [...bucket.dates].sort();
    const uniqueDates = [...new Set(dates)];
    const typicalAmount = median(bucket.amounts);
    const amountStable = bucket.amounts.every((a) => amountsClose(a, typicalAmount));

    const gaps: number[] = [];
    for (let i = 1; i < uniqueDates.length; i++) {
      const gap = Math.round((dayMs(uniqueDates[i]!) - dayMs(uniqueDates[i - 1]!)) / 86_400_000);
      if (gap > 0) gaps.push(gap);
    }
    const medGap = gaps.length ? median(gaps) : 0;
    const cadence = gaps.length ? cadenceFromGap(medGap) : "unknown";
    const gapStable =
      gaps.length > 0 && gaps.every((g) => Math.abs(g - medGap) <= Math.max(4, medGap * 0.25));

    // Strict gate: unknown merchants need clear recurrence. Known brands need 2+ charges
    // (or 1 charge only if we still want to hint — we require 2+ so groceries don't sneak in).
    const recurring =
      uniqueDates.length >= 2 && amountStable && cadence !== "unknown" && (gapStable || uniqueDates.length >= 3);

    if (!bucket.knownBrand && !recurring) continue;
    if (bucket.knownBrand && chargeCount < 2 && !recurring) continue;
    if (!amountStable && !bucket.knownBrand) continue;
    if (!bucket.knownBrand && cadence === "unknown") continue;

    let confidence: DetectedSubscription["confidence"] = "low";
    if (recurring && uniqueDates.length >= 3) confidence = "high";
    else if (recurring) confidence = "medium";
    else if (bucket.knownBrand && chargeCount >= 2 && amountStable) confidence = "medium";

    // Drop low-confidence generic (non-brand) noise entirely.
    if (!bucket.knownBrand && confidence === "low") continue;

    const resolvedCadence = cadence === "unknown" && bucket.knownBrand ? "monthly" : cadence;
    const step =
      gapDaysForCadence(resolvedCadence) ??
      (medGap > 0 ? Math.round(medGap) : bucket.knownBrand ? 30 : null);
    const last = uniqueDates[uniqueDates.length - 1]!;

    let nextExpectedDate: string | null = null;
    let currentPeriodStart: string | null = null;
    let currentPeriodEnd: string | null = null;
    if (step && (chargeCount >= 2 || bucket.knownBrand)) {
      const rolled = rollForwardExpected(last, step);
      nextExpectedDate = rolled.nextDue;
      currentPeriodStart = rolled.periodStart;
      currentPeriodEnd = rolled.periodEnd;
    }

    out.push({
      service: bucket.service,
      amount: typicalAmount.toFixed(2),
      cadence: resolvedCadence,
      confidence,
      chargeCount,
      firstPurchaseDate: uniqueDates[0]!,
      lastChargeDate: last,
      nextExpectedDate,
      currentPeriodStart,
      currentPeriodEnd,
      stepDays: step,
      rawMerchants: [...bucket.raw],
    });
  }

  return out.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 } as const;
    if (rank[a.confidence] !== rank[b.confidence]) return rank[a.confidence] - rank[b.confidence];
    return b.chargeCount - a.chargeCount;
  });
}

/** All ledger charges that belong to a detected subscription. */
export function rowsForSubscription(
  sub: DetectedSubscription,
  rows: DecryptedLedgerRow[],
): DecryptedLedgerRow[] {
  const raw = new Set(sub.rawMerchants.map((r) => r.toLowerCase()));
  const service = sub.service.toLowerCase();
  return rows
    .filter(
      (r) =>
        raw.has(r.merchantRaw.toLowerCase()) ||
        r.merchantDisplay.toLowerCase() === service ||
        r.merchantRaw.toLowerCase().includes(service),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** @deprecated use detectSubscriptions */
export const detectServices = detectSubscriptions;
