/** @registry part-of="calendar" */
/* Time zones with Intl only: the wall clock of an instant in an IANA zone, and the instant of a wall clock in it. No date library.
   An instant is a Date. A wall time that does not exist (spring forward) moves forward to the first instant that does;
   one that happens twice (fall back) is the earlier one. */

const formatters = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", weekday: "short" });
    formatters.set(tz, f);
  }
  return f;
}

export interface WallTime {
  year: number;
  /** 1 to 12. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 Sunday to 6 Saturday. */
  weekday: number;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The wall clock of `t` in `timeZone`. */
export function wallTime(t: Date | number, timeZone: string): WallTime {
  const out: Record<string, string> = {};
  for (const p of fmt(timeZone).formatToParts(t)) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    weekday: Math.max(0, WEEKDAYS.indexOf(out.weekday ?? "")),
  };
}

/** Minutes east of UTC that `timeZone` is at `t` (+420 for Asia/Ho_Chi_Minh). */
export function zoneOffset(t: Date | number, timeZone: string): number {
  const w = wallTime(t, timeZone);
  const ms = typeof t === "number" ? t : t.getTime();
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, 0);
  return Math.round((asUtc - Math.floor(ms / 60000) * 60000) / 60000);
}

const sameWall = (w: WallTime, y: number, mo: number, d: number, h: number, mi: number) => w.year === y && w.month === mo && w.day === d && w.hour === h && w.minute === mi;

/** The instant at which the clock in `timeZone` reads year-month(1-12)-day hour:minute. Out-of-range parts roll over like Date.UTC. */
export function zonedInstant(timeZone: string, year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const norm = new Date(utc);
  const [y, mo, d, h, mi] = [norm.getUTCFullYear(), norm.getUTCMonth() + 1, norm.getUTCDate(), norm.getUTCHours(), norm.getUTCMinutes()];
  // The offset a day before and a day after: across a change they differ, otherwise they agree.
  const before = utc - zoneOffset(utc - 86400000, timeZone) * 60000;
  const after = utc - zoneOffset(utc + 86400000, timeZone) * 60000;
  const okBefore = sameWall(wallTime(before, timeZone), y, mo, d, h, mi);
  const okAfter = sameWall(wallTime(after, timeZone), y, mo, d, h, mi);
  if (okBefore && okAfter) return new Date(Math.min(before, after));
  if (okBefore) return new Date(before);
  if (okAfter) return new Date(after);
  // In the gap: neither offset reads that wall time. The first instant that exists is the later one.
  return new Date(Math.max(before, after));
}

/** The start of the calendar day of `t` in `timeZone`, as an instant. */
export function startOfZonedDay(t: Date | number, timeZone: string): Date {
  const w = wallTime(t, timeZone);
  return zonedInstant(timeZone, w.year, w.month, w.day);
}

/** "Ho Chi Minh (GMT+7)": the city of the zone id and its offset at `at`. */
export function zoneLabel(timeZone: string, at: Date = new Date(), locale?: string): string {
  const off = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "shortOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value;
  const city = timeZone.split("/").pop()?.replace(/_/g, " ") ?? timeZone;
  return off ? `${city} (${off})` : city;
}

/** The viewer's zone. */
export const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
