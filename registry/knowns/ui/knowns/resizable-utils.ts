/** @registry part-of="resizable" */
/**
 * Resizable panels: the pure parts. Sizes are percentages of the group that add up to 100.
 * No React, no DOM.
 */

export interface PanelLimits {
  /** Smallest size in %, unless collapsed. Default 10. */
  min?: number;
  /** Largest size in %. Default 100. */
  max?: number;
  /** May shrink to 0 (collapsed): dragging below half of `min` snaps it shut. */
  collapsible?: boolean;
}

const minOf = (p: PanelLimits) => p.min ?? 10;
const lo = (p: PanelLimits) => (p.collapsible ? 0 : minOf(p));
const hi = (p: PanelLimits) => p.max ?? 100;
const round = (v: number) => Math.round(v * 1000) / 1000;

/** Equal shares for panels without a default, so the total is 100. */
export function initialSizes(defaults: (number | undefined)[]): number[] {
  const given = defaults.reduce<number>((s, d) => s + (d ?? 0), 0);
  const open = defaults.filter((d) => d === undefined).length;
  const share = open ? Math.max(0, 100 - given) / open : 0;
  return normalize(defaults.map((d) => d ?? share));
}

/** Scales sizes so they add up to 100. All zero gives equal shares. */
export function normalize(sizes: number[]): number[] {
  if (!sizes.length) return [];
  const total = sizes.reduce((s, v) => s + v, 0);
  if (total <= 0) return normalize(sizes.map(() => 1));
  const out = sizes.map((v) => round((v / total) * 100));
  out[out.length - 1] = round(out[out.length - 1] + (100 - out.reduce((s, v) => s + v, 0)));
  return out;
}

/**
 * Moves the divider between panel `i` and `i + 1` by `delta` percent (positive grows panel `i`),
 * from the layout `start`. Both panels stay inside their limits; a collapsible one snaps shut or open.
 */
export function resize(start: number[], i: number, delta: number, limits: PanelLimits[]): number[] {
  const a = start[i];
  const b = start[i + 1];
  if (a === undefined || b === undefined) return start;
  const A = limits[i] ?? {};
  const B = limits[i + 1] ?? {};
  const low = Math.max(lo(A) - a, b - hi(B));
  const high = Math.min(hi(A) - a, b - lo(B));
  const d = Math.min(Math.max(delta, low), Math.max(low, high));
  let na = a + d;
  let nb = b - d;
  const snap = (v: number, p: PanelLimits) => (p.collapsible && v > 0 && v < minOf(p) ? (v < minOf(p) / 2 ? 0 : minOf(p)) : v);
  const sa = snap(na, A);
  if (sa !== na) {
    na = sa;
    nb = a + b - na;
  } else {
    const sb = snap(nb, B);
    if (sb !== nb) {
      nb = sb;
      na = a + b - nb;
    }
  }
  const out = start.slice();
  out[i] = round(na);
  out[i + 1] = round(nb);
  return out;
}

/** Percent per arrow key: 1, or 10 with Shift. */
export const keyStep = (shift: boolean) => (shift ? 10 : 1);

/** Which way a key moves the divider, for a group side by side ("horizontal") or stacked ("vertical"). 0 for other keys. */
export function keyDirection(key: string, direction: "horizontal" | "vertical"): -1 | 0 | 1 {
  if (direction === "horizontal") return key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : 0;
  return key === "ArrowUp" ? -1 : key === "ArrowDown" ? 1 : 0;
}

/** Reads saved sizes; anything that does not fit the panels (count, total, numbers) is ignored. */
export function parseSaved(raw: string | null, count: number): number[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v) || v.length !== count || !v.every((x) => typeof x === "number" && Number.isFinite(x) && x >= 0)) return null;
    const total = (v as number[]).reduce((s, x) => s + x, 0);
    return Math.abs(total - 100) < 0.5 ? normalize(v as number[]) : null;
  } catch {
    return null;
  }
}

/** Pixels moved to percent of the room the panels share (the group minus its handles). */
export function pxToPercent(px: number, room: number): number {
  return room > 0 ? (px / room) * 100 : 0;
}
