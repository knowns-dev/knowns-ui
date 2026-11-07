"use client";
/** @registry name="gradient-floor" type="block" title="Gradient Floor" description="A lit floor that rises from the bottom edge: two soft gradient layers drift and breathe, and pulse(x) sends a wave across it from a ref or from other pieces (Prompt Keyboard sends one per key). CSS and the Web Animations API, no blur filter, no per-frame JavaScript." */

import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { useLive } from "@/registry/knowns/ui/knowns/illustrations/use-in-view";
import { BackgroundFrame } from "./background-frame";
import { intensityScale, speedScale, tokenColor, withAlpha, type BackgroundProps } from "./bg-utils";

export interface GradientFloorHandle {
  /** Sends one wave across the floor. `x` is 0 (left) to 1 (right), default 0.5; `strength` 0 to 2, default 1. */
  pulse(x?: number, strength?: number): void;
}

export interface GradientFloorProps extends Omit<BackgroundProps, "color" | "density"> {
  /** One or two colours (tokens, CSS variables or CSS colours): the two layers. Default indigo and violet. */
  color?: string | string[];
  /** How far the floor rises, as a fraction of the box (0.2 to 1). Default 0.6. */
  height?: number;
  /** Only `pulseGradientFloors(…, channel)` calls with the same channel reach this floor. Default: every floor hears every call. */
  channel?: string;
  /** Call `pulse(x, strength)` to send a wave. */
  ref?: Ref<GradientFloorHandle>;
}

const DEFAULT = ["#6366f1", "#8b5cf6"];
const MAX_WAVES = 8;

/* ── The bus: any piece can send a wave to the floors on the page ── */

type Listener = { channel?: string; pulse: (x: number, strength: number) => void };
const floors = new Set<Listener>();

/**
 * Sends a wave to every mounted Gradient Floor (or only those with the same `channel`). It is how Prompt
 * Keyboard lights the floor under it, and how your own events can too: `pulseGradientFloors(0.3)` on a
 * button click. A floor that is offscreen, paused or under reduced motion ignores it.
 */
export function pulseGradientFloors(x = 0.5, strength = 1, channel?: string) {
  for (const f of floors) if (!channel || f.channel === channel) f.pulse(x, strength);
}

const CSS = `
@keyframes knbg-floor-rise { from { opacity: 0; transform: translateY(16%); } to { opacity: 1; transform: none; } }
@keyframes knbg-floor-a { 0% { transform: translateX(-7%) scaleY(0.9); } 100% { transform: translateX(8%) scaleY(1.08); } }
@keyframes knbg-floor-b { 0% { transform: translateX(8%) scaleY(1.06); } 100% { transform: translateX(-9%) scaleY(0.86); } }
@keyframes knbg-floor-breathe { 0%, 100% { opacity: 0.8; } 50% { opacity: 1; } }
[data-kn-bg="gradient-floor"] .kn-rise { animation: knbg-floor-rise 1.5s cubic-bezier(.2,.7,.2,1) both; }
[data-kn-bg="gradient-floor"] .kn-breathe { animation: knbg-floor-breathe var(--kn-breathe) ease-in-out infinite; }
[data-kn-bg="gradient-floor"] .kn-a, [data-kn-bg="gradient-floor"] .kn-b { transform-origin: 50% 100%; will-change: transform; animation: var(--kn-name) var(--kn-dur) cubic-bezier(.45,0,.55,1) infinite alternate; }
[data-kn-bg="gradient-floor"] .kn-wave { position: absolute; bottom: 0; border-radius: 50%; pointer-events: none; will-change: transform, opacity; opacity: 0; }
`;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * A lit floor under a hero or a scene. Two soft gradient layers drift and breathe along the bottom edge;
 * `pulse(x)` (a ref, or `pulseGradientFloors` from anywhere) sends a wave across it. The drift is
 * transform-animated CSS and each wave one short Web Animation on one element, so a frame costs almost
 * nothing and React never re-renders for a pulse. It pauses offscreen and in hidden tabs, and under reduced
 * motion shows the still, composed floor (pulses are ignored).
 */
export function GradientFloor({ speed, color, mask = "none", intensity, paused, height = 0.6, channel, className, style, children, ref }: GradientFloorProps) {
  const root = useRef<HTMLDivElement>(null);
  const waves = useRef<HTMLDivElement>(null);
  const { live } = useLive(root, paused);
  const s = speedScale(speed);
  const k = intensityScale(intensity);
  const list = (Array.isArray(color) ? color : color ? [color] : DEFAULT).slice(0, 2).map((c) => tokenColor(c));
  const c1 = list[0];
  const c2 = list[1] ?? list[0];
  const rise = clamp(height, 0.2, 1) * 100;

  // Latest values for the pulse function the bus and the ref share (no re-subscribe on every render).
  const state = useRef({ live, s, k, c1, c2 });
  state.current = { live, s, k, c1, c2 };

  const pulse = useCallback((x = 0.5, strength = 1) => {
    const host = waves.current;
    const cur = state.current;
    if (!host || !cur.live || cur.s === 0 || typeof host.animate !== "function") return;
    while (host.childElementCount >= MAX_WAVES) host.firstElementChild?.remove();
    const st = clamp(strength, 0, 2);
    const el = document.createElement("div");
    el.className = "kn-wave";
    el.style.left = `${clamp(x, 0, 1) * 100}%`;
    el.style.width = `${34 + 14 * st}%`;
    el.style.height = "110%";
    // A wavefront, not a blob: a bright ring (lighter than the floor, so it shows on it) around a faint core.
    const front = `color-mix(in oklab, ${cur.c1} 62%, white)`;
    el.style.background = `radial-gradient(closest-side, ${withAlpha(cur.c2, 0.22 * cur.k)} 0%, ${withAlpha(cur.c2, 0.1 * cur.k)} 50%, ${withAlpha(front, 0.95 * cur.k)} 78%, ${withAlpha(cur.c1, 0.3 * cur.k)} 90%, transparent 100%)`;
    host.appendChild(el);
    const a = el.animate(
      [
        { transform: "translateX(-50%) scale(0.18)", opacity: 0 },
        { transform: "translateX(-50%) scale(0.5)", opacity: clamp(0.5 + 0.4 * st, 0, 1), offset: 0.22 },
        { transform: "translateX(-50%) scale(1.15)", opacity: 0 },
      ],
      { duration: 1500 / Math.max(0.3, cur.s), easing: "cubic-bezier(.2,.6,.3,1)", fill: "both" },
    );
    a.onfinish = a.oncancel = () => el.remove();
  }, []);

  useImperativeHandle(ref, () => ({ pulse }), [pulse]);

  useEffect(() => {
    const entry: Listener = { channel, pulse };
    floors.add(entry);
    return () => void floors.delete(entry);
  }, [channel, pulse]);

  const hold = s === 0 ? "paused" : undefined;
  const dur = (base: number) => `${(base / Math.max(0.05, s)).toFixed(1)}s`;

  return (
    <BackgroundFrame ref={root} name="gradient-floor" live={live} mask={mask} css={CSS} className={className} style={style} layer={
      <div className="kn-rise absolute inset-x-0 bottom-0" style={{ height: `${rise}%` }}>
        {/* A low base wash, so the floor reads as one lit surface under the two drifting layers. */}
        <div className="kn-breathe absolute inset-0 opacity-[0.85] dark:opacity-100" style={{ background: `linear-gradient(to top, ${withAlpha(c1, 0.34 * k)}, ${withAlpha(c2, 0.08 * k)} 58%, transparent)`, animationPlayState: hold, ["--kn-breathe" as string]: dur(9) }} />
        <div
          className="kn-a absolute opacity-[0.9] dark:opacity-100"
          style={{ left: "-12%", bottom: 0, width: "66%", height: "100%", background: `radial-gradient(ellipse closest-side at 50% 100%, ${withAlpha(c1, 0.78 * k)}, ${withAlpha(c1, 0.26 * k)} 52%, transparent)`, animationPlayState: hold, ["--kn-name" as string]: "knbg-floor-a", ["--kn-dur" as string]: dur(14) }}
        />
        <div
          className="kn-b absolute opacity-[0.9] dark:opacity-100"
          style={{ left: "44%", bottom: 0, width: "68%", height: "88%", background: `radial-gradient(ellipse closest-side at 50% 100%, ${withAlpha(c2, 0.66 * k)}, ${withAlpha(c2, 0.22 * k)} 52%, transparent)`, animationPlayState: hold, ["--kn-name" as string]: "knbg-floor-b", ["--kn-dur" as string]: dur(19) }}
        />
        <div ref={waves} className="absolute inset-0" />
      </div>
    }>
      {children}
    </BackgroundFrame>
  );
}
