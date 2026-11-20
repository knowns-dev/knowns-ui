"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { EASE, MOTION, prefersReducedMotion } from "@/registry/knowns/lib/knowns/motion";
import { bezierOf, compact, SERIES_COLORS, valueAt, type ChartDatum, type ChartSeries } from "./chart-utils";
import { AnimatedNumber } from "../animated-number";

export interface RadialChartProps {
  type: "donut" | "pie" | "rings";
  data: ChartDatum[];
  /** Key of the slice label field. */
  x: string;
  /** The first series names the value key. Slices are the rows of `data`. */
  series: ChartSeries[];
  label: string;
  /** Donut: ring width as a share of the radius, 0.1 to 0.9. Default 0.32. A pie has no hole. */
  thickness?: number;
  /** Donut: "total" writes the sum of the visible slices in the hole; any node is shown as it is. Rings: "total" writes the overall progress, the mean of each ring's progress capped at 100%. */
  center?: "total" | ReactNode;
  /** Caption under the total. Default "Total". */
  centerLabel?: string;
  /** Space between slices in px (rings: between rings, default 3). Default 2. */
  gap?: number;
  /** Donut: round the ends of every slice (a half circle as wide as the ring), keeping the `gap` between neighbours. A single full ring has no ends. Default false. */
  rounded?: boolean;
  /** Donut and pie: key of the field that holds each slice's `max`. With it a slice's arc length follows its max and the first series' value fills that share of the arc over a faint track in the same colour: 49 of 50 is nearly full, 29 of 30 nearly full, and the arcs add up to the whole ring. Without it, slices are sized by value as before. */
  maxKey?: string;
  /** Rings: key of the field that holds each ring's goal. Default "goal". Progress is value / goal. */
  goalKey?: string;
  height?: number | "fill";
  legend?: boolean;
  format?: (v: number) => string;
  formatX?: (x: string) => string;
  /** One colour per slice, in data order. Any CSS colour. Default: --chart-1..5, repeating. */
  barColors?: string[];
  onSelect?: (index: number, datum: ChartDatum) => void;
  selected?: number | null;
  defaultSelected?: number | null;
  /** Rings: the ring that is in focus, or null for none. Pass it to drive the focus from outside (a stat list, say); the other rings drop to low opacity. Leave it out and the chart follows its own hover and keyboard focus. */
  focused?: number | null;
  /** Rings: fired with the ring's data index when hover or keyboard focus moves onto it, and with null when it leaves. */
  onFocusChange?: (index: number | null) => void;
  /** Rings: show the tooltip beside the ring. Default true. */
  tooltip?: boolean;
  empty?: ReactNode;
  className?: string;
}

/** Style tags of the chart: the same names the line and bar charts use. */
const STYLE = `
@keyframes knch-in{from{opacity:0}}
.knch-tip{animation:knch-in var(--kn-dur-fast, ${MOTION.fast}ms) var(--kn-ease-out, ${EASE.out}) both}
@media (prefers-reduced-motion: reduce){.knch-tip{animation:none}}
`;
const HOVER = "transition-opacity duration-(--kn-dur-fast) ease-(--kn-ease-out)";
const EASE_INOUT = bezierOf(EASE.inOut);
const FILL_MIN = 120;
const START = -Math.PI / 2;
const TAU = Math.PI * 2;

type Span = [number, number];

/** The angles of each visible slice, from 12 o'clock, clockwise. */
export function sliceAngles(values: { i: number; v: number }[]): Map<number, Span> {
  const total = values.reduce((a, s) => a + s.v, 0);
  const out = new Map<number, Span>();
  if (total <= 0) return out;
  let a = START;
  for (const s of values) {
    const next = a + (s.v / total) * TAU;
    out.set(s.i, [a, next]);
    a = next;
  }
  return out;
}

const pt = (cx: number, cy: number, r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;

/** One ring sector (a wedge when `inner` is 0), with `pad` radians trimmed off each side so slices keep a gap. */
export function sectorPath(cx: number, cy: number, outer: number, inner: number, span: Span, pad: number): string {
  const full = span[1] - span[0] >= TAU - 1e-6;
  const a0 = full ? span[0] : span[0] + pad / 2;
  const a1 = full ? span[1] : span[1] - pad / 2;
  if (a1 - a0 <= 1e-4) return "";
  if (full) {
    const mid = a0 + Math.PI;
    const ring = `M${pt(cx, cy, outer, a0)}A${outer},${outer} 0 1 1 ${pt(cx, cy, outer, mid)}A${outer},${outer} 0 1 1 ${pt(cx, cy, outer, a0)}Z`;
    return inner > 0 ? `${ring}M${pt(cx, cy, inner, a0)}A${inner},${inner} 0 1 0 ${pt(cx, cy, inner, mid)}A${inner},${inner} 0 1 0 ${pt(cx, cy, inner, a0)}Z` : ring;
  }
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const head = `M${pt(cx, cy, outer, a0)}A${outer},${outer} 0 ${large} 1 ${pt(cx, cy, outer, a1)}`;
  return inner > 0 ? `${head}L${pt(cx, cy, inner, a1)}A${inner},${inner} 0 ${large} 0 ${pt(cx, cy, inner, a0)}Z` : `${head}L${cx.toFixed(2)},${cy.toFixed(2)}Z`;
}

/** The angle a round end adds on each side of a slice, in radians: half the ring's width over the middle radius. */
export const capAngle = (outer: number, inner: number) => (inner > 0 ? (outer - inner) / 2 / Math.max(1e-6, (outer + inner) / 2) : 0);

/**
 * The part of a slice that is filled, as a span for `sectorPath` / `roundedSectorPath` with the same `pad` (and `cap`, the
 * `capAngle` when rounded): it starts where the slice starts and ends `ratio` (0 to 1) of the way along its inner length.
 */
export function partialSpan(span: Span, pad: number, cap: number, ratio: number): Span {
  const room = Math.max(0, span[1] - span[0] - pad - 2 * cap);
  return [span[0], span[0] + pad + 2 * cap + room * Math.min(1, Math.max(0, ratio))];
}

/**
 * A ring slice with round ends: an arc of the ring whose two ends are half circles as wide as the ring. The tips of the
 * ends stay `pad` radians apart from the neighbours (measured on the middle radius), like the flat slice. A full ring and
 * a wedge (no hole) have no ends, so they draw as `sectorPath` does.
 */
export function roundedSectorPath(cx: number, cy: number, outer: number, inner: number, span: Span, pad: number): string {
  if (inner <= 0 || span[1] - span[0] >= TAU - 1e-6) return sectorPath(cx, cy, outer, inner, span, pad);
  const cap = capAngle(outer, inner);
  let c0 = span[0] + pad / 2 + cap;
  let c1 = span[1] - pad / 2 - cap;
  if (span[1] - span[0] - pad <= 1e-4) return "";
  if (c1 < c0) c0 = c1 = (c0 + c1) / 2;
  const r = (outer - inner) / 2;
  const large = c1 - c0 > Math.PI ? 1 : 0;
  return `M${pt(cx, cy, outer, c0)}A${outer},${outer} 0 ${large} 1 ${pt(cx, cy, outer, c1)}A${r.toFixed(2)},${r.toFixed(2)} 0 0 1 ${pt(cx, cy, inner, c1)}A${inner},${inner} 0 ${large} 0 ${pt(cx, cy, inner, c0)}A${r.toFixed(2)},${r.toFixed(2)} 0 0 1 ${pt(cx, cy, outer, c0)}Z`;
}

/** The size of a box, kept up to date by a ResizeObserver. */
function useBoxSize(box: { current: HTMLDivElement | null }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    return () => ro.disconnect();
  }, [box]);
  return size;
}

/** Donut and pie charts in plain SVG. The legend toggles slices; arrow keys read each one. */
export function RadialChart({ type, data, x, series, label, thickness = 0.32, center, centerLabel = "Total", gap = 2, rounded = false, maxKey, height: heightProp = 240, legend = true, format = compact, formatX = (s) => s, barColors, onSelect, selected, defaultSelected = null, empty = "No data yet", className }: RadialChartProps) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const size = useBoxSize(box);
  const [off, setOff] = useState<Set<number>>(() => new Set());
  const [active, setActive] = useState<number | null>(null);
  const [kept, setKept] = useState<number | null>(defaultSelected);
  const fill = heightProp === "fill";
  const key = series[0]?.key ?? "";

  const partial = Boolean(maxKey);
  const rows = useMemo(() => data.map((d, i) => ({ i, d, v: valueAt(d, key), m: maxKey ? valueAt(d, maxKey) : null, name: formatX(String(d[x] ?? "")), color: barColors?.[i] ?? SERIES_COLORS[i % SERIES_COLORS.length] ?? "currentColor" })), [data, key, maxKey, x, barColors]); // eslint-disable-line react-hooks/exhaustive-deps
  /** With a max, the filled share of a slice's own arc; otherwise the slice is all fill. */
  const fillOf = (r: { v: number | null; m: number | null }) => (partial ? Math.min(1, Math.max(0, (r.v ?? 0) / (r.m ?? 1))) : 1);
  const listed = rows.filter((r) => (partial ? (r.m ?? 0) > 0 : r.v !== null && r.v > 0));
  const vis = listed.filter((r) => !off.has(r.i));
  const total = vis.reduce((a, r) => a + (partial ? Math.min(r.v ?? 0, r.m ?? 0) : (r.v ?? 0)), 0);
  const hasData = listed.length > 0;
  const to = useMemo(() => sliceAngles(vis.map((r) => ({ i: r.i, v: (partial ? r.m : r.v) ?? 0 }))), [vis.map((r) => `${r.i}:${partial ? r.m : r.v}`).join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const width = size.w;
  const height = fill ? Math.max(FILL_MIN, size.h) : heightProp;
  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.max(0, Math.min(width, height) / 2 - 4);
  const ratio = Math.min(0.9, Math.max(0.1, thickness));
  const inner = type === "donut" ? outer * (1 - ratio) : 0;
  const mid = (outer + inner) / 2;
  const pad = vis.length > 1 ? gap / Math.max(1, type === "donut" ? mid : outer * 0.6) : 0;

  const chosen = selected !== undefined ? selected : kept;
  const sel = chosen !== null && vis.some((r) => r.i === chosen) ? chosen : null;
  const act = active !== null && vis.some((r) => r.i === active) ? active : null;
  const lit = (i: number) => (act === null && sel === null) || i === act || i === sel;
  const choose = (i: number) => {
    const d = data[i];
    if (!d) return;
    if (selected === undefined) setKept(i);
    onSelect?.(i, d);
  };

  // Motion (kn-motion): the first render is the final state. A real change of values or of the visible slices tweens
  // the angles over --kn-dur-slow with the in-out ease (rAF: SVG path d has no CSS transition). Reduced motion is instant.
  const sig = JSON.stringify([type, vis.map((r) => [r.i, r.v, r.m])]);
  const fills = new Map(vis.map((r) => [r.i, fillOf(r)]));
  const seen = useRef<{ sig: string; angles: Map<number, Span>; fills: Map<number, number> } | null>(null);
  const [tween, setTween] = useState<{ from: Map<number, Span>; fromFills: Map<number, number>; t: number } | null>(null);
  useLayoutEffect(() => {
    if (!width) return;
    const prev = seen.current;
    seen.current = { sig, angles: to, fills };
    if (!prev || prev.sig === sig || prefersReducedMotion()) {
      setTween(null);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = prev.angles;
    const fromFills = prev.fills;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / MOTION.slow);
      setTween(p >= 1 ? null : { from, fromFills, t: EASE_INOUT(p) });
      if (p < 1) raf = requestAnimationFrame(step);
    };
    setTween({ from, fromFills, t: 0 });
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [sig, width]); // eslint-disable-line react-hooks/exhaustive-deps

  /** The angles to draw now: a slice that is new starts as a sliver at its own start and grows. */
  const drawn = (i: number, end: Span): Span => {
    const f = tween?.from.get(i);
    if (!tween) return end;
    const start: Span = f ?? [end[0], end[0]];
    return [start[0] + (end[0] - start[0]) * tween.t, start[1] + (end[1] - start[1]) * tween.t];
  };

  /** The filled share to draw now (a slice that is new fills from nothing). */
  const drawnFill = (i: number, end: number) => {
    const from = tween?.fromFills.get(i) ?? 0;
    return tween ? from + (end - from) * tween.t : end;
  };
  const roundedOn = rounded && type === "donut";
  const cap = roundedOn ? capAngle(outer, inner) : 0;
  const pathOf = (span: Span) => (roundedOn ? roundedSectorPath(cx, cy, outer, inner, span, pad) : sectorPath(cx, cy, outer, inner, span, pad));

  const onKey = (e: KeyboardEvent) => {
    if (!vis.length) return;
    if ((e.key === "Enter" || e.key === " ") && onSelect) {
      e.preventDefault();
      if (act !== null) choose(act);
      return;
    }
    if (e.key === "Escape") return setActive(null);
    const at = act === null ? -1 : vis.findIndex((r) => r.i === act);
    const next = e.key === "ArrowRight" || e.key === "ArrowDown" ? (at < 0 ? 0 : at + 1) : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (at < 0 ? vis.length - 1 : at - 1) : e.key === "Home" ? 0 : e.key === "End" ? vis.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    setActive(vis[Math.max(0, Math.min(vis.length - 1, next))]!.i);
  };

  const row = (i: number | null) => (i === null ? undefined : rows.find((r) => r.i === i));
  const actRow = row(act);
  const selRow = row(sel);
  /** A slice's share of the total, or with a max the share of its own arc that is filled. */
  const pct = (r: { v: number | null; m: number | null }) => (partial ? (r.v === null || !r.m ? "" : `${Math.round(fillOf(r) * 100)}%`) : r.v === null || total <= 0 ? "" : `${Math.round((r.v / total) * 100)}%`);
  const actSpan = act === null ? undefined : to.get(act);
  // The tooltip sits just outside the ring at the slice's middle, on the side with room, so it never covers the centre.
  const midA = actSpan ? (actSpan[0] + actSpan[1]) / 2 : 0;
  const roomy = width / 2 - outer >= 150;
  const tipAt = actSpan ? (roomy ? { x: cx + (outer + 8) * Math.cos(midA), y: cy + (outer + 8) * Math.sin(midA), right: Math.cos(midA) >= 0, inside: false } : { x: cx + mid * Math.cos(midA), y: cy + mid * Math.sin(midA), right: false, inside: true }) : null;
  const hole = inner * 2 * 0.78;

  return (
    <figure className={cn("flex flex-col gap-3", fill && "h-full min-h-0", className)}>
      <style>{STYLE}</style>
      <div ref={box} className={cn("relative w-full", fill && "min-h-0 flex-1")} style={fill ? { minHeight: FILL_MIN } : { height }}>
        {!hasData ? (
          <div role="img" aria-label={`${label}: no data`} className="grid size-full place-items-center rounded-xl border border-dashed border-border text-[13px] text-muted-foreground">
            {empty}
          </div>
        ) : (
          width > 0 && (
            <>
              <svg
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label={`${label}. ${type} chart, ${vis.length} slices, ${format(total)} in all. Arrow keys read each slice${onSelect ? ", Enter selects it" : ""}; the data table follows.${selRow ? ` Selected: ${selRow.name}.` : ""}`}
                tabIndex={0}
                aria-describedby={`${id}-live`}
                className={cn("block rounded-md text-muted-foreground", focusRing)}
                onPointerLeave={() => setActive(null)}
                onKeyDown={onKey}
                onBlur={() => setActive(null)}
              >
                {vis.map((r) => {
                  const end = to.get(r.i);
                  if (!end) return null;
                  const span = drawn(r.i, end);
                  if (partial) {
                    const track = pathOf(span);
                    const ratio = drawnFill(r.i, fills.get(r.i) ?? 0);
                    const fillD = ratio > 0.0005 ? pathOf(partialSpan(span, pad, cap, ratio)) : "";
                    return track ? (
                      <g
                        key={r.i}
                        data-slice={r.i}
                        data-selected={r.i === sel ? "" : undefined}
                        className={cn(HOVER, onSelect && "cursor-pointer")}
                        style={{ opacity: lit(r.i) ? 1 : 0.55 }}
                        onPointerEnter={() => setActive(r.i)}
                        onClick={onSelect ? () => choose(r.i) : undefined}
                      >
                        <path data-track="" d={track} fill={r.color} fillOpacity={0.18} fillRule="evenodd" />
                        {fillD && <path data-fill="" d={fillD} fill={r.color} fillRule="evenodd" />}
                      </g>
                    ) : null;
                  }
                  const d = pathOf(span);
                  return d ? (
                    <path
                      key={r.i}
                      data-slice={r.i}
                      data-selected={r.i === sel ? "" : undefined}
                      d={d}
                      fill={r.color}
                      fillRule="evenodd"
                      className={cn(HOVER, onSelect && "cursor-pointer")}
                      style={{ opacity: lit(r.i) ? 1 : 0.55 }}
                      onPointerEnter={() => setActive(r.i)}
                      onClick={onSelect ? () => choose(r.i) : undefined}
                    />
                  ) : null;
                })}
              </svg>

              {type === "donut" && center !== undefined && center !== false && center !== null && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div data-center="" className="flex flex-col items-center text-center" style={{ maxWidth: hole }}>
                    {center === "total" ? (
                      <>
                        <span className="text-[22px] font-semibold leading-tight text-foreground tabular-nums">
                          <AnimatedNumber value={total} format={format} />
                        </span>
                        <span className="text-[12px] text-muted-foreground">{centerLabel}</span>
                      </>
                    ) : (
                      center
                    )}
                  </div>
                </div>
              )}

              {actRow && tipAt && (
                <div aria-hidden="true" className="knch-tip pointer-events-none absolute z-10 min-w-32 rounded-xl border border-border bg-popover px-3 py-2 text-[12.5px] text-popover-foreground shadow-md" style={{ left: tipAt.x, top: tipAt.y, transform: tipAt.inside ? "translate(-50%, calc(-100% - 8px))" : `translate(${tipAt.right ? "0" : "-100%"}, -50%)` }}>
                  <div className="flex items-center gap-2">
                    <span className="size-2 flex-none rounded-[3px]" style={{ background: actRow.color }} />
                    <span className="text-muted-foreground">{actRow.name}</span>
                    <span className="ml-auto pl-3 font-medium tabular-nums">{format(actRow.v ?? 0)}{partial && actRow.m !== null ? ` / ${format(actRow.m)}` : ""}</span>
                    <span className="text-muted-foreground tabular-nums">{pct(actRow)}</span>
                  </div>
                </div>
              )}
            </>
          )
        )}
      </div>

      <div id={`${id}-live`} className="sr-only" aria-live="polite">
        {act === null && selRow && `Selected ${selRow.name}`}
        {actRow && `${sel === act ? "Selected, " : ""}${actRow.name}: ${format(actRow.v ?? 0)}${partial && actRow.m !== null ? ` of ${format(actRow.m)}` : ""}, ${pct(actRow)}`}
      </div>

      {legend && hasData && (
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[12.5px]" aria-label="Slices">
          {listed.map((r) => {
            const on = !off.has(r.i);
            return (
              <li key={r.i}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={on && vis.length === 1}
                  onClick={() => setOff((p) => { const nx = new Set(p); if (on) nx.add(r.i); else nx.delete(r.i); return nx; })}
                  className={cn("inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out)", on ? "text-foreground" : "text-muted-foreground line-through", "enabled:hover:bg-muted", focusRing)}
                >
                  <span className="size-2 flex-none rounded-[3px]" style={{ background: r.color, opacity: on ? 1 : 0.35 }} />
                  {r.name}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {hasData && (
        <div className="sr-only">
          {/* A table ignores width: 1px, so sr-only on the table itself still widens the page; the wrapper collapses. */}
          <table>
            <caption>{label}</caption>
            <thead>
              <tr>
                <th scope="col">{x}</th>
                <th scope="col">{series[0]?.label ?? key}</th>
                {partial && <th scope="col">Max</th>}
                <th scope="col">{partial ? "Filled" : "Share"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.i}>
                  <th scope="row">{r.name}</th>
                  <td>{r.v === null ? "" : format(r.v)}</td>
                  {partial && <td>{r.m === null ? "" : format(r.m)}</td>}
                  <td>{off.has(r.i) ? "" : pct(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}

const LAPS = 3;
/** Rings skip the neutral slot of the palette: accent, green, amber, red. `barColors` overrides it. */
const RING_COLORS = [SERIES_COLORS[0], SERIES_COLORS[2], SERIES_COLORS[3], SERIES_COLORS[4]];

/** How far a ring is drawn: `base` is the first lap (0 to 1), `lap` the arc that keeps going past the start (0 to 1, 0 when under the goal). Capped at three laps. */
export function ringProgress(value: number, goal: number): { p: number; base: number; lap: number } {
  const p = goal > 0 ? Math.min(LAPS, Math.max(0, value / goal)) : 0;
  return { p, base: Math.min(1, p), lap: p > 1 ? (p - 1) % 1 || 1 : 0 };
}

/** The progress to draw for a raw (possibly mid-tween) progress number. */
const drawProgress = (p: number) => ringProgress(p, 1);

const LAP_SHADOW = "drop-shadow(0 0 3px color-mix(in srgb, black 55%, transparent))";

/** Concentric progress rings in plain SVG: one ring per row, the first outermost. Progress is value over goal; past the goal the arc laps the start. */
export function RingsChart({ data, x, series, label, thickness = 0.62, center, centerLabel = "Overall", gap = 3, goalKey = "goal", height: heightProp = 240, legend = true, format = compact, formatX = (s) => s, barColors, onSelect, selected, defaultSelected = null, focused, onFocusChange, tooltip = true, empty = "No data yet", className }: Omit<RadialChartProps, "type">) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const size = useBoxSize(box);
  const [off, setOff] = useState<Set<number>>(() => new Set());
  const [active, setActiveRaw] = useState<number | null>(null);
  const setActive = (i: number | null) => {
    setActiveRaw(i);
    onFocusChange?.(i);
  };
  const [kept, setKept] = useState<number | null>(defaultSelected);
  const fill = heightProp === "fill";
  const key = series[0]?.key ?? "";

  const rows = useMemo(() => data.map((d, i) => ({ i, d, v: valueAt(d, key), goal: valueAt(d, goalKey), name: formatX(String(d[x] ?? "")), color: barColors?.[i] ?? RING_COLORS[i % RING_COLORS.length] ?? "currentColor" })), [data, key, goalKey, x, barColors]); // eslint-disable-line react-hooks/exhaustive-deps
  const listed = rows.filter((r) => r.v !== null && r.goal !== null && r.goal > 0);
  const vis = listed.filter((r) => !off.has(r.i));
  const hasData = listed.length > 0;
  const prog = (r: { v: number | null; goal: number | null }) => (r.goal ? (r.v ?? 0) / r.goal : 0);
  const pct = (r: { v: number | null; goal: number | null }) => `${Math.round(prog(r) * 100)}%`;
  // The overall figure is the mean of each ring's progress, each capped at 100%: goals in different units never mix.
  const overall = vis.length ? vis.reduce((a, r) => a + Math.min(1, prog(r)), 0) / vis.length : 0;

  const width = size.w;
  const height = fill ? Math.max(FILL_MIN, size.h) : heightProp;
  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.max(0, Math.min(width, height) / 2 - 4);
  const n = Math.max(1, vis.length);
  const band = Math.min(1, Math.max(0.2, thickness)) * outer;
  const stroke = Math.max(4, Math.min(14, (band - (n - 1) * gap) / n));
  const radiusOf = (k: number) => outer - stroke / 2 - k * (stroke + gap);
  const hole = Math.max(0, outer - n * stroke - (n - 1) * gap) * 2 * 0.78;

  const chosen = selected !== undefined ? selected : kept;
  const sel = chosen !== null && vis.some((r) => r.i === chosen) ? chosen : null;
  const act = active !== null && vis.some((r) => r.i === active) ? active : null;
  // Focus: the ring in focus (from outside or from hover and keys) stays full, the others drop to low opacity.
  const hot = focused !== undefined ? (focused !== null && vis.some((r) => r.i === focused) ? focused : null) : act;
  const lit = (i: number) => (hot === null && sel === null) || i === hot || i === sel;
  const choose = (i: number) => {
    const d = data[i];
    if (!d) return;
    if (selected === undefined) setKept(i);
    onSelect?.(i, d);
  };

  // Motion (kn-motion): the first render is the final state. A real change of a value, a goal or the visible rings
  // sweeps each arc from where it was to where it is over --kn-dur-slow with the in-out ease. Reduced motion is instant.
  const sig = JSON.stringify(vis.map((r) => [r.i, r.v, r.goal]));
  const to = useMemo(() => new Map(vis.map((r) => [r.i, prog(r)])), [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const seen = useRef<{ sig: string; prog: Map<number, number> } | null>(null);
  const [tween, setTween] = useState<{ from: Map<number, number>; t: number } | null>(null);
  useLayoutEffect(() => {
    if (!width) return;
    const prev = seen.current;
    seen.current = { sig, prog: to };
    if (!prev || prev.sig === sig || prefersReducedMotion()) {
      setTween(null);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = prev.prog;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / MOTION.slow);
      setTween(p >= 1 ? null : { from, t: EASE_INOUT(p) });
      if (p < 1) raf = requestAnimationFrame(step);
    };
    setTween({ from, t: 0 });
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [sig, width]); // eslint-disable-line react-hooks/exhaustive-deps

  const drawn = (i: number, end: number) => {
    if (!tween) return end;
    const f = tween.from.get(i) ?? 0;
    return f + (end - f) * tween.t;
  };

  const onKey = (e: KeyboardEvent) => {
    if (!vis.length) return;
    if ((e.key === "Enter" || e.key === " ") && onSelect) {
      e.preventDefault();
      if (act !== null) choose(act);
      return;
    }
    if (e.key === "Escape") return setActive(null);
    const at = act === null ? -1 : vis.findIndex((r) => r.i === act);
    const next = e.key === "ArrowRight" || e.key === "ArrowDown" ? (at < 0 ? 0 : at + 1) : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (at < 0 ? vis.length - 1 : at - 1) : e.key === "Home" ? 0 : e.key === "End" ? vis.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    setActive(vis[Math.max(0, Math.min(vis.length - 1, next))]!.i);
  };

  const row = (i: number | null) => (i === null ? undefined : rows.find((r) => r.i === i));
  const actRow = row(act);
  const selRow = row(sel);
  const said = (r: NonNullable<typeof actRow>) => `${r.name}: ${format(r.v ?? 0)} of ${format(r.goal ?? 0)}, ${pct(r)}`;
  const actK = actRow ? vis.findIndex((r) => r.i === actRow.i) : -1;
  const roomy = width / 2 - outer >= 170;
  const tipY = actK >= 0 ? cy - radiusOf(actK) : 0;

  return (
    <figure className={cn("flex flex-col gap-3", fill && "h-full min-h-0", className)}>
      <style>{STYLE}</style>
      <div ref={box} className={cn("relative w-full", fill && "min-h-0 flex-1")} style={fill ? { minHeight: FILL_MIN } : { height }}>
        {!hasData ? (
          <div role="img" aria-label={`${label}: no data`} className="grid size-full place-items-center rounded-xl border border-dashed border-border text-[13px] text-muted-foreground">
            {empty}
          </div>
        ) : (
          width > 0 && (
            <>
              <svg
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label={`${label}. Rings chart, ${vis.length} rings, the first outermost. Arrow keys read each ring${onSelect ? ", Enter selects it" : ""}; the data table follows.${selRow ? ` Selected: ${selRow.name}.` : ""}`}
                tabIndex={0}
                aria-describedby={`${id}-live`}
                className={cn("block rounded-md text-muted-foreground", focusRing)}
                onPointerLeave={() => setActive(null)}
                onKeyDown={onKey}
                onBlur={() => setActive(null)}
              >
                {vis.map((r, k) => {
                  const rad = radiusOf(k);
                  if (rad <= 0) return null;
                  const len = 2 * Math.PI * rad;
                  const { base, lap } = drawProgress(drawn(r.i, to.get(r.i) ?? 0));
                  const dash = (f: number) => `${(len * f).toFixed(2)} ${len.toFixed(2)}`;
                  return (
                    <g
                      key={r.i}
                      data-ring={r.i}
                      data-selected={r.i === sel ? "" : undefined}
                      data-lapping={lap > 0 ? "" : undefined}
                      className={cn(HOVER, onSelect && "cursor-pointer")}
                      style={{ opacity: lit(r.i) ? 1 : 0.3 }}
                      onPointerEnter={() => setActive(r.i)}
                      onClick={onSelect ? () => choose(r.i) : undefined}
                    >
                      <circle cx={cx} cy={cy} r={rad} fill="none" stroke={r.color} strokeOpacity={0.2} strokeWidth={stroke} />
                      {base > 0 && <circle data-arc="" cx={cx} cy={cy} r={rad} fill="none" stroke={r.color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={base >= 1 ? undefined : dash(base)} transform={`rotate(-90 ${cx} ${cy})`} />}
                      {lap > 0 && <circle data-lap="" cx={cx} cy={cy} r={rad} fill="none" stroke={r.color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={dash(lap)} transform={`rotate(-90 ${cx} ${cy})`} style={{ filter: LAP_SHADOW }} />}
                    </g>
                  );
                })}
              </svg>

              {center !== undefined && center !== false && center !== null && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div data-center="" className="flex flex-col items-center text-center" style={{ maxWidth: hole }}>
                    {center === "total" ? (
                      <>
                        <span className="text-[22px] font-semibold leading-tight text-foreground tabular-nums">
                          <AnimatedNumber value={Math.round(overall * 100)} format={(v) => `${Math.round(v)}%`} />
                        </span>
                        <span className="text-[12px] text-muted-foreground">{centerLabel}</span>
                      </>
                    ) : (
                      center
                    )}
                  </div>
                </div>
              )}

              {tooltip && actRow && actK >= 0 && (
                <div
                  aria-hidden="true"
                  className="knch-tip pointer-events-none absolute z-10 min-w-36 rounded-xl border border-border bg-popover px-3 py-2 text-[12.5px] text-popover-foreground shadow-md"
                  style={roomy ? { left: cx + outer + 8, top: tipY, transform: "translateY(-50%)" } : { left: cx, top: tipY, transform: "translate(-50%, calc(-100% - 8px))" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="size-2 flex-none rounded-[3px]" style={{ background: actRow.color }} />
                    <span className="text-muted-foreground">{actRow.name}</span>
                    <span className="ml-auto pl-3 font-medium tabular-nums">{format(actRow.v ?? 0)}</span>
                    <span className="text-muted-foreground tabular-nums">/ {format(actRow.goal ?? 0)}</span>
                    <span className="font-medium tabular-nums">{pct(actRow)}</span>
                  </div>
                </div>
              )}
            </>
          )
        )}
      </div>

      <div id={`${id}-live`} className="sr-only" aria-live="polite">
        {act === null && selRow && `Selected ${selRow.name}`}
        {actRow && `${sel === act ? "Selected, " : ""}${said(actRow)}`}
      </div>

      {legend && hasData && (
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[12.5px]" aria-label="Rings">
          {listed.map((r) => {
            const on = !off.has(r.i);
            return (
              <li key={r.i}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={on && vis.length === 1}
                  onClick={() => setOff((p) => { const nx = new Set(p); if (on) nx.add(r.i); else nx.delete(r.i); return nx; })}
                  className={cn("inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out)", on ? "text-foreground" : "text-muted-foreground line-through", "enabled:hover:bg-muted", focusRing)}
                >
                  <span className="size-2 flex-none rounded-full" style={{ background: r.color, opacity: on ? 1 : 0.35 }} />
                  {r.name}
                  <span className="tabular-nums text-muted-foreground">{format(r.v ?? 0)} / {format(r.goal ?? 0)} · {pct(r)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {hasData && (
        <div className="sr-only">
          {/* A table ignores width: 1px, so sr-only on the table itself still widens the page; the wrapper collapses. */}
          <table>
            <caption>{label}</caption>
            <thead>
              <tr>
                <th scope="col">{x}</th>
                <th scope="col">{series[0]?.label ?? key}</th>
                <th scope="col">Goal</th>
                <th scope="col">Progress</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.i}>
                  <th scope="row">{r.name}</th>
                  <td>{r.v === null ? "" : format(r.v)}</td>
                  <td>{r.goal === null ? "" : format(r.goal)}</td>
                  <td>{r.v === null || !r.goal ? "" : pct(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
