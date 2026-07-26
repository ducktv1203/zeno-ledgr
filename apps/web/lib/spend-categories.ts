import type { DecryptedLedgerRow } from "@/lib/types";

/**
 * Where money goes — coarse AU personal-spend buckets.
 * Matched client-side from merchant text; nothing is stored encrypted.
 */
export type SpendCategoryId =
  | "groceries"
  | "dining"
  | "transport"
  | "entertainment"
  | "software"
  | "phone"
  | "shopping"
  | "utilities"
  | "health"
  | "transfers"
  | "income"
  | "other";

export type SpendCategory = {
  id: SpendCategoryId;
  label: string;
  /** Short hint under the label in the analysis list. */
  hint: string;
  /** Outflow categories roll into "spent"; income/transfers sit aside. */
  kind: "spend" | "income" | "transfer";
};

export const SPEND_CATEGORIES: SpendCategory[] = [
  { id: "groceries", label: "Groceries", hint: "Supermarkets and pantry", kind: "spend" },
  { id: "dining", label: "Food & drink", hint: "Cafés, takeaway, delivery", kind: "spend" },
  { id: "transport", label: "Transport", hint: "Fuel, rides, transit", kind: "spend" },
  {
    id: "entertainment",
    label: "Entertainment",
    hint: "Streaming and media",
    kind: "spend",
  },
  { id: "software", label: "Apps & software", hint: "Cloud, tools, app stores", kind: "spend" },
  { id: "phone", label: "Phone & internet", hint: "Mobile and broadband", kind: "spend" },
  { id: "shopping", label: "Shopping", hint: "Retail and marketplaces", kind: "spend" },
  { id: "utilities", label: "Bills & utilities", hint: "Power, water, rates", kind: "spend" },
  { id: "health", label: "Health", hint: "Pharmacy, medical, fitness", kind: "spend" },
  { id: "transfers", label: "Transfers out", hint: "Sent to people, ATM, BNPL", kind: "transfer" },
  { id: "income", label: "Money in", hint: "Salary, refunds, transfers received", kind: "income" },
  { id: "other", label: "Other", hint: "Uncategorised spend", kind: "spend" },
];

const BY_ID = new Map(SPEND_CATEGORIES.map((c) => [c.id, c]));

export function categoryMeta(id: SpendCategoryId): SpendCategory {
  return BY_ID.get(id) ?? BY_ID.get("other")!;
}

/**
 * Stable key for merchant → category overrides. Prefer the cleaned display
 * name so every Woolworths row shares one mapping.
 */
export function categoryMerchantKey(
  row: Pick<DecryptedLedgerRow, "merchantRaw" | "merchantDisplay"> | { name: string },
): string {
  const label =
    "name" in row
      ? row.name
      : row.merchantDisplay || row.merchantRaw || "unknown";
  return label.toLowerCase().replace(/\s+/g, " ").trim() || "unknown";
}

type Rule = { category: SpendCategoryId; match: RegExp };

/**
 * First match wins. Keep specifics (Uber Eats, YouTube) ahead of broad tokens
 * (Uber, Google). Tuned for CommBank / AU merchant descriptors.
 */
/** Text that almost always means money arrived (credits), not a purchase. */
const MONEY_IN_HINT =
  /\b(refund|reimburs|cashback|direct\s*credit|salary|wage|payroll|pay\s*centre|paycentre|employer|centrelink|ato\s*refund|interest\s*(credited|earned)|dividend|deposit\b|transfer\s*from|received\s*from|incoming|credit\s*from|payment\s*received|funds?\s*received)\b/i;

/**
 * When the statement row has no stored debit/credit flag (older imports),
 * guess from the descriptor so refunds don't inflate spend.
 */
export function inferCashFlow(
  row: Pick<DecryptedLedgerRow, "merchantRaw" | "merchantDisplay" | "flow">,
): "in" | "out" {
  if (row.flow === "in" || row.flow === "out") return row.flow;
  const hay = `${row.merchantDisplay} ${row.merchantRaw}`;
  return MONEY_IN_HINT.test(hay) ? "in" : "out";
}

const RULES: Rule[] = [
  // Money in — salary, refunds, transfers received (never "spend").
  {
    category: "income",
    match: MONEY_IN_HINT,
  },

  // Money sent elsewhere / cash out — not grocery spend, but also not "in".
  {
    category: "transfers",
    match:
      /\b(osko|payid|transfer\s*to|tfr\s*to|netbank\s*transfer|commbank\s*app|afterpay|zip\s*pay|zipmoney|klarna|humm\b|atm\b|withdraw|cash\s*out)\b/i,
  },

  // Groceries
  {
    category: "groceries",
    match:
      /\b(woolworths|woolies|coles\b|aldi\b|iga\b|costco|whole\s*foods|wholefds|harris\s*farm|foodworks|drakes|spudshed|asian\s*grocery|grocery)\b/i,
  },

  // Dining / delivery (before bare Uber)
  {
    category: "dining",
    match:
      /\b(uber\s*eats|menulog|doordash|deliveroo|starbucks|mcdonald|maccas|hungry\s*jack|kfc\b|subway|guzman|grill.?d|nandos|domino|pizza\s*hut|crust\s*pizza|cafe|caf[eé]|coffee|bakery|restaurant|sushi|noodle|thai\b|indian\b|chinese\b|bar\s*&\s*grill|bottle\s*shop|liquor|pub\b|hotel\s+motel)\b/i,
  },

  // Transport
  {
    category: "transport",
    match:
      /\b(uber\s*\*?trip|uber\b|ola\b|didi\b|taxi|cabcharge|translink|queensland\s*rail|citycat|ferry|opaltop|myki|transport\s*nsw|bp\b|shell\b|caltex|ampol|7-eleven|7\s*eleven|parking|toll\b|linkt|e-?toll|jetstar|qantas|virgin\s*austral|rex\s*air)\b/i,
  },

  // Entertainment / streaming
  {
    category: "entertainment",
    match:
      /\b(youtube|yt\s*prem|ytprem|netflix|spotify|disney|stan\b|binge|paramount|apple\s*tv|prime\s*video|amazon\s*prime|steam\b|playstation|xbox\s*live|nintendo|patreon|twitch)\b/i,
  },

  // Software / cloud / app stores
  {
    category: "software",
    match:
      /\b(adobe|microsoft|google\s*play|google\s*storage|google\s*one|google\s*music|icloud|apple\.com\/bill|apple\s*com\/bill|dropbox|notion|slack|github|openai|chatgpt|anthropic|cursor\.|jetbrains|1password|lastpass|canva|zoom\.us|linkedin\s*prem)\b/i,
  },

  // Phone / internet
  {
    category: "phone",
    match:
      /\b(amaysim|telstra|optus|vodafone|belong|boost\s*mobile|aldi\s*mobile|circles\.?life|spintel|tpg\b|iinet|aussie\s*broadband|exetel|lebara|kogan\s*mobile)\b/i,
  },

  // Shopping / retail
  {
    category: "shopping",
    match:
      /\b(amazon|amzn\b|ebay|kmart|target\b|big\s*w|bunnings|officeworks|jb\s*hi|harvey\s*norman|the\s*iconic|asos|shein|temu|catch\.com|myer\b|david\s*jones|cotton\s*on|uniqlo|zara\b|h&m|sephora|mecca)\b/i,
  },

  // Utilities / bills
  {
    category: "utilities",
    match:
      /\b(origin\s*energy|agl\b|energyaustralia|red\s*energy|alinta|simply\s*energy|urban\s*utilities|sydney\s*water|seqwater|council\s*rates|city\s*council|insurance|nrma|aami|allianz|budget\s*direct|youi\b|suncorp\s*ins)\b/i,
  },

  // Health
  {
    category: "health",
    match:
      /\b(pharmacy|chemist\s*warehouse|chemist|priceline|terrywhite|terry\s*white|medicare|bupa|medibank|nib\b|hcf\b|dental|dentist|physio|optometrist|specsavers|fitness|gym\b|anytime\s*fitness|f45\b|goodlife)\b/i,
  },
];

/** Seed-rule guess only — ignores user overrides. */
export function categorizePaymentByRules(
  row: Pick<DecryptedLedgerRow, "merchantRaw" | "merchantDisplay">,
): SpendCategoryId {
  const hay = `${row.merchantDisplay} ${row.merchantRaw}`.trim();
  if (!hay) return "other";
  for (const rule of RULES) {
    if (rule.match.test(hay)) return rule.category;
  }
  return "other";
}

/**
 * Resolve category: money-in → Income; else user override → seed rules → other.
 * Refunds and transfers received must never land in groceries / other spend.
 */
export function categorizePayment(
  row: Pick<DecryptedLedgerRow, "merchantRaw" | "merchantDisplay" | "flow">,
  overrides?: ReadonlyMap<string, SpendCategoryId> | null,
): SpendCategoryId {
  if (inferCashFlow(row) === "in") return "income";
  const key = categoryMerchantKey(row);
  const overridden = overrides?.get(key);
  if (overridden) return overridden;
  return categorizePaymentByRules(row);
}

export type CategoryMerchant = {
  name: string;
  key: string;
  total: number;
  count: number;
  /** True when this merchant has a saved override. */
  overridden: boolean;
};

export type CategorySlice = {
  id: SpendCategoryId;
  label: string;
  hint: string;
  kind: SpendCategory["kind"];
  total: number;
  count: number;
  /** Share of outflow spend (0–1). Income/transfer slices use 0. */
  share: number;
  merchants: CategoryMerchant[];
};

export type SpendBreakdown = {
  slices: CategorySlice[];
  spendTotal: number;
  incomeTotal: number;
  transferTotal: number;
  spendCount: number;
};

/** Aggregate visible ledger rows into category slices (biggest spend first). */
export function buildSpendBreakdown(
  rows: DecryptedLedgerRow[],
  overrides?: ReadonlyMap<string, SpendCategoryId> | null,
): SpendBreakdown {
  type Acc = {
    total: number;
    count: number;
    merchants: Map<string, { name: string; total: number; count: number; overridden: boolean }>;
  };

  const byCat = new Map<SpendCategoryId, Acc>();

  for (const row of rows) {
    const amount = Number.parseFloat(row.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const key = categoryMerchantKey(row);
    const id = categorizePayment(row, overrides);
    const merchant = row.merchantDisplay || row.merchantRaw || "Unknown";
    let acc = byCat.get(id);
    if (!acc) {
      acc = { total: 0, count: 0, merchants: new Map() };
      byCat.set(id, acc);
    }
    acc.total += amount;
    acc.count += 1;
    const m = acc.merchants.get(key);
    if (m) {
      m.total += amount;
      m.count += 1;
    } else {
      acc.merchants.set(key, {
        name: merchant,
        total: amount,
        count: 1,
        overridden: Boolean(overrides?.has(key)),
      });
    }
  }

  let spendTotal = 0;
  let incomeTotal = 0;
  let transferTotal = 0;
  let spendCount = 0;

  for (const [id, acc] of byCat) {
    const meta = categoryMeta(id);
    if (meta.kind === "income") incomeTotal += acc.total;
    else if (meta.kind === "transfer") transferTotal += acc.total;
    else {
      spendTotal += acc.total;
      spendCount += acc.count;
    }
  }

  const slices: CategorySlice[] = [...byCat.entries()]
    .map(([id, acc]) => {
      const meta = categoryMeta(id);
      const merchants = [...acc.merchants.entries()]
        .map(([key, m]) => ({
          name: m.name,
          key,
          total: m.total,
          count: m.count,
          overridden: m.overridden,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8);
      return {
        id,
        label: meta.label,
        hint: meta.hint,
        kind: meta.kind,
        total: acc.total,
        count: acc.count,
        share: meta.kind === "spend" && spendTotal > 0 ? acc.total / spendTotal : 0,
        merchants,
      };
    })
    .sort((a, b) => {
      // Spend categories by size, then transfers, then income.
      const rank = (k: SpendCategory["kind"]) => (k === "spend" ? 0 : k === "transfer" ? 1 : 2);
      const dr = rank(a.kind) - rank(b.kind);
      if (dr !== 0) return dr;
      return b.total - a.total;
    });

  return { slices, spendTotal, incomeTotal, transferTotal, spendCount };
}
