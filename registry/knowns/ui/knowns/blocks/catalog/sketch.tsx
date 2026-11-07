/** @registry part-of="catalog-grid" */
import { Children, isValidElement, type ReactElement, type ReactNode, type SVGProps } from "react";

/**
 * A small kit for catalog thumbnails: quiet, monochrome schematic drawings in one visual language. Every
 * thumbnail is a 160 x 100 drawing in currentColor at a few fixed opacities, with 1.25px hairlines and small
 * radii, so a grid of them reads as one family in light and dark. Compose the primitives inside <Sketch>.
 */

/** The opacities the kit uses: surfaces, hairlines, text and the one "active" element. */
export const INK = { fill: 0.06, fillStrong: 0.12, line: 0.32, text: 0.22, strong: 0.7, solid: 0.45 } as const;

type Rect = { x: number; y: number; w: number; h: number };

/**
 * `fit`: frame the drawing so its content fills that share of the thumbnail (e.g. 0.62), whatever area it
 * was drawn in, so a grid of thumbnails has one scale. Computed from the primitives' props (no DOM), so the
 * server and the browser agree. The scale is kept within 0.8x-1.4x; hairlines stay 1.25px at any scale.
 */
export function Sketch({ children, label, fit, ...rest }: { children: ReactNode; label?: string; fit?: number } & Omit<SVGProps<SVGSVGElement>, "children">) {
  const viewBox = fit ? fitViewBox(sketchBounds(children), fit) : "0 0 160 100";
  return (
    <svg viewBox={viewBox} fill="none" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} {...rest}>
      {children}
    </svg>
  );
}

/** A surface: card, panel, field. `strong` for the active one. */
export function Box({ x, y, w, h, r = 4, strong, filled = true, dashed }: Rect & { r?: number; strong?: boolean; filled?: boolean; dashed?: boolean }) {
  return (
    <rect
      x={x + 0.5}
      y={y + 0.5}
      width={w - 1}
      height={h - 1}
      rx={r}
      fill="currentColor"
      fillOpacity={filled ? (strong ? INK.fillStrong : INK.fill) : 0}
      stroke="currentColor"
      strokeOpacity={strong ? INK.strong : INK.line}
      strokeWidth={1.25}
      vectorEffect="non-scaling-stroke"
      strokeDasharray={dashed ? "3 3" : undefined}
    />
  );
}

/** A solid bar: a button, a filled track, a highlighted row. */
export function Bar({ x, y, w, h, r = 3, strong }: Rect & { r?: number; strong?: boolean }) {
  return <rect x={x} y={y} width={w} height={h} rx={r} fill="currentColor" fillOpacity={strong ? INK.solid : INK.fillStrong} />;
}

/** A line of text, drawn as a rounded stroke. */
export function Text({ x, y, w, strong, h = 4 }: { x: number; y: number; w: number; strong?: boolean; h?: number }) {
  return <rect x={x} y={y - h / 2} width={w} height={h} rx={h / 2} fill="currentColor" fillOpacity={strong ? INK.strong * 0.8 : INK.text} />;
}

export function Dot({ x, y, r = 3, strong, ring }: { x: number; y: number; r?: number; strong?: boolean; ring?: boolean }) {
  return ring ? (
    <circle cx={x} cy={y} r={r} fill="none" stroke="currentColor" strokeOpacity={strong ? INK.strong : INK.line} strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
  ) : (
    <circle cx={x} cy={y} r={r} fill="currentColor" fillOpacity={strong ? INK.strong : INK.line} />
  );
}

/** A pill: a badge, a chip, a tab. */
export function Pill({ x, y, w, h = 9, strong }: { x: number; y: number; w: number; h?: number; strong?: boolean }) {
  return (
    <rect
      x={x + 0.5}
      y={y - h / 2 + 0.5}
      width={w - 1}
      height={h - 1}
      rx={(h - 1) / 2}
      fill="currentColor"
      fillOpacity={strong ? INK.fillStrong : INK.fill}
      stroke="currentColor"
      strokeOpacity={strong ? INK.strong : INK.line}
      strokeWidth={1}
      vectorEffect="non-scaling-stroke"
    />
  );
}

/** A hairline path: edges, axes, connectors. Use straight runs and rounded corners. */
export function Line({ d, strong, dashed }: { d: string; strong?: boolean; dashed?: boolean }) {
  return <path d={d} stroke="currentColor" strokeOpacity={strong ? INK.strong : INK.line} strokeWidth={1.25} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dashed ? "3 3" : undefined} />;
}

/* ── Framing ── */

type Bounds = { x0: number; y0: number; x1: number; y1: number } | null;
const add = (b: Bounds, x0: number, y0: number, x1: number, y1: number): Bounds => (b ? { x0: Math.min(b.x0, x0), y0: Math.min(b.y0, y0), x1: Math.max(b.x1, x1), y1: Math.max(b.y1, y1) } : { x0, y0, x1, y1 });

/** The area a drawing covers, from its primitives' props. Plain SVG elements and wrapper components are walked through. */
export function sketchBounds(node: ReactNode, depth = 0): Bounds {
  let b: Bounds = null;
  const merge = (o: Bounds) => o && (b = add(b, o.x0, o.y0, o.x1, o.y1));
  Children.forEach(node, (c) => {
    if (!isValidElement(c) || depth > 8) return;
    const el = c as ReactElement<Record<string, unknown>>;
    const p = el.props;
    const n = (k: string, d = 0) => (typeof p[k] === "number" ? (p[k] as number) : d);
    if (el.type === Box || el.type === Bar) merge(add(null, n("x"), n("y"), n("x") + n("w"), n("y") + n("h")));
    else if (el.type === Text) merge(add(null, n("x"), n("y") - n("h", 4) / 2, n("x") + n("w"), n("y") + n("h", 4) / 2));
    else if (el.type === Pill) merge(add(null, n("x"), n("y") - n("h", 9) / 2, n("x") + n("w"), n("y") + n("h", 9) / 2));
    else if (el.type === Dot) merge(add(null, n("x") - n("r", 3), n("y") - n("r", 3), n("x") + n("r", 3), n("y") + n("r", 3)));
    else if (el.type === Line && typeof p.d === "string") merge(pathBounds(p.d as string)); else if (typeof el.type === "function") merge(sketchBounds((el.type as (q: unknown) => ReactNode)(p), depth + 1));
    else merge(sketchBounds(p.children as ReactNode, depth + 1));
  });
  return b;
}

/** End points (and control points) of an SVG path, absolute or relative, arcs included. Close enough for framing. */
export function pathBounds(d: string): Bounds {
  let b: Bounds = null;
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  const pt = (px: number, py: number) => (b = add(b, px, py, px, py));
  const SIZE: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
  for (const [, cmd, args] of d.matchAll(/([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g)) {
    const n = args.match(/-?\d*\.?\d+(?:e-?\d+)?/gi)?.map(Number) ?? [];
    const k = cmd.toLowerCase();
    const rel = cmd !== cmd.toUpperCase();
    if (k === "z") {
      x = sx;
      y = sy;
      continue;
    }
    const size = SIZE[k];
    for (let i = 0; i + size <= n.length; i += size) {
      const g = n.slice(i, i + size);
      if (k === "h") x = rel ? x + g[0] : g[0];
      else if (k === "v") y = rel ? y + g[0] : g[0];
      else if (k === "a") {
        x = rel ? x + g[5] : g[5];
        y = rel ? y + g[6] : g[6];
      } else {
        // Control points count too, so curves stay inside the frame.
        for (let j = 0; j + 1 < size - 2; j += 2) pt(rel ? x + g[j] : g[j], rel ? y + g[j + 1] : g[j + 1]);
        x = rel ? x + g[size - 2] : g[size - 2];
        y = rel ? y + g[size - 1] : g[size - 1];
      }
      pt(x, y);
      if (k === "m" && i === 0) {
        sx = x;
        sy = y;
      }
    }
  }
  return b;
}

/** A 160:100 viewBox around `b` where the content fills `fit` of the limiting side (scale 0.8x-1.4x of the 160x100 canvas). */
export function fitViewBox(b: Bounds, fit: number): string {
  if (!b || b.x1 <= b.x0 || b.y1 <= b.y0) return "0 0 160 100";
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  // The view width that makes the content fill `fit` of the width or the height, whichever binds.
  let vw = Math.max(w / fit, ((h / fit) * 160) / 100);
  vw = Math.min(Math.max(vw, 160 / 1.4), 160 / 0.8);
  const vh = (vw * 100) / 160;
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const r = (v: number) => Math.round(v * 100) / 100;
  return `${r(cx - vw / 2)} ${r(cy - vh / 2)} ${r(vw)} ${r(vh)}`;
}
