/*
 * Local-calendar date helpers.
 *
 * Everything the UI shows is a calendar date, not an instant, so these stay in
 * local time and never round-trip through UTC — that mismatch is what made
 * DayPicker cells land a day off.
 */

/** Today as YYYY-MM-DD in the viewer's own timezone. */
export function todayIso(now = new Date()): string {
  return dateToIsoLocal(now);
}

/** Local calendar date as YYYY-MM-DD (matches DayPicker day cells). */
export function dateToIsoLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD into a local Date at noon (stable for DayPicker matching). */
export function isoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}
