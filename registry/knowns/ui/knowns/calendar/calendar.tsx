"use client";
/** @registry name="calendar" type="ui" title="Calendar" description="A month grid: single day, range or multiple days, one or two months, min/max and disabled days, controlled paging, a renderDay slot for dots and badges, full keyboard navigation. Intl only, no date library." */

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { EASE, MOTION } from "@/registry/knowns/lib/knowns/motion-utils";
import {
  addMonths,
  clampDay,
  compareDay,
  dayKey,
  inRange,
  monthGrid,
  moveFocus,
  outOfBounds,
  pickDay,
  sameDay,
  startOfDay,
  startOfMonth,
  toggleDay,
  weekdayNames,
  type DateRange,
} from "./calendar-utils";

/** What a day cell tells `renderDay`. */
export interface CalendarDayState {
  selected: boolean;
  disabled: boolean;
  today: boolean;
  /** A day of the neighbouring month (only with showOutsideDays). */
  outside: boolean;
}

interface CalendarBase {
  /** Months side by side. Default 1. */
  months?: 1 | 2;
  min?: Date;
  max?: Date;
  /** Extra days that can't be picked (weekends, holidays…). */
  isDateDisabled?: (d: Date) => boolean;
  /** 0 Sunday, 1 Monday (default). */
  weekStartsOn?: number;
  locale?: string;
  /** The month shown first, as any day in it, when the calendar keeps its own paging. Default: the month of the selection, else today. */
  defaultMonth?: Date;
  /** Controls the month shown first. Pair it with onMonthChange (it gets the 1st of the month). */
  month?: Date;
  onMonthChange?: (month: Date) => void;
  /** Draw the neighbouring months' days in the first and last week (one month only). Default false. */
  showOutsideDays?: boolean;
  /** Always draw six weeks, so the height does not change from month to month. Default true. */
  fixedWeeks?: boolean;
  /** Content inside each day button, under the number: dots, a count, a badge. It sits at the bottom of the cell and ignores the pointer. */
  renderDay?: (date: Date, state: CalendarDayState) => ReactNode;
  /** Focus the selected day (or today) when mounted, e.g. inside a popover. */
  autoFocus?: boolean;
  className?: string;
}

export type CalendarProps = CalendarBase &
  (
    | {
        /** "range" (default): two clicks. "single": one day, kept in `value.from`. */
        mode?: "range" | "single";
        value?: DateRange | null;
        /** Every click: the start alone, then the full range. */
        onValueChange?: (value: DateRange) => void;
        /** Once a range is complete (or a day picked in single mode). */
        onComplete?: (value: DateRange) => void;
      }
    | {
        /** "multiple": any number of days; a click adds or removes one. */
        mode: "multiple";
        value?: Date[] | null;
        onValueChange?: (value: Date[]) => void;
        onComplete?: never;
      }
  );

const Arrow = ({ dir }: { dir: "left" | "right" }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
    <path d={dir === "left" ? "M10 3.5 5.5 8l4.5 4.5" : "M6 3.5 10.5 8 6 12.5"} />
  </svg>
);

/** Inline month grid(s): single, range or multiple selection and full keyboard support. Used by DatePicker and DateRangePicker; usable alone. */
export function Calendar(props: CalendarProps) {
  const { months = 1, min, max, isDateDisabled, weekStartsOn = 1, locale, defaultMonth, month, onMonthChange, showOutsideDays = false, fixedWeeks = true, renderDay, autoFocus, className } = props;
  const mode = props.mode ?? "range";
  const multiple = props.mode === "multiple";
  // One shape to work with: a range for single and range, a day list for multiple.
  const value: DateRange | null | undefined = multiple ? undefined : props.value;
  const picked: readonly Date[] = multiple ? (props.value ?? []) : [];
  const today = useMemo(() => startOfDay(new Date()), []);
  const first = multiple ? picked[0] : value?.from;
  const initial = clampDay(first ?? defaultMonth ?? today, min, max);
  const [viewState, setViewState] = useState(() => {
    if (defaultMonth && !first) return startOfMonth(defaultMonth);
    // Show the end month too when a range spans into the next month.
    const end = value?.to ?? value?.from;
    if (months === 2 && end && value && compareDay(startOfMonth(end), startOfMonth(value.from)) > 0) return startOfMonth(addMonths(end, -1));
    return startOfMonth(initial);
  });
  const view = month ? startOfMonth(month) : viewState;
  const setView = (v: Date) => {
    setViewState(v);
    if (!month || compareDay(v, view) !== 0) onMonthChange?.(v);
  };
  const [focus, setFocus] = useState(initial);
  const [hover, setHover] = useState<Date | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const id = useId();

  // A real month change nudges the new months 8px from the side you went to. Nothing plays on first render.
  const shownKey = dayKey(view);
  const lastView = useRef(view);
  useEffect(() => {
    const prev = lastView.current;
    lastView.current = view;
    if (compareDay(prev, view) === 0) return;
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const dir = compareDay(view, prev) > 0 ? 1 : -1;
    for (const el of root.current?.querySelectorAll<HTMLElement>("[data-cal-nudge]") ?? []) el.animate?.([{ opacity: 0, transform: `translateX(${dir * 8}px)` }, { opacity: 1, transform: "none" }], { duration: MOTION.base, easing: EASE.out });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownKey]);

  const blocked = (d: Date) => outOfBounds(d, min, max) || !!isDateDisabled?.(d);
  const shown = Array.from({ length: months }, (_, i) => addMonths(view, i));
  const lastShown = shown[shown.length - 1] ?? view;

  const focusDay = (d: Date) => root.current?.querySelector<HTMLButtonElement>(`[data-day="${dayKey(d)}"]`)?.focus();

  // Move DOM focus after a keyboard move (the target may only exist after the view shifts).
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    focusDay(focus);
  });

  // Inside a popover the panel is hidden until it is placed: wait for it, then focus the day.
  useEffect(() => {
    if (!autoFocus) return;
    let frames = 0;
    let raf = 0;
    const tryFocus = () => {
      const btn = root.current?.querySelector<HTMLButtonElement>(`[data-day="${dayKey(focus)}"]`);
      if (btn && getComputedStyle(btn).visibility !== "hidden") btn.focus({ preventScroll: true });
      else if (frames++ < 30) raf = requestAnimationFrame(tryFocus);
    };
    raf = requestAnimationFrame(tryFocus);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (d: Date) => {
    if (blocked(d)) return;
    if (props.mode === "multiple") {
      props.onValueChange?.(toggleDay(picked, d));
    } else {
      const next = pickDay(value, d, mode as "range" | "single");
      props.onValueChange?.(next);
      if (mode === "single" || next.to) props.onComplete?.(next);
    }
    // A day of a neighbouring month (showOutsideDays) pages to its month.
    if (months === 1 && compareDay(startOfMonth(d), view) !== 0) setView(startOfMonth(d));
    setFocus(d);
    setHover(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Only the day grid is keyboard-driven; the month buttons keep their own Enter / Space.
    if (!(e.target as HTMLElement).dataset.day) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(focus);
      return;
    }
    const raw = moveFocus(focus, e.key, { weekStartsOn, shift: e.shiftKey });
    if (!raw) return;
    e.preventDefault();
    const next = clampDay(raw, min, max);
    if (compareDay(startOfMonth(next), view) < 0) setView(startOfMonth(next));
    else if (compareDay(startOfMonth(next), startOfMonth(lastShown)) > 0) setView(startOfMonth(addMonths(next, -(months - 1))));
    setFocus(next);
    if (value && !value.to && mode === "range") setHover(next);
    moved.current = true;
  };

  const page = (n: number) => {
    const v = addMonths(view, n);
    setView(v);
    // Keep the roving focus inside what is shown.
    if (compareDay(focus, v) < 0 || compareDay(focus, addMonths(v, months)) >= 0) setFocus(clampDay(v, min, max));
  };
  const canPrev = !min || compareDay(view, startOfMonth(min)) > 0;
  const canNext = !max || compareDay(startOfMonth(lastShown), startOfMonth(max)) < 0;

  const names = weekdayNames(locale, weekStartsOn);
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const previewEnd = value && !value.to && mode === "range" ? hover : null;

  const navBtn = cn(
    "grid size-7 cursor-pointer place-items-center rounded-[8px] text-muted-foreground transition-colors ease-(--kn-ease-out) duration-(--kn-dur-fast) hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35",
    focusRing,
  );

  return (
    <div ref={root} className={cn("flex flex-col gap-3 sm:flex-row sm:gap-6", className)} onKeyDown={onKeyDown} onMouseLeave={() => setHover(null)}>
      {shown.map((m, mi) => {
        const headingId = `${id}-m${mi}`;
        const days = monthGrid(m.getFullYear(), m.getMonth(), weekStartsOn, { outside: showOutsideDays && months === 1, fixed: fixedWeeks });
        return (
          <div key={dayKey(m)} className="flex w-[17.5rem] max-w-full flex-col gap-2">
            <div className="flex h-7 items-center justify-between">
              {mi === 0 ? (
                <button type="button" className={navBtn} onClick={() => page(-1)} disabled={!canPrev} aria-label="Previous month">
                  <Arrow dir="left" />
                </button>
              ) : (
                <span className="size-7" />
              )}
              <div id={headingId} aria-live="polite" data-cal-nudge="" className="text-[13.5px] font-semibold tracking-tight">
                {monthFmt.format(m)}
              </div>
              {mi === shown.length - 1 ? (
                <button type="button" className={navBtn} onClick={() => page(1)} disabled={!canNext} aria-label="Next month">
                  <Arrow dir="right" />
                </button>
              ) : (
                <span className="size-7" />
              )}
            </div>
            <table role="grid" data-cal-nudge="" aria-labelledby={headingId} aria-multiselectable={mode === "range" || multiple || undefined} className="w-full border-collapse">
              <thead>
                <tr>
                  {names.map((n) => (
                    <th key={n.long} scope="col" abbr={n.long} className="h-7 text-center text-[11.5px] font-medium text-muted-foreground">
                      {n.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: days.length / 7 }, (_, w) => (
                  <tr key={w}>
                    {days.slice(w * 7, w * 7 + 7).map((d, di) => {
                      if (!d) return <td key={di} />;
                      const outside = d.getMonth() !== m.getMonth();
                      const from = value?.from;
                      const to = value?.to ?? previewEnd ?? undefined;
                      const isStart = sameDay(d, from) || (!!previewEnd && !value?.to && sameDay(d, previewEnd) && compareDay(previewEnd, from!) < 0);
                      const isEnd = (!!value?.to && sameDay(d, value.to)) || (!!previewEnd && sameDay(d, previewEnd) && compareDay(previewEnd, from!) >= 0);
                      const lo = from && to ? (compareDay(from, to) <= 0 ? from : to) : from;
                      const hi = from && to ? (compareDay(from, to) <= 0 ? to : from) : from;
                      const edgeStart = !!lo && sameDay(d, lo);
                      const edgeEnd = !!hi && sameDay(d, hi);
                      const inside = inRange(d, from, to);
                      const band = (inside || ((edgeStart || edgeEnd) && !!to && !sameDay(lo, hi))) && mode === "range";
                      const inPicked = multiple && picked.some((p) => sameDay(p, d));
                      const selected = inPicked || sameDay(d, value?.from) || sameDay(d, value?.to) || (!!value?.to && inRange(d, value.from, value.to));
                      const disabled = blocked(d);
                      const isToday = sameDay(d, today);
                      const extra = renderDay?.(d, { selected, disabled, today: isToday, outside });
                      return (
                        <td key={di} role="gridcell" aria-selected={selected || undefined} className="relative p-0 text-center">
                          {band && (
                            <span
                              aria-hidden="true"
                              className={cn(
                                "absolute inset-y-0.5 bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)]",
                                edgeStart ? "left-1/2 right-0" : edgeEnd ? "left-0 right-1/2" : "inset-x-0",
                                !value?.to && "bg-[color-mix(in_srgb,var(--foreground)_4.5%,transparent)]",
                              )}
                            />
                          )}
                          <button
                            type="button"
                            data-day={dayKey(d)}
                            data-outside={outside || undefined}
                            tabIndex={sameDay(d, focus) ? 0 : -1}
                            aria-label={`${dayFmt.format(d)}${isToday ? ", today" : ""}`}
                            aria-disabled={disabled || undefined}
                            onClick={() => select(d)}
                            onMouseEnter={() => mode === "range" && value && !value.to && !disabled && setHover(d)}
                            onFocus={() => setFocus(d)}
                            className={cn(
                              "relative mx-auto grid size-9 cursor-pointer place-items-center rounded-[9px] text-[13px] tabular-nums outline-none transition-[background-color,color,box-shadow] duration-(--kn-dur-fast) ease-(--kn-ease-out) pointer-coarse:size-10",
                              "focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_3.5px_var(--ring)]",
                              isStart || isEnd || (mode === "single" && sameDay(d, value?.from)) || inPicked
                                ? "bg-primary font-medium text-primary-foreground"
                                : "text-foreground hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]",
                              outside && !selected && "text-muted-foreground/60",
                              disabled && "cursor-not-allowed text-muted-foreground/45 hover:bg-transparent",
                              // Inside a range band a blocked day keeps the band whole: muted number, no strike.
                              disabled && !band && "line-through decoration-muted-foreground/30",
                            )}
                          >
                            {d.getDate()}
                            {isToday && <span aria-hidden="true" className={cn("absolute left-1/2 size-1 -translate-x-1/2 rounded-full bg-current opacity-70", extra ? "top-1" : "bottom-1")} />}
                            {extra && <span className="pointer-events-none absolute inset-x-0 bottom-0.5 flex justify-center gap-0.5">{extra}</span>}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

export default Calendar;
