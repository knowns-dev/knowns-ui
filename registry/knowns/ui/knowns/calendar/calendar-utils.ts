/** @registry part-of="calendar" */
/* Pure date helpers for Calendar, the date pickers and the schedule items. Local days, no date library, no React. */

/** A day range. `to` is missing while only the start is picked, and always in single-date mode. */
export interface DateRange {
  from: Date;
  to?: Date;
}

/* ── Pure date helpers (exported for tests). Local days, no date library. ── */

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
/** Same day of month `n` months later, clamped to that month's length (Jan 31 + 1 → Feb 28/29). */
export function addMonths(d: Date, n: number) {
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), last));
}
export const sameDay = (a?: Date | null, b?: Date | null) => !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
/** -1, 0 or 1 by calendar day (time of day ignored). */
export const compareDay = (a: Date, b: Date) => Math.sign(startOfDay(a).getTime() - startOfDay(b).getTime());
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** True when `d` is outside [min, max] (either bound optional, inclusive). */
export function outOfBounds(d: Date, min?: Date, max?: Date) {
  return (!!min && compareDay(d, min) < 0) || (!!max && compareDay(d, max) > 0);
}

export function clampDay(d: Date, min?: Date, max?: Date) {
  if (min && compareDay(d, min) < 0) return startOfDay(min);
  if (max && compareDay(d, max) > 0) return startOfDay(max);
  return startOfDay(d);
}

/**
 * The 6×7 days shown for a month, starting on `weekStartsOn` (0 Sunday … 6 Saturday). Days of
 * neighbouring months are `null`, so two months side by side don't repeat days.
 */
export function monthDays(year: number, month: number, weekStartsOn = 1): (Date | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() - weekStartsOn + 7) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= count; day++) cells.push(new Date(year, month, day));
  while (cells.length < 42) cells.push(null);
  return cells;
}

/** Applies a click: the first click starts a range, the second ends it (in either order), a third starts over. */
export function pickDay(range: DateRange | null | undefined, day: Date, mode: "range" | "single" = "range"): DateRange {
  const d = startOfDay(day);
  if (mode === "single" || !range || range.to) return { from: d };
  return compareDay(d, range.from) < 0 ? { from: d, to: range.from } : { from: range.from, to: d };
}

/** Is `d` strictly inside the range (or the preview range while the end is still being picked)? */
export function inRange(d: Date, from?: Date, to?: Date | null) {
  if (!from || !to) return false;
  const [a, b] = compareDay(from, to) <= 0 ? [from, to] : [to, from];
  return compareDay(d, a) > 0 && compareDay(d, b) < 0;
}

/** Where the keyboard moves focus in the grid; null for keys it doesn't handle. */
export function moveFocus(d: Date, key: string, opts: { weekStartsOn?: number; shift?: boolean } = {}): Date | null {
  const ws = opts.weekStartsOn ?? 1;
  switch (key) {
    case "ArrowLeft":
      return addDays(d, -1);
    case "ArrowRight":
      return addDays(d, 1);
    case "ArrowUp":
      return addDays(d, -7);
    case "ArrowDown":
      return addDays(d, 7);
    case "Home":
      return addDays(d, -((d.getDay() - ws + 7) % 7));
    case "End":
      return addDays(d, 6 - ((d.getDay() - ws + 7) % 7));
    case "PageUp":
      return addMonths(d, opts.shift ? -12 : -1);
    case "PageDown":
      return addMonths(d, opts.shift ? 12 : 1);
    default:
      return null;
  }
}


/** Narrow weekday names in display order, e.g. ["M", "T", …] - plus long names for screen readers. */
export function weekdayNames(locale?: string, weekStartsOn = 1): { short: string; long: string }[] {
  const short = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  const long = new Intl.DateTimeFormat(locale, { weekday: "long" });
  // Jan 4 2026 is a Sunday.
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2026, 0, 4 + ((weekStartsOn + i) % 7));
    return { short: short.format(d), long: long.format(d) };
  });
}


/**
 * The days of one month on a week grid, as dates. `outside` fills the lead and the tail with the neighbouring months' days
 * (monthDays leaves them null); `fixed` pads to six weeks, otherwise the grid stops at the last week of the month.
 */
export function monthGrid(year: number, month: number, weekStartsOn = 1, opts: { outside?: boolean; fixed?: boolean } = {}): (Date | null)[] {
  const base = monthDays(year, month, weekStartsOn);
  const lead = base.findIndex(Boolean);
  const count = new Date(year, month + 1, 0).getDate();
  const weeks = opts.fixed === false ? Math.ceil((lead + count) / 7) : 6;
  const out = base.slice(0, weeks * 7);
  if (!opts.outside) return out;
  const first = new Date(year, month, 1);
  return out.map((d, i) => d ?? new Date(first.getFullYear(), first.getMonth(), 1 - lead + i));
}

/** Adds the day to a multiple selection, or removes it when it is already there. Sorted by day. */
export function toggleDay(days: readonly Date[] | null | undefined, day: Date): Date[] {
  const d = startOfDay(day);
  const list = days ?? [];
  return list.some((x) => sameDay(x, d)) ? list.filter((x) => !sameDay(x, d)) : [...list, d].sort((a, b) => a.getTime() - b.getTime());
}
