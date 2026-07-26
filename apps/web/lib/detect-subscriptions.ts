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
 * `active` bills on a clear schedule and is safe to put on the calendar.
 * `review` repeats enough to be worth asking about but not enough to assume —
 * the evidence is thin, the dates wander, or it stopped a while back.
 */
export type SubscriptionStatus = "active" | "review";

/** Why a candidate is waiting on the user. Drives the wording of the prompt. */
export type ReviewReason =
  /** Billed on a cycle, then went quiet for several cycles. */
  | "stopped"
  /** Too few charges yet — could be a plan, could be coincidence. */
  | "sparse"
  /** Repeats on time, but the charge is a different size each cycle. */
  | "amount"
  /** Repeats, but the gaps or billing day wander more than a plan should. */
  | "irregular";

export type DetectedSubscription = {
  /** Stable across reloads — used to remember what the user dismissed. */
  key: string;
  service: string;
  amount: string;
  cadence: SubscriptionCadence;
  confidence: "high" | "medium" | "low";
  status: SubscriptionStatus;
  reviewReason: ReviewReason | null;
  /** Typical days between charges, as observed. */
  medianGapDays: number | null;
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
  /*
   * YouTube Premium is billed by Google, and banks truncate the product name
   * aggressively. Google's own payments help lists `GOOGLE *GOOGLE` as the
   * YouTube Premium descriptor — not a typo. Match that exact form, but do not
   * steal `GOOGLE *Google Play` / Storage / Music / One.
   */
  {
    id: "youtube",
    name: "YouTube",
    match:
      /youtube|youtu\.?be|youtubeprem|yt\s*(premium|music|prem)|ytprem|google\s*\*?\s*youtu|\bgoogle\s*\*?\s*google(?:\s+(?:aus?|aud|sydney|melbourne|brisbane|perth|g\.co\S*))?\s*$/i,
  },
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
  { id: "openai", name: "OpenAI", match: /openai|chatgpt/i },
  { id: "anthropic", name: "Claude", match: /anthropic|claude\.ai/i },
  { id: "github", name: "GitHub", match: /github/i },
  { id: "icloud", name: "iCloud", match: /icloud/i },
  { id: "stan", name: "Stan", match: /\bstan\b/i },
  { id: "binge", name: "Binge", match: /\bbinge\b/i },
  { id: "kayo", name: "Kayo", match: /\bkayo\b/i },
  { id: "paramount", name: "Paramount+", match: /paramount\s*\+?/i },
  { id: "foxtel", name: "Foxtel", match: /foxtel/i },
  { id: "audible", name: "Audible", match: /audible/i },
  { id: "canva", name: "Canva", match: /\bcanva\b/i },
  { id: "figma", name: "Figma", match: /\bfigma\b/i },
  { id: "zoom", name: "Zoom", match: /\bzoom\.us\b|zoom\s*video/i },
  { id: "patreon", name: "Patreon", match: /patreon/i },
  { id: "twitch", name: "Twitch", match: /twitch/i },
  { id: "playstation", name: "PlayStation", match: /playstation|\bpsn\b|sony\s*interactive/i },
  { id: "nintendo", name: "Nintendo", match: /nintendo/i },
  { id: "linkedin", name: "LinkedIn", match: /linkedin/i },
  { id: "duolingo", name: "Duolingo", match: /duolingo/i },
  { id: "strava", name: "Strava", match: /strava/i },
  { id: "optus", name: "Optus", match: /\boptus\b/i },
  { id: "telstra", name: "Telstra", match: /\btelstra\b/i },
  { id: "vodafone", name: "Vodafone", match: /vodafone/i },
  // PayPal descriptors often read "PAYPAL *AMAYSIM" when mum's SIM is on PayPal.
  { id: "amaysim", name: "Amaysim", match: /amaysim/i },
  { id: "belong", name: "Belong", match: /\bbelong\b/i },
  { id: "aussie-broadband", name: "Aussie Broadband", match: /aussie\s*broadband/i },
  { id: "superloop", name: "Superloop", match: /superloop/i },
  { id: "tpg", name: "TPG", match: /\btpg\b/i },
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

/**
 * Apply the user's "yes, I still pay this" to a recurrence the detector called
 * finished. Statement history routinely stops months before today — importing
 * one old statement should not mean nothing is ever due again — so a confirmed
 * subscription gets its schedule projected forward like any other.
 */
export function reviveSubscription(sub: DetectedSubscription): DetectedSubscription {
  if (sub.status === "active" || !sub.stepDays) return sub;
  const rolled = rollForwardExpected(sub.lastChargeDate, sub.stepDays);
  return {
    ...sub,
    status: "active",
    reviewReason: null,
    nextExpectedDate: rolled.nextDue,
    currentPeriodStart: rolled.periodStart,
    currentPeriodEnd: rolled.periodEnd,
  };
}

export type SubscriptionGroups = {
  /** Billing now — drives the calendar, the count and the monthly total. */
  active: DetectedSubscription[];
  /** Went quiet; waiting on the user to say whether they still pay for it. */
  review: DetectedSubscription[];
  /** Struck off as ordinary spending. */
  removed: DetectedSubscription[];
};

/** Split detections by the detector's verdict and the user's, in that order. */
export function groupSubscriptions(
  subscriptions: DetectedSubscription[],
  overrides: { dismissed: Set<string>; confirmed: Set<string> },
): SubscriptionGroups {
  const groups: SubscriptionGroups = { active: [], review: [], removed: [] };

  for (const sub of subscriptions) {
    if (overrides.dismissed.has(sub.key)) groups.removed.push(sub);
    else if (sub.status === "active") groups.active.push(sub);
    else if (overrides.confirmed.has(sub.key)) groups.active.push(reviveSubscription(sub));
    else groups.review.push(sub);
  }
  return groups;
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

type Charge = { amount: number; date: string; raw: string };

/**
 * Prepaid telcos (Amaysim) and shared family plans dump many different amounts
 * under one merchant name: the real 28-day plan, a $1 card-auth hold, a small
 * top-up, and sometimes a second plan for a visiting parent. Clustering by
 * amount keeps those from collapsing into one nonsense "subscription" of $1.
 */
function clusterByAmount(charges: Charge[]): Charge[][] {
  const clusters: Charge[][] = [];
  const ordered = [...charges].sort((a, b) => a.amount - b.amount);

  for (const charge of ordered) {
    const hit = clusters.find((cluster) => {
      const centre = median(cluster.map((c) => c.amount));
      return amountsClose(charge.amount, centre, 0.08, 0.51);
    });
    if (hit) hit.push(charge);
    else clusters.push([charge]);
  }
  return clusters;
}

/** Amaysim (and friends) put a ~$1 pre-auth on the card — not a plan. */
function isCardAuthHold(cluster: Charge[]): boolean {
  const centre = median(cluster.map((c) => c.amount));
  return centre > 0 && centre <= 1.05;
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

/**
 * Bank descriptors for one merchant rarely match character for character:
 * "Hanaro Toowong Pty Ltd", "Hanaro Toowong Store 4" and "Hanaro Toowong" are
 * one shop. Keying on the first couple of meaningful words groups those while
 * keeping "City Council Rates" apart from "City Council Parking".
 */
const KEY_WORDS = 2;

/** Legal, retail and location padding that varies between charges. */
const KEY_NOISE =
  /^(pty|ltd|limited|inc|llc|corp|corporation|plc|co|group|holdings|store|shop|outlet|branch|au|aus|australia|nz|qld|nsw|vic|wa|sa|tas|act)$/;

function genericKey(display: string, raw: string): string {
  const words = (display || raw)
    .toLowerCase()
    .replace(/\*+[a-z0-9]+/gi, " ")
    .replace(/\b(p|ref|txn|id|au|nz)\d+\b/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word && !/^\d+$/.test(word) && !KEY_NOISE.test(word));

  return words.slice(0, KEY_WORDS).join(" ");
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
 * Candidates come out in two tiers rather than pass/fail, because silently
 * dropping the near-misses leaves a ledger full of payments and an empty
 * calendar with no explanation:
 *
 *   `active`  Strong evidence and still running — safe to schedule. An even
 *             interval, a steady amount, the same billing day, three charges
 *             deep (two for a brand we recognise).
 *   `review`  Repeats, but something is short of proof: only two charges, a
 *             wandering billing date, or a cycle that stopped a while ago.
 *             These are put to the user as a question instead of a guess.
 *
 * Anything that never repeats, or whose amount is all over the place, is not
 * a candidate at all.
 */
export function detectSubscriptions(
  rows: DecryptedLedgerRow[],
  options: { asOf?: string } = {},
): DetectedSubscription[] {
  type Bucket = {
    key: string;
    service: string;
    knownBrand: boolean;
    charges: Charge[];
  };

  const asOf = options.asOf ?? dataHorizon(rows);
  const buckets = new Map<string, Bucket>();

  for (const row of rows) {
    const amount = parseAmount(row.amount);
    if (!(amount > 0) || !row.date) continue;
    // Refunds / wages / money received are not subscription charges.
    if (row.flow === "in") continue;

    const key = subscriptionKeyForRow(row);
    if (!key) continue;

    const brand = resolveBrand(row.merchantRaw, row.merchantDisplay);
    const service = brand?.name ?? row.merchantDisplay ?? row.merchantRaw;
    const existing = buckets.get(key);
    const charge = { amount, date: row.date, raw: row.merchantRaw };
    if (existing) existing.charges.push(charge);
    else {
      buckets.set(key, {
        key,
        service,
        knownBrand: Boolean(brand),
        charges: [charge],
      });
    }
  }

  const out: DetectedSubscription[] = [];

  for (const bucket of buckets.values()) {
    /*
     * One merchant name ≠ one plan. Split by amount first so a $35 Amaysim
     * renewal is not averaged with a $1 card check and a second SIM for mum.
     */
    const clusters = clusterByAmount(bucket.charges).filter((cluster) => !isCardAuthHold(cluster));

    for (const cluster of clusters) {
      const amounts = cluster.map((c) => c.amount);
      const uniqueDates = [...new Set(cluster.map((c) => c.date))].sort();
      const typicalAmount = median(amounts);
      const chargeCount = cluster.length;

      const amountsTight = amounts.every((a) => amountsClose(a, typicalAmount, 0.03, 0.25));
      const amountsLoose = amounts.every((a) => amountsClose(a, typicalAmount, 0.12, 1));

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

      /*
       * A name we recognise is evidence in itself — one charge raises a
       * question, unless it is a tiny one-off crumb ($2.90 top-up, leftover
       * auth) that has never repeated. Unknown merchants need a repeated,
       * steady amount on a recognisable cycle.
       */
      const isCandidate = bucket.knownBrand
        ? uniqueDates.length >= 2 || (uniqueDates.length >= 1 && typicalAmount >= 5)
        : cadence !== "unknown" &&
          ((uniqueDates.length >= 2 && amountsTight) ||
            (uniqueDates.length >= MIN_GENERIC_CHARGES && gapsRegular && amountsLoose));

      if (!isCandidate) continue;

      const strongEvidence = bucket.knownBrand
        ? uniqueDates.length >= 2 && amountsLoose
        : uniqueDates.length >= MIN_GENERIC_CHARGES && gapsRegular && aligned && amountsTight;

      let confidence: DetectedSubscription["confidence"] = "low";
      if (uniqueDates.length >= 3 && gapsRegular && aligned) confidence = "high";
      else if (uniqueDates.length >= 2 && (bucket.knownBrand || gapsRegular)) confidence = "medium";

      const resolvedCadence = cadence === "unknown" && bucket.knownBrand ? "monthly" : cadence;
      // Prefer the observed gap (Amaysim renews every 28 days, not 30).
      const step =
        medGap > 0 && cadence !== "unknown"
          ? Math.round(medGap)
          : gapDaysForCadence(resolvedCadence) ?? (bucket.knownBrand ? 30 : null);
      const last = uniqueDates[uniqueDates.length - 1]!;

      const daysSinceLastCharge = Math.max(0, daysBetween(last, asOf));
      const cyclesMissed = step ? Math.max(0, Math.floor(daysSinceLastCharge / step) - 1) : 0;
      const lapsed =
        step !== null && daysSinceLastCharge > step * LAPSE_CYCLES + LAPSE_GRACE_DAYS;

      const enoughCharges = uniqueDates.length >= (bucket.knownBrand ? 2 : MIN_GENERIC_CHARGES);
      let reviewReason: ReviewReason | null = null;
      if (lapsed) reviewReason = "stopped";
      else if (!strongEvidence) {
        if (!enoughCharges) reviewReason = "sparse";
        else if (!amountsTight) reviewReason = "amount";
        else reviewReason = "irregular";
      }

      let nextExpectedDate: string | null = null;
      let currentPeriodStart: string | null = null;
      let currentPeriodEnd: string | null = null;
      if (step && !reviewReason) {
        const rolled = rollForwardExpected(last, step);
        nextExpectedDate = rolled.nextDue;
        currentPeriodStart = rolled.periodStart;
        currentPeriodEnd = rolled.periodEnd;
      }

      const amountKey = typicalAmount.toFixed(2);
      out.push({
        // Amount in the key so two Amaysim SIMs (yours + mum's) stay distinct.
        key: `${bucket.key}#${amountKey}`,
        service: bucket.service,
        amount: amountKey,
        cadence: resolvedCadence,
        confidence,
        status: reviewReason ? "review" : "active",
        reviewReason,
        medianGapDays: medGap > 0 ? Math.round(medGap) : null,
        cyclesMissed,
        daysSinceLastCharge,
        chargeCount,
        firstPurchaseDate: uniqueDates[0]!,
        lastChargeDate: last,
        nextExpectedDate,
        currentPeriodStart,
        currentPeriodEnd,
        stepDays: step,
        rawMerchants: [...new Set(cluster.map((c) => c.raw))],
      });
    }
  }

  return out.sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    const rank = { high: 0, medium: 1, low: 2 } as const;
    if (rank[a.confidence] !== rank[b.confidence]) return rank[a.confidence] - rank[b.confidence];
    return b.chargeCount - a.chargeCount;
  });
}

/** Merchant bucket without the `#amount` cluster suffix. */
export function subscriptionBaseKey(key: string): string {
  const hash = key.indexOf("#");
  return hash === -1 ? key : key.slice(0, hash);
}

/** All ledger charges that belong to a detected subscription. */
export function rowsForSubscription(
  sub: DetectedSubscription,
  rows: DecryptedLedgerRow[],
): DecryptedLedgerRow[] {
  const base = subscriptionBaseKey(sub.key);
  const target = parseAmount(sub.amount);
  return rows
    .filter((row) => {
      if (subscriptionKeyForRow(row) !== base) return false;
      // Keep charge history scoped to this amount cluster (your plan vs mum's).
      return amountsClose(parseAmount(row.amount), target, 0.08, 0.51);
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** @deprecated use detectSubscriptions */
export const detectServices = detectSubscriptions;
