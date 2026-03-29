export type MerchantWikiEntry = {
  /** Plain substring (case-insensitive) or /body/flags RegExp */
  pattern: string;
  displayName: string;
};

function parseRegex(pattern: string): RegExp | null {
  if (!pattern.startsWith("/")) return null;
  const lastSlash = pattern.lastIndexOf("/");
  if (lastSlash <= 0) return null;
  const body = pattern.slice(1, lastSlash);
  const flags = pattern.slice(lastSlash + 1) || "i";
  try {
    return new RegExp(body, flags);
  } catch {
    return null;
  }
}

/**
 * Map a raw bank/Plaid/PayPal string to a friendlier label using local wiki only.
 */
export function refineMerchant(
  raw: string,
  wiki: MerchantWikiEntry[],
): { displayName: string; matched: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { displayName: "Unknown", matched: false };
  }

  const lower = trimmed.toLowerCase();

  for (const entry of wiki) {
    const re = parseRegex(entry.pattern);
    if (re) {
      if (re.test(trimmed)) {
        return { displayName: entry.displayName, matched: true };
      }
    } else if (lower.includes(entry.pattern.toLowerCase())) {
      return { displayName: entry.displayName, matched: true };
    }
  }

  return { displayName: trimmed, matched: false };
}
