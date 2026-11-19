"use client";
/** @registry name="date-range-picker" type="ui" title="Date range picker" description="Range or single date in a popover: one or two month calendar, presets, keyboard grid navigation, min/max and disabled days, Field label/hint/error. Intl only, no date library." */

import { useEffect, useId, useState, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Popover } from "./popover";
import { SURFACE } from "./field-class";
import { Calendar } from "./calendar/calendar";
import { addDays, addMonths, clampDay, outOfBounds, sameDay, startOfDay, startOfMonth, type DateRange } from "./calendar/calendar-utils";

/* The calendar grid and the date helpers live in ./calendar; they are re-exported here so imports of this file keep working. */
export { Calendar, type CalendarProps } from "./calendar/calendar";
export { addDays, addMonths, clampDay, compareDay, dayKey, inRange, monthDays, moveFocus, outOfBounds, pickDay, sameDay, startOfDay, startOfMonth, weekdayNames, type DateRange } from "./calendar/calendar-utils";

export interface DatePreset {
  id: string;
  label: string;
  range: DateRange;
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
        "flex w-full min-w-0 cursor-pointer items-center text-left outline-none",
        SURFACE,
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
                      "w-full cursor-pointer whitespace-nowrap rounded-[8px] px-2.5 py-1.5 text-left text-[13px] text-muted-foreground transition-colors ease-(--kn-ease-out) duration-(--kn-dur-fast) hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
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
          className={cn("flex-none cursor-pointer rounded-[6px] px-1.5 py-0.5 text-[12.5px] font-medium text-muted-foreground transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:text-foreground", focusRing)}
        >
          Clear
        </button>
      )}
    </div>
  );
}
