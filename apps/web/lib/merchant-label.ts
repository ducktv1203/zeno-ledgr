/*
 * Turns a raw statement descriptor into something a human wants to read.
 *
 * Bank PDFs wrap one transaction over several visual lines, so a raw capture
 * often looks like:
 *   "9 Value Date 28 Jan HANARO TOOWONG PTY LTD TOOWONG AUS Card xx4198
 *    Value Date 28 Jan HANARO TOOWONG PTY LTD TOOWONG AUS Card xx4198"
 * — a row number, a "Value Date" prefix, a card tail, and the whole thing
 * repeated. Order matters here: the duplicate block is only detectable while
 * both copies are still identical, so de-duplication runs before the noise
 * strippers start rewriting one copy differently from the other.
 */

const MONTHS =
  "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december";

/** Row number or bullet the PDF table leaked into the description. */
const LEADING_INDEX = /^\s*\d{1,4}\s*[.)\-\u2013]?\s+(?=[a-z])/i;

const NOISE_PATTERNS: RegExp[] = [
  // "Value Date 28 Jan", "Processed 28/01/26", bare "Date 28 Jan"
  new RegExp(
    `\\b(?:value\\s+date|posting\\s+date|processed(?:\\s+date)?|txn\\s+date|transaction\\s+date|date)\\b\\s*:?\\s*(?:\\d{1,2}\\s*(?:${MONTHS})\\.?(?:\\s+\\d{2,4})?|\\d{1,2}[/.-]\\d{1,2}(?:[/.-]\\d{2,4})?)?`,
    "gi",
  ),
  // Payment rails — tells you the method, not the merchant.
  /\b(?:eftpos|visa\s+purchase|visa\s+debit|visa|mastercard|debit\s+card\s+purchase|card\s+purchase|direct\s+debit|direct\s+credit|pos\s+purchase|purchase\s+authorised\s+on|bpay|osko|payid)\b/gi,
  // Card / account tails: "Card xx4198", "xxxx1234"
  /\b(?:card|acct|account)\s*(?:no\.?|number)?\s*[x*•]{2,}\s*\d{2,6}\b/gi,
  /\b[x*]{3,}\s*\d{2,6}\b/gi,
  // Explicit reference numbers
  /\b(?:ref|reference|receipt|auth|trace|id)\s*[:#]?\s*[a-z0-9]{5,}\b/gi,
  // Company suffixes
  /\s+(?:pty\.?\s*ltd\.?|pty\.?|ltd\.?|limited|inc\.?|llc|corp\.?)\b/gi,
];

/** A leading bare date left over once the "Value Date" keyword is gone. */
const LEADING_BARE_DATE = new RegExp(
  `^\\s*(?:\\d{1,2}\\s*(?:${MONTHS})\\.?(?:\\s+\\d{2,4})?|\\d{1,2}[/.-]\\d{1,2}(?:[/.-]\\d{2,4})?)\\s+`,
  "i",
);

/** Country/currency tail: only meaningful at the very end. */
const TRAILING_LOCALE = /\s+(?:aus|au|aud|nzd|nz|nzl|usa|usd|us|gbr|gbp|uk|sgp|sg)\s*$/gi;

/**
 * CommBank often tacks the merchant's suburb/office on before the country code:
 * "Google YouTubePremium Barangaroo AU". Drop a final proper-noun place when
 * it sits in front of a country code (or alone at the end after the code went).
 */
const TRAILING_PLACE_BEFORE_LOCALE = new RegExp(
  `\\s+[A-Z][A-Za-z]+(?:\\s+[A-Z][A-Za-z]+)?(?=\\s+(?:aus|au|aud|nzd|nz|nzl|usa|usd|us)\\b)`,
  "g",
);
const TRAILING_PLACE = /\s+\b(?:barangaroo|sydney|melbourne|brisbane|perth|adelaide|canberra|parramatta|chatswood|toowong|southbank|docklands)\b\s*$/i;

/** Store numbers: "WOOLWORTHS 1234 BONDI" → the 1234 says nothing. */
const STORE_NUMBER = /\s+\d{3,6}(?=\s|$)/g;

/** Terminal codes tacked onto a name: "SPOTIFY P12345", "AMAZON PRIME AB12". */
const TRAILING_CODE = /\s+[a-z]{1,3}\d{2,8}\s*$/i;

/**
 * Opaque terminal refs like "P1A2B3C4". Requires a digit immediately followed
 * by a letter, so real names that merely end in digits ("Xbox360", "7 Eleven")
 * survive.
 */
const TERMINAL_REF = /\b(?=[a-z0-9]{6,}\b)[a-z0-9]*\d[a-z][a-z0-9]*\b/gi;

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Support domains ("UBER *TRIP HELP.UBER.COM") are noise, but a leading domain
 * is usually the brand itself ("NETFLIX.COM SYDNEY"), so only later ones go.
 */
function dropSupportDomains(value: string): string {
  const words = value.split(" ").filter(Boolean);
  return words
    .filter((word, i) => i === 0 || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|au|io|co)$/i.test(word))
    .join(" ");
}

/** "A B C A B C" → "A B C". Handles the wrapped-line duplicate. */
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

  // Partial echo: "A B C A B" — keep the head when the tail restates it.
  for (let period = Math.floor(words.length / 2); period >= 3; period--) {
    const head = words.slice(0, period).join(" ").toLowerCase();
    const next = words.slice(period, period * 2).join(" ").toLowerCase();
    if (head === next) return words.slice(0, period).join(" ");
  }

  return value;
}

/** "Toowong Toowong" → "Toowong" (merchant name already carries the suburb). */
function collapseAdjacentDuplicates(value: string): string {
  const words = value.split(" ").filter(Boolean);
  const out: string[] = [];
  for (const word of words) {
    if (out.length && out[out.length - 1]!.toLowerCase() === word.toLowerCase()) continue;
    out.push(word);
  }
  return out.join(" ");
}

/** ALL-CAPS descriptors are shouty; Title Case reads better in a table. */
function titleCaseIfShouting(value: string): string {
  const letters = value.replace(/[^a-z]/gi, "");
  if (!letters || letters !== letters.toUpperCase()) return value;

  // Capitalise the first letter of each space-separated token only, so
  // "netflix.com" does not become "Netflix.Com".
  return value
    .toLowerCase()
    .split(" ")
    .map((token) => (token ? token[0]!.toUpperCase() + token.slice(1) : token))
    .join(" ");
}

/**
 * Best-effort readable name. Returns an empty string when nothing survives, so
 * callers can fall back to the raw descriptor.
 */
export function cleanMerchantLabel(raw: string): string {
  let value = collapseWhitespace(raw);
  if (!value) return "";

  value = value.replace(LEADING_INDEX, "");
  value = dropRepeatedBlock(collapseWhitespace(value));

  for (const pattern of NOISE_PATTERNS) {
    value = collapseWhitespace(value.replace(pattern, " "));
  }

  value = collapseWhitespace(value.replace(LEADING_BARE_DATE, " "));
  // Place before locale first, then the locale itself, then any orphan place.
  value = collapseWhitespace(value.replace(TRAILING_PLACE_BEFORE_LOCALE, " "));
  value = collapseWhitespace(value.replace(TRAILING_LOCALE, " "));
  // Repeat: "AU AUS" and a leftover suburb both show up on CommBank lines.
  value = collapseWhitespace(value.replace(TRAILING_LOCALE, " "));
  value = collapseWhitespace(value.replace(TRAILING_PLACE, " "));
  value = collapseWhitespace(value.replace(TERMINAL_REF, " "));
  value = collapseWhitespace(value.replace(STORE_NUMBER, " "));
  // Only once: a name that is nothing but a code should fall back to the raw text.
  if (/\s/.test(value)) value = collapseWhitespace(value.replace(TRAILING_CODE, " "));

  value = dropSupportDomains(value);
  value = collapseWhitespace(value.replace(/\*/g, " "));
  value = dropRepeatedBlock(value);
  value = collapseAdjacentDuplicates(value);

  value = collapseWhitespace(value.replace(/^[\s,;:*\-\u2013\u2014|]+|[\s,;:*\-\u2013\u2014|]+$/g, ""));

  // A bare number or a couple of stray characters is not a merchant.
  if (value.length < 2 || /^[\d\s.,-]+$/.test(value)) return "";

  return titleCaseIfShouting(value);
}
