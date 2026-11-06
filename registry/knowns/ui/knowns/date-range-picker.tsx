"use client";
/** @registry name="date-range-picker" type="ui" title="Date range picker" description="Range or single date in a popover: one or two month calendar, presets, keyboard grid navigation, min/max and disabled days, Field label/hint/error. Intl only, no date library." */

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Popover } from "./popover";

/** A day range. `to` is missing while only the start is picked, and always in single-date mode. */
export interface DateRange {
  from: Date;
  to?: Date;
}

export interface DatePreset {
  id: string;
  label: string;
  range: DateRange;
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

/** Common ranges ending today. */
export function defaultPresets(today = new Date()): DatePreset[] {
  const t = startOfDay(today);
  const som = startOfMonth(t);
  const lastMonthStart = addMonths(som, -1);
  return [
    { id: "today", label: "Today", range: { from: t, to: t } },
    { id: "yesterday", label: "Yesterday", range: { from: addDays(t, -1), to: addDays(t, -1) } },
    { id: "7d", label: "Last 7 days", range: { from: addDays(t, -6), to: t } },
    { id: "30d", label: "Last 30 days", range: { from: addDays(t, -29), to: t } },
    { id: "month", label: "This month", range: { from: som, to: t } },
    { id: "last-month", label: "Last month", range: { from: lastMonthStart, to: addDays(som, -1) } },
    { id: "year", label: "This year", range: { from: new Date(t.getFullYear(), 0, 1), to: t } },
  ];
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

/** "Mar 3 – Mar 9, 2026", "Mar 3, 2026" or "" - via Intl.DateTimeFormat.formatRange where available. */
export function formatRange(range: DateRange | null | undefined, locale?: string): string {
  if (!range) return "";
  const fmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" });
  if (!range.to || sameDay(range.from, range.to)) return fmt.format(range.from);
  const f = fmt as Intl.DateTimeFormat & { formatRange?: (a: Date, b: Date) => string };
  return f.formatRange ? f.formatRange(range.from, range.to) : `${fmt.format(range.from)} – ${fmt.format(range.to)}`;
}

/** Same range (by day)? */
export const sameRange = (a?: DateRange | null, b?: DateRange | null) => (!a && !b) || (!!a && !!b && sameDay(a.from, b.from) && (sameDay(a.to, b.to) || (!a.to && !b.to)));

/* ── Calendar ── */

export interface CalendarProps {
  value?: DateRange | null;
  /** Every click: the start alone, then the full range. */
  onValueChange?: (value: DateRange) => void;
  /** Once a range is complete (or a day picked in single mode). */
  onComplete?: (value: DateRange) => void;
  mode?: "range" | "single";
  /** Months side by side. Default 1. */
  months?: 1 | 2;
  min?: Date;
  max?: Date;
  /** Extra days that can't be picked (weekends, holidays…). */
  isDateDisabled?: (d: Date) => boolean;
  /** 0 Sunday, 1 Monday (default). */
  weekStartsOn?: number;
  locale?: string;
  /** Focus the selected day (or today) when mounted, e.g. inside a popover. */
  autoFocus?: boolean;
  className?: string;
}

const Arrow = ({ dir }: { dir: "left" | "right" }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
    <path d={dir === "left" ? "M10 3.5 5.5 8l4.5 4.5" : "M6 3.5 10.5 8 6 12.5"} />
  </svg>
);

/** Inline month grid(s) with range selection and full keyboard support. Used by DateRangePicker; usable alone. */
export function Calendar({
  value,
  onValueChange,
  onComplete,
  mode = "range",
  months = 1,
  min,
  max,
  isDateDisabled,
  weekStartsOn = 1,
  locale,
  autoFocus,
  className,
}: CalendarProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const initial = clampDay(value?.from ?? today, min, max);
  const [view, setView] = useState(() => {
    // Show the end month too when a range spans into the next month.
    const end = value?.to ?? value?.from;
    if (months === 2 && end && value && compareDay(startOfMonth(end), startOfMonth(value.from)) > 0) return startOfMonth(addMonths(end, -1));
    return startOfMonth(initial);
  });
  const [focus, setFocus] = useState(initial);
  const [hover, setHover] = useState<Date | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const id = useId();

  const blocked = (d: Date) => outOfBounds(d, min, max) || !!isDateDisabled?.(d);
  const shown = Array.from({ length: months }, (_, i) => addMonths(view, i));
  const lastShown = shown[shown.length - 1];

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
    const next = pickDay(value, d, mode);
    onValueChange?.(next);
    setFocus(d);
    setHover(null);
    if (mode === "single" || next.to) onComplete?.(next);
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
    "grid size-7 cursor-pointer place-items-center rounded-[8px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35",
    focusRing,
  );

  return (
    <div ref={root} className={cn("flex flex-col gap-3 sm:flex-row sm:gap-6", className)} onKeyDown={onKeyDown} onMouseLeave={() => setHover(null)}>
      {shown.map((m, mi) => {
        const headingId = `${id}-m${mi}`;
        const days = monthDays(m.getFullYear(), m.getMonth(), weekStartsOn);
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
              <div id={headingId} aria-live="polite" className="text-[13.5px] font-semibold tracking-tight">
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
            <table role="grid" aria-labelledby={headingId} aria-multiselectable={mode === "range" || undefined} className="w-full border-collapse">
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
                {Array.from({ length: 6 }, (_, w) => (
                  <tr key={w}>
                    {days.slice(w * 7, w * 7 + 7).map((d, di) => {
                      if (!d) return <td key={di} />;
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
                      const selected = sameDay(d, value?.from) || sameDay(d, value?.to) || (!!value?.to && inRange(d, value.from, value.to));
                      const disabled = blocked(d);
                      const isToday = sameDay(d, today);
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
                            tabIndex={sameDay(d, focus) ? 0 : -1}
                            aria-label={`${dayFmt.format(d)}${isToday ? ", today" : ""}`}
                            aria-disabled={disabled || undefined}
                            onClick={() => select(d)}
                            onMouseEnter={() => mode === "range" && value && !value.to && !disabled && setHover(d)}
                            onFocus={() => setFocus(d)}
                            className={cn(
                              "relative mx-auto grid size-9 cursor-pointer place-items-center rounded-[9px] text-[13px] tabular-nums outline-none transition-[background-color,color,box-shadow] duration-150 ease-out pointer-coarse:size-10",
                              "focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_3.5px_var(--ring)]",
                              isStart || isEnd || (mode === "single" && sameDay(d, value?.from))
                                ? "bg-primary font-medium text-primary-foreground"
                                : "text-foreground hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]",
                              disabled && "cursor-not-allowed text-muted-foreground/45 line-through decoration-muted-foreground/30 hover:bg-transparent",
                            )}
                          >
                            {d.getDate()}
                            {isToday && <span aria-hidden="true" className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current opacity-70" />}
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

/* ── DateRangePicker ── */

function useWide() {
  const [wide, setWide] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(min-width: 640px)").matches);
  useEffect(() => {
    const mq = matchMedia("(min-width: 640px)");
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

const CalIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
    <rect x="2.25" y="3" width="11.5" height="10.75" rx="2.25" />
    <path d="M2.25 6.5h11.5M5.5 1.75v2.5M10.5 1.75v2.5" />
  </svg>
);

const TRIGGER_SIZE = {
  sm: "h-7 gap-1.5 rounded-[8px] px-2.5 text-[12.5px] [&_svg]:size-3.5 pointer-coarse:h-9",
  md: "h-8 gap-2 rounded-[9px] px-3 text-[13.5px] [&_svg]:size-4 pointer-coarse:h-10",
  lg: "h-9 gap-2 rounded-[10px] px-3.5 text-sm [&_svg]:size-[17px] pointer-coarse:h-11",
};

export interface DateRangePickerProps {
  /** "range" (default) or "single": one day, kept in `value.from`. */
  mode?: "range" | "single";
  value?: DateRange | null;
  defaultValue?: DateRange | null;
  /** Called with a complete range (or a day in single mode), or null when cleared. */
  onValueChange?: (value: DateRange | null) => void;
  min?: Date;
  max?: Date;
  isDateDisabled?: (d: Date) => boolean;
  /** Quick ranges beside the calendar. true = Today, Yesterday, Last 7/30 days, This/Last month, This year. Default true in range mode. */
  presets?: boolean | DatePreset[];
  /** Months side by side. Default: 2 from 640px wide, 1 below. */
  months?: 1 | 2;
  weekStartsOn?: number;
  /** BCP 47 locale for month and day names; default the browser's. */
  locale?: string;
  placeholder?: string;
  /** Shows a Clear button in the panel. Default true. */
  clearable?: boolean;
  size?: "sm" | "md" | "lg";
  invalid?: boolean;
  disabled?: boolean;
  align?: "start" | "center" | "end";
  /** id of the trigger, for a Field label. */
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
}

/** A field-style button that opens one or two months with presets. Picks a range or a single day; Intl only, no date library. */
export function DateRangePicker({
  mode = "range",
  value: valueProp,
  defaultValue = null,
  onValueChange,
  min,
  max,
  isDateDisabled,
  presets,
  months: monthsProp,
  weekStartsOn = 1,
  locale,
  placeholder,
  clearable = true,
  size = "md",
  invalid,
  disabled,
  align = "start",
  id,
  className,
  "aria-label": label,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": required,
}: DateRangePickerProps) {
  const [own, setOwn] = useState<DateRange | null>(defaultValue);
  const committed = valueProp !== undefined ? valueProp : own;
  const [draft, setDraft] = useState<DateRange | null>(committed);
  const [open, setOpen] = useState(false);
  const wide = useWide();
  const months = monthsProp ?? (wide && mode === "range" ? 2 : 1);
  const list: DatePreset[] = presets === false || (presets === undefined && mode === "single") ? [] : Array.isArray(presets) ? presets : defaultPresets();
  const bad = invalid || ariaInvalid;
  // In a Field, the <label for> names the trigger and hides its text, so describe it with the value.
  const valueId = useId();

  const commit = (v: DateRange | null) => {
    if (valueProp === undefined) setOwn(v);
    if (!sameRange(v, committed)) onValueChange?.(v);
  };
  const openChange = (o: boolean) => {
    setOpen(o);
    // Opening starts from the committed value; closing with only a start picked discards it.
    setDraft(committed);
  };

  const text = formatRange(committed, locale);
  const placeholderText = placeholder ?? (mode === "single" ? "Pick a date" : "Pick a date range");
  const activePreset = list.find((p) => sameRange(p.range, draft));

  const trigger = (
    <button
      type="button"
      id={id}
      disabled={disabled}
      aria-label={label ? `${label}${text ? `: ${text}` : ""}` : undefined}
      aria-describedby={label ? describedBy : [valueId, describedBy].filter(Boolean).join(" ")}
      aria-invalid={bad || undefined}
      aria-required={required || undefined}
      className={cn(
        "flex w-full min-w-0 cursor-pointer items-center bg-card text-left text-foreground outline-none",
        "shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_14%,transparent),0_1px_2px_rgb(0_0_0/0.04)] transition-[box-shadow] duration-200 ease-out dark:bg-[color-mix(in_srgb,var(--muted)_35%,var(--card))]",
        "focus-visible:shadow-[0_0_0_1px_color-mix(in_srgb,var(--ring)_80%,transparent),0_0_0_4px_color-mix(in_srgb,var(--ring)_22%,transparent)]",
        "aria-expanded:shadow-[0_0_0_1px_color-mix(in_srgb,var(--ring)_80%,transparent),0_0_0_4px_color-mix(in_srgb,var(--ring)_22%,transparent)]",
        "aria-invalid:shadow-[0_0_0_1px_rgb(239_68_68/0.6),0_0_0_4px_rgb(239_68_68/0.12)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        TRIGGER_SIZE[size],
        className,
      )}
    >
      <span className="grid flex-none text-muted-foreground">
        <CalIcon />
      </span>
      <span id={valueId} className={cn("min-w-0 flex-1 truncate tabular-nums", !text && "text-muted-foreground")}>{text || placeholderText}</span>
    </button>
  );

  return (
    <Popover trigger={trigger} open={open} onOpenChange={openChange} align={align} aria-label={mode === "single" ? "Choose a date" : "Choose a date range"} className="max-w-[calc(100vw-16px)] p-0">
      <div className="flex flex-col sm:flex-row">
        {list.length > 0 && (
          <ul
            aria-label="Presets"
            className="flex gap-1 overflow-x-auto border-b p-2 [scrollbar-width:none] sm:w-36 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r"
          >
            {list.map((p) => {
              const off = outOfBounds(p.range.from, min, max) && outOfBounds(p.range.to ?? p.range.from, min, max);
              const on = p === activePreset;
              return (
                <li key={p.id} className="flex-none">
                  <button
                    type="button"
                    disabled={off}
                    aria-pressed={on}
                    onClick={() => {
                      const r = { from: clampDay(p.range.from, min, max), to: clampDay(p.range.to ?? p.range.from, min, max) };
                      setDraft(r);
                      commit(r);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full cursor-pointer whitespace-nowrap rounded-[8px] px-2.5 py-1.5 text-left text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
                      on && "bg-muted font-medium text-foreground",
                      focusRing,
                    )}
                  >
                    {p.label}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex flex-col">
          <Calendar
            className="p-3"
            value={draft}
            onValueChange={setDraft}
            onComplete={(r) => {
              commit(r);
              setOpen(false);
            }}
            mode={mode}
            months={months}
            min={min}
            max={max}
            isDateDisabled={isDateDisabled}
            weekStartsOn={weekStartsOn}
            locale={locale}
            autoFocus
          />
          <PickerFooter
            text={draft ? (draft.to || mode === "single" ? formatRange(draft, locale) : `${formatRange(draft, locale)} – pick an end date`) : "No date selected"}
            onClear={
              clearable && (committed || draft)
                ? () => {
                    setDraft(null);
                    commit(null);
                  }
                : undefined
            }
          />
        </div>
      </div>
    </Popover>
  );
}

function PickerFooter({ text, onClear }: { text: ReactNode; onClear?: () => void }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-t px-3 py-2">
      <p className="min-w-0 truncate text-[12.5px] tabular-nums text-muted-foreground" aria-live="polite">
        {text}
      </p>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className={cn("flex-none cursor-pointer rounded-[6px] px-1.5 py-0.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground", focusRing)}
        >
          Clear
        </button>
      )}
    </div>
  );
}
