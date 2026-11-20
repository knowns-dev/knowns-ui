/** @registry part-of="date-picker" */
/** Pure logic of the date picker: reading a typed date and time, formatting, bounds and the quick picks. Intl only. */
import { addDays, addMonths, startOfDay } from "./calendar/calendar-utils";

export interface DateQuickPick {
  id: string;
  label: string;
  date: Date;
}

/** Day, month and year order for a locale, from Intl: "dmy" (en-GB, vi), "mdy" (en-US) or "ymd" (ja, ISO-like). */
export function dateOrder(locale?: string): "dmy" | "mdy" | "ymd" {
  const parts = new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric", year: "numeric" }).formatToParts(new Date(2026, 10, 20));
  const seq = parts
    .filter((p) => p.type === "day" || p.type === "month" || p.type === "year")
    .map((p) => p.type[0])
    .join("");
  return seq === "mdy" || seq === "ymd" ? seq : "dmy";
}

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const monthIndex = (s: string) => MONTHS.indexOf(s.slice(0, 3));
const weekdayIndex = (s: string) => WEEKDAYS.indexOf(s.slice(0, 3));

/** A real calendar day? (31/02 is not.) */
function makeDay(y: number, m: number, d: number): Date | null {
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  const out = new Date(y, m, d);
  return out.getFullYear() === y && out.getMonth() === m && out.getDate() === d ? out : null;
}
const fullYear = (y: number) => (y < 100 ? 2000 + y : y);

/** "3pm", "3:30 pm", "15:30", "9h", "noon". Returns the time and the text without it. */
export function parseTime(text: string): { time: { h: number; m: number } | null; rest: string } {
  const s = text.trim().toLowerCase();
  if (/\bnoon\b/.test(s)) return { time: { h: 12, m: 0 }, rest: s.replace(/\b(at\s+)?noon\b/, "").trim() };
  if (/\bmidnight\b/.test(s)) return { time: { h: 0, m: 0 }, rest: s.replace(/\b(at\s+)?midnight\b/, "").trim() };
  const re = /(?:\bat\s+)?(?<![\d/.-])(\d{1,2})(?:[:h.](\d{2}))?\s*(am|pm|a|p|h)?\b(?![/.-]\d)/g;
  let found: { h: number; m: number; at: number; len: number } | null = null;
  for (const mt of s.matchAll(re)) {
    const [all, hs, ms, suf] = mt;
    if (!ms && !suf) continue; // a bare number is a day, not a time
    let h = Number(hs);
    const m = ms ? Number(ms) : 0;
    if (suf === "pm" || suf === "p") h = h % 12 + 12;
    else if (suf === "am" || suf === "a") h = h % 12;
    if (h > 23 || m > 59) continue;
    found = { h, m, at: mt.index ?? 0, len: all.length };
  }
  if (!found) return { time: null, rest: s };
  return { time: { h: found.h, m: found.m }, rest: (s.slice(0, found.at) + s.slice(found.at + found.len)).replace(/\s+/g, " ").trim() };
}

/**
 * Reads what someone typed. Returns the day (and a time when one was typed), or null.
 * Two-part numeric dates ("20/11") take the next such day from today when the year is left out.
 */
export function parseDateInput(text: string, o: { today?: Date; locale?: string } = {}): { date: Date; time: { h: number; m: number } | null } | null {
  const today = startOfDay(o.today ?? new Date());
  const { time, rest } = parseTime(text);
  const s = rest
    .replace(/[,]/g, " ")
    .replace(/\b(\d{1,2})(st|nd|rd|th)\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const day = (d: Date | null) => (d ? { date: d, time } : null);
  if (!s) return time ? { date: today, time } : null;

  if (s === "today" || s === "now") return day(today);
  if (s === "tomorrow" || s === "tmr" || s === "tmrw") return day(addDays(today, 1));
  if (s === "yesterday") return day(addDays(today, -1));

  let m = s.match(/^in (\d{1,3}) (day|week|month|year)s?$/);
  if (m) {
    const n = Number(m[1]);
    return day(m[2] === "day" ? addDays(today, n) : m[2] === "week" ? addDays(today, 7 * n) : m[2] === "month" ? addMonths(today, n) : addMonths(today, 12 * n));
  }
  if (s === "next week") return day(addDays(today, 7));
  if (s === "next month") return day(addMonths(today, 1));

  // "fri" / "this fri": the coming Friday, today included. "next fri": the first Friday after today.
  m = s.match(/^(this |next )?([a-z]+)$/);
  if (m && (m[2] ?? "").length >= 3 && weekdayIndex(m[2] ?? "") >= 0) {
    const diff = (weekdayIndex(m[2] ?? "") - today.getDay() + 7) % 7;
    return day(addDays(today, m[1] === "next " && diff === 0 ? 7 : diff));
  }

  // ISO: 2026-11-20 or 2026/11/20.
  m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return day(makeDay(Number(m[1]), Number(m[2]) - 1, Number(m[3])));

  // Numeric in locale order: 20/11/2026, 11/20/26, 20.11, 20-11.
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?$/);
  if (m) {
    const order = dateOrder(o.locale);
    const a = Number(m[1]);
    const b = Number(m[2]);
    const [d, mo] = order === "mdy" ? [b, a] : [a, b];
    if (m[3]) return day(makeDay(fullYear(Number(m[3])), mo - 1, d));
    const thisYear = makeDay(today.getFullYear(), mo - 1, d);
    if (!thisYear) return null;
    return day(thisYear < today ? makeDay(today.getFullYear() + 1, mo - 1, d) : thisYear);
  }

  // Month names: "nov 20", "20 nov", "november 20 2026", "20 november 2026".
  m = s.match(/^([a-z]{3,}) (\d{1,2})(?: (\d{2,4}))?$/) ?? null;
  let mi = -1;
  let d = 0;
  let y: number | null = null;
  if (m && monthIndex(m[1] ?? "") >= 0) [mi, d, y] = [monthIndex(m[1] ?? ""), Number(m[2]), m[3] ? fullYear(Number(m[3])) : null];
  else {
    m = s.match(/^(\d{1,2}) ([a-z]{3,})(?: (\d{2,4}))?$/);
    if (m && monthIndex(m[2] ?? "") >= 0) [mi, d, y] = [monthIndex(m[2] ?? ""), Number(m[1]), m[3] ? fullYear(Number(m[3])) : null];
  }
  if (mi >= 0) {
    if (y !== null) return day(makeDay(y, mi, d));
    const thisYear = makeDay(today.getFullYear(), mi, d);
    if (!thisYear) return null;
    return day(thisYear < today ? makeDay(today.getFullYear() + 1, mi, d) : thisYear);
  }
  return null;
}

/** Puts a time on a day (or keeps the day's own when none is given). */
export const withTime = (d: Date, t: { h: number; m: number } | null | undefined) => (t ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), t.h, t.m) : d);

/** "Fri, Nov 20, 2026" or with time "Fri, Nov 20, 2026, 3:00 PM", in the locale's own order. */
export function formatDate(d: Date | null | undefined, o: { locale?: string; time?: boolean; weekday?: boolean } = {}): string {
  if (!d) return "";
  return new Intl.DateTimeFormat(o.locale, {
    weekday: o.weekday === false ? undefined : "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(o.time ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(d);
}

/** "HH:mm" for <input type="time">. */
export const timeValue = (d: Date | null | undefined) => (d ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "");

/** Why a day can't be used, or null. */
export function dateProblem(d: Date, o: { min?: Date; max?: Date; isDateDisabled?: (d: Date) => boolean; locale?: string }): string | null {
  if (o.min && startOfDay(d) < startOfDay(o.min)) return `Pick ${formatDate(o.min, { locale: o.locale, weekday: false })} or later`;
  if (o.max && startOfDay(d) > startOfDay(o.max)) return `Pick ${formatDate(o.max, { locale: o.locale, weekday: false })} or earlier`;
  if (o.isDateDisabled?.(d)) return "That day isn't available";
  return null;
}

/** Today, Tomorrow, Next Monday, In a week, In a month. */
export function defaultQuickPicks(today = new Date()): DateQuickPick[] {
  const t = startOfDay(today);
  const toMonday = ((1 - t.getDay() + 7) % 7) || 7;
  return [
    { id: "today", label: "Today", date: t },
    { id: "tomorrow", label: "Tomorrow", date: addDays(t, 1) },
    { id: "next-monday", label: "Next Monday", date: addDays(t, toMonday) },
    { id: "week", label: "In a week", date: addDays(t, 7) },
    { id: "month", label: "In a month", date: addMonths(t, 1) },
  ];
}
