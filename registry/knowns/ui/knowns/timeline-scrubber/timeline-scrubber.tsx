"use client";
/** @registry name="timeline-scrubber" type="ui" title="Timeline Scrubber" description="A time axis with ticks and labels and one marker you drag or move with the keyboard, anchoring a card above it that stays inside the track. Controlled or not. A grab halo on the marker, a faint ghost where a click lands, and the card fades on a click or key move; transform and opacity only." */

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { buildTicks, cardShift, fromRatio, moveValue, snap, toPercent } from "./timeline-scrubber-utils";

export interface TimelineScrubberProps {
  /** The ends of the axis, in your own unit: hours, minutes, a day number. */
  min: number;
  max: number;
  /** Smallest move of the marker. Default (max - min) / 100. */
  step?: number;
  /** Page Up and Page Down move. Default ten steps. */
  bigStep?: number;
  /** Controlled value. */
  value?: number;
  /** Starting value when uncontrolled. Default min. */
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  /** A tick every this many units, with a label. Default one sixth of the range. */
  tickEvery?: number;
  /** The label under a tick. Default the number. */
  formatTick?: (value: number) => ReactNode;
  /** The value as a screen reader says it (aria-valuetext). Default the number. */
  formatValue?: (value: number) => string;
  /** Names the slider for assistive tech, e.g. "Time of night". */
  label: string;
  /** A card above the marker for the current value. It sits on a stem and is kept inside the track at the ends. */
  card?: (value: number) => ReactNode;
  /** Gap in px between the card and the edges of the track. Default 0. */
  cardPad?: number;
  /** Length in px of the stem from the marker up to the card. Default 28. */
  stem?: number;
  className?: string;
}

/**
 * An axis with ticks and one marker that anchors a card. Drag the track or the marker, or use the arrow keys, Page Up,
 * Page Down, Home and End. The marker moves with a transform (container-query units), never with layout, and holds
 * still without a transition under reduced motion. While you hold the marker a soft halo fades in around it; with a mouse,
 * a faint ghost dot follows the pointer to show where a click would land; and the card fades in on a click or a key move,
 * not while you drag. All of it is opacity or transform, and none of it plays under reduced motion. The card is not in
 * the layout: leave room above the axis for it.
 */
export function TimelineScrubber({ min, max, step, bigStep, value, defaultValue, onValueChange, tickEvery, formatTick, formatValue, label, card, cardPad = 0, stem = 28, className }: TimelineScrubberProps) {
  const s = step && step > 0 ? step : (max - min) / 100;
  const [inner, setInner] = useState(() => snap(defaultValue ?? min, min, max, s));
  const current = snap(value ?? inner, min, max, s);
  const pct = toPercent(current, min, max);
  const ticks = buildTicks(min, max, tickEvery && tickEvery > 0 ? tickEvery : (max - min) / 6);
  const track = useRef<HTMLDivElement>(null);
  const cardEl = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [shift, setShift] = useState(0);
  // Which snapped value the mouse is over (null: none, or touch, or dragging), and how many click or key moves have happened.
  const [ghost, setGhost] = useState<number | null>(null);
  const [settled, setSettled] = useState(0);

  const commit = useCallback(
    (next: number) => {
      if (value === undefined) setInner(next);
      if (next !== current) onValueChange?.(next);
      return next !== current;
    },
    [value, current, onValueChange],
  );

  // Keep the card inside the track: measured, so it follows the card's width and the track's.
  useLayoutEffect(() => {
    const t = track.current;
    const c = cardEl.current;
    if (!t || !c) return setShift(0);
    const measure = () => setShift(cardShift((current - min) / (max - min || 1), c.offsetWidth, t.clientWidth, cardPad));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(t);
    ro.observe(c);
    return () => ro.disconnect();
  }, [current, min, max, cardPad, card]);

  const valueAt = (e: PointerEvent<HTMLElement>) => {
    const r = track.current?.getBoundingClientRect();
    return r && r.width ? fromRatio((e.clientX - r.left) / r.width, min, max, s) : null;
  };
  const at = (e: PointerEvent<HTMLElement>) => {
    const next = valueAt(e);
    return next === null ? false : commit(next);
  };
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    const next = moveValue(e.key, current, min, max, s, bigStep ?? s * 10);
    if (next === null) return;
    e.preventDefault();
    if (commit(next)) setSettled((n) => n + 1);
  };

  const place = { "--p": pct } as CSSProperties;
  return (
    <div className={cn("relative select-none", className)}>
      <div ref={track} className="relative touch-none [container-type:inline-size]" style={place}>
        {/* The marker group: dot, stem and card ride one transform. */}
        <div
          data-dragging={dragging || undefined}
          className="pointer-events-none absolute top-3.5 left-0 z-[1] h-0 w-0 translate-x-[calc(var(--p)*1cqw)] transition-transform duration-(--kn-dur) ease-(--kn-ease-out) data-[dragging]:transition-none motion-reduce:transition-none"
        >
          {card && (
            <div ref={cardEl} className="absolute left-0 w-max transition-transform duration-(--kn-dur) ease-(--kn-ease-out) data-[dragging]:transition-none motion-reduce:transition-none" data-dragging={dragging || undefined} style={{ bottom: stem + 6, translate: `calc(-50% + ${shift}px) 0` }}>
              {/* A click or a key move remounts the content so it fades in (opacity only); a drag and the first render stay still. */}
              <div key={settled} className={cn(settled > 0 && "animate-[kn-fade-in_var(--kn-dur-fast)_var(--kn-ease-out)_backwards]")}>{card(current)}</div>
            </div>
          )}
          <span aria-hidden className="absolute left-0 w-px -translate-x-1/2 bg-foreground" style={{ bottom: 0, height: stem + 6 }} />
        </div>
        {/* Ghost: where a click would land. Follows the pointer with no easing, fades by opacity; mouse only, not while dragging. */}
        <span
          aria-hidden
          data-on={(ghost !== null && !dragging && ghost !== current) || undefined}
          className="pointer-events-none absolute top-3.5 left-0 z-0 size-3 -translate-y-1/2 rounded-full bg-foreground opacity-0 transition-opacity duration-(--kn-dur-fast) ease-(--kn-ease-out) data-[on]:opacity-25 motion-reduce:transition-none"
          style={{ transform: `translateX(calc(${toPercent(ghost ?? current, min, max)} * 1cqw - 6px))` }}
        />
        {/* The axis: a hit area taller than the line, so it is easy to grab. */}
        <div
          className="relative h-7 cursor-pointer"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
            setGhost(null);
            if (at(e)) setSettled((n) => n + 1);
          }}
          onPointerMove={(e) => {
            if (dragging) at(e);
            else if (e.pointerType === "mouse") setGhost(valueAt(e));
          }}
          onPointerLeave={() => setGhost(null)}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
        >
          <span aria-hidden className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-foreground" />
          {/* Halo: a soft ring that fades in while the marker is held. */}
          <span
            aria-hidden
            data-dragging={dragging || undefined}
            className="pointer-events-none absolute top-1/2 left-0 size-7 -translate-y-1/2 translate-x-[calc(var(--p)*1cqw-14px)] rounded-full bg-foreground opacity-0 transition-opacity duration-(--kn-dur-fast) ease-(--kn-ease-out) data-[dragging]:opacity-15 motion-reduce:transition-none"
          />
          {ticks.map((t) => (
            <span key={t} aria-hidden className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-foreground" style={{ left: `${toPercent(t, min, max)}%` }} />
          ))}
          <span
            role="slider"
            tabIndex={0}
            aria-label={label}
            aria-orientation="horizontal"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={current}
            aria-valuetext={formatValue ? formatValue(current) : String(current)}
            onKeyDown={onKey}
            data-dragging={dragging || undefined}
            className="absolute top-1/2 left-0 size-3 -translate-y-1/2 translate-x-[calc(var(--p)*1cqw-6px)] rounded-full bg-foreground outline-2 outline-offset-4 outline-transparent transition-transform duration-(--kn-dur) ease-(--kn-ease-out) focus-visible:outline-ring data-[dragging]:transition-none motion-reduce:transition-none"
          />
        </div>
        <div aria-hidden className="relative h-5 text-[12px] leading-5 text-foreground tabular-nums">
          {ticks.map((t) => (
            <span key={t} className="absolute top-0 -translate-x-1/2 whitespace-nowrap" style={{ left: `${toPercent(t, min, max)}%` }}>
              {formatTick ? formatTick(t) : t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
