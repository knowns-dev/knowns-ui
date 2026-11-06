"use client";

import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";

/* ── Math (pure, exported for tests) ── */

/** Digits after the point in `step`, so 0.1 + 0.2 lands on 0.3, not 0.30000000000000004. */
function decimals(step: number) {
  const s = String(step);
  if (s.includes("e-")) return Number(s.split("e-")[1]);
  return (s.split(".")[1] ?? "").length;
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/** Nearest value on the step grid that starts at `min`, kept inside min…max. */
export function snap(v: number, min: number, max: number, step: number) {
  if (!(step > 0)) return clamp(v, min, max);
  const n = Math.round((v - min) / step);
  const out = Number((min + n * step).toFixed(decimals(step) + decimals(min)));
  return clamp(out, min, max);
}

/** Where `v` sits on the track, 0…100. */
export function percent(v: number, min: number, max: number) {
  return max === min ? 0 : ((clamp(v, min, max) - min) / (max - min)) * 100;
}

/** The value under a point on the track; `fraction` is 0 at the start, 1 at the end. */
export function valueAt(fraction: number, min: number, max: number, step: number) {
  return snap(min + clamp(fraction, 0, 1) * (max - min), min, max, step);
}

/** Which thumb a press at `v` should move: the closest; on a tie, the one on the side of the press. */
export function closestThumb(values: number[], v: number) {
  if (values.length < 2) return 0;
  const [a, b] = values;
  if (a === b) return v < a ? 0 : 1;
  return Math.abs(v - a) <= Math.abs(v - b) ? 0 : 1;
}

/** Puts `next` at `index`, held between its neighbours so thumbs never cross. */
export function setThumb(values: number[], index: number, next: number) {
  const lo = index > 0 ? values[index - 1] : -Infinity;
  const hi = index < values.length - 1 ? values[index + 1] : Infinity;
  const out = values.slice();
  out[index] = clamp(next, lo, hi);
  return out;
}

/** The value a key moves to, or null for keys the slider ignores. */
export function keyValue(key: string, v: number, o: { min: number; max: number; step: number; largeStep: number }) {
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return snap(v + o.step, o.min, o.max, o.step);
    case "ArrowLeft":
    case "ArrowDown":
      return snap(v - o.step, o.min, o.max, o.step);
    case "PageUp":
      return snap(v + o.largeStep, o.min, o.max, o.step);
    case "PageDown":
      return snap(v - o.largeStep, o.min, o.max, o.step);
    case "Home":
      return o.min;
    case "End":
      return o.max;
    default:
      return null;
  }
}

/* ── Component ── */

export type SliderValue = number | [number, number];

export interface SliderMark {
  value: number;
  label?: ReactNode;
}

export interface SliderProps<T extends SliderValue = number> {
  /** A number for one thumb, a [from, to] pair for a range. */
  value?: T;
  defaultValue?: T;
  /** Every change while dragging or pressing keys. */
  onValueChange?: (value: T) => void;
  /** Once per gesture: on release, or after each key press. */
  onValueCommit?: (value: T) => void;
  min?: number;
  max?: number;
  step?: number;
  /** PageUp / PageDown jump. Default 10 steps. */
  largeStep?: number;
  size?: "sm" | "md";
  disabled?: boolean;
  /** Ticks on the track; give a label to show it underneath. */
  marks?: (number | SliderMark)[];
  /** Value bubble over the thumb: while dragging or focused from the keyboard (true), or all the time. */
  tooltip?: boolean | "always";
  /** Turns a value into text for the bubble, the readout and screen readers. */
  formatValue?: (value: number) => string;
  /** Field-style label above the track, with the current value on the right. */
  label?: ReactNode;
  /** Muted line under the slider. */
  hint?: ReactNode;
  /** Hide the value readout next to the label. */
  hideValue?: boolean;
  /** Names of the two thumbs in a range, for screen readers. */
  thumbLabels?: [string, string];
  "aria-label"?: string;
  /** Submitted with forms: one hidden input per thumb. */
  name?: string;
  id?: string;
  className?: string;
}

const SIZE = {
  sm: { track: "h-1", thumb: "size-3.5", pad: "px-[7px]", height: "h-4", tick: "size-[3px]" },
  md: { track: "h-1.5", thumb: "size-4.5", pad: "px-[9px]", height: "h-5", tick: "size-1" },
};

const EASE = "duration-200 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none";

/**
 * Pick a number, or a range, by dragging, clicking the track or using the keyboard:
 * arrows move one step, PageUp/PageDown ten, Home/End jump to the ends.
 */
export function Slider<T extends SliderValue = number>({
  value,
  defaultValue,
  onValueChange,
  onValueCommit,
  min = 0,
  max = 100,
  step = 1,
  largeStep,
  size = "md",
  disabled = false,
  marks,
  tooltip = false,
  formatValue = String,
  label,
  hint,
  hideValue = false,
  thumbLabels = ["Minimum", "Maximum"],
  "aria-label": ariaLabel,
  name,
  id,
  className,
}: SliderProps<T>) {
  const isRange = Array.isArray(value ?? defaultValue);
  const toList = (v: SliderValue | undefined): number[] =>
    v === undefined ? (isRange ? [min, max] : [min]) : Array.isArray(v) ? [v[0], v[1]] : [v];
  const [own, setOwn] = useState<number[]>(() => toList(defaultValue).map((v) => snap(v, min, max, step)));
  const values = value !== undefined ? toList(value).map((v) => clamp(v, min, max)) : own;
  const latest = useRef(values);
  latest.current = values;

  const big = largeStep ?? step * 10;
  const s = SIZE[size];
  const base = useId();
  const labelId = `${base}-label`;
  const track = useRef<HTMLDivElement>(null);
  const thumbs = useRef<(HTMLSpanElement | null)[]>([]);
  const active = useRef(-1);
  const [dragging, setDragging] = useState(-1);
  const [keyFocus, setKeyFocus] = useState(-1);

  const out = (list: number[]) => (isRange ? [list[0], list[1]] : list[0]) as T;

  const update = (index: number, next: number) => {
    const cur = latest.current;
    const list = setThumb(cur, index, next);
    if (list[index] === cur[index]) return cur;
    if (value === undefined) setOwn(list);
    latest.current = list;
    onValueChange?.(out(list));
    return list;
  };

  const fromPointer = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return valueAt((clientX - r.left) / r.width, min, max, step);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    const v = fromPointer(e.clientX);
    // Pressing a thumb keeps that thumb, even when both sit on the same spot.
    const hit = thumbs.current.findIndex((t) => t && t.contains(e.target as Node));
    const i = hit >= 0 ? hit : closestThumb(latest.current, v);
    active.current = i;
    setDragging(i);
    setKeyFocus(-1);
    e.currentTarget.setPointerCapture(e.pointerId);
    thumbs.current[i]?.focus({ preventScroll: true });
    if (hit < 0) update(i, v);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (active.current < 0) return;
    update(active.current, fromPointer(e.clientX));
  };

  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (active.current < 0) return;
    active.current = -1;
    setDragging(-1);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    onValueCommit?.(out(latest.current));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLSpanElement>, i: number) => {
    if (disabled) return;
    const next = keyValue(e.key, latest.current[i], { min, max, step, largeStep: big });
    if (next === null) return;
    e.preventDefault();
    setKeyFocus(i);
    const before = latest.current;
    const list = update(i, next);
    if (list !== before) onValueCommit?.(out(list));
  };

  const ticks = (marks ?? []).map((m) => (typeof m === "number" ? { value: m } : m)).filter((m) => m.value >= min && m.value <= max);
  const labelled = ticks.some((m) => m.label !== undefined);
  const lo = isRange ? values[0] : min;
  const hi = isRange ? values[1] : values[0];
  const readout = values.map(formatValue).join(" – ");
  const anim = dragging < 0 ? cn("transition-[left,width]", EASE) : "";

  return (
    // role=group + aria-disabled marks the dimmed readout as inactive UI (WCAG exempts it from contrast).
    <div role={disabled ? "group" : undefined} aria-disabled={disabled || undefined} className={cn("flex w-full flex-col gap-2", disabled && "opacity-50", className)}>
      {label && (
        <div className="flex items-baseline justify-between gap-3 text-[13px]">
          <span id={labelId} className="font-medium">
            {label}
          </span>
          {!hideValue && (
            <output aria-hidden="true" className="tabular-nums text-muted-foreground">
              {readout}
            </output>
          )}
        </div>
      )}

      <div
        id={id}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        className={cn(
          "relative flex touch-none items-center select-none",
          s.height,
          s.pad,
          // Room for the value bubble, so it never covers the label row.
          tooltip && "mt-6",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        )}
      >
        <div ref={track} className={cn("relative w-full rounded-full bg-[color-mix(in_srgb,var(--foreground)_11%,transparent)]", s.track)}>
          <span
            aria-hidden="true"
            className={cn("absolute inset-y-0 rounded-full bg-primary", anim)}
            style={{ left: `${percent(lo, min, max)}%`, width: `${percent(hi, min, max) - percent(lo, min, max)}%` }}
          />
          {ticks.map((m) => {
            const inside = m.value >= lo && m.value <= hi;
            return (
              <span
                key={m.value}
                aria-hidden="true"
                className={cn(
                  "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[background-color]",
                  EASE,
                  s.tick,
                  inside ? "bg-primary-foreground/70" : "bg-[color-mix(in_srgb,var(--foreground)_32%,transparent)]",
                )}
                style={{ left: `${percent(m.value, min, max)}%` }}
              />
            );
          })}

          {values.map((v, i) => {
            const pct = percent(v, min, max);
            const showTip = tooltip === "always" || (tooltip && (dragging === i || keyFocus === i));
            const thumbName = isRange ? thumbLabels[i] : undefined;
            return (
              <span
                key={i}
                ref={(el) => void (thumbs.current[i] = el)}
                role="slider"
                tabIndex={disabled ? -1 : 0}
                aria-valuemin={isRange && i === 1 ? values[0] : min}
                aria-valuemax={isRange && i === 0 ? values[1] : max}
                aria-valuenow={v}
                aria-valuetext={formatValue(v)}
                aria-orientation="horizontal"
                aria-disabled={disabled || undefined}
                aria-label={label ? undefined : thumbName ? (ariaLabel ? `${ariaLabel}, ${thumbName}` : thumbName) : ariaLabel}
                aria-labelledby={label ? (thumbName ? `${labelId} ${base}-t${i}` : labelId) : undefined}
                onKeyDown={(e) => onKeyDown(e, i)}
                onBlur={() => setKeyFocus((k) => (k === i ? -1 : k))}
                className={cn(
                  "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-card outline-none",
                  "shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_18%,transparent),0_1px_3px_rgb(0_0_0/0.18)]",
                  dragging < 0 ? "transition-[left,scale]" : "transition-[scale]",
                  EASE,
                  // A wider invisible hit area for fingers.
                  "before:absolute before:-inset-2 before:rounded-full pointer-coarse:before:-inset-3.5",
                  dragging === i && "scale-110",
                  focusRing,
                  dragging === i ? "z-20" : "z-10",
                  s.thumb,
                )}
                style={{ left: `${pct}%` }}
              >
                {thumbName && (
                  <span id={`${base}-t${i}`} className="sr-only">
                    {thumbName}
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-[7px] bg-foreground px-1.5 py-0.5 text-[11.5px] font-medium tabular-nums text-background shadow-[0_2px_8px_rgb(0_0_0/0.18)]",
                    "transition-[opacity,translate]",
                    EASE,
                    showTip ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
                  )}
                >
                  {formatValue(v)}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {labelled && (
        <div aria-hidden="true" className={cn("relative h-4 text-[11.5px] text-muted-foreground", s.pad)}>
          <div className="relative">
            {ticks
              .filter((m) => m.label !== undefined)
              .map((m) => {
                const pct = percent(m.value, min, max);
                return (
                  <span
                    key={m.value}
                    className={cn("absolute top-0 whitespace-nowrap tabular-nums", pct <= 0 ? "" : pct >= 100 ? "-translate-x-full" : "-translate-x-1/2")}
                    style={{ left: `${pct}%` }}
                  >
                    {m.label}
                  </span>
                );
              })}
          </div>
        </div>
      )}

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {name && values.map((v, i) => <input key={i} type="hidden" name={isRange ? `${name}[${i}]` : name} value={v} disabled={disabled} />)}
    </div>
  );
}
