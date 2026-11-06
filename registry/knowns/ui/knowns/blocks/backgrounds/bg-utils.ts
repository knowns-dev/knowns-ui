import type { CSSProperties, ReactNode } from "react";

/** Pure helpers shared by the backgrounds: colour tokens, fade masks, density, seeded randomness, geometry. */

export type BgDensity = "low" | "medium" | "high" | number;

/** Where the background stays visible; it fades out everywhere else. */
export type BgMask = "none" | "radial" | "top" | "bottom" | "edges";

/** Shared props of every background. */
export interface BackgroundProps {
  /** How much is drawn: "low" | "medium" | "high", or a multiplier (0.25–3). Default "medium". */
  density?: BgDensity;
  /** Motion speed multiplier. 0 holds still. Default 1. */
  speed?: number;
  /** A theme token ("foreground", "primary", "muted-foreground", "ring", "chart-1"…), a CSS variable ("--brand") or any CSS colour. */
  color?: string;
  /** Fade mask. Default "radial". */
  mask?: BgMask;
  /** Overall strength, 0–1.5. Default 1. */
  intensity?: number;
  /** Stops the motion (it also stops offscreen, in hidden tabs and with prefers-reduced-motion). */
  paused?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Content drawn above the background. */
  children?: ReactNode;
}

const TOKENS = new Set([
  "foreground",
  "background",
  "primary",
  "primary-foreground",
  "muted-foreground",
  "accent-foreground",
  "ring",
  "border",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
]);

/** A theme token name or CSS variable becomes var(--…); anything else is used as a CSS colour. */
export function tokenColor(color: string | undefined, fallback = "foreground"): string {
  const c = (color ?? fallback).trim();
  if (c.startsWith("--")) return `var(${c})`;
  if (TOKENS.has(c)) return `var(--${c})`;
  return c;
}

/** `color` at `alpha` (0–1), through color-mix so tokens in any colour space work. */
export function withAlpha(color: string, alpha: number): string {
  const pct = Math.round(Math.min(1, Math.max(0, alpha)) * 1000) / 10;
  return `color-mix(in oklab, ${color} ${pct}%, transparent)`;
}

/** mask-image for a fade mask, or undefined for "none". */
export function maskImage(mask: BgMask = "radial"): string | undefined {
  switch (mask) {
    case "none":
      return undefined;
    case "top":
      return "linear-gradient(to bottom, #000 0%, #000 35%, transparent 100%)";
    case "bottom":
      return "linear-gradient(to top, #000 0%, #000 35%, transparent 100%)";
    case "edges":
      return "linear-gradient(to right, transparent, #000 14%, #000 86%, transparent), linear-gradient(to bottom, transparent, #000 14%, #000 86%, transparent)";
    case "radial":
    default:
      return "radial-gradient(ellipse 70% 65% at 50% 45%, #000 35%, transparent 100%)";
  }
}

/** "edges" stacks two gradients: they must intersect, not add. */
export function maskComposite(mask: BgMask = "radial"): string | undefined {
  return mask === "edges" ? "intersect" : undefined;
}

/** Density as a multiplier. */
export function densityScale(density: BgDensity = "medium"): number {
  if (typeof density === "number") return Number.isFinite(density) ? Math.min(3, Math.max(0.25, density)) : 1;
  return density === "low" ? 0.7 : density === "high" ? 1.45 : 1;
}

/** Speed as a multiplier, 0 meaning still. */
export function speedScale(speed = 1): number {
  return Number.isFinite(speed) ? Math.min(4, Math.max(0, speed)) : 1;
}

/** Clamped intensity. */
export function intensityScale(intensity = 1): number {
  return Number.isFinite(intensity) ? Math.min(1.5, Math.max(0, intensity)) : 1;
}

/** Small seeded PRNG (mulberry32): the same seed draws the same picture on server and client. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Signal lines ── */

export interface SignalTrace {
  /** SVG path data in the viewBox. */
  d: string;
  /** Start and end points, drawn as small terminals. */
  from: [number, number];
  to: [number, number];
  /** Seconds for one pulse, before the speed multiplier. */
  duration: number;
  /** Seconds before the first pulse. */
  delay: number;
}

/**
 * Board-style traces across a w×h viewBox: each starts on the left edge on a grid row, runs right in straight
 * stretches and steps up or down a row on 45° diagonals, like routed wiring. Deterministic for a seed.
 */
export function signalTraces(w: number, h: number, count: number, seed = 7, cell = 40): SignalTrace[] {
  const rng = mulberry32(seed);
  const rows = Math.max(2, Math.floor(h / cell) - 1);
  const used = new Set<number>();
  const traces: SignalTrace[] = [];
  for (let i = 0; i < count; i++) {
    let row = 1 + Math.floor(rng() * rows);
    for (let tries = 0; used.has(row) && tries < rows; tries++) row = (row % rows) + 1;
    used.add(row);
    let x = -cell + Math.floor(rng() * 3) * cell;
    let y = row * cell;
    const pts: [number, number][] = [[x, y]];
    while (x < w + cell) {
      x += cell * (2 + Math.floor(rng() * 5));
      pts.push([x, y]);
      const step = rng() < 0.5 ? -1 : 1;
      const ny = y + step * cell;
      if (ny > cell * 0.5 && ny < h - cell * 0.5 && rng() < 0.7) {
        x += cell;
        y = ny;
        pts.push([x, y]);
      }
    }
    const d = pts.map(([px, py], j) => `${j ? "L" : "M"}${px} ${py}`).join(" ");
    traces.push({ d, from: pts[0], to: pts[pts.length - 1], duration: 5 + rng() * 5, delay: -rng() * 10 });
  }
  return traces;
}

/* ── Node field ── */

export interface FieldNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** How many nodes fit a w×h box at a density (about one per 9,000 px² at 1×), capped for the frame budget. */
export function nodeCount(w: number, h: number, density = 1): number {
  if (w <= 0 || h <= 0) return 0;
  return Math.max(8, Math.min(160, Math.round(((w * h) / 9000) * density * density)));
}

/** Scatter n nodes with slow random velocities (px per second). */
export function makeNodes(n: number, w: number, h: number, seed = 11): FieldNode[] {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => {
    const a = rng() * Math.PI * 2;
    const v = 6 + rng() * 10;
    return { x: rng() * w, y: rng() * h, vx: Math.cos(a) * v, vy: Math.sin(a) * v };
  });
}

/** Move every node by its velocity for dt seconds, bouncing softly off the edges. Mutates and returns nodes. */
export function stepNodes(nodes: FieldNode[], dt: number, w: number, h: number): FieldNode[] {
  for (const n of nodes) {
    n.x += n.vx * dt;
    n.y += n.vy * dt;
    if (n.x < 0) {
      n.x = -n.x;
      n.vx = Math.abs(n.vx);
    } else if (n.x > w) {
      n.x = 2 * w - n.x;
      n.vx = -Math.abs(n.vx);
    }
    if (n.y < 0) {
      n.y = -n.y;
      n.vy = Math.abs(n.vy);
    } else if (n.y > h) {
      n.y = 2 * h - n.y;
      n.vy = -Math.abs(n.vy);
    }
    // A node outside a box that just shrank lands back inside.
    n.x = Math.min(w, Math.max(0, n.x));
    n.y = Math.min(h, Math.max(0, n.y));
  }
  return nodes;
}

/** Opacity of a link between two nodes `dist` apart: 1 when touching, easing to 0 at `max`. */
export function linkAlpha(dist: number, max: number): number {
  if (max <= 0 || dist >= max) return 0;
  const t = 1 - dist / max;
  return t * t;
}

/** Link distance for a density: denser fields link over shorter spans so the web stays light. */
export function linkDistance(density = 1): number {
  return Math.round(130 / Math.sqrt(Math.max(0.25, density)));
}
