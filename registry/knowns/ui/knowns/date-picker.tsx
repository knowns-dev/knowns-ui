"use client";
/** @registry name="date-picker" type="ui" title="Date picker" description="One date, optionally with a time: a typeable field that reads ISO, locale-ordered numbers, month names, today/tomorrow, 'next fri', 'in 3 days' and '3pm', with a live preview and a calendar popover; or a button or an inline panel. Quick picks, min/max, disabled days, Intl only." */

/**
 * Date Picker: one date (optionally with a time). Three shapes:
 * - "field" (default): a text field you can type into ("2026-11-20", "20/11", "Nov 20", "tomorrow",
 *   "next fri", "in 3 days", plus "3pm" or "15:30" when `time` is on). It shows what it understood as you
 *   type and formats on blur or Enter; a calendar button opens quick picks and a month grid.
 * - "button": a field-style button that opens the same panel.
 * - "inline": the panel itself, for a sidebar or a scheduling step.
 * Intl only, no date library. Reuses Calendar from Date Range Picker.
 */
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { SURFACE } from "./field-class";
import { Popover } from "./popover";
import { Calendar } from "./calendar/calendar";
import { clampDay, outOfBounds, sameDay, startOfDay } from "./calendar/calendar-utils";

import { parseDateInput, withTime, formatDate, timeValue, dateProblem, defaultQuickPicks, type DateQuickPick } from "./date-picker-utils";

export { dateOrder, parseTime, parseDateInput, withTime, formatDate, timeValue, dateProblem, defaultQuickPicks } from "./date-picker-utils";
export type { DateQuickPick } from "./date-picker-utils";

/* ── Pieces ── */

const CalIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" className="size-4">
    <rect x="2.25" y="3" width="11.5" height="10.75" rx="2.25" />
    <path d="M2.25 6.5h11.5M5.5 1.75v2.5M10.5 1.75v2.5" />
  </svg>
);

const FIELD_SIZE = {
  sm: "h-7 gap-2 rounded-[8px] pl-3 pr-1 text-[12.5px] pointer-coarse:h-9",
  md: "h-8 gap-2 rounded-[9px] pl-3 pr-1 text-[13.5px] pointer-coarse:h-10",
  lg: "h-9 gap-2 rounded-[10px] pl-3.5 pr-1 text-sm pointer-coarse:h-11",
};

const frame = cn(
  "flex w-full min-w-0 items-center",
  SURFACE,
  "focus-within:shadow-[0_0_0_1px_color-mix(in_srgb,var(--ring)_80%,transparent),0_0_0_4px_color-mix(in_srgb,var(--ring)_22%,transparent)]",
  "has-[[aria-invalid=true]]:shadow-[0_0_0_1px_rgb(239_68_68/0.6),0_0_0_4px_rgb(239_68_68/0.12)]",
  "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
);

interface PanelProps {
  value: Date | null;
  onPick: (d: Date) => void;
  onClear?: () => void;
  /** Inline: fill the box (the calendar stretches, the footer spans the width at the bottom). */
  fill?: boolean;
  picks: DateQuickPick[];
  time: boolean;
  minuteStep: number;
  min?: Date;
  max?: Date;
  isDateDisabled?: (d: Date) => boolean;
  weekStartsOn: number;
  locale?: string;
  autoFocus?: boolean;
  /** Time changes apply at once (inline) or with the day (popover). */
  onTime: (t: { h: number; m: number }) => void;
}

function Panel({ value, onPick, onClear, picks, time, minuteStep, min, max, isDateDisabled, weekStartsOn, locale, autoFocus, onTime, fill }: PanelProps) {
  const timeId = useId();
  const blocked = (d: Date) => outOfBounds(d, min, max) || !!isDateDisabled?.(d);
  const keepTime = (d: Date) => (time && value ? withTime(d, { h: value.getHours(), m: value.getMinutes() }) : d);
  return (
    <div className={cn("flex flex-col sm:flex-row", fill && "flex-1")}>
      {picks.length > 0 && (
        <ul aria-label="Quick picks" className="flex gap-1 overflow-x-auto border-b p-2 [scrollbar-width:none] sm:w-36 sm:flex-col sm:overflow-visible sm:border-r sm:border-b-0">
          {picks.map((p) => {
            const on = !!value && sameDay(value, p.date);
            return (
              <li key={p.id} className="flex-none">
                <button
                  type="button"
                  disabled={blocked(p.date)}
                  aria-pressed={on}
                  onClick={() => onPick(keepTime(p.date))}
                  className={cn(
                    "w-full cursor-pointer whitespace-nowrap rounded-lg px-3 py-2 text-left text-[13px] text-muted-foreground transition-colors ease-(--kn-ease-out) duration-(--kn-dur-fast) hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
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
      <div className={cn("flex flex-col", fill && "min-w-0 flex-1")}>
        <Calendar
          className={fill ? "p-4 [&>div]:w-full" : "p-3"}
          mode="single"
          value={value ? { from: value } : null}
          onComplete={(r) => onPick(keepTime(r.from))}
          min={min}
          max={max}
          isDateDisabled={isDateDisabled}
          weekStartsOn={weekStartsOn}
          locale={locale}
          autoFocus={autoFocus}
        />
        {time && (
          <div className="flex items-center justify-between gap-3 border-t px-3 py-2">
            <label htmlFor={timeId} className="text-[13px] text-muted-foreground">
              Time
            </label>
            <input
              id={timeId}
              type="time"
              step={minuteStep * 60}
              value={timeValue(value) || "09:00"}
              onChange={(e) => {
                const [h = Number.NaN, m = Number.NaN] = e.target.value.split(":").map(Number);
                if (Number.isFinite(h) && Number.isFinite(m)) onTime({ h, m });
              }}
              className={cn("h-8 rounded-[9px] bg-card px-2 text-[13px] tabular-nums shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_14%,transparent)] outline-none", focusRing)}
            />
          </div>
        )}
        <div className={cn("flex min-h-11 items-center justify-between gap-3 border-t px-3 py-2", fill && "mt-auto px-4")}>
          <p className="min-w-0 truncate text-[13px] tabular-nums text-muted-foreground" aria-live="polite">
            {value ? formatDate(value, { locale, time }) : "No date selected"}
          </p>
          {onClear && value && (
            <button type="button" onClick={onClear} className={cn("flex-none cursor-pointer rounded-lg px-2 py-1 text-[13px] font-medium text-muted-foreground transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:text-foreground", focusRing)}>
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── DatePicker ── */

export interface DatePickerProps {
  value?: Date | null;
  defaultValue?: Date | null;
  /** The picked date (with the time when `time` is on), or null when cleared. */
  onValueChange?: (value: Date | null) => void;
  variant?: "field" | "button" | "inline";
  /** Adds a time. Typed times ("3pm") and the time input both set it. */
  time?: boolean;
  /** Time input step in minutes. Default 15. */
  minuteStep?: number;
  min?: Date;
  max?: Date;
  isDateDisabled?: (d: Date) => boolean;
  /** Quick picks beside the calendar. true = Today, Tomorrow, Next Monday, In a week, In a month. Default true. */
  quickPicks?: boolean | DateQuickPick[];
  weekStartsOn?: number;
  /** BCP 47 locale for names, formatting and the order typed numbers are read in. */
  locale?: string;
  placeholder?: string;
  clearable?: boolean;
  size?: "sm" | "md" | "lg";
  invalid?: boolean;
  disabled?: boolean;
  align?: "start" | "center" | "end";
  /** id of the input (field) or trigger (button), for a Field label. */
  id?: string;
  name?: string;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
}

export function DatePicker({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  variant = "field",
  time = false,
  minuteStep = 15,
  min,
  max,
  isDateDisabled,
  quickPicks = true,
  weekStartsOn = 1,
  locale,
  placeholder,
  clearable = true,
  size = "md",
  invalid,
  disabled,
  align = "start",
  id,
  name,
  className,
  "aria-label": label,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": required,
}: DatePickerProps) {
  const [own, setOwn] = useState<Date | null>(defaultValue);
  const value = valueProp !== undefined ? valueProp : own;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const hintId = useId();
  const picks = useMemo(() => (quickPicks === false ? [] : Array.isArray(quickPicks) ? quickPicks : defaultQuickPicks()), [quickPicks]);
  const rules = { min, max, isDateDisabled, locale };

  const commit = (d: Date | null) => {
    const next = d ? (time ? d : startOfDay(d)) : null;
    if (valueProp === undefined) setOwn(next);
    const same = (!next && !value) || (!!next && !!value && next.getTime() === value.getTime());
    if (!same) onValueChange?.(next);
  };

  const text = formatDate(value, { locale, time });
  const ph = placeholder ?? (time ? "Date and time, e.g. tomorrow 3pm" : "Pick or type a date");

  // What the field understood from the draft, and whether it can be used.
  const parsed = draft !== null && draft.trim() ? parseDateInput(draft, { locale }) : null;
  const parsedDate = parsed ? withTime(parsed.date, time ? (parsed.time ?? (value ? { h: value.getHours(), m: value.getMinutes() } : null)) : null) : null;
  const problem = draft !== null && draft.trim() ? (parsedDate ? dateProblem(parsedDate, rules) : "Not a date I can read") : null;
  const bad = invalid || ariaInvalid || !!problem;

  const settle = () => {
    if (draft === null) return;
    if (!draft.trim()) {
      if (clearable) commit(null);
      setDraft(null);
      return;
    }
    if (parsedDate && !problem) {
      commit(parsedDate);
      setDraft(null);
    }
    // A bad draft stays so it can be fixed; the field shows why.
  };

  const panel = (autoFocus: boolean, close: () => void, fill = false) => (
    <Panel
      fill={fill}
      value={value}
      onPick={(d) => {
        commit(d);
        setDraft(null);
        close();
      }}
      onClear={clearable ? () => (commit(null), setDraft(null)) : undefined}
      picks={picks}
      time={time}
      minuteStep={minuteStep}
      min={min}
      max={max}
      isDateDisabled={isDateDisabled}
      weekStartsOn={weekStartsOn}
      locale={locale}
      autoFocus={autoFocus}
      onTime={(t) => commit(withTime(value ?? clampDay(startOfDay(new Date()), min, max), t))}
    />
  );

  if (variant === "inline")
    return (
      <div role="group" aria-label={label ?? "Choose a date"} className={cn("flex w-fit flex-col rounded-xl border bg-card", className)}>
        {panel(false, () => {}, true)}
      </div>
    );

  const popoverLabel = time ? "Choose a date and time" : "Choose a date";

  if (variant === "button") {
    const trigger = (
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-label={label ? `${label}${text ? `: ${text}` : ""}` : undefined}
        aria-describedby={describedBy}
        aria-invalid={bad || undefined}
        aria-required={required || undefined}
        className={cn(frame, FIELD_SIZE[size], "cursor-pointer pr-3 text-left outline-none aria-expanded:shadow-[0_0_0_1px_color-mix(in_srgb,var(--ring)_80%,transparent),0_0_0_4px_color-mix(in_srgb,var(--ring)_22%,transparent)]", className)}
      >
        <span className="grid flex-none text-muted-foreground">
          <CalIcon />
        </span>
        <span className={cn("min-w-0 flex-1 truncate tabular-nums", !text && "text-muted-foreground")}>{text || (time ? "Pick a date and time" : "Pick a date")}</span>
      </button>
    );
    return (
      <>
        <Popover trigger={trigger} open={open} onOpenChange={setOpen} align={align} aria-label={popoverLabel} className="max-w-[calc(100vw-16px)] p-0">
          {panel(true, () => setOpen(false))}
        </Popover>
        {name && <input type="hidden" name={name} value={value ? value.toISOString() : ""} />}
      </>
    );
  }

  const calButton = (
    <button
      type="button"
      disabled={disabled}
      aria-label={popoverLabel}
      className={cn("grid size-7 flex-none cursor-pointer place-items-center rounded-[8px] text-muted-foreground transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:bg-muted hover:text-foreground", focusRing)}
    >
      <CalIcon />
    </button>
  );

  const shown = draft ?? text;
  const preview = parsedDate && !problem && draft !== null ? formatDate(parsedDate, { locale, time }) : null;

  return (
    <div className={cn(frame, FIELD_SIZE[size], className)}>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={shown}
        placeholder={ph}
        aria-label={label}
        aria-invalid={bad || undefined}
        aria-required={required || undefined}
        aria-describedby={[describedBy, preview || problem ? hintId : undefined].filter(Boolean).join(" ") || undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={settle}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") {
            e.preventDefault();
            settle();
          } else if (e.key === "Escape" && draft !== null) {
            e.preventDefault();
            setDraft(null);
          } else if (e.key === "ArrowDown" && e.altKey) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="h-full min-w-0 flex-1 bg-transparent tabular-nums outline-none placeholder:text-muted-foreground"
      />
      <span id={hintId} aria-live="polite" className={cn("max-w-[45%] flex-none truncate text-[13px]", problem ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
        {problem ?? preview ?? ""}
      </span>
      <Popover trigger={calButton} open={open} onOpenChange={setOpen} align="end" aria-label={popoverLabel} className="max-w-[calc(100vw-16px)] p-0">
        {panel(true, () => setOpen(false))}
      </Popover>
    </div>
  );
}

export default DatePicker;
