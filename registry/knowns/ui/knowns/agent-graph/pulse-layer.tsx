"use client";

import { useEffect, useRef, useState } from "react";
import { ease, measure, pointAt, roundedPath, slice, type Pt } from "./routing";

export type PulseKind = "out" | "ok" | "fail";
export type Pulse = { key: string; from: string; to: string; start: number; dur: number; kind: PulseKind; hit?: boolean };
export type Flash = { from: string; to: string; start: number; until: number };

type Ref<T> = { current: T };

const SLICES = 7;
const toD = (pts: Pt[]) => "M" + pts.map((q) => `${q.x},${q.y}`).join(" L");

/**
 * Light streaks and error flashes. Owns its own animation-frame loop, so only this <g>
 * re-renders every frame - nodes, links and labels are left alone.
 */
export function PulseLayer({
  pulses,
  flashes,
  pathRef,
  hueRef,
  kickRef,
  arriveRef,
  corner,
}: {
  pulses: Ref<Pulse[]>;
  flashes: Ref<Flash[]>;
  /** Current route between two actors, or null if one is not placed. */
  pathRef: Ref<(from: string, to: string) => Pt[] | null>;
  hueRef: Ref<(a: string, b: string) => string>;
  /** Set by the layer: call it after pushing pulses to start the loop. */
  kickRef: Ref<(() => void) | null>;
  /** Called once when a streak reaches its target. */
  arriveRef: Ref<(id: string, color: string) => void>;
  corner: number;
}) {
  const [, setTick] = useState(0);
  const raf = useRef<number | null>(null);
  const arrivals = useRef<[string, string][]>([]);

  useEffect(() => {
    kickRef.current = () => {
      if (raf.current !== null) return;
      const loop = () => {
        const t = performance.now();
        pulses.current = pulses.current.filter((p) => t < p.start + p.dur);
        flashes.current = flashes.current.filter((f) => t < f.until);
        setTick((x) => (x + 1) % 1e9);
        raf.current = pulses.current.length || flashes.current.length ? requestAnimationFrame(loop) : null;
      };
      raf.current = requestAnimationFrame(loop);
    };
    kickRef.current();
    return () => {
      kickRef.current = null;
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [pulses, flashes, kickRef]);

  // Fire arrivals after paint, never during render.
  useEffect(() => {
    const due = arrivals.current;
    arrivals.current = [];
    for (const [id, color] of due) arriveRef.current(id, color);
  });

  const now = performance.now();

  const flashEls = flashes.current
    .filter((f) => now >= f.start)
    .map((f, i) => {
      const pts = pathRef.current(f.from, f.to);
      if (!pts) return null;
      const k = Math.max(0, 1 - (now - f.start) / (f.until - f.start));
      return (
        <path
          key={`f${i}`}
          d={roundedPath(pts, corner)}
          opacity={k}
          className="fill-none stroke-red-500 [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2.5]"
        />
      );
    });

  // Streak: bright head, tail fading out, bending round corners. Starts inside the source
  // node and runs until the tail is fully inside the target node.
  const streakEls = pulses.current.map((p) => {
    if (now < p.start) return null;
    const pts = pathRef.current(p.from, p.to);
    if (!pts) return null;
    const cum = measure(pts);
    const total = cum[cum.length - 1];
    const len = Math.min(p.kind === "ok" ? 56 : 84, total * 0.6);
    const head = ease(Math.min(1, (now - p.start) / p.dur)) * (total + len);
    const hue = p.kind === "fail" ? "#ef4444" : hueRef.current(p.from, p.to);
    const maxW = p.kind === "ok" ? 1.6 : 2;
    const glow = slice(pts, cum, head - len * 0.5, head);
    const segs = [];
    for (let i = 0; i < SLICES; i++) {
      const k = (i + 1) / SLICES;
      const part = slice(pts, cum, head - len + (i * len) / SLICES, head - len + ((i + 1) * len) / SLICES + 0.6);
      if (part.length < 2) continue;
      segs.push(
        <path key={i} d={toD(part)} strokeWidth={0.8 + (maxW - 0.8) * k} strokeOpacity={k * k * (p.kind === "ok" ? 0.75 : 1)} />,
      );
    }
    const tip = head <= total ? pointAt(pts, cum, head) : null;
    if (!p.hit && head >= total) {
      p.hit = true;
      arrivals.current.push([p.to, hue]);
    }
    return (
      <g
        key={p.key}
        style={{ ["--hue" as string]: hue }}
        className="fill-none [stroke:var(--hue)] [stroke-linecap:round] [stroke-linejoin:round]"
      >
        {glow.length > 1 && <path d={toD(glow)} strokeWidth={maxW * 2.6} strokeOpacity={0.12} />}
        {segs}
        {tip && (
          <circle
            cx={tip.x}
            cy={tip.y}
            r={maxW * 0.75}
            className={p.kind === "ok" ? "[fill:var(--hue)] stroke-none" : "[fill:color-mix(in_srgb,var(--hue)_35%,#fff)] stroke-none"}
          />
        )}
      </g>
    );
  });

  return (
    <g>
      {flashEls}
      {streakEls}
    </g>
  );
}
