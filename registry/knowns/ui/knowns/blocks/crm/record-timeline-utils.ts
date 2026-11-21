/**
 * Pure rules for RecordTimeline: grouping events by day in a time zone, day and time text, the type and person
 * filters, and the note draft. No DOM and no clock: `today` and `timeZone` come in as arguments.
 */

export type EventKind = "email" | "call" | "meeting" | "note" | "stage";

export const KIND_LABEL: Record<EventKind, string> = { email: "Email", call: "Call", meeting: "Meeting", note: "Note", stage: "Stage change" };
export const KIND_ORDER: EventKind[] = ["email", "call", "meeting", "note", "stage"];

export interface TimelineEvent {
  id: string;
  kind: EventKind;
  /** ISO date and time with a zone, such as 2026-11-19T14:05:00Z. */
  at: string;
  title: string;
  body?: string;
  /** Who did it: a teammate for a note or a call, the sender for an email. */
  author?: string;
  /** A short extra: "Sent", "Received", "32 min", "3 attendees". */
  detail?: string;
  /** Stage change only. */
  from?: string;
  to?: string;
}

export interface TimelineFilter {
  kinds: EventKind[];
  authors: string[];
}
export const NO_FILTER: TimelineFilter = { kinds: [], authors: [] };

const time = (at: string) => Date.parse(at);
export const validAt = (at: string) => !Number.isNaN(time(at));

/** YYYY-MM-DD of an instant in a zone. A bad date or zone falls back to UTC; an unreadable date gives "". */
export function dayKey(at: string, timeZone = "UTC"): string {
  const t = time(at);
  if (Number.isNaN(t)) return "";
  const parts = (zone: string) => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
  try {
    return parts(timeZone);
  } catch {
    return parts("UTC");
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** "Today", "Yesterday", "Nov 12", or "Nov 12, 2025" in another year. Without `today` there is no Today or Yesterday. */
export function dayLabel(key: string, today?: string): string {
  if (!ISO.test(key)) return "Undated";
  if (today && ISO.test(today)) {
    if (key === today) return "Today";
    const y = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    if (key === y) return "Yesterday";
  }
  const sameYear = today && ISO.test(today) ? key.slice(0, 4) === today.slice(0, 4) : true;
  return new Date(Date.parse(`${key}T00:00:00Z`)).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" });
}

/** "2:05 PM" in a zone. Empty for an unreadable date. */
export function timeText(at: string, timeZone = "UTC"): string {
  const t = time(at);
  if (Number.isNaN(t)) return "";
  const fmt = (zone: string) => new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" }).format(t);
  try {
    return fmt(timeZone);
  } catch {
    return fmt("UTC");
  }
}

/** Events that pass the filter: any chosen type and any chosen person (an empty list means all). */
export function applyFilter(events: TimelineEvent[], f: TimelineFilter): TimelineEvent[] {
  return events.filter((e) => (!f.kinds.length || f.kinds.includes(e.kind)) && (!f.authors.length || (e.author !== undefined && f.authors.includes(e.author))));
}

export interface DayGroup {
  key: string;
  label: string;
  events: TimelineEvent[];
}

/**
 * Days in order, events inside a day in the same order. "newest" (default) puts the latest first. An event with no
 * readable date goes in one "Undated" group at the end. Ties keep the order they came in.
 */
export function groupByDay(events: TimelineEvent[], o: { timeZone?: string; today?: string; order?: "newest" | "oldest" } = {}): DayGroup[] {
  const dir = o.order === "oldest" ? 1 : -1;
  const dated = events.filter((e) => validAt(e.at)).map((e, i) => ({ e, i }));
  dated.sort((a, b) => dir * (time(a.e.at) - time(b.e.at)) || a.i - b.i);
  const groups: DayGroup[] = [];
  for (const { e } of dated) {
    const key = dayKey(e.at, o.timeZone);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.events.push(e);
    else groups.push({ key, label: dayLabel(key, o.today), events: [e] });
  }
  const undated = events.filter((e) => !validAt(e.at));
  if (undated.length) groups.push({ key: "", label: "Undated", events: undated });
  return groups;
}

/** How many events of each type, for the filter menu. */
export function kindCounts(events: TimelineEvent[]): Record<EventKind, number> {
  const out: Record<EventKind, number> = { email: 0, call: 0, meeting: 0, note: 0, stage: 0 };
  for (const e of events) if (e.kind in out) out[e.kind] += 1;
  return out;
}

/** People who appear on events, in first-seen order. */
export function authorsOf(events: TimelineEvent[]): string[] {
  const seen = new Set<string>();
  for (const e of events) if (e.author) seen.add(e.author);
  return [...seen];
}

export const NOTE_LIMIT = 2000;

/** The note to send: trimmed, or null when it is empty or over the limit. */
export function noteToSend(draft: string, limit = NOTE_LIMIT): string | null {
  const t = draft.trim();
  return t && t.length <= limit ? t : null;
}

/** True when a body is long enough to be worth folding. */
export const isLong = (body: string | undefined, over = 200) => (body?.length ?? 0) > over || (body?.split("\n").length ?? 0) > 3;
