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
import { Popover } from "./popover";
import { Calendar, addDays, addMonths, clampDay, outOfBounds, sameDay, startOfDay } from "./date-range-picker";

/* ── Pure helpers (exported for tests) ── */

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
  if (m && m[2].length >= 3 && weekdayIndex(m[2]) >= 0) {
    const diff = (weekdayIndex(m[2]) - today.getDay() + 7) % 7;
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
  if (m && monthIndex(m[1]) >= 0) [mi, d, y] = [monthIndex(m[1]), Number(m[2]), m[3] ? fullYear(Number(m[3])) : null];
  else {
    m = s.match(/^(\d{1,2}) ([a-z]{3,})(?: (\d{2,4}))?$/);
    if (m && monthIndex(m[2]) >= 0) [mi, d, y] = [monthIndex(m[2]), Number(m[1]), m[3] ? fullYear(Number(m[3])) : null];
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

/* ── Pieces ── */

const CalIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" className="size-4">
    <rect x="2.25" y="3" width="11.5" height="10.75" rx="2.25" />
    <path d="M2.25 6.5h11.5M5.5 1.75v2.5M10.5 1.75v2.5" />
  </svg>
);

const FIELD_SIZE = {
  sm: "h-7 gap-2 rounded-lg pl-3 pr-1 text-[13px] pointer-coarse:h-9",
  md: "h-8 gap-2 rounded-lg pl-3 pr-1 text-[14px] pointer-coarse:h-10",
  lg: "h-9 gap-2 rounded-xl pl-4 pr-1 text-[15px] pointer-coarse:h-11",
};

const frame = cn(
  "flex w-full min-w-0 items-center bg-card text-foreground",
  "shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_14%,transparent)] transition-[box-shadow] duration-200 ease-out dark:bg-[color-mix(in_srgb,var(--muted)_35%,var(--card))]",
  "focus-within:shadow-[0_0_0_1px_color-mix(in_srgb,var(--ring)_80%,transparent),0_0_0_4px_color-mix(in_srgb,var(--ring)_22%,transparent)]",
  "has-[[aria-invalid=true]]:shadow-[0_0_0_1px_rgb(239_68_68/0.6),0_0_0_4px_rgb(239_68_68/0.12)]",
  "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
);

interface PanelProps {
  value: Date | null;
  onPick: (d: Date) => void;
  onClear?: () => void;
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

function Panel({ value, onPick, onClear, picks, time, minuteStep, min, max, isDateDisabled, weekStartsOn, locale, autoFocus, onTime }: PanelProps) {
  const timeId = useId();
  const blocked = (d: Date) => outOfBounds(d, min, max) || !!isDateDisabled?.(d);
  const keepTime = (d: Date) => (time && value ? withTime(d, { h: value.getHours(), m: value.getMinutes() }) : d);
  return (
    <div className="flex flex-col sm:flex-row">
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
                    "w-full cursor-pointer whitespace-nowrap rounded-lg px-3 py-2 text-left text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
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
                const [h, m] = e.target.value.split(":").map(Number);
                if (Number.isFinite(h) && Number.isFinite(m)) onTime({ h, m });
              }}
              className={cn("h-8 rounded-lg bg-card px-2 text-[13px] tabular-nums shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_14%,transparent)] outline-none", focusRing)}
            />
          </div>
        )}
        <div className="flex min-h-11 items-center justify-between gap-3 border-t px-3 py-2">
          <p className="min-w-0 truncate text-[13px] tabular-nums text-muted-foreground" aria-live="polite">
            {value ? formatDate(value, { locale, time }) : "No date selected"}
          </p>
          {onClear && value && (
            <button type="button" onClick={onClear} className={cn("flex-none cursor-pointer rounded-lg px-2 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground", focusRing)}>
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

  const panel = (autoFocus: boolean, close: () => void) => (
    <Panel
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
      <div role="group" aria-label={label ?? "Choose a date"} className={cn("w-fit rounded-xl border bg-card", className)}>
        {panel(false, () => {})}
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
      className={cn("grid size-7 flex-none cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", focusRing)}
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
