import { dateToIsoLocal, isoToLocalDate, todayIso } from "@/lib/dates";
import type { DecryptedLedgerRow } from "@/lib/types";

export type SubscriptionCadence =
  | "weekly"
  | "fortnightly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "unknown";

/**
 * `active` still bills on schedule; `lapsed` stopped long enough ago that the
 * recurrence is over — a service used for a few months last year, not a
 * standing charge to plan around.
 */
export type SubscriptionStatus = "active" | "lapsed";

export type DetectedSubscription = {
  /** Stable across reloads — used to remember what the user dismissed. */
  key: string;
  service: string;
  amount: string;
  cadence: SubscriptionCadence;
  confidence: "high" | "medium" | "low";
  status: SubscriptionStatus;
  /** Whole cycles missed since the last charge. 0 while on schedule. */
  cyclesMissed: number;
  /** Days between the last charge and the end of the imported history. */
  daysSinceLastCharge: number;
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
  /\b(woolworths?|coles|aldi|iga|costco|afterpay?|zip\b|klarna|translink|queensland rail|citycat|ferry|uber\s*\*?trip|uber\s*eats|menulog|doordash|deliveroo|mcdonald|hungry jack|kfc|subway|bp\b|shell\b|7-eleven|7 eleven|parking|toll|atm\b|withdraw|transfer|osko|payid|salary|wage|payroll|laundr\w*|laundromat|dry\s*clean|wash\s*(house|room|world|club)|restaurant|cafe|caf\u00e9|coffee|bakery|sushi|noodle|bar\s*&\s*grill|bottle\s*shop|liquor|pharmacy|chemist|hotel|motel|airbnb|qantas|jetstar|virgin\s*austral|taxi|cabcharge|bunnings|kmart|target|big\s*w|officeworks)\b/i;

/**
 * A charge only counts as recurring once the interval repeats this many times.
 * Two visits a month apart is a coincidence; three on the same day of the
 * month is a plan.
 */
const MIN_GENERIC_CHARGES = 3;

/** Cycles that may be missed before the recurrence is considered finished. */
const LAPSE_CYCLES = 2;

/** Slack on top of the missed cycles, for statements that arrive late. */
const LAPSE_GRACE_DAYS = 10;

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

export { dateToIsoLocal, isoToLocalDate, todayIso };

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
  // A lapsed recurrence has no next due, so it never reaches the calendar.
  if (!sub.stepDays || !sub.lastChargeDate || !sub.nextExpectedDate) return [];
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

function amountsClose(a: number, b: number, relative: number, absolute: number): boolean {
  if (a === 0 && b === 0) return true;
  const diff = Math.abs(a - b);
  return diff <= absolute || diff / Math.max(a, b) <= relative;
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((dayMs(toIso) - dayMs(fromIso)) / 86_400_000);
}

/**
 * Subscriptions bill on the same day each month; the date drifts a little for
 * weekends and short months, so allow a few days. Compared circularly so a
 * plan billed on the 31st still matches the 1st.
 */
function billingDayAligned(dates: string[]): boolean {
  const days = dates.map((iso) => Number(iso.slice(8, 10)));
  const base = days[0]!;
  return days.every((day) => {
    const raw = Math.abs(day - base);
    return Math.min(raw, 31 - raw) <= 3;
  });
}

/**
 * The end of the imported history, which is what staleness is measured
 * against. Judging against today alone would mark every subscription lapsed
 * whenever the whole ledger happens to be a few months old.
 */
export function dataHorizon(rows: { date: string }[], now: string = todayIso()): string {
  let latest = "";
  for (const row of rows) {
    if (row.date && row.date > latest) latest = row.date;
  }
  return !latest || latest > now ? now : latest;
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
 * The bucket a row belongs to. Shared by detection and charge lookup so the
 * two can never disagree about which charges back a subscription.
 */
export function subscriptionKeyForRow(row: DecryptedLedgerRow): string | null {
  const hay = `${row.merchantRaw} ${row.merchantDisplay}`;
  if (NEVER_SUBSCRIPTION.test(hay)) return null;

  const brand = resolveBrand(row.merchantRaw, row.merchantDisplay);
  if (brand) return `brand:${brand.id}`;

  const generic = genericKey(row.merchantDisplay, row.merchantRaw);
  return generic.length >= 3 ? `gen:${generic}` : null;
}

/**
 * Detect subscriptions only — not groceries, transit, Afterpay, one-off shops.
 * Known brands (YouTube/Netflix/…) are grouped across bank-string variants.
 *
 * Two questions decide every candidate:
 *   1. Is the pattern actually a plan? Unknown merchants must repeat at least
 *      three times, at an even interval, for the same amount, on the same
 *      billing day. A laundry used twice one month apart fails all but the
 *      first test.
 *   2. Is it still running? A recurrence that stopped several cycles back is
 *      reported as `lapsed` rather than projected into next month.
 */
export function detectSubscriptions(
  rows: DecryptedLedgerRow[],
  options: { asOf?: string } = {},
): DetectedSubscription[] {
  type Bucket = {
    key: string;
    service: string;
    knownBrand: boolean;
    amounts: number[];
    dates: string[];
    raw: Set<string>;
  };

  const asOf = options.asOf ?? dataHorizon(rows);
  const buckets = new Map<string, Bucket>();

  for (const row of rows) {
    const amount = parseAmount(row.amount);
    if (!(amount > 0) || !row.date) continue;

    const key = subscriptionKeyForRow(row);
    if (!key) continue;

    const brand = resolveBrand(row.merchantRaw, row.merchantDisplay);
    const service = brand?.name ?? row.merchantDisplay ?? row.merchantRaw;
    const existing = buckets.get(key);
    if (existing) {
      existing.amounts.push(amount);
      existing.dates.push(row.date);
      existing.raw.add(row.merchantRaw);
    } else {
      buckets.set(key, {
        key,
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
    const uniqueDates = [...new Set(bucket.dates)].sort();
    const typicalAmount = median(bucket.amounts);

    // Real plans bill the same figure to the cent; brands get room for a price rise.
    const amountsTight = bucket.amounts.every((a) => amountsClose(a, typicalAmount, 0.03, 0.25));
    const amountsLoose = bucket.amounts.every((a) => amountsClose(a, typicalAmount, 0.12, 1));

    const gaps: number[] = [];
    for (let i = 1; i < uniqueDates.length; i++) {
      const gap = daysBetween(uniqueDates[i - 1]!, uniqueDates[i]!);
      if (gap > 0) gaps.push(gap);
    }
    const medGap = gaps.length ? median(gaps) : 0;
    const cadence = gaps.length ? cadenceFromGap(medGap) : "unknown";

    const gapsRegular =
      gaps.length > 0 && gaps.every((g) => Math.abs(g - medGap) <= Math.max(3, medGap * 0.2));
    const needsBillingDay =
      cadence === "monthly" || cadence === "quarterly" || cadence === "yearly";
    const aligned = !needsBillingDay || billingDayAligned(uniqueDates);

    const qualifies = bucket.knownBrand
      ? uniqueDates.length >= 2 && amountsLoose
      : uniqueDates.length >= MIN_GENERIC_CHARGES &&
        cadence !== "unknown" &&
        gapsRegular &&
        amountsTight &&
        aligned;

    if (!qualifies) continue;

    let confidence: DetectedSubscription["confidence"] = "low";
    if (uniqueDates.length >= 3 && gapsRegular && aligned) confidence = "high";
    else if (uniqueDates.length >= 2 && (bucket.knownBrand || gapsRegular)) confidence = "medium";

    const resolvedCadence = cadence === "unknown" && bucket.knownBrand ? "monthly" : cadence;
    const step =
      gapDaysForCadence(resolvedCadence) ?? (medGap > 0 ? Math.round(medGap) : null);
    const last = uniqueDates[uniqueDates.length - 1]!;

    const daysSinceLastCharge = Math.max(0, daysBetween(last, asOf));
    const cyclesMissed = step ? Math.max(0, Math.floor(daysSinceLastCharge / step) - 1) : 0;
    const lapsed =
      step !== null && daysSinceLastCharge > step * LAPSE_CYCLES + LAPSE_GRACE_DAYS;

    // A finished recurrence has no next due — projecting one would put a
    // service you stopped using back on the calendar.
    let nextExpectedDate: string | null = null;
    let currentPeriodStart: string | null = null;
    let currentPeriodEnd: string | null = null;
    if (step && !lapsed) {
      const rolled = rollForwardExpected(last, step);
      nextExpectedDate = rolled.nextDue;
      currentPeriodStart = rolled.periodStart;
      currentPeriodEnd = rolled.periodEnd;
    }

    out.push({
      key: bucket.key,
      service: bucket.service,
      amount: typicalAmount.toFixed(2),
      cadence: resolvedCadence,
      confidence,
      status: lapsed ? "lapsed" : "active",
      cyclesMissed,
      daysSinceLastCharge,
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
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
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
  return rows
    .filter((row) => subscriptionKeyForRow(row) === sub.key)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** @deprecated use detectSubscriptions */
export const detectServices = detectSubscriptions;
