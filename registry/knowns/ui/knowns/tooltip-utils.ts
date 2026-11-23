/** @registry part-of="tooltip" */
/**
 * Pure parts of TooltipGroup's hover highlight: a cubic-bezier evaluator for the motion tokens, and the keyframes
 * that let the highlight stretch from one trigger to the next. No React, no DOM.
 */
import { EASE, MOTION } from "@/registry/knowns/lib/knowns/motion-utils";

/** A box in the toolbar's own px: left, top, width, height. */
export interface HighlightBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** y of a CSS cubic-bezier(x1, y1, x2, y2) at progress x (0 to 1), solved for t by Newton steps with a bisection fallback. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const e = sx(t) - x;
      const d = dx(t);
      if (Math.abs(e) < 1e-6) return sy(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

/** A token easing string ("cubic-bezier(a, b, c, d)") as a function. */
export function easing(css: string): (x: number) => number {
  const n = css.match(/-?[\d.]+/g)?.map(Number) ?? [];
  return n.length === 4 ? cubicBezier(n[0] ?? 0, n[1] ?? 0, n[2] ?? 1, n[3] ?? 1) : (x) => x;
}

const OUT = easing(EASE.out);
const IN_OUT = easing(EASE.inOut);

/** How long the highlight travels: the trailing edge's time. The leading edge arrives in MOTION.fast. */
export const STRETCH_MS = MOTION.base;

/** A type alias (not an interface), so it is assignable to WAAPI's Keyframe. */
export type StretchFrame = { offset: number; transform: string };

/**
 * Keyframes that carry the highlight from `from` to `to`. The edge facing the move is stiff (ease-out over
 * MOTION.fast) and the trailing edge soft (ease-in-out over MOTION.base), so the pill stretches across the gap and
 * settles at the new trigger. The element is drawn at `to`'s size with transform-origin 0 0, so every frame is one
 * translate and one scale (transform only), and the last frame is exactly the rest state.
 */
export function stretchFrames(from: HighlightBox, to: HighlightBox, steps = 12): StretchFrame[] {
  const lead = (p: number) => OUT(Math.min(1, (p * STRETCH_MS) / MOTION.fast));
  const trail = (p: number) => IN_OUT(p);
  const edges = (a0: number, a1: number, b0: number, b1: number, p: number): [number, number] => {
    // Forward (toward larger coordinates): the far edge leads. Backward: the near edge leads.
    const fwd = b0 + b1 >= a0 + a1;
    const near = a0 + (b0 - a0) * (fwd ? trail(p) : lead(p));
    const far = a1 + (b1 - a1) * (fwd ? lead(p) : trail(p));
    return [near, Math.max(near + 1, far)];
  };
  const frames: StretchFrame[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = i / steps;
    const [x0, x1] = edges(from.x, from.x + from.w, to.x, to.x + to.w, p);
    const [y0, y1] = edges(from.y, from.y + from.h, to.y, to.y + to.h, p);
    const sx = to.w ? (x1 - x0) / to.w : 1;
    const sy = to.h ? (y1 - y0) / to.h : 1;
    frames.push({ offset: +p.toFixed(4), transform: `translate(${+x0.toFixed(2)}px, ${+y0.toFixed(2)}px) scale(${+sx.toFixed(4)}, ${+sy.toFixed(4)})` });
  }
  return frames;
}

/** The rest transform of the highlight on `box`. */
export function restTransform(box: HighlightBox): string {
  return `translate(${box.x}px, ${box.y}px) scale(1, 1)`;
}
