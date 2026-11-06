"use client";

import { useRef, type CSSProperties } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { TextShell, useLive } from "./text-core";

export interface ShimmerTextProps {
  text: string;
  /** Run the shimmer. false shows plain text (e.g. once the agent is done). Default true. */
  active?: boolean;
  /** Seconds for one sweep across the text. Default 2. */
  duration?: number;
  /** How wide the bright band is, in characters. Default 6. */
  spread?: number;
  /** Highlight colour of the band. Default the text colour; the rest dims to ~55%. */
  color?: string;
  paused?: boolean;
  className?: string;
}

const CSS = `
@keyframes kntx-wave { 0% { opacity: var(--dim) } 12% { opacity: 1 } 24%, 100% { opacity: var(--dim) } }
`;

/** Delay (s) for character `i` of `n`, so the band crosses the text once per `duration`, left to right. */
export function waveDelay(i: number, n: number, duration: number, spread: number): number {
  // The bright part of the keyframe lasts 24% of the cycle; spread that across `spread` characters.
  const step = (duration * 0.24) / Math.max(1, spread);
  // Negative delays so the sweep is already running on the first frame.
  return +(i * step - duration).toFixed(3);
}

/**
 * A soft bright band sweeping through a label, for "Thinking…", "Searching the web…" and other
 * in-progress text. Each letter fades up and back (opacity only). Screen readers get the plain text;
 * reduced motion and active={false} show it still. Pauses offscreen and in hidden tabs.
 */
export function ShimmerText({ text, active = true, duration = 2, spread = 6, color, paused, className }: ShimmerTextProps) {
  const root = useRef<HTMLSpanElement>(null);
  const { live } = useLive(root, paused || !active);
  const chars = Array.from(text);
  // The band runs past both ends, so the gap before the next sweep is part of the cycle.
  const cycle = Math.max(duration, ((chars.length + spread * 2) * duration * 0.24) / spread);
  return (
    <TextShell kind="shimmer" label={text} live={live} css={CSS} rootRef={root} className={cn("whitespace-pre-wrap", className)}>
      {active
        ? chars.map((c, i) => (
            <span
              key={i}
              style={
                {
                  "--dim": 0.55,
                  color,
                  animation: `kntx-wave ${cycle.toFixed(2)}s linear ${waveDelay(i + spread, chars.length, cycle, spread)}s infinite`,
                } as CSSProperties
              }
            >
              {c}
            </span>
          ))
        : text}
    </TextShell>
  );
}

export default ShimmerText;
