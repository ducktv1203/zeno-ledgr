/*
 * Turns a raw statement descriptor into something a human wants to read.
 *
 * Bank PDFs wrap a single transaction over several visual lines, so the raw
 * capture often looks like:
 *   "9 Value Date 28 Jan HANARO TOOWONG PTY LTD TOOWONG AUS Card xx4198
 *    Value Date 28 Jan HANARO TOOWONG PTY LTD TOOWONG AUS Card xx4198"
 * i.e. a leading row number, a "Value Date" prefix, a card suffix, and the
 * whole thing repeated. This strips the scaffolding and de-duplicates.
 */

const MONTHS =
  "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december";

/** Bank scaffolding that carries no information about who was paid. */
const NOISE_PATTERNS: RegExp[] = [
  // Leading row/reference number: "9 Value Date ..."
  /^\s*\d{1,4}[\s.)-]+(?=(?:value\s+date|date\b))/i,
  // "Value Date 28 Jan" / "Date 28 Jan" / "Processed 28/01"
  new RegExp(
    `\\b(?:value\\s+date|posting\\s+date|processed(?:\\s+date)?|txn\\s+date|transaction\\s+date|date)\\b\\s*:?\\s*(?:\\d{1,2}\\s*(?:${MONTHS})\\.?(?:\\s+\\d{2,4})?|\\d{1,2}[/.-]\\d{1,2}(?:[/.-]\\d{2,4})?)?`,
    "gi",
  ),
  // Card / account tails: "Card xx4198", "xxxx1234", "acct ...1234"
  /\b(?:card|acct|account)\s*(?:no\.?|number)?\s*[x*•]{2,}\s*\d{2,6}\b/gi,
  /\b[x*]{3,}\s*\d{2,6}\b/gi,
  // Payment rails and receipt refs
  /\b(?:eftpos|visa\s+purchase|visa\s+debit|mastercard|debit\s+card\s+purchase|card\s+purchase|direct\s+debit|pos\s+purchase|purchase\s+authorised\s+on)\b/gi,
  /\b(?:ref|reference|receipt|auth|trace|id)\s*[:#]?\s*[a-z0-9]{6,}\b/gi,
  // Country / locale tails
  /\b(?:aus|au|aud|nz|nzl|usa|us|gbr|uk)\b\s*$/gi,
];

/** Words that are location noise when they trail the actual merchant name. */
const TRAILING_JUNK = /\s+(?:pty\.?\s*ltd\.?|pty\.?|ltd\.?|limited|inc\.?|llc)\b/gi;

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Statement wrapping repeats the same descriptor. If the token list is exactly
 * the same block N times over, keep one copy.
 */
function dropRepeatedBlock(value: string): string {
  const words = value.split(" ").filter(Boolean);
  if (words.length < 4) return value;

  for (let period = 1; period <= Math.floor(words.length / 2); period++) {
    if (words.length % period !== 0) continue;
    let repeats = true;
    for (let i = period; i < words.length && repeats; i++) {
      if (words[i]!.toLowerCase() !== words[i % period]!.toLowerCase()) repeats = false;
    }
    if (repeats) return words.slice(0, period).join(" ");
  }

  // Partial repeat: "A B C A B" — keep the leading block if the tail echoes it.
  const half = Math.floor(words.length / 2);
  for (let period = half; period >= 3; period--) {
    const head = words.slice(0, period).join(" ").toLowerCase();
    const next = words.slice(period, period * 2).join(" ").toLowerCase();
    if (head === next) return words.slice(0, period).join(" ");
  }

  return value;
}

/** ALL-CAPS descriptors are shouty; Title Case reads better in a table. */
function titleCaseIfShouting(value: string): string {
  const letters = value.replace(/[^a-z]/gi, "");
  if (!letters || letters !== letters.toUpperCase()) return value;

  return value
    .toLowerCase()
    .replace(/\b([a-z])([a-z']*)/g, (_, first: string, rest: string) => first.toUpperCase() + rest);
}

/**
 * Best-effort readable name. Returns an empty string when nothing survives, so
 * callers can fall back to the raw descriptor.
 */
export function cleanMerchantLabel(raw: string): string {
  let value = collapseWhitespace(raw);
  if (!value) return "";

  for (const pattern of NOISE_PATTERNS) {
    value = value.replace(pattern, " ");
    value = collapseWhitespace(value);
  }

  value = dropRepeatedBlock(collapseWhitespace(value));
  value = value.replace(TRAILING_JUNK, "");
  value = value.replace(/[\s,;:*\-–—|]+$/g, "");
  value = value.replace(/^[\s,;:*\-–—|]+/g, "");
  value = collapseWhitespace(value);

  // A bare number or a couple of stray characters is not a merchant.
  if (value.length < 2 || /^[\d\s.,-]+$/.test(value)) return "";

  return titleCaseIfShouting(value);
}
