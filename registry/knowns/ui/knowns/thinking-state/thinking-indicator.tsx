"use client";
/** @registry name="thinking-indicator" type="ui" title="Thinking indicator" description="A one-line working indicator: a small glyph (dot grid wave, node chain pulse, filling ring or breathing bars), a shimmering status label and an optional elapsed timer." */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { ShimmerText } from "../text-animation/shimmer-text";

export type ThinkingIndicatorVariant = "grid" | "chain" | "ring" | "bars";
export type ThinkingIndicatorTone = "accent" | "neutral";

export interface ThinkingIndicatorProps {
  /** The glyph. "grid": a 3x3 dot grid crossed by a diagonal wave. "chain": a pulse travelling along a short node chain. "ring": a ring that fills and resets. "bars": three bars breathing out of phase. Default "grid". */
  variant?: ThinkingIndicatorVariant;
  /** Status text, e.g. "Thinking" or "Searching the docs". Default "Thinking". */
  label?: string;
  /** Run the motion, the shimmer and the timer. false freezes the glyph and keeps the last time. Default true. */
  active?: boolean;
  /** Seconds spent, if you track it yourself. Without it the indicator times itself from when it mounts (or `active` turns on). */
  elapsed?: number;
  /** Show the timer ("2.3s") after the label. Default true. */
  showTimer?: boolean;
  /** Sweep a light band through the label. Default true. */
  shimmer?: boolean;
  /** "accent" tints the glyph with --kn-accent; "neutral" keeps it in the text colour. Default "accent". */
  tone?: ThinkingIndicatorTone;
  /** Edge of the glyph in px. Default 16. */
  size?: number;
  className?: string;
}

export const THINKING_VARIANTS: ThinkingIndicatorVariant[] = ["grid", "chain", "ring", "bars"];

/** "0.0s", "3.2s", "12.4s", then "1m 05s" from a minute on. */
export function formatTenths(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0.0s";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

/* The loops are periods, not UI durations. Private keyframes (knti-): each only moves transform or opacity.
   Reduced motion drops the loop and leaves a still glyph, never a slower loop. */
const CSS = `
@keyframes knti-wave { 0%, 100% { opacity: .38; transform: scale(.9); } 35% { opacity: 1; transform: scale(1.1); } }
@keyframes knti-node { 0%, 100% { opacity: .25; transform: scale(.9); } 20% { opacity: 1; transform: scale(1); } 55% { opacity: .25; transform: scale(.9); } }
@keyframes knti-fillring { 0% { stroke-dashoffset: 1; opacity: .75; } 78% { stroke-dashoffset: 0; opacity: .75; } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes knti-breathe { 0%, 100% { transform: scaleY(.4); } 50% { transform: scaleY(1); } }
[data-knti] [data-paused="true"], [data-knti] [data-paused="true"] * { animation-play-state: paused !important; }
@media (prefers-reduced-motion: reduce) {
  [data-knti] *, [data-knti] *::before, [data-knti] *::after { animation: none !important; }
  [data-knti] [data-still] { opacity: .75 !important; }
}
`;

const EASE_IO = "var(--kn-ease-inout, cubic-bezier(.65,0,.35,1))";

/** Just the glyph, for a header, a button or a list row. Decorative: pair it with a label. */
export function ThinkingMark({ variant = "grid", active = true, tone = "accent", size = 16, className }: Pick<ThinkingIndicatorProps, "variant" | "active" | "tone" | "size" | "className">) {
  const paused = !active;
  return (
    <span
      aria-hidden
      data-knti={variant}
      className={cn("relative inline-grid flex-none place-items-center", tone === "accent" ? "text-[color:var(--kn-accent,var(--color-indigo-500))] dark:text-[color:var(--kn-accent,var(--color-indigo-400))]" : "text-foreground/70", className)}
      style={{ width: size, height: size }}
    >
      <style href="knti" precedence="default">
        {CSS}
      </style>
      {variant === "grid" && (
        <span data-paused={paused} className="grid size-full grid-cols-3 grid-rows-3 place-items-center">
          {Array.from({ length: 9 }, (_, i) => (
            <span
              key={i}
              data-still
              className="size-[72%] rounded-full bg-current"
              style={{ animation: `knti-wave 1.3s ${EASE_IO} ${((i % 3) + Math.floor(i / 3)) * 0.14}s infinite backwards`, opacity: 0.38 }}
            />
          ))}
        </span>
      )}
      {variant === "chain" && (
        <span data-paused={paused} className="relative flex size-full items-center justify-between">
          <span aria-hidden className="absolute inset-x-[10%] top-1/2 h-px -translate-y-1/2 bg-current opacity-25" />
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              data-still
              className="relative size-[26%] rounded-full bg-current"
              style={{ animation: `knti-node 1.5s ${EASE_IO} ${i * 0.22}s infinite backwards`, opacity: 0.25 }}
            />
          ))}
        </span>
      )}
      {variant === "ring" && (
        <span data-paused={paused} className="relative size-full">
          <svg viewBox="0 0 16 16" className="absolute inset-0 size-full -rotate-90" fill="none" stroke="currentColor" strokeWidth="1.75">
            <circle cx="8" cy="8" r="6" className="opacity-20" />
            <circle
              data-still
              cx="8"
              cy="8"
              r="6"
              pathLength={1}
              strokeDasharray="1 1"
              strokeLinecap="round"
              style={{ animation: `knti-fillring 1.6s ${EASE_IO} infinite`, opacity: 0.75 }}
            />
          </svg>
        </span>
      )}
      {variant === "bars" && (
        <span data-paused={paused} className="flex size-full items-center justify-center gap-[12%]">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              data-still
              className="h-[72%] w-[16%] origin-center rounded-full bg-current"
              style={{ animation: `knti-breathe 1.2s ${EASE_IO} ${i * -0.4}s infinite`, transform: "scaleY(.7)" }}
            />
          ))}
        </span>
      )}
    </span>
  );
}

/** Times itself while `active`; an explicit `elapsed` wins. Ticks every 100ms, only while running. */
function useSeconds(active: boolean, elapsed?: number) {
  const base = useRef(0);
  const startedAt = useRef<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active || elapsed !== undefined) return;
    startedAt.current = performance.now() - base.current * 1000;
    const t = setInterval(() => {
      base.current = (performance.now() - (startedAt.current ?? 0)) / 1000;
      setNow(base.current);
    }, 100);
    return () => clearInterval(t);
  }, [active, elapsed]);
  return elapsed ?? now;
}

/**
 * "[glyph] Thinking 2.3s": a one-line working indicator with a small glyph, a shimmering status label and an optional
 * timer, to sit above a composer or inside an answer. Screen readers get the label once; the timer is silent. Reduced
 * motion shows a still glyph and a plain label.
 */
export function ThinkingIndicator({ variant = "grid", label = "Thinking", active = true, elapsed, showTimer = true, shimmer = true, tone = "accent", size = 16, className }: ThinkingIndicatorProps) {
  const seconds = useSeconds(active, elapsed);
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-[13px] text-muted-foreground", className)}>
      <ThinkingMark variant={variant} active={active} tone={tone} size={size} />
      <ShimmerText text={label} active={active && shimmer} variant="sweep" className="font-medium text-foreground/85" />
      {showTimer && (
        <span aria-hidden className="min-w-[3ch] tabular-nums">
          {formatTenths(seconds)}
        </span>
      )}
    </span>
  );
}

export default ThinkingIndicator;
