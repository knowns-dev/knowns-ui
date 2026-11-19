"use client";
/** @registry name="time-slots" type="ui" title="Time slots" description="The times of one day to pick from, for booking: shown in a chosen time zone with its label, disabled slots, keyboard list navigation and an inline Confirm. Intl only, no date library." */

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { localZone, zoneLabel } from "../calendar/calendar-zone";
import type { TimeSlot } from "./slots";

export { buildSlots, freeSlots, type BuildSlotsOptions, type Interval, type TimeSlot } from "./slots";

export interface TimeSlotsProps {
  /** The slots of the day, in order. Make them with buildSlots, or from your own API. */
  slots: readonly TimeSlot[];
  /** The selected slot's start, as an instant. Pass it to control the selection. */
  value?: Date | null;
  defaultValue?: Date | null;
  onValueChange?: (slot: TimeSlot) => void;
  /** Shows a Confirm button on the selected slot; fires when it is pressed (or Enter on it). */
  onConfirm?: (slot: TimeSlot) => void;
  confirmLabel?: string;
  /** The zone the times are shown in, IANA. Default the viewer's. */
  timeZone?: string;
  locale?: string;
  /** "12" or "24" hour clock. Default the locale's. */
  hourCycle?: "12" | "24";
  /** Write "Times in Ho Chi Minh (GMT+7)" under the list. Default true. */
  showZone?: boolean;
  /** Names the list for screen readers, e.g. "Times on Wednesday, November 18". */
  label?: string;
  /** Shown when there are no slots. */
  empty?: ReactNode;
  className?: string;
}

/* The Confirm button appears when a slot is picked: a short fade, only after the first render. */
const CSS = `
@keyframes knts-in { from { opacity: 0; } }
.knts-in { animation: knts-in var(--kn-dur-fast, 120ms) var(--kn-ease-out, cubic-bezier(.22,1,.36,1)) both; }
@media (prefers-reduced-motion: reduce) { .knts-in { animation: none; } }
`;

/** A day's times to book from: a list of slots in a time zone, with an inline Confirm. */
export function TimeSlots({ slots, value, defaultValue = null, onValueChange, onConfirm, confirmLabel = "Confirm", timeZone, locale, hourCycle, showZone = true, label = "Available times", empty = "No times left on this day", className }: TimeSlotsProps) {
  const tz = timeZone ?? localZone();
  const [kept, setKept] = useState<Date | null>(defaultValue);
  const chosen = value !== undefined ? value : kept;
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();

  const fmt = useMemo(() => new Intl.DateTimeFormat(locale, { timeZone: tz, hour: hourCycle === "24" ? "2-digit" : "numeric", minute: "2-digit", ...(hourCycle ? { hour12: hourCycle === "12" } : {}) }), [tz, locale, hourCycle]);
  const first = slots.find((s) => !s.disabled);
  const selectedIndex = chosen ? slots.findIndex((s) => s.start.getTime() === chosen.getTime()) : -1;
  // One tab stop: the selected slot, else the first free one.
  const stop = selectedIndex >= 0 && !slots[selectedIndex]?.disabled ? selectedIndex : first ? slots.indexOf(first) : -1;

  const pick = (s: TimeSlot) => {
    if (s.disabled) return;
    if (value === undefined) setKept(s.start);
    onValueChange?.(s);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const opts = [...(list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not([aria-disabled="true"])') ?? [])];
    if (!opts.length) return;
    const at = opts.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "Home" ? 0 : e.key === "End" ? opts.length - 1 : e.key === "ArrowDown" ? Math.min(opts.length - 1, at + 1) : Math.max(0, at <= 0 ? 0 : at - 1);
    e.preventDefault();
    opts[next]?.focus();
  };

  if (!slots.length) return <p className={cn("text-[13px] text-muted-foreground", className)}>{empty}</p>;

  return (
    <div className={cn("flex w-full min-w-44 flex-col gap-2", className)}>
      <style href="kn-ts" precedence="default">
        {CSS}
      </style>
      <div ref={list} role="listbox" aria-label={label} aria-describedby={showZone ? `${id}-zone` : undefined} onKeyDown={onKeyDown} className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
        {slots.map((s, i) => {
          const selected = i === selectedIndex;
          return (
            <div key={s.start.getTime()} role="presentation" className="flex gap-1.5">
              <button
                type="button"
                role="option"
                aria-selected={selected}
                aria-disabled={s.disabled || undefined}
                tabIndex={i === stop ? 0 : -1}
                onClick={() => pick(s)}
                className={cn(
                  "flex h-9 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[9px] border px-3 text-[13px] font-medium tabular-nums transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) pointer-coarse:h-11",
                  selected ? "border-foreground bg-foreground/5 text-foreground" : "border-border text-foreground hover:bg-muted",
                  s.disabled && "cursor-not-allowed border-border/60 text-muted-foreground/60 line-through decoration-muted-foreground/30 hover:bg-transparent",
                  focusRing,
                )}
              >
                {fmt.format(s.start)}
                {s.note && !selected && <span className="text-[11.5px] font-normal text-muted-foreground no-underline">{s.note}</span>}
              </button>
              {selected && onConfirm && (
                <button
                  type="button"
                  onClick={() => onConfirm(s)}
                  className={cn(
                    "h-9 flex-1 cursor-pointer rounded-[9px] bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-[opacity,scale] duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:opacity-90 active:scale-[.97] pointer-coarse:h-11",
                    ready && "knts-in",
                    focusRing,
                  )}
                >
                  {confirmLabel}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {showZone && (
        <p id={`${id}-zone`} className="text-[12px] text-muted-foreground">
          Times in {zoneLabel(tz, slots[0]?.start, locale)}
        </p>
      )}
    </div>
  );
}

export default TimeSlots;
