import type { LedgerPlaintext } from "@/lib/crypto";

export type ParsedStatementRow = LedgerPlaintext & {
  line: number;
};

export type ParseStatementResult = {
  rows: ParsedStatementRow[];
  skipped: number;
  warnings: string[];
};

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
  /\b(opening balance|closing balance|balance brought forward|available balance|account number|bsb|page\s+\d|statement period|total debit|total credit|transaction details)\b/i;

const LINE_DATE = /^(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/;

/** Money token: 12.34, 1,200.00, (12.34), optional CR/DR suffix. */
const MONEY_TOKEN =
  "(-?\\$?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{2})|\\(\\$?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{2})\\))\\s*(?:CR|DR|CREDIT|DEBIT)?";

const TRAILING_AMOUNT = new RegExp(`${MONEY_TOKEN}\\s*$`, "i");
const ALL_AMOUNTS = new RegExp(MONEY_TOKEN, "gi");

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
    .replace(/[$£€]/g, "")
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

/**
 * Accepts ISO, AU (DD/MM/YYYY), US (MM/DD/YYYY when ambiguous prefers AU if day > 12).
 */
export function normalizeStatementDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slash = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (slash) {
    let a = Number(slash[1]);
    let b = Number(slash[2]);
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
      // Prefer AU day/month for bank statements in this product.
      day = a;
      month = b;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${String(y).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

function resolveAmount(
  cells: string[],
  amountIdx: number,
  debitIdx: number,
  creditIdx: number,
): string | null {
  if (amountIdx >= 0) {
    const n = parseAmountCell(cells[amountIdx] ?? "");
    if (n === null) return null;
    return formatAbsAmount(n);
  }

  const debit = debitIdx >= 0 ? parseAmountCell(cells[debitIdx] ?? "") : null;
  const credit = creditIdx >= 0 ? parseAmountCell(cells[creditIdx] ?? "") : null;
  if (debit !== null && debit !== 0) return formatAbsAmount(debit);
  if (credit !== null && credit !== 0) return formatAbsAmount(credit);
  return null;
}

/**
 * Parse free-form statement lines (from PDF text extraction).
 * Looks for date-prefixed rows with a trailing money amount.
 */
export function parseStatementLines(lines: string[]): ParseStatementResult {
  const warnings: string[] = [];
  const rows: ParsedStatementRow[] = [];
  let skipped = 0;

  let pending: {
    line: number;
    date: string;
    merchantParts: string[];
    amount: string | null;
  } | null = null;

  function flush() {
    if (!pending) return;
    const merchantRaw = pending.merchantParts.join(" ").replace(/\s+/g, " ").trim();
    if (merchantRaw && pending.amount) {
      rows.push({
        line: pending.line,
        merchantRaw,
        amount: pending.amount,
        date: pending.date,
      });
    } else {
      skipped += 1;
    }
    pending = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]!.trim();
    if (!rawLine || SKIP_LINE.test(rawLine)) continue;

    const dateMatch = LINE_DATE.exec(rawLine);
    if (dateMatch) {
      flush();
      const date = normalizeStatementDate(dateMatch[1]!);
      if (!date) {
        skipped += 1;
        continue;
      }

      let rest = rawLine.slice(dateMatch[0].length).trim();
      const moneyHits = [...rest.matchAll(ALL_AMOUNTS)];
      let amount: string | null = null;

      if (moneyHits.length >= 2) {
        // Common layout: ... description  debit/credit  balance
        const txnHit = moneyHits[moneyHits.length - 2]!;
        const balHit = moneyHits[moneyHits.length - 1]!;
        const n = parseAmountCell(txnHit[1] ?? txnHit[0]!);
        if (n !== null) amount = formatAbsAmount(n);
        rest = rest.slice(0, txnHit.index).trim();
        void balHit;
      } else if (moneyHits.length === 1) {
        const hit = moneyHits[0]!;
        const n = parseAmountCell(hit[1] ?? hit[0]!);
        if (n !== null) amount = formatAbsAmount(n);
        rest = rest.slice(0, hit.index).trim();
      }

      pending = {
        line: i + 1,
        date,
        merchantParts: rest ? [rest] : [],
        amount,
      };
      continue;
    }

    if (pending) {
      const amountMatch = TRAILING_AMOUNT.exec(rawLine);
      if (amountMatch && !pending.amount) {
        const n = parseAmountCell(amountMatch[1]!);
        if (n !== null) pending.amount = formatAbsAmount(n);
        const before = rawLine.slice(0, amountMatch.index).trim();
        if (before) pending.merchantParts.push(before);
      } else if (!/^\d+(\.\d+)?$/.test(rawLine)) {
        pending.merchantParts.push(rawLine);
      }
    }
  }

  flush();

  if (rows.length === 0) {
    warnings.push(
      "No transactions found in this PDF. Text-based statements work best — scanned image PDFs need OCR (not supported yet).",
    );
  } else if (skipped > 0) {
    warnings.push(`Skipped ${skipped} incomplete or unparseable line(s).`);
  }

  return { rows, skipped, warnings };
}

/**
 * Parse a bank statement CSV in the browser.
 * Expects a header row with date + description/merchant + amount (or debit/credit).
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

  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const merchantRaw = (cells[merchantIdx] ?? "").trim();
    const date = normalizeStatementDate(cells[dateIdx] ?? "");
    const amount = resolveAmount(cells, amountIdx, debitIdx, creditIdx);

    if (!merchantRaw || !date || !amount) {
      skipped += 1;
      continue;
    }

    rows.push({
      line: i + 1,
      merchantRaw,
      amount,
      date,
    });
  }

  if (rows.length === 0) {
    warnings.push("No valid transaction rows found after the header.");
  } else if (skipped > 0) {
    warnings.push(`Skipped ${skipped} incomplete or unparseable row(s).`);
  }

  return { rows, skipped, warnings };
}

export async function parseStatementFile(file: File): Promise<ParseStatementResult> {
  const name = file.name.toLowerCase();
  const isPdf = name.endsWith(".pdf") || file.type === "application/pdf";
  const isCsv =
    name.endsWith(".csv") || file.type === "text/csv" || file.type === "application/vnd.ms-excel";

  if (isPdf) {
    const { extractPdfTextLines } = await import("@/lib/extract-pdf-text");
    const lines = await extractPdfTextLines(await file.arrayBuffer());
    if (lines.length === 0) {
      return {
        rows: [],
        skipped: 0,
        warnings: [
          "Could not read any text from this PDF. If it is a scanned image, OCR is not supported yet.",
        ],
      };
    }
    return parseStatementLines(lines);
  }

  if (isCsv) {
    return parseStatementCsv(await file.text());
  }

  return {
    rows: [],
    skipped: 0,
    warnings: ["Upload a bank statement PDF (preferred) or CSV export."],
  };
}
