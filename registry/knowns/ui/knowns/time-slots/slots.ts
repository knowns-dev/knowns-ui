/** @registry part-of="time-slots" */
/* Pure slot maths for TimeSlots: the bookable times of one day, minus what is busy. No React. */
import { wallTime, zonedInstant } from "../calendar/calendar-zone";

export interface TimeSlot {
  /** The instant the slot starts. */
  start: Date;
  end: Date;
  /** Not bookable (busy, or already past). */
  disabled?: boolean;
  /** Why, or a hint ("Booked", "2 left"). */
  note?: string;
}

export interface Interval {
  start: Date;
  end: Date;
}

export interface BuildSlotsOptions {
  /** The day, read as a calendar day in `timeZone` (year, month and day of the Date's local fields). */
  day: Date;
  /** The zone the working hours are in (the host's), IANA. Default the viewer's. */
  timeZone?: string;
  /** Working hours, "HH:MM" 24-hour. Default 09:00 to 17:00. */
  from?: string;
  to?: string;
  /** Minutes between slot starts. Default 30. */
  step?: number;
  /** Minutes a slot lasts. Default the step. */
  duration?: number;
  /** Busy intervals. A slot that overlaps one is disabled with the note "Booked". */
  busy?: readonly Interval[];
  /** Slots that start before this instant are disabled ("Past"). Default none. */
  notBefore?: Date;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m ?? 0);
};

/**
 * Every slot of `day` between `from` and `to`, generated on the host's clock in `timeZone`, so a 09:00 to 17:00 day in
 * Ho Chi Minh is 09:00 to 17:00 there whoever looks at it. A slot that would end after `to` is left out. On a day with a
 * clock change the slots follow the wall clock: a slot inside the missing hour is dropped, and the repeated hour appears once.
 */
export function buildSlots(o: BuildSlotsOptions): TimeSlot[] {
  const tz = o.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const step = Math.max(1, o.step ?? 30);
  const duration = Math.max(1, o.duration ?? step);
  const from = toMinutes(o.from ?? "09:00");
  const to = toMinutes(o.to ?? "17:00");
  const y = o.day.getFullYear();
  const mo = o.day.getMonth() + 1;
  const d = o.day.getDate();
  const out: TimeSlot[] = [];
  const seen = new Set<number>();
  for (let m = from; m + duration <= to; m += step) {
    const start = zonedInstant(tz, y, mo, d, Math.floor(m / 60), m % 60);
    // A wall time inside the missing hour moved forward onto a later slot: keep one.
    if (seen.has(start.getTime()) || wallTime(start, tz).day !== d) continue;
    seen.add(start.getTime());
    const end = new Date(start.getTime() + duration * 60000);
    const busy = o.busy?.some((b) => start < b.end && end > b.start);
    const past = !!o.notBefore && start < o.notBefore;
    out.push({ start, end, ...(busy || past ? { disabled: true, note: busy ? "Booked" : "Past" } : {}) });
  }
  return out;
}

/** The slots a viewer can still pick. */
export const freeSlots = (slots: readonly TimeSlot[]) => slots.filter((s) => !s.disabled);
