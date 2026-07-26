import type { CashFlow, LedgerPlaintext } from "@/lib/crypto";
import type { StatementReadProgress } from "@/lib/extract-pdf-text";

export type ParsedStatementRow = LedgerPlaintext & {
  line: number;
};

export type StatementPeriod = {
  /** Inclusive ISO start (YYYY-MM-DD). */
  start: string;
  /** Inclusive ISO end (YYYY-MM-DD). */
  end: string;
};

export type ParseStatementResult = {
  rows: ParsedStatementRow[];
  skipped: number;
  warnings: string[];
  usedOcr?: boolean;
  pageCount?: number;
  lineCount?: number;
  /** Inclusive statement window when detected from the PDF/CSV header. */
  period?: StatementPeriod | null;
};

export type { StatementReadProgress };

const DATE_HEADERS = [
  "date",
  "transaction date",
  "txn date",
  "posting date",
  "value date",
  "processed date",
];

const MERCHANT_HEADERS = [
  "description",
  "merchant",
  "narrative",
  "particulars",
  "details",
  "payee",
  "transaction description",
  "memo",
  "name",
];

const AMOUNT_HEADERS = ["amount", "value", "transaction amount", "aud", "nzd", "usd"];
const DEBIT_HEADERS = ["debit", "withdrawal", "money out", "out"];
const CREDIT_HEADERS = ["credit", "deposit", "money in", "in"];

const SKIP_LINE =
  /\b(opening balance|closing balance|balance brought forward|available balance|account number|bsb|page\s+\d+(?:\s+of\s+\d+)?|statement period|total debit|total credit|transaction details|please note|important information|continued on next page|date\s+description|debit\s+credit|transaction statement|cheques?\s+written|account\s+fee|customer relations|compliments.?and.?complaints|financial complaints|afca|passcodes?|important safety notice|keeping your passcodes|reply paid|gpo box|free call|dispute resolution|commbank\.com\.au|we try to get things right|unless you make a reasonable attempt)\b/i;

const HEADERISH_MERCHANT =
  /^(date|description|debit|credit|balance|amount|particulars|details|narrative|merchant|transactions?|statement|cheques?\s+written|account\s+fee)(\s+\w+){0,6}$/i;

const BOILERPLATE =
  /\b(afca|passcode|complaints?|customer relations|dispute resolution|reply paid|gpo box|we try to get things right|keeping your passcodes|important safety notice|australian financial)\b/i;

/** Whole-line page chrome — do not use bare "commbank" (kills real txn lines). */
const HEADER_ONLY =
  /^(commonwealth\s+bank|commbank|statement\s+of\s+account|transaction\s+account statement)\b/i;

const MONTH_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const MONTH_NAMES = Object.keys(MONTH_MAP).join("|");

/** Money token: 12.34, 1,200.00, (12.34), optional CR/DR suffix. */
const MONEY_TOKEN =
  "(-?\\$?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{2})|\\(\\$?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{2})\\))\\s*(?:CR|DR|CREDIT|DEBIT)?";

/** Day/month only — month must be 01–12 so amounts like 10.49 never match. */
const DM_NO_YEAR = "(?:0?[1-9]|[12]\\d|3[01])[/.-](?:0?[1-9]|1[0-2])";

const DATE_AT_START = new RegExp(
  `^(\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\s+(?:${MONTH_NAMES})\\.?\\s+\\d{2,4}|(?:${MONTH_NAMES})\\.?\\s+\\d{1,2},?\\s+\\d{2,4}|\\d{1,2}\\s+(?:${MONTH_NAMES})\\.?|${DM_NO_YEAR})\\b`,
  "i",
);

const DATE_ANYWHERE = new RegExp(
  `(\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\s+(?:${MONTH_NAMES})\\.?\\s+\\d{2,4}|(?:${MONTH_NAMES})\\.?\\s+\\d{1,2},?\\s+\\d{2,4}|\\d{1,2}\\s+(?:${MONTH_NAMES})\\.?)`,
  "i",
);

/**
 * CommBank wraps "Value Date 15/01/2026" onto its own line under a purchase.
 * That date is settlement metadata — treating it as a new transaction date
 * splits YouTube into junk rows and steals the real $10.49 debit.
 */
const VALUE_DATE_LINE =
  /^\s*(?:value|posting|processed|txn|transaction)\s+date\b/i;

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

/** Minimal CSV split that respects double-quoted fields. */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function findColumn(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.findIndex((h) => h === candidate || h.includes(candidate));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseAmountCell(raw: string): number | null {
  const cleaned = raw
    .replace(/[$£€AUDNZDUSD]/gi, "")
    .replace(/\s/g, "")
    .replace(/^\((.*)\)$/, "-$1")
    .replace(/,/g, "");
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatAbsAmount(n: number): string {
  return Math.abs(n).toFixed(2);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${String(y).padStart(4, "0")}-${pad2(m)}-${pad2(d)}`;
}

export type DateResolveContext = {
  /** Last successfully parsed transaction date (ordering hint). */
  previousDate?: string | null;
  /** Whole statement window — preferred for yearless body rows. */
  period?: StatementPeriod | null;
  /** Legacy single-year fallback when no period is known. */
  fallbackYear?: number | null;
};

/**
 * Pick the calendar year for a day/month that omitted it.
 * Prefer a date that lands inside the statement period (so "16 Jan" on an
 * Aug 2025–Jan 2026 statement becomes 2026, not 2025 after a December row).
 */
function resolvePartialDate(
  yearHints: number[],
  month: number,
  day: number,
  ctx: DateResolveContext,
): string | null {
  const years = [...new Set(yearHints.filter((y) => y >= 2005 && y <= 2100))];
  if (years.length === 0) return null;

  const candidates = years
    .map((y) => ymd(y, month, day))
    .filter((d): d is string => Boolean(d));
  if (candidates.length === 0) return null;

  const { period, previousDate } = ctx;
  if (period) {
    const inRange = candidates.filter((d) => d >= period.start && d <= period.end);
    if (inRange.length === 1) return inRange[0]!;
    if (inRange.length > 1) {
      if (previousDate) {
        const nearest = [...inRange].sort(
          (a, b) =>
            Math.abs(Date.parse(a) - Date.parse(previousDate)) -
            Math.abs(Date.parse(b) - Date.parse(previousDate)),
        )[0];
        if (nearest) return nearest;
      }
      return inRange[inRange.length - 1]!;
    }
  }

  if (previousDate) {
    const nearest = [...candidates].sort(
      (a, b) =>
        Math.abs(Date.parse(a) - Date.parse(previousDate)) -
        Math.abs(Date.parse(b) - Date.parse(previousDate)),
    )[0];
    if (nearest) return nearest;
  }

  return candidates[candidates.length - 1]!;
}

/**
 * Accepts ISO, AU slash dates, and month-name dates (01 Jul 2026 / Jul 1, 2026).
 * CommBank body rows sometimes omit the year ("16 Jan") — pass the statement
 * period so Jan after Dec 2025 still resolves to Jan 2026 when the period ends then.
 */
export function normalizeStatementDate(
  raw: string,
  ctx: DateResolveContext | number | null = null,
): string | null {
  const context: DateResolveContext =
    typeof ctx === "number" || ctx === null || ctx === undefined
      ? { fallbackYear: ctx ?? null }
      : ctx;

  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return ymd(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const slash = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    let y = Number(slash[3]);
    if (y < 100) y += y >= 70 ? 1900 : 2000;

    let day: number;
    let month: number;
    if (a > 12) {
      day = a;
      month = b;
    } else if (b > 12) {
      month = a;
      day = b;
    } else {
      // AU statements: day/month/year
      day = a;
      month = b;
    }
    return ymd(y, month, day);
  }

  const yearHints = (): number[] => {
    const hints: number[] = [];
    if (context.period) {
      hints.push(Number(context.period.start.slice(0, 4)));
      hints.push(Number(context.period.end.slice(0, 4)));
    }
    if (context.previousDate) hints.push(Number(context.previousDate.slice(0, 4)));
    if (context.fallbackYear) hints.push(context.fallbackYear);
    return hints;
  };

  const slashNoYear = /^(\d{1,2})[/.-](\d{1,2})$/.exec(s);
  if (slashNoYear) {
    const a = Number(slashNoYear[1]);
    const b = Number(slashNoYear[2]);
    // AU: day/month
    return resolvePartialDate(yearHints(), b, a, context);
  }

  const dmyName = new RegExp(`^(\\d{1,2})\\s+(${MONTH_NAMES})\\.?\\s+(\\d{2,4})$`, "i").exec(s);
  if (dmyName) {
    let y = Number(dmyName[3]);
    if (y < 100) y += y >= 70 ? 1900 : 2000;
    const month = MONTH_MAP[dmyName[2]!.toLowerCase()]!;
    return ymd(y, month, Number(dmyName[1]));
  }

  const dmyNoYear = new RegExp(`^(\\d{1,2})\\s+(${MONTH_NAMES})\\.?$`, "i").exec(s);
  if (dmyNoYear) {
    const month = MONTH_MAP[dmyNoYear[2]!.toLowerCase()]!;
    return resolvePartialDate(yearHints(), month, Number(dmyNoYear[1]), context);
  }

  const mdyName = new RegExp(`^(${MONTH_NAMES})\\.?\\s+(\\d{1,2}),?\\s+(\\d{2,4})$`, "i").exec(s);
  if (mdyName) {
    let y = Number(mdyName[3]);
    if (y < 100) y += y >= 70 ? 1900 : 2000;
    const month = MONTH_MAP[mdyName[1]!.toLowerCase()]!;
    return ymd(y, month, Number(mdyName[2]));
  }

  const mdyNoYear = new RegExp(`^(${MONTH_NAMES})\\.?\\s+(\\d{1,2})$`, "i").exec(s);
  if (mdyNoYear) {
    const month = MONTH_MAP[mdyNoYear[1]!.toLowerCase()]!;
    return resolvePartialDate(yearHints(), month, Number(mdyNoYear[2]), context);
  }

  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

const PERIOD_DATE =
  `(\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}|\\d{1,2}\\s+(?:${MONTH_NAMES})\\.?\\s+\\d{2,4}|(?:${MONTH_NAMES})\\.?\\s+\\d{1,2},?\\s+\\d{2,4})`;

/**
 * Read "Statement period 01 Aug 2025 – 31 Jan 2026" (and close variants) so
 * yearless transaction dates can be placed in the right calendar year.
 */
export function inferStatementPeriod(lines: string[]): StatementPeriod | null {
  const joined = lines.slice(0, 80).join(" ");
  const patterns = [
    new RegExp(
      `statement\\s*period\\s*:?\\s*${PERIOD_DATE}\\s*(?:-|–|—|to)\\s*${PERIOD_DATE}`,
      "i",
    ),
    new RegExp(
      `period\\s*:?\\s*${PERIOD_DATE}\\s*(?:-|–|—|to)\\s*${PERIOD_DATE}`,
      "i",
    ),
    new RegExp(`${PERIOD_DATE}\\s*(?:-|–|—|to)\\s*${PERIOD_DATE}`, "i"),
  ];

  for (const source of [...lines.slice(0, 80), joined]) {
    for (const re of patterns) {
      const match = re.exec(source);
      if (!match) continue;
      const start = normalizeStatementDate(match[1]!);
      const end = normalizeStatementDate(match[2]!);
      if (start && end && start <= end) return { start, end };
      // Swapped if OCR reversed the ends
      if (start && end && end < start) return { start: end, end: start };
    }
  }
  return null;
}

function isMoneyOnlyLine(line: string): boolean {
  const moneyHits = [...line.matchAll(new RegExp(MONEY_TOKEN, "gi"))];
  if (moneyHits.length === 0) return false;
  return line.replace(new RegExp(MONEY_TOKEN, "gi"), "").replace(/[$,\s]/g, "").length === 0;
}

function looksTransactional(line: string): boolean {
  // Headers like "Statement Period 01 Jan 2026 – 31 Jan 2026" contain dates
  // but must never be treated as payments (they steal the next amount line).
  if (SKIP_LINE.test(line) || HEADER_ONLY.test(line) || BOILERPLATE.test(line)) {
    return isMoneyOnlyLine(line);
  }
  if (DATE_AT_START.test(line) || DATE_ANYWHERE.test(line)) return true;
  if (isMoneyOnlyLine(line)) return true;
  return false;
}

function resolveAmount(
  cells: string[],
  amountIdx: number,
  debitIdx: number,
  creditIdx: number,
): { amount: string; flow: CashFlow | null } | null {
  if (amountIdx >= 0) {
    const raw = cells[amountIdx] ?? "";
    const n = parseAmountCell(raw);
    if (n === null) return null;
    let flow: CashFlow | null = null;
    if (/\bCR\b|CREDIT/i.test(raw) || n < 0) flow = "in";
    else if (/\bDR\b|DEBIT/i.test(raw)) flow = "out";
    return { amount: formatAbsAmount(n), flow };
  }

  const debit = debitIdx >= 0 ? parseAmountCell(cells[debitIdx] ?? "") : null;
  const credit = creditIdx >= 0 ? parseAmountCell(cells[creditIdx] ?? "") : null;
  if (debit !== null && debit !== 0) return { amount: formatAbsAmount(debit), flow: "out" };
  if (credit !== null && credit !== 0) return { amount: formatAbsAmount(credit), flow: "in" };
  return null;
}

function cleanOcrLine(line: string): string {
  return line
    .replace(/[|]/g, "I")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type ExtractedAmount = {
  amount: string | null;
  merchant: string;
  flow: CashFlow | null;
};

function flowFromMoneyToken(token: string, value: number): CashFlow | null {
  if (/\bCR\b|CREDIT/i.test(token)) return "in";
  if (/\bDR\b|DEBIT/i.test(token)) return "out";
  // Parentheses / leading minus often mark a credit/refund on statements.
  if (value < 0 || /^\(.*\)$/.test(token.trim())) return "in";
  return null;
}

/**
 * Pull the transaction amount out of free text that may also include a
 * running balance, and on CommBank-style tables an empty debit/credit column
 * as 0.00:
 *   "… 10.49 0.00 1,523.67"  → debit 10.49 out (not 0.00, not balance)
 *   "… 0.00 2,450.00 5,000" → credit 2,450 in
 *   "… 10.49 1,523.67"       → 10.49 (amount + balance)
 */
function extractAmountFromRest(rest: string): ExtractedAmount {
  const moneyHits = [...rest.matchAll(new RegExp(MONEY_TOKEN, "gi"))];
  if (moneyHits.length === 0) {
    return { amount: null, merchant: rest.trim(), flow: null };
  }

  const parsed = moneyHits.map((hit) => ({
    hit,
    token: hit[0]!,
    value: parseAmountCell(hit[1] ?? hit[0]!),
  }));

  let chosen: (typeof parsed)[number] | undefined;
  let flow: CashFlow | null = null;

  if (parsed.length >= 3) {
    // Debit | Credit | Balance — ignore balance; take the non-zero movement.
    const debit = parsed[0]!;
    const credit = parsed[1]!;
    if (debit.value !== null && debit.value !== 0) {
      chosen = debit;
      flow = "out";
    } else if (credit.value !== null && credit.value !== 0) {
      chosen = credit;
      flow = "in";
    }
  } else if (parsed.length === 2) {
    // Amount | Balance (or 0.00 | Credit). Prefer the first non-zero.
    chosen =
      parsed.find((p) => p.value !== null && p.value !== 0) ?? parsed[0];
    if (chosen) flow = flowFromMoneyToken(chosen.token, chosen.value ?? 0);
    // "0.00 2,450.00" with no balance column — treat as credit then amount.
    if (
      !flow &&
      parsed[0]!.value === 0 &&
      parsed[1]!.value !== null &&
      parsed[1]!.value !== 0
    ) {
      chosen = parsed[1];
      flow = "in";
    }
  } else {
    chosen = parsed[0];
    if (chosen) flow = flowFromMoneyToken(chosen.token, chosen.value ?? 0);
  }

  if (!chosen || chosen.value === null || chosen.value === 0) {
    return {
      amount: null,
      merchant: rest.slice(0, moneyHits[0]!.index).trim(),
      flow: null,
    };
  }

  return {
    amount: formatAbsAmount(chosen.value),
    // Everything from the first money token onward is columns, not merchant.
    merchant: rest.slice(0, moneyHits[0]!.index).trim(),
    flow,
  };
}

export function isPlausiblePayment(merchantRaw: string, amount: string, date: string): boolean {
  const merchant = merchantRaw.trim();
  if (merchant.length < 2 || merchant.length > 160) return false;
  // A line that is only settlement scaffolding is not a purchase.
  if (/^value\s+date\b/i.test(merchant) && !/\byoutube|google|netflix|spotify|amaysim\b/i.test(merchant)) {
    return false;
  }
  if (HEADERISH_MERCHANT.test(merchant) || SKIP_LINE.test(merchant)) {
    return false;
  }
  // Legal footers only — do not reject real merchants that mention a bank.
  if (BOILERPLATE.test(merchant) && merchant.length < 48) {
    return false;
  }
  if (/\b(cheques?\s+written|account\s+fee|opening|closing)\b/i.test(merchant)) return false;
  // Too many zeros / summary tables
  if ((merchant.match(/\b0\.00\b/g) ?? []).length >= 2) return false;

  const n = Number.parseFloat(amount);
  if (!Number.isFinite(n) || n <= 0) return false;

  const t = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(t)) return false;
  const year = new Date(t).getUTCFullYear();
  const nowY = new Date().getUTCFullYear();
  if (year < 2005 || year > nowY + 1) return false;

  return true;
}

function rowKey(r: ParsedStatementRow): string {
  return `${r.date}|${r.amount}|${r.merchantRaw.toLowerCase()}`;
}

/**
 * Parse free-form statement lines (PDF text or OCR).
 */
export function parseStatementLines(lines: string[]): ParseStatementResult {
  const warnings: string[] = [];
  const rows: ParsedStatementRow[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  const period = inferStatementPeriod(lines);
  let previousDate: string | null = period?.start ?? null;
  /** Amounts that pdf.js emitted above their date row (common on CommBank). */
  let orphan: { amount: string; flow: CashFlow | null } | null = null;

  let pending: {
    line: number;
    date: string;
    merchantParts: string[];
    amount: string | null;
    flow: CashFlow | null;
  } | null = null;

  function flush() {
    if (!pending) return;
    // Wrapped PDF rows often repeat the descriptor verbatim on the next line.
    const uniqueParts = pending.merchantParts.filter(
      (part, i, all) => all.findIndex((p) => p.toLowerCase() === part.toLowerCase()) === i,
    );
    const merchantRaw = uniqueParts
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^[-\u2013\u2014:]+/, "")
      .trim();
    if (
      merchantRaw &&
      pending.amount &&
      isPlausiblePayment(merchantRaw, pending.amount, pending.date)
    ) {
      const row: ParsedStatementRow = {
        line: pending.line,
        merchantRaw,
        amount: pending.amount,
        date: pending.date,
        ...(pending.flow ? { flow: pending.flow } : {}),
      };
      const key = rowKey(row);
      if (!seen.has(key)) {
        seen.add(key);
        rows.push(row);
      }
    } else {
      skipped += 1;
    }
    pending = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = cleanOcrLine(lines[i]!);
    if (!rawLine) continue;

    const transactional = looksTransactional(rawLine);
    if (HEADER_ONLY.test(rawLine) && rawLine.length < 80 && !transactional) continue;
    // Footers / legal — but never drop a line that still looks like a payment.
    if ((SKIP_LINE.test(rawLine) || BOILERPLATE.test(rawLine)) && !transactional) continue;
    if (rawLine.length > 220 && !transactional) continue;

    // Settlement "Value Date …" lines belong to the open purchase — never a new row.
    if (VALUE_DATE_LINE.test(rawLine)) {
      if (pending) {
        const { amount, flow } = extractAmountFromRest(
          rawLine.replace(VALUE_DATE_LINE, "").trim(),
        );
        if (amount && !pending.amount) {
          pending.amount = amount;
          if (flow && !pending.flow) pending.flow = flow;
        }
      }
      continue;
    }

    // Debit/Credit/Balance emitted on their own line before the date row.
    if (isMoneyOnlyLine(rawLine)) {
      const { amount, flow } = extractAmountFromRest(rawLine);
      if (amount) {
        if (pending && !pending.amount) {
          pending.amount = amount;
          if (flow && !pending.flow) pending.flow = flow;
        } else {
          orphan = { amount, flow };
        }
      }
      continue;
    }

    let dateMatch = DATE_AT_START.exec(rawLine);
    let restAfterDate = "";

    if (dateMatch) {
      restAfterDate = rawLine.slice(dateMatch[0].length).trim();
    } else if (!SKIP_LINE.test(rawLine) && !HEADER_ONLY.test(rawLine)) {
      // Only accept mid-line dates on short transaction-like lines (not footers
      // / statement-period headers, and never "Value Date …").
      const mid = DATE_ANYWHERE.exec(rawLine);
      if (
        mid &&
        mid.index !== undefined &&
        mid.index <= 24 &&
        rawLine.length <= 140 &&
        !BOILERPLATE.test(rawLine)
      ) {
        dateMatch = mid;
        const before = rawLine.slice(0, mid.index).trim();
        const after = rawLine.slice(mid.index + mid[0].length).trim();
        restAfterDate = [before, after].filter(Boolean).join(" ");
      }
    }

    if (dateMatch) {
      flush();
      const date = normalizeStatementDate(dateMatch[1]!, {
        period,
        previousDate,
        fallbackYear: previousDate ? Number(previousDate.slice(0, 4)) : period
          ? Number(period.end.slice(0, 4))
          : null,
      });
      if (!date) {
        skipped += 1;
        continue;
      }
      previousDate = date;

      const { amount, merchant, flow } = extractAmountFromRest(restAfterDate);
      pending = {
        line: i + 1,
        date,
        merchantParts: merchant ? [merchant] : [],
        amount: amount ?? orphan?.amount ?? null,
        flow: flow ?? orphan?.flow ?? null,
      };
      orphan = null;
      continue;
    }

    if (pending) {
      // Never glue footer/legal text onto a transaction description.
      if ((BOILERPLATE.test(rawLine) || SKIP_LINE.test(rawLine)) && !transactional) {
        flush();
        continue;
      }
      if (rawLine.length > 140 && !transactional) {
        flush();
        continue;
      }

      const moneyHits = [...rawLine.matchAll(new RegExp(MONEY_TOKEN, "gi"))];
      const moneyOnly = isMoneyOnlyLine(rawLine);

      if (moneyHits.length >= 1 && !pending.amount) {
        const { amount, merchant, flow } = extractAmountFromRest(rawLine);
        if (amount) {
          pending.amount = amount;
          if (flow && !pending.flow) pending.flow = flow;
        }
        if (
          merchant &&
          !VALUE_DATE_LINE.test(merchant) &&
          merchant.length <= 80 &&
          !moneyOnly
        ) {
          const soFar = pending.merchantParts.join(" ").length;
          if (soFar < 120) pending.merchantParts.push(merchant.slice(0, 80));
        }
      } else if (!moneyOnly && !DATE_AT_START.test(rawLine) && !VALUE_DATE_LINE.test(rawLine)) {
        const soFar = pending.merchantParts.join(" ").length;
        if (soFar < 120) pending.merchantParts.push(rawLine.slice(0, 80));
      }
    }
  }

  flush();

  if (rows.length === 0) {
    warnings.push(
      "No transactions found. Check the preview after re-upload, or try a clearer photo/PDF.",
    );
  } else if (skipped > 0) {
    warnings.push(`Skipped ${skipped} incomplete, footer, or non-payment line(s).`);
  }

  if (period) {
    warnings.unshift(
      `Statement period ${period.start} → ${period.end} used to resolve dates without a year.`,
    );
  }

  return { rows, skipped, warnings, period };
}

/**
 * Parse a bank statement CSV in the browser.
 */
export function parseStatementCsv(text: string): ParseStatementResult {
  const warnings: string[] = [];
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return { rows: [], skipped: 0, warnings: ["File needs a header row and at least one data row."] };
  }

  let headerLineIdx = 0;
  let headers = splitCsvLine(lines[0]!).map(normalizeHeader);
  let dateIdx = findColumn(headers, DATE_HEADERS);
  let merchantIdx = findColumn(headers, MERCHANT_HEADERS);
  let amountIdx = findColumn(headers, AMOUNT_HEADERS);
  let debitIdx = findColumn(headers, DEBIT_HEADERS);
  let creditIdx = findColumn(headers, CREDIT_HEADERS);

  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const trial = splitCsvLine(lines[i]!).map(normalizeHeader);
    const d = findColumn(trial, DATE_HEADERS);
    const m = findColumn(trial, MERCHANT_HEADERS);
    const a = findColumn(trial, AMOUNT_HEADERS);
    const db = findColumn(trial, DEBIT_HEADERS);
    const cr = findColumn(trial, CREDIT_HEADERS);
    if (d >= 0 && m >= 0 && (a >= 0 || db >= 0 || cr >= 0)) {
      headerLineIdx = i;
      headers = trial;
      dateIdx = d;
      merchantIdx = m;
      amountIdx = a;
      debitIdx = db;
      creditIdx = cr;
      break;
    }
  }

  if (dateIdx < 0 || merchantIdx < 0 || (amountIdx < 0 && debitIdx < 0 && creditIdx < 0)) {
    return {
      rows: [],
      skipped: 0,
      warnings: [
        "Could not detect columns. Need Date, Description/Merchant, and Amount (or Debit/Credit).",
      ],
    };
  }

  const rows: ParsedStatementRow[] = [];
  let skipped = 0;
  const period = inferStatementPeriod(lines);
  let previousDate: string | null = period?.start ?? null;

  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const merchantRaw = (cells[merchantIdx] ?? "").trim();
    const date = normalizeStatementDate(cells[dateIdx] ?? "", {
      period,
      previousDate,
      fallbackYear: previousDate
        ? Number(previousDate.slice(0, 4))
        : period
          ? Number(period.end.slice(0, 4))
          : null,
    });
    const resolved = resolveAmount(cells, amountIdx, debitIdx, creditIdx);

    if (!merchantRaw || !date || !resolved) {
      skipped += 1;
      continue;
    }
    previousDate = date;

    rows.push({
      line: i + 1,
      merchantRaw,
      amount: resolved.amount,
      date,
      ...(resolved.flow ? { flow: resolved.flow } : {}),
    });
  }

  if (rows.length === 0) {
    warnings.push("No valid transaction rows found after the header.");
  } else if (skipped > 0) {
    warnings.push(`Skipped ${skipped} incomplete or unparseable row(s).`);
  }

  return { rows, skipped, warnings, period };
}

export async function parseStatementFile(
  file: File,
  onProgress?: (p: StatementReadProgress) => void,
): Promise<ParseStatementResult> {
  const name = file.name.toLowerCase();
  const isPdf = name.endsWith(".pdf") || file.type === "application/pdf";
  const isCsv =
    name.endsWith(".csv") || file.type === "text/csv" || file.type === "application/vnd.ms-excel";
  const isImage =
    /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(name) ||
    file.type.startsWith("image/");

  if (isPdf) {
    const { readPdfStatement } = await import("@/lib/extract-pdf-text");
    const buffer = await file.arrayBuffer();
    let { lines, usedOcr, pageCount } = await readPdfStatement(buffer, onProgress);
    let parsed = parseStatementLines(lines);

    // Text layer existed but didn't yield rows — retry every page with OCR.
    if (parsed.rows.length === 0 && !usedOcr) {
      onProgress?.({
        stage: "ocr",
        message: "No transactions from text layer — retrying with full OCR…",
      });
      const retry = await readPdfStatement(buffer, onProgress, { forceOcr: true });
      lines = retry.lines;
      usedOcr = retry.usedOcr;
      pageCount = retry.pageCount;
      parsed = parseStatementLines(lines);
    }

    parsed.pageCount = pageCount;
    parsed.lineCount = lines.length;

    if (lines.length === 0) {
      return {
        rows: [],
        skipped: 0,
        usedOcr,
        pageCount,
        lineCount: 0,
        warnings: ["Could not read any text from this PDF, even with OCR."],
      };
    }

    parsed.warnings = [
      `Read ${pageCount} page${pageCount === 1 ? "" : "s"}, ${lines.length} text lines → ${parsed.rows.length} payment${parsed.rows.length === 1 ? "" : "s"}.`,
      ...parsed.warnings,
    ];
    if (pageCount >= 5 && parsed.rows.length > 0 && parsed.rows.length <= 2 && lines.length > 80) {
      parsed.warnings = [
        "Only a couple of payments came through from a long statement — hard-refresh the page (Ctrl+Shift+R) and re-upload so the latest parser loads.",
        ...parsed.warnings,
      ];
    }

    if (usedOcr) {
      parsed.usedOcr = true;
      parsed.warnings = [
        "Used on-device OCR — review the preview before importing.",
        ...parsed.warnings,
      ];
    }
    return parsed;
  }

  if (isImage) {
    const { readImageStatement } = await import("@/lib/extract-pdf-text");
    const { lines, usedOcr } = await readImageStatement(file, onProgress);
    const parsed = parseStatementLines(lines);
    parsed.usedOcr = usedOcr;
    parsed.warnings = [
      "Photo OCR ran on-device — review the preview before importing.",
      ...parsed.warnings,
    ];
    return parsed;
  }

  if (isCsv) {
    onProgress?.({ stage: "parsing", message: "Parsing CSV…" });
    return parseStatementCsv(await file.text());
  }

  return {
    rows: [],
    skipped: 0,
    warnings: ["Upload a bank statement PDF, photo, or CSV export."],
  };
}
