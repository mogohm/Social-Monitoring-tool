/**
 * Shared date-range model for every analytics page.
 *
 * Pages used to hardcode 7/14/30/90-day buttons, so there was no way to ask
 * for "1–15 July". A range is either a rolling preset (`days`) or an explicit
 * calendar span (`from`/`to`, both YYYY-MM-DD, `to` inclusive). The backend
 * accepts both shapes on the same endpoints.
 */
export interface DateRange {
  days?: number;
  from?: string;
  to?: string;
}

export const PRESETS = [
  { days: 7, label: "7 วัน" },
  { days: 14, label: "14 วัน" },
  { days: 30, label: "30 วัน" },
  { days: 90, label: "90 วัน" },
] as const;

export function isCustom(range: DateRange): boolean {
  return Boolean(range.from || range.to);
}

/**
 * Minutes east of UTC for this browser (Bangkok = 420).
 * getTimezoneOffset() reports the opposite sign, hence the negation.
 */
export function tzOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

/** Query params for the API. */
export function rangeParams(range: DateRange): Record<string, string | number> {
  if (isCustom(range)) {
    // A calendar date is meaningless without a timezone: read as UTC, picking
    // "29 July" in Bangkok returned only 30 July posts. The offset lets the
    // API map the local day onto the right UTC window.
    const p: Record<string, string | number> = { tz_offset: tzOffsetMinutes() };
    if (range.from) p.date_from = range.from;
    if (range.to) p.date_to = range.to;
    return p;
  }
  return { days: range.days ?? 7, tz_offset: tzOffsetMinutes() };
}

/** Same thing as a query string, for helpers that build URLs by hand. */
export function rangeQuery(range: DateRange): string {
  return new URLSearchParams(
    Object.entries(rangeParams(range)).map(([k, v]) => [k, String(v)]),
  ).toString();
}

export function todayISO(): string {
  return toISO(new Date());
}

export function toISO(d: Date): string {
  // Local calendar date — using toISOString() here would shift the day for
  // anyone east of UTC, which is exactly the class of bug that made every
  // timestamp in this dashboard read 7 hours stale.
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISO(d);
}

const THAI_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function fmtThai(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${THAI_MONTHS[m - 1]} ${(y + 543) % 100}`;
}

/** Human label, e.g. "1 ก.ค. 69 – 15 ก.ค. 69" or "30 วันล่าสุด". */
export function rangeLabel(range: DateRange): string {
  if (isCustom(range)) {
    const from = range.from ? fmtThai(range.from) : "เริ่มต้น";
    const to = range.to ? fmtThai(range.to) : "วันนี้";
    return `${from} – ${to}`;
  }
  return `${range.days ?? 7} วันล่าสุด`;
}

/**
 * Start/end actually covered, so pages can show the exact span.
 *
 * Presets mirror the backend, which filters a rolling `days * 24h` window
 * (`created_at >= now - days`). That touches N+1 calendar dates, so the start
 * is `daysAgoISO(n)` — using n-1 here made the label disagree with the data,
 * e.g. a 14-day chart legitimately drawing 15 daily buckets.
 */
export function resolvedSpan(range: DateRange): { from: string; to: string } {
  if (isCustom(range)) {
    return { from: range.from ?? daysAgoISO(range.days ?? 7), to: range.to ?? todayISO() };
  }
  return { from: daysAgoISO(range.days ?? 7), to: todayISO() };
}
