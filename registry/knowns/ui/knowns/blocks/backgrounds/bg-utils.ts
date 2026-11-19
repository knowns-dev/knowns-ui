/** @registry part-of="backgrounds-core" */
import type { CSSProperties, ReactNode } from "react";

/** Pure helpers shared by the backgrounds: colour tokens, fade masks, density, seeded randomness, geometry. */

export type BgDensity = "low" | "medium" | "high" | number;

/** Where the background stays visible; it fades out everywhere else. */
export type BgMask = "none" | "radial" | "top" | "bottom" | "edges";

/**
 * A quiet zone for your content, so body copy stays readable on top of the pattern. "center" fades the pattern
 * out in an ellipse behind a centred block (a hero); "band" clears a horizontal stripe through the middle;
 * "none" leaves the pattern as it is. It stacks with `mask`: both must let the pattern through.
 */
export type BgFocus = "none" | "center" | "band";

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
  /** Quiet zone behind your content: "center", "band" or "none" (default). Keeps body copy at AA contrast. */
  focus?: BgFocus;
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

/** mask-image for the focus zone: transparent where the content sits, opaque (pattern visible) around it. */
export function focusImage(focus: BgFocus = "none"): string | undefined {
  switch (focus) {
    case "center":
      return "radial-gradient(ellipse 48% 46% at 50% 50%, transparent 62%, #000 100%)";
    case "band":
      return "linear-gradient(to bottom, #000 0%, #000 18%, transparent 34%, transparent 74%, #000 90%, #000 100%)";
    case "none":
    default:
      return undefined;
  }
}

/** The mask-image of a background: its fade mask and focus zone, stacked. */
export function bgMaskImage(mask: BgMask = "radial", focus: BgFocus = "none"): string | undefined {
  const parts = [maskImage(mask), focusImage(focus)].filter(Boolean) as string[];
  return parts.length ? parts.join(", ") : undefined;
}

/** Stacked masks (edges, or any mask with a focus zone) must intersect, not add. */
export function maskComposite(mask: BgMask = "radial", focus: BgFocus = "none"): string | undefined {
  return mask === "edges" || (mask !== "none" && focus !== "none") ? "intersect" : undefined;
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
    const from = pts[0];
    const to = pts[pts.length - 1];
    if (!from || !to) continue;
    traces.push({ d, from, to, duration: 5 + rng() * 5, delay: -rng() * 10 });
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

/* ── Grid pattern ── */

/** A cell of a square grid, [column, row]. */
export type GridCell = [number, number];

/** `count` distinct cells of a cols×rows grid, deterministic for a seed. */
export function gridSquares(cols: number, rows: number, count: number, seed = 5): GridCell[] {
  const total = Math.max(0, Math.floor(cols) * Math.floor(rows));
  const n = Math.min(total, Math.max(0, Math.floor(count)));
  const rng = mulberry32(seed);
  const taken = new Set<number>();
  const out: GridCell[] = [];
  while (out.length < n) {
    const i = Math.floor(rng() * total);
    if (taken.has(i)) continue;
    taken.add(i);
    out.push([i % Math.floor(cols), Math.floor(i / Math.floor(cols))]);
  }
  return out;
}

/** The next lit set: about `share` of the cells move to new free cells, the rest stay. Same length as `cells`. */
export function rotateSquares(cells: GridCell[], cols: number, rows: number, rng: () => number, share = 0.34): GridCell[] {
  const total = Math.floor(cols) * Math.floor(rows);
  if (!cells.length || total <= cells.length) return cells;
  const key = (c: GridCell) => c[1] * Math.floor(cols) + c[0];
  const taken = new Set(cells.map(key));
  const moves = Math.max(1, Math.round(cells.length * share));
  const next = cells.slice();
  for (let m = 0; m < moves; m++) {
    const at = Math.floor(rng() * next.length);
    let i = Math.floor(rng() * total);
    for (let tries = 0; taken.has(i) && tries < 8; tries++) i = Math.floor(rng() * total);
    if (taken.has(i)) continue;
    const moved = next[at];
    if (!moved) continue;
    taken.delete(key(moved));
    taken.add(i);
    next[at] = [i % Math.floor(cols), Math.floor(i / Math.floor(cols))];
  }
  return next;
}

/** Grid cell size for a density: denser grids have smaller cells. */
export function gridCell(base = 40, density = 1): number {
  return Math.max(8, Math.round(base / Math.sqrt(Math.max(0.25, density))));
}

/* ── Dither field ── */

/**
 * Ordered-dither thresholds: the n×n Bayer matrix (n = 2, 4 or 8), row-major, normalised to (0, 1) as
 * (v + 0.5) / n². A cell is on when its intensity is above its threshold.
 */
export function bayerMatrix(n: 2 | 4 | 8 = 8): Float32Array {
  let m = [0, 2, 3, 1];
  let size = 2;
  while (size < n) {
    const next = new Array<number>(size * 2 * size * 2);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const v = 4 * (m[y * size + x] ?? 0);
        next[y * 2 * size + x] = v;
        next[y * 2 * size + x + size] = v + 2;
        next[(y + size) * 2 * size + x] = v + 3;
        next[(y + size) * 2 * size + x + size] = v + 1;
      }
    m = next;
    size *= 2;
  }
  const out = new Float32Array(n * n);
  for (let i = 0; i < out.length; i++) out[i] = ((m[i] ?? 0) + 0.5) / (n * n);
  return out;
}

/**
 * Ordered dither of one channel value (0 to 255) to one of `levels` evenly spaced steps (2 to 8). `t` is
 * the Bayer threshold in (0, 1). The step is floor(v / 255 * (levels - 1) + t), so a value between two
 * steps lands on the upper one for a share of cells equal to its distance from the lower one.
 */
export function ditherChannel(v: number, t: number, levels: number): number {
  const n = Math.max(2, Math.min(8, Math.round(levels))) - 1;
  const step = Math.min(n, Math.floor((Math.max(0, Math.min(255, v)) / 255) * n + t));
  return Math.round((step / n) * 255);
}

/** How an image is thresholded: each RGB channel on its own, or the luminance only (chroma kept as it is). */
export type DitherTone = "channel" | "luma";

/**
 * Dithers an RGBA image in place, one Bayer threshold per cell. "channel" quantises R, G and B separately
 * against it: colour is limited to a palette, but near a step the channels can round in different
 * directions, which shows as pink or green speckle. "luma" dithers only the luminance (Rec. 709) and
 * rescales the cell's own colour to that brightness, so the hue never flips between neighbours and only the
 * lightness is patterned. Alpha is left alone. `thr` is a bayerMatrix of size `matrix`.
 */
export function ditherImage(data: Uint8ClampedArray, cols: number, rows: number, thr: Float32Array, matrix: 2 | 4 | 8, levels: number, tone: DitherTone = "channel"): void {
  const m = matrix - 1;
  const shift = matrix === 8 ? 3 : matrix === 4 ? 2 : 1;
  for (let y = 0; y < rows; y++) {
    const row = (y & m) << shift;
    for (let x = 0; x < cols; x++) {
      const t = thr[row + (x & m)] ?? 0.5;
      const i = (y * cols + x) * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      if (tone === "luma") {
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const d = ditherChannel(l, t, levels);
        if (l < 1) {
          data[i] = data[i + 1] = data[i + 2] = d;
        } else {
          // Scale the colour to the dithered brightness. Past white the channels clip, so push the
          // excess into the others as grey rather than let one channel carry the hue.
          const k = d / l;
          const rr = r * k;
          const gg = g * k;
          const bb = b * k;
          const over = Math.max(0, Math.max(rr, gg, bb) - 255);
          const lift = over / 3;
          data[i] = Math.min(255, Math.round(rr + lift));
          data[i + 1] = Math.min(255, Math.round(gg + lift));
          data[i + 2] = Math.min(255, Math.round(bb + lift));
        }
      } else {
        data[i] = ditherChannel(r, t, levels);
        data[i + 1] = ditherChannel(g, t, levels);
        data[i + 2] = ditherChannel(b, t, levels);
      }
    }
  }
}

/**
 * Where an image lands in a box: [x, y, w, h] in the box's units. "cover" fills the box and crops, "contain"
 * fits inside it. `pos` is the focal point as fractions of the free space; [0.5, 0.5] is centred.
 */
export function imageRect(imgW: number, imgH: number, boxW: number, boxH: number, fit: "cover" | "contain" = "cover", pos: [number, number] = [0.5, 0.5]): [number, number, number, number] {
  if (imgW <= 0 || imgH <= 0 || boxW <= 0 || boxH <= 0) return [0, 0, Math.max(0, boxW), Math.max(0, boxH)];
  const k = fit === "cover" ? Math.max(boxW / imgW, boxH / imgH) : Math.min(boxW / imgW, boxH / imgH);
  const w = imgW * k;
  const h = imgH * k;
  const px = Math.max(0, Math.min(1, pos[0]));
  const py = Math.max(0, Math.min(1, pos[1]));
  // + 0 turns a -0 (free space times a 0 focal point) into 0.
  return [(boxW - w) * px + 0, (boxH - h) * py + 0, w, h];
}

/** Soft radial falloff: 1 at the centre, easing to 0 at `radius`. */
export function glowFalloff(dist: number, radius: number): number {
  if (radius <= 0 || dist >= radius) return 0;
  const t = 1 - dist / radius;
  return t * t * (3 - 2 * t);
}

/* ── Flickering grid ── */

/** Columns and rows of size+gap cells that fill w×h (CSS px). */
export function gridDims(w: number, h: number, size: number, gap: number): { cols: number; rows: number; pitch: number } {
  const pitch = Math.max(1, size + gap);
  return { cols: Math.max(0, Math.ceil(w / pitch)), rows: Math.max(0, Math.ceil(h / pitch)), pitch };
}

/**
 * How many cells to re-roll this frame: each cell flickers `chance` times per second on average, so a
 * frame of dt seconds updates cells × chance × dt, with the fractional part carried to the next frame.
 * Returns [count, carry].
 */
export function flickerBudget(cells: number, chance: number, dt: number, carry = 0): [number, number] {
  const want = Math.max(0, cells * chance * dt) + carry;
  const n = Math.min(cells, Math.floor(want));
  return [n, n === cells ? 0 : want - n];
}

/** xorshift32: a tiny allocation-free PRNG for per-frame sampling. Returns [0, 1). */
export function xorshift32(seed = 2463534242): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

/**
 * A content-safe hole baked into one factor per grid cell: 0 inside `box` (in cell units, [x0, y0, x1, y1]),
 * easing to 1 across `feather` cells with a smoothstep (a rounded rectangle), so a draw loop clears the
 * content with one multiply per cell.
 */
export function holeField(cols: number, rows: number, box: [number, number, number, number], feather: number): Float32Array {
  const cx = (box[0] + box[2]) / 2;
  const cy = (box[1] + box[3]) / 2;
  const hw = (box[2] - box[0]) / 2;
  const hh = (box[3] - box[1]) / 2;
  const f = Math.max(1e-6, feather);
  const hole = new Float32Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    const dy = Math.max(0, Math.abs(y + 0.5 - cy) - hh);
    for (let x = 0; x < cols; x++) {
      const dx = Math.max(0, Math.abs(x + 0.5 - cx) - hw);
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy) / f);
      hole[y * cols + x] = d * d * (3 - 2 * d);
    }
  }
  return hole;
}

/** The same hole at one point: 0 inside `box` ([x0, y0, x1, y1]), easing to 1 across `feather`. */
export function holeAt(x: number, y: number, box: [number, number, number, number], feather: number): number {
  const dx = Math.max(0, Math.abs(x - (box[0] + box[2]) / 2) - (box[2] - box[0]) / 2);
  const dy = Math.max(0, Math.abs(y - (box[1] + box[3]) / 2) - (box[3] - box[1]) / 2);
  const d = Math.min(1, Math.sqrt(dx * dx + dy * dy) / Math.max(1e-6, feather));
  return d * d * (3 - 2 * d);
}

/* ── Cube Field ── */

export type CubeMode = "isometric" | "perspective";

/** Perspective floor: the row gap at the bottom edge as a share of the pitch (the camera's tilt). */
export const PERSPECTIVE_PITCH = 0.55;

export interface CubeLayout {
  n: number;
  /** Top-face centre of each cube in CSS px, back to front (the draw order). */
  x: Float32Array;
  y: Float32Array;
  /** Sprite scale: 1 when isometric, shrinking toward the horizon in perspective. */
  scale: Float32Array;
  /** Position on the ground plane in CSS px, where the pointer and the wave are measured. */
  gx: Float32Array;
  gy: Float32Array;
  /** Distance fade, 0 to 1 (perspective only; 1 when isometric). */
  fade: Float32Array;
  /** The perspective camera: horizon y, height from the horizon to the bottom edge, and the width. */
  cam: { hy: number; hs: number; w: number };
}

/**
 * Where every cube sits for a w x h field. Isometric: a 2:1 lattice in staggered rows, `pitch` apart, ground
 * y doubled so the pointer's reach is round on the floor. Perspective: rows on a floor seen from above,
 * receding to a horizon above the top edge, culled where they shrink below 0.4.
 */
export function cubeLayout(mode: CubeMode, w: number, h: number, pitch: number): CubeLayout {
  const xs: number[] = [];
  const ys: number[] = [];
  const ss: number[] = [];
  const gxs: number[] = [];
  const gys: number[] = [];
  const fs: number[] = [];
  const hy = -0.3 * h;
  const hs = h - hy;
  if (mode === "isometric") {
    const step = pitch / 4;
    const rows = Math.ceil(h / step) + 2;
    for (let r = -2; r < rows; r++) {
      const off = r & 1 ? pitch / 2 : 0;
      for (let x = off - pitch; x < w + pitch; x += pitch) {
        xs.push(x);
        ys.push(r * step);
        ss.push(1);
        gxs.push(x);
        gys.push(r * step * 2);
        fs.push(1);
      }
    }
  } else {
    const z0 = hs / (PERSPECTIVE_PITCH * pitch);
    const near = -Math.ceil(z0 * 0.08);
    const far = Math.ceil(z0 / 0.4 - z0);
    for (let k = far; k >= near; k--) {
      const s = z0 / (z0 + k);
      if (s < 0.4) continue;
      const y = hy + hs * s;
      const span = pitch * s;
      const fade = Math.min(1, (s - 0.4) / 0.22);
      const half = Math.ceil(w / 2 / span) + 1;
      for (let c = -half; c <= half; c++) {
        xs.push(w / 2 + c * span);
        ys.push(y);
        ss.push(s);
        gxs.push(c * pitch);
        gys.push(hs / PERSPECTIVE_PITCH / s);
        fs.push(fade * fade * (3 - 2 * fade));
      }
    }
  }
  return { n: xs.length, x: Float32Array.from(xs), y: Float32Array.from(ys), scale: Float32Array.from(ss), gx: Float32Array.from(gxs), gy: Float32Array.from(gys), fade: Float32Array.from(fs), cam: { hy, hs, w } };
}

/** The idle swell at a ground point: a slow travelling crest, sharpened so most cubes rest flat. */
export function waveLift(gx: number, gy: number, t: number, height: number): number {
  const a = 0.5 + 0.5 * Math.sin(gx * 0.011 + gy * 0.0065 - t * 1.15);
  const b = 0.75 + 0.25 * Math.sin(gx * 0.0042 - gy * 0.009 + t * 0.6);
  return a * a * a * a * b * height * 0.45;
}

/**
 * One spring step toward `target` (semi-implicit Euler, substepped at 1/120 s so long frames stay stable).
 * Slightly under-damped: a cube overshoots a touch and settles. Returns [position, velocity].
 */
export function springStep(x: number, v: number, target: number, dt: number, stiffness = 150, damping = 15): [number, number] {
  const n = Math.max(1, Math.ceil(dt * 120));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    v += ((target - x) * stiffness - v * damping) * h;
    x += v * h;
  }
  return [x, v];
}

/**
 * Like holeField, for many boxes (in dots): 0 inside the copy, easing to 1 across `feather`.
 * The edge is one soft shape, not per-line boxes: each box is a rounded rectangle (signed distance with
 * corner radius `round`), and nearby boxes melt together with a smooth minimum of width `smooth`, so the
 * lines of a paragraph, its buttons and a chip below form one organic contour. Each box only touches the
 * dots within reach, so measuring stays cheap with dozens of lines.
 */
export function holeFieldRects(
  cols: number,
  rows: number,
  boxes: [number, number, number, number][],
  feather: number,
  o: { round?: number; smooth?: number } = {},
): Float32Array {
  const f = Math.max(1e-6, feather);
  const k = Math.max(0, o.smooth ?? f * 0.75);
  const dist = new Float32Array(cols * rows).fill(Infinity);
  const reach = f + k;
  for (const [bx0, by0, bx1, by1] of boxes) {
    const hw = (bx1 - bx0) / 2;
    const hh = (by1 - by0) / 2;
    const cx = bx0 + hw;
    const cy = by0 + hh;
    const r = Math.max(0, Math.min(o.round ?? f * 0.25, hw, hh));
    const x0 = Math.max(0, Math.floor(bx0 - reach));
    const x1 = Math.min(cols - 1, Math.ceil(bx1 + reach));
    const y0 = Math.max(0, Math.floor(by0 - reach));
    const y1 = Math.min(rows - 1, Math.ceil(by1 + reach));
    for (let y = y0; y <= y1; y++) {
      const qy = Math.abs(y + 0.5 - cy) - (hh - r);
      for (let x = x0; x <= x1; x++) {
        const qx = Math.abs(x + 0.5 - cx) - (hw - r);
        // Rounded-rectangle signed distance: negative inside, 0 on the edge.
        const s = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
        const i = y * cols + x;
        const a = dist[i] ?? Infinity;
        if (a === Infinity || k === 0) {
          if (s < a) dist[i] = s;
          continue;
        }
        // Polynomial smooth minimum: melts boxes closer than k into one shape.
        const h = Math.max(k - Math.abs(a - s), 0) / k;
        dist[i] = Math.min(a, s) - h * h * k * 0.25;
      }
    }
  }
  const hole = new Float32Array(cols * rows);
  for (let i = 0; i < hole.length; i++) {
    const d = Math.min(1, Math.max(0, (dist[i] ?? 0) / f));
    hole[i] = d * d * (3 - 2 * d);
  }
  return hole;
}

/* ── Rain field ── */

export interface RainStreak {
  /** Grid column the streak falls down. */
  col: number;
  /** Head position in CSS px from the top. Starts above the field for a streak that has not arrived yet. */
  y: number;
  /** Fall speed in CSS px per second. */
  speed: number;
  /** Tail length in CSS px. */
  len: number;
  /** Head brightness, 0.25 to 1: far layers are dimmer. */
  glow: number;
  /** Depth layer: 0 near, 1 middle, 2 far. Far streaks fall slower and dimmer. */
  layer: 0 | 1 | 2;
}

/** Speed and brightness of the three depth layers: far streaks are slower and dimmer, which gives the field depth in one colour. */
export const RAIN_LAYERS = [
  { speed: 1, glow: 1 },
  { speed: 0.7, glow: 0.62 },
  { speed: 0.45, glow: 0.38 },
] as const;

/** How many streaks fall across `cols` columns: about one column in two at medium density, never fewer than 3. */
export function rainCount(cols: number, density = 1): number {
  return Math.max(3, Math.min(cols, Math.round(cols * 0.5 * density)));
}

/** A fresh streak: a random column, a speed in [60, 260] px/s, a length in `range` and a head brightness. `y` is left to the caller. */
function rainStreak(rng: () => number, cols: number, range: [number, number]): RainStreak {
  const [lo, hi] = range;
  const r = rng();
  const layer: 0 | 1 | 2 = r < 0.3 ? 0 : r < 0.65 ? 1 : 2;
  return { col: Math.floor(rng() * Math.max(1, cols)), y: 0, speed: (60 + rng() * 200) * RAIN_LAYERS[layer].speed, len: lo + rng() * Math.max(0, hi - lo), glow: (0.7 + rng() * 0.3) * RAIN_LAYERS[layer].glow, layer };
}

/** The starting streaks, spread over the whole height so the first frame (and a still frame) already looks full. */
export function makeRain(n: number, cols: number, h: number, range: [number, number], seed = 17): RainStreak[] {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => {
    const s = rainStreak(rng, cols, range);
    s.y = rng() * (h + s.len);
    return s;
  });
}

/**
 * Moves every streak down by speed × dt (in place, no allocation). A streak whose tail has left the bottom comes back
 * above the top as a new one: a new column, speed and length, so the pattern never repeats.
 */
export function stepRain(streaks: RainStreak[], dt: number, h: number, cols: number, range: [number, number], rng: () => number): void {
  for (const s of streaks) {
    s.y += s.speed * dt;
    if (s.y - s.len > h) {
      const n = rainStreak(rng, cols, range);
      s.col = n.col;
      s.speed = n.speed;
      s.len = n.len;
      s.glow = n.glow;
      s.layer = n.layer;
      s.y = -rng() * h * 0.25;
    }
  }
}

/** Brightness of a tail cell at `d` (0 at the head, 1 at the end of the tail): a quick fade then a long faint trail. */
export function rainAlpha(d: number): number {
  const t = Math.min(1, Math.max(0, 1 - d));
  return t ** 1.6;
}

/** Size of the working copy of a picture: the same shape, its longest side no more than `max`. Never enlarges. */
export function workingSize(w: number, h: number, max: number) {
  const k = Math.min(1, max / Math.max(w, h, 1));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)), scaled: k < 1 };
}
