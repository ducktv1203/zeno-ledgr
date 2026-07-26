/*
 * Shared display formatting.
 *
 * Deliberately locale-independent: `toLocaleDateString`/`toLocaleString` resolve
 * differently on the server than in the browser, which makes any SSR-ed row
 * fail hydration. Everything here formats by hand so both sides agree.
 */

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** 1234.5 → "1,234.50" */
export function formatMoney(value: string | number): string {
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(n)) return "—";
  const [whole, cents] = Math.abs(n).toFixed(2).split(".");
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${n < 0 ? "-" : ""}${grouped}.${cents}`;
}

/** 1234 → "1,234" */
export function formatCount(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** "2026-07-10" → "10 Jul 2026". Read as a calendar date, never shifted by zone. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/** "10 July" — for calendar day headings. */
export function formatDayMonth(date: Date): string {
  return `${date.getDate()} ${MONTHS_LONG[date.getMonth()]}`;
}

/** An API timestamp → "26 Jul 2026", using UTC parts so it never drifts. */
export function formatTimestamp(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
