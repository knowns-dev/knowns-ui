"use client";
/** @registry name="shine-border" type="ui" title="Shine Border" description="A sheen that travels around an element's border, for the one thing a view most wants chosen. CSS only: an @property angle turns a conic-gradient masked to the border ring. Continuous, hover or once modes; pauses offscreen; still gradient border with reduced motion or without @property." */

/**
 * ShineBorder: a sheen that travels around an element's border. Drop it inside any `relative` element
 * (a Card, a plan, a list row); it takes the host's radius and paints only the border ring.
 *
 * CSS-only motion: an @property-registered angle turns a conic-gradient, and a mask composite keeps it to
 * the ring, so the content underneath is never touched and there are no blur layers. JS only pauses it
 * offscreen and in hidden tabs. Without @property support, and with reduced motion, it is a still,
 * subtle gradient border.
 *
 * Use it for one emphasis per view: the featured plan, the recommended option, an upgrade card.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { AGENT_PALETTE } from "@/registry/knowns/lib/knowns/status";
import { useLive } from "./illustrations/use-in-view";

export type ShineMode = "continuous" | "hover" | "once";

/** The accent: your --kn-shine, else our indigo (a lighter shade on dark themes, so a 1px ring still reads). */
export const SHINE_ACCENT = ["var(--kn-shine, var(--knsb-accent))"];
/** Three agent colours for a multi-stop sheen. */
export const SHINE_AGENTS = AGENT_PALETTE.slice(0, 3);

/**
 * The travelling sheen: transparent everywhere except an `arc`-degree band whose colours rise and fall
 * evenly, so neither edge is a hard cut. Rotated by --knsb-angle.
 */
export function shineGradient(colors: string[], arc = 100) {
  const list = colors.length ? colors : SHINE_ACCENT;
  const a = Math.min(300, Math.max(20, arc));
  const start = 360 - a;
  const stops = list.map((c, i) => `${c} ${+(start + (a * (i + 1)) / (list.length + 1)).toFixed(1)}deg`);
  return `conic-gradient(from var(--knsb-angle), transparent 0deg ${start}deg, ${stops.join(", ")}, transparent 360deg)`;
}

/** The still version (no @property, or reduced motion): a soft diagonal ring in the same colours. */
export function shineStatic(colors: string[]) {
  const list = colors.length ? colors : SHINE_ACCENT;
  const mix = (c: string, p: number) => `color-mix(in srgb, ${c} ${p}%, transparent)`;
  const first = list[0];
  const last = list[list.length - 1];
  return `linear-gradient(135deg, ${mix(first, 90)}, ${mix(last, 15)} 45%, ${mix(last, 15)} 55%, ${mix(first, 90)})`;
}

/** 1, 2 or 3; anything else is clamped. */
export const shineWidth = (w: number) => Math.min(3, Math.max(1, Math.round(w)));

/** Whether the browser can animate a registered custom property. False on the server. */
export function supportsShine() {
  return typeof CSS !== "undefined" && typeof (CSS as { registerProperty?: unknown }).registerProperty === "function";
}

const CSS_TEXT = `
@property --knsb-angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
@keyframes knsb-spin { to { --knsb-angle: 360deg; } }
@keyframes knsb-fade { 0%, 70% { opacity: var(--knsb-o); } 100% { opacity: var(--knsb-rest); } }
[data-kn-shine] {
  --knsb-accent: var(--kn-accent, #6366f1);
  background: var(--knsb-bg);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
  opacity: var(--knsb-o);
  animation: knsb-spin var(--knsb-dur) linear infinite;
}
[data-kn-shine][data-mode="hover"] { opacity: var(--knsb-rest); animation-play-state: paused; transition: opacity 200ms ease-out; }
:hover > [data-kn-shine][data-mode="hover"], :focus-visible > [data-kn-shine][data-mode="hover"], :focus-within > [data-kn-shine][data-mode="hover"] { opacity: var(--knsb-o); animation-play-state: running; }
[data-kn-shine][data-mode="once"] { animation: knsb-spin var(--knsb-dur) var(--kn-ease-out,cubic-bezier(.22,1,.36,1)) 1 both, knsb-fade var(--knsb-dur) ease-out 1 both; }
[data-kn-shine][data-live="false"] { animation-play-state: paused; }
[data-kn-shine][data-static="true"] { background: var(--knsb-still); animation: none; opacity: var(--knsb-o); }
.dark [data-kn-shine], [data-theme="dark"] [data-kn-shine] { --knsb-accent: var(--kn-accent, #a5b4fc); }
@media (prefers-reduced-motion: reduce) {
  [data-kn-shine] { background: var(--knsb-still); animation: none !important; transition: none; opacity: var(--knsb-o); }
}
`;

export interface ShineBorderProps {
  /** "hover" (default) runs while the host is hovered or focused; "continuous" loops forever, so opt in for the one thing that must be chosen; "once" makes one lap on mount, then fades. */
  mode?: ShineMode;
  /** Ring width in px: 1, 2 or 3. Default 1. */
  width?: number;
  /** Seconds per lap. Default 6 (continuous, hover) or 1.6 (once). */
  duration?: number;
  /** Sheen colours: SHINE_ACCENT (default), SHINE_AGENTS, or your own 1-3 CSS colours. */
  colors?: string[];
  /** Length of the sheen in degrees of the lap. Default 100. */
  arc?: number;
  /** 0-1: how strong the sheen is. Default 1. */
  intensity?: number;
  /** Opacity left after "once" and at rest in "hover" (0 = only the host's own border). Default 0. */
  rest?: number;
  /** The host's border width, which the ring sits on top of. Use 0 inside an overflow-hidden host. Default 1. */
  hostBorder?: number;
  /** Change it to replay a "once" lap. */
  replayKey?: string | number;
  paused?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function ShineBorder({
  mode = "hover",
  width = 1,
  duration,
  colors = SHINE_ACCENT,
  arc = 100,
  intensity = 1,
  rest = 0,
  hostBorder = 1,
  replayKey,
  paused,
  className,
  style,
}: ShineBorderProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const { live } = useLive(ref, paused);
  // Server and first paint assume support; the still ring only replaces it where @property is missing.
  const [still, setStill] = useState(false);
  useEffect(() => setStill(!supportsShine()), []);
  const vars = {
    "--knsb-bg": shineGradient(colors, arc),
    "--knsb-still": shineStatic(colors),
    "--knsb-dur": `${duration ?? (mode === "once" ? 1.6 : 6)}s`,
    "--knsb-o": Math.min(1, Math.max(0, intensity)),
    "--knsb-rest": Math.min(1, Math.max(0, rest)),
  } as CSSProperties;
  return (
    <>
      <style href="knsb" precedence="default">
        {CSS_TEXT}
      </style>
      <span
        key={replayKey}
        ref={ref}
        aria-hidden="true"
        data-slot="shine-border"
        data-kn-shine=""
        data-mode={mode}
        data-live={live}
        data-static={still || undefined}
        className={cn("pointer-events-none absolute rounded-[inherit]", className)}
        style={{ ...vars, inset: -Math.max(0, hostBorder), padding: shineWidth(width), zIndex: 1, ...style }}
      />
    </>
  );
}
