/** @registry name="illustrations-core" type="ui" title="Illustrations core" description="Shared helpers for illustrations: pause offscreen, in hidden tabs and under reduced motion." deps="knowns-core" */
/** Small geometry and text helpers shared by the illustrations. */
import { AGENT_PALETTE } from "@/registry/knowns/lib/knowns/status";

export type Pt = { x: number; y: number };

/** Point at `t` (0–1) on a cubic Bézier. */
export function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

/** SVG path data for a cubic Bézier. */
export function cubicPath(p0: Pt, p1: Pt, p2: Pt, p3: Pt): string {
  const f = (p: Pt) => `${+p.x.toFixed(1)} ${+p.y.toFixed(1)}`;
  return `M ${f(p0)} C ${f(p1)}, ${f(p2)}, ${f(p3)}`;
}

/** Visible prefix of a prompt being typed, `at` ms after it started. */
export function typedPrefix(text: string, at: number, msPerChar = 34): string {
  if (at <= 0) return "";
  return text.slice(0, Math.min(text.length, Math.floor(at / msPerChar)));
}

/** The agent palette colour for slot `i`, wrapping around. The palette is never empty, so the fallback only types it. */
export function hueAt(i: number): string {
  return AGENT_PALETTE[i % AGENT_PALETTE.length] ?? "#0ea5e9"; // never reached (the index wraps); sky, not the brand colour
}

/** `arr[i]` for an index the caller knows is in range. Fails loudly instead of returning undefined, like a bad index always did. */
export function nth<T>(arr: ArrayLike<T>, i: number): T {
  const v = arr[i];
  if (v === undefined) throw new RangeError(`index ${i} is out of range`);
  return v;
}
