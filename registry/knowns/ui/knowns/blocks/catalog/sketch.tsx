/** @registry part-of="catalog-grid" */
import type { ReactNode, SVGProps } from "react";

/**
 * A small kit for catalog thumbnails: quiet, monochrome schematic drawings in one visual language. Every
 * thumbnail is a 160 x 100 drawing in currentColor at a few fixed opacities, with 1.25px hairlines and small
 * radii, so a grid of them reads as one family in light and dark. Compose the primitives inside <Sketch>.
 */

/** The opacities the kit uses: surfaces, hairlines, text and the one "active" element. */
export const INK = { fill: 0.06, fillStrong: 0.12, line: 0.32, text: 0.22, strong: 0.7 } as const;

type Rect = { x: number; y: number; w: number; h: number };

export function Sketch({ children, label, ...rest }: { children: ReactNode; label?: string } & Omit<SVGProps<SVGSVGElement>, "children">) {
  return (
    <svg viewBox="0 0 160 100" fill="none" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} {...rest}>
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
      strokeDasharray={dashed ? "3 3" : undefined}
    />
  );
}

/** A solid bar: a button, a filled track, a highlighted row. */
export function Bar({ x, y, w, h, r = 3, strong }: Rect & { r?: number; strong?: boolean }) {
  return <rect x={x} y={y} width={w} height={h} rx={r} fill="currentColor" fillOpacity={strong ? INK.strong : INK.fillStrong} />;
}

/** A line of text, drawn as a rounded stroke. */
export function Text({ x, y, w, strong, h = 4 }: { x: number; y: number; w: number; strong?: boolean; h?: number }) {
  return <rect x={x} y={y - h / 2} width={w} height={h} rx={h / 2} fill="currentColor" fillOpacity={strong ? INK.strong * 0.8 : INK.text} />;
}

export function Dot({ x, y, r = 3, strong, ring }: { x: number; y: number; r?: number; strong?: boolean; ring?: boolean }) {
  return ring ? (
    <circle cx={x} cy={y} r={r} fill="none" stroke="currentColor" strokeOpacity={strong ? INK.strong : INK.line} strokeWidth={1.25} />
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
    />
  );
}

/** A hairline path: edges, axes, connectors. Use straight runs and rounded corners. */
export function Line({ d, strong, dashed }: { d: string; strong?: boolean; dashed?: boolean }) {
  return <path d={d} stroke="currentColor" strokeOpacity={strong ? INK.strong : INK.line} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dashed ? "3 3" : undefined} />;
}
