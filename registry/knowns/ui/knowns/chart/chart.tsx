"use client";
/** @registry name="chart" type="ui" title="Chart" description="Line, bar (grouped or stacked), area, donut, pie, activity rings and sparkline in plain SVG with no dependency: axes, grid, keyboard tooltip, legend toggles, empty state and a screen-reader data table." */

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { EASE, MOTION, prefersReducedMotion } from "@/registry/knowns/lib/knowns/motion";
import {
  areaPath,
  bandPath,
  barFlip,
  bezierOf,
  lerpPoints,
  type BarBox,
  compact,
  linePath,
  linear,
  niceTicks,
  seriesColor,
  stackRows,
  toShares,
  valueAt,
  valueDomain,
  type ChartAnnotation,
  type ChartDatum,
  type ChartSeries,
} from "./chart-utils";
import { AnimatedNumber } from "../animated-number";
import { RadialChart, RingsChart } from "./chart-radial";

export { Sparkline, type SparklineProps } from "./sparkline";
export type { ChartAnnotation, ChartDatum, ChartSeries } from "./chart-utils";
export { VIVID_COLORS } from "./chart-utils";

export interface ChartProps {
  type?: "line" | "bar" | "area" | "donut" | "pie" | "rings";
  data: ChartDatum[];
  /** Key of the category field (x axis): a label or a date string. */
  x: string;
  series: ChartSeries[];
  /** Name for screen readers and the data table caption. */
  label: string;
  /** Bars and areas: stack the series instead of grouping or overlaying them. `"percent"` stacks each category's share of its total: the axis runs 0 to 100%, and the tooltip shows the share and the value. A hidden series drops out and the rest re-share. */
  stacked?: boolean | "percent";
  /** Smooth lines and areas. Default false. */
  smooth?: boolean;
  /** Lines and areas: `"smooth"` is a monotone curve that never overshoots a point (so an area never dips below its baseline); `"linear"` joins the points with straight segments. Wins over `smooth`. */
  curve?: "smooth" | "linear";
  /** Plot height in px. Default 240. */
  height?: number | "fill";
  /** Show the legend, which also toggles series. Default true when there is more than one series. */
  legend?: boolean;
  /** Format a value for the axis and the tooltip. Default: compact numbers. */
  format?: (v: number) => string;
  /** Format a category for the axis and the tooltip header. */
  formatX?: (x: string) => string;
  /** Fixed value range. Default: data range, including zero for bars and areas. */
  domain?: [number, number];
  /** No axes, labels or gridlines, only a baseline: a compact strip for use inside a card. Hover and keyboard still read each point. */
  bare?: boolean;
  /** Bars: write each bar's value above it. Skips zero and missing values. After a data change the labels fade in once the bars have grown. */
  valueLabels?: boolean;
  /** Bars of a single series: one colour per category, in data order (a colour per model, say). Any CSS colour. */
  barColors?: string[];
  /** Makes the points selectable: fired with the point's index and datum on a click, and on Enter or Space for the point the arrow keys are on. */
  onSelect?: (index: number, datum: ChartDatum) => void;
  /** The selected point's index, or null for none. Pass it to control the selection (update it from onSelect); leave it out and the chart keeps its own. */
  selected?: number | null;
  /** The point selected first, when the chart keeps its own selection. Default none. */
  defaultSelected?: number | null;
  /** Lines: format for the right-hand axis and for the tooltip and end labels of series on it. Default: `format`. */
  formatRight?: (v: number) => string;
  /** Lines: fixed value range of the right-hand axis (series with `axis: "right"`). Default: their data range. */
  domainRight?: [number, number];
  /** Lines and areas: markers on the x axis, each a dashed vertical line with a small button that opens a tooltip on hover or focus. */
  annotations?: ChartAnnotation[];
  /** Lines and areas: write each series' latest value, after its icon, at the end of its line. The value rolls when it changes and follows the line when it glides. Labels that would overlap are moved apart. */
  endLabels?: boolean;
  /** Lines and areas: hovering a series' end label or its legend entry dims the other series (120 ms). Default false. */
  focusSeries?: boolean;
  /** Lines and areas: a fixed number of x slots. Points fill from the left and the rest stays empty, so appending a point extends the line to the right instead of re-spacing every point; the end dot glides to the new point while the old ones stay put. Fewer points than before (a restart) cross-fades. Default: the points fill the width. */
  slots?: number;
  /** Areas: fill each series with a vertical gradient instead of a flat tint, and draw its line at 1.5px. Overlaid areas fade from the line colour at the top to nothing at the baseline; the number is the opacity at the top (`true`: 0.14). Stacked bands fade from that opacity (`true`: 0.6) to 45% of it. Default false. */
  fadeArea?: boolean | number;
  /** Lines and areas: the hover line. Default "dashed". */
  cursorLine?: "dashed" | "solid";
  /** Lines and areas: hovering the plot picks the series under the pointer (the band it is in when stacked, else the nearest line) as the focused one, so `focusSeries` dims the rest. Default false. */
  hoverSeries?: boolean;
  /** Controls which series is focused (a key or null); leave it out and the chart keeps it. Dimming still needs `focusSeries`. */
  focusedSeries?: string | null;
  /** Called when the focused series changes: from the legend, an end label, or the plot with `hoverSeries`. */
  onFocusSeries?: (key: string | null) => void;
  /** Lines and areas: a dot on the last point of each line. It glides with the line when the data changes. Default false. */
  endDot?: boolean;
  /** Donut and pie: slices are the rows of `data`, sized by the first series' value, labelled by `x`. Colours come from `barColors` or --chart-1..5. The legend toggles slices and the rest reflow. */
  /** Donut: ring width as a share of the radius (0.1 to 0.9). Default 0.32. A pie has no hole. */
  thickness?: number;
  /** Donut: `"total"` writes the sum of the visible slices in the hole, with the value rolling when it changes; any node is shown as it is. */
  center?: "total" | ReactNode;
  /** Donut with `center="total"`: the caption under the total. Default "Total". */
  centerLabel?: string;
  /** Donut and pie: space between slices in px. Default 2. Rings: space between rings, default 3. */
  gap?: number;
  /** Donut: round the ends of every slice (half circles as wide as the ring), keeping the gap between slices. Default false. */
  rounded?: boolean;
  /** Donut and pie: key of the field that holds each slice's max. The slice's arc follows its max and the value fills that share over a faint track in the same colour, so 49 of 50, 29 of 30 and 20 of 20 can add up to one ring. Without it slices are sized by value. */
  maxKey?: string;
  /** Rings: concentric progress rings, one per row of `data`, the first outermost. Each row has a value (the first series) and a goal (the field named by `goalKey`); the arc starts at 12 o'clock and runs clockwise. Past the goal it laps the start, with a soft shadow on the arc's end, up to three laps. `thickness` is the share of the radius the rings fill (default 0.62, each ring at most 14px wide; gap default 3, so three rings read as a compact set at 160 to 200px). `VIVID_COLORS` (pink-red, lime, cyan) is a bolder set for `barColors`; `center="total"` writes the overall progress, the mean of each ring's progress capped at 100%. Colours skip the neutral slot of the palette (accent, green, amber, red); `barColors` overrides them. */
  goalKey?: string;
  /** Rings: the ring in focus, or null for none. Pass it to drive focus from outside (a stat list); the other rings drop to low opacity (120ms). Leave it out and the chart follows its own hover and keys. */
  focused?: number | null;
  /** Rings: fired with the ring's data index when hover or keys move onto it, and null when they leave. */
  onFocusChange?: (index: number | null) => void;
  /** Rings: the tooltip beside the ring. Default true. */
  tooltip?: boolean;
  /** Shown when there is no data. */
  empty?: ReactNode;
  className?: string;
}

/** A bar with only its far end (top when `up`, else bottom) rounded. */
const endRounded = (x: number, y: number, w: number, h: number, r: number, up: boolean) =>
  up
    ? `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
    : `M${x},${y}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w - r}Q${x + w},${y + h} ${x + w},${y + h - r}V${y}Z`;

const M = { top: 10, right: 8, bottom: 26 };
const M_LABELS = { ...M, top: 24 };
/** Room for the end labels (icon, space and a value such as "$12.4k") to the right of the plot. */
const END_W = 84;
const END_GAP = 20;
/**
 * Motion (see .claude/skills/kn-motion). No intro: the first render is the final state. A real data change (a new
 * period, a series toggled) shows what changed: bars FLIP from their old box to the new one (transform only, about
 * their base), new bars fade in, removed bars fade out where they were, and lines and areas tween their points. An
 * identical re-render or a resize plays nothing; reduced motion is instant. Hover is opacity only, 120ms.
 */
const STYLE = `
@keyframes knch-in{from{opacity:0}}
@keyframes knch-out{to{opacity:0}}
.knch-tip{animation:knch-in var(--kn-dur-fast, ${MOTION.fast}ms) var(--kn-ease-out, ${EASE.out}) both}
.knch-leave{pointer-events:none;animation:knch-out var(--kn-dur-fast, ${MOTION.fast}ms) var(--kn-ease-out, ${EASE.out}) both}
@media (prefers-reduced-motion: reduce){.knch-tip{animation:none}.knch-leave{display:none}}
`;
const FILL_MIN = 120;
const HOVER = "transition-opacity duration-(--kn-dur-fast) ease-(--kn-ease-out)";
const EASE_INOUT = bezierOf(EASE.inOut);

type Bar = BarBox & { key: string; i: number; fill: string; d: string; stub?: boolean; v?: number };
type Pt = { x: number; y: number };
type Shape = { pts: Pt[]; base: Pt[] | null };

/** Line, bar, area, donut and pie charts in plain SVG. Arrow keys move the tooltip; the legend toggles series (slices for donut and pie). */
export function Chart(props: ChartProps) {
  const { type, thickness, center, centerLabel, gap, goalKey, rounded, maxKey, ...rest } = props;
  if (type === "rings" || type === "donut" || type === "pie") {
    const { stacked, smooth, curve, cursorLine, hoverSeries, focusedSeries, onFocusSeries, domain, bare, valueLabels, formatRight, domainRight, annotations, endLabels, focusSeries, slots, fadeArea, endDot, ...radial } = rest; // eslint-disable-line @typescript-eslint/no-unused-vars
    if (type === "rings") return <RingsChart thickness={thickness} center={center} centerLabel={centerLabel} gap={gap} goalKey={goalKey} {...radial} />;
    return <RadialChart type={type} thickness={thickness} center={center} centerLabel={centerLabel} gap={gap} rounded={rounded} maxKey={maxKey} {...radial} />;
  }
  return <LineBarChart type={type} {...rest} />;
}

function LineBarChart({ type = "line", data: rawData, x, series, label, stacked = false, smooth: smoothProp = false, curve, cursorLine = "dashed", hoverSeries = false, focusedSeries, onFocusSeries, height: heightProp = 240, legend, format: formatProp = compact, formatX = (s) => s, domain, bare = false, valueLabels = false, barColors, onSelect, selected, defaultSelected = null, endDot = false, slots, fadeArea = false, formatRight, domainRight, annotations, endLabels = false, focusSeries = false, empty = "No data yet", className }: ChartProps) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // height="fill": the plot takes the height its box gets from a flex or grid parent (at least FILL_MIN).
  const [boxH, setBoxH] = useState(0);
  const fill = heightProp === "fill";
  const height = fill ? Math.max(FILL_MIN, boxH) : heightProp;
  const [off, setOff] = useState<Set<string>>(() => new Set());
  const [active, setActive] = useState<number | null>(null);
  const [kept, setKept] = useState<number | null>(defaultSelected);
  const [focusOwn, setFocusOwn] = useState<string | null>(null);
  const focus = focusedSeries !== undefined ? focusedSeries : focusOwn;
  const setFocus = (k: string | null) => {
    if (focusedSeries === undefined) setFocusOwn(k);
    onFocusSeries?.(k);
  };
  const [annAt, setAnnAt] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      setWidth(Math.round(e.contentRect.width));
      setBoxH(Math.round(e.contentRect.height));
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setWidth(Math.round(r.width));
    setBoxH(Math.round(r.height));
    return () => ro.disconnect();
  }, []);

  const shown = series.filter((s) => !off.has(s.key));
  const keys = shown.map((s) => s.key);
  const isBar = type === "bar";
  const stack = !!stacked && (isBar || type === "area");
  const pct = stack && stacked === "percent";
  const smooth = curve ? curve === "smooth" : smoothProp;
  // Percent: every geometry below works on shares (0 to 100); the raw values stay in `rawData` for the tooltip and the table.
  const data = useMemo(() => (pct ? toShares(rawData, keys) : rawData), [pct, rawData, keys.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const format = pct ? (v: number) => `${Number(v.toFixed(1))}%` : formatProp;
  // Series on the right-hand axis (lines only) have their own scale; the left one covers the rest.
  const rightKeys = !isBar && !stack ? shown.filter((s) => s.axis === "right").map((s) => s.key) : [];
  const leftKeys = keys.filter((k) => !rightKeys.includes(k));
  const dom = useMemo(() => domain ?? (pct ? ([0, 100] as [number, number]) : valueDomain(data, leftKeys, { stacked: stack, zero: type !== "line" })), [data, leftKeys.join("|"), stack, pct, type, domain]); // eslint-disable-line react-hooks/exhaustive-deps
  const domR = useMemo(() => (rightKeys.length ? (domainRight ?? valueDomain(data, rightKeys, { stacked: false, zero: false })) : null), [data, rightKeys.join("|"), domainRight]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasData = data.length > 0 && series.some((s) => data.some((d) => valueAt(d, s.key) !== null));

  const ticks = dom ? niceTicks(dom[0], dom[1], Math.max(2, Math.round(height / 56))) : [0, 1];
  const lo = bare && dom ? dom[0] : (ticks[0] ?? 0);
  const hi = bare && dom ? dom[1] : (ticks[ticks.length - 1] ?? 1);
  const left = bare ? 0 : Math.max(...ticks.map((t) => format(t).length)) * 6.4 + 12;
  const fmtR = formatRight ?? format;
  const ticksR = domR ? niceTicks(domR[0], domR[1], Math.max(2, Math.round(height / 56))) : [];
  const loR = domR ? (bare ? domR[0] : (ticksR[0] ?? 0)) : 0;
  const hiR = domR ? (bare ? domR[1] : (ticksR[ticksR.length - 1] ?? 1)) : 1;
  const rightW = domR && !bare ? Math.max(...ticksR.map((t) => fmtR(t).length)) * 6.4 + 12 : 0;
  const m0 = bare ? { top: endDot ? 5 : 2, right: endDot ? 5 : 0, bottom: 0 } : valueLabels ? M_LABELS : M;
  const m = { ...m0, right: m0.right + rightW + (endLabels && !isBar ? END_W : 0) };
  const iw = Math.max(0, width - left - m.right);
  const ih = height - m.top - m.bottom;
  const y = linear(lo, hi, m.top + ih, m.top);
  const yR = linear(loR, hiR, m.top + ih, m.top);
  const yOf = (key: string) => (rightKeys.includes(key) ? yR : y);
  const fmtOf = (key: string) => (rightKeys.includes(key) ? fmtR : format);
  /** A raw value as text: what the tooltip and the table show beside a share. */
  const fmtRaw = (key: string) => (rightKeys.includes(key) ? fmtR : formatProp);
  const n = data.length;
  const band = n ? iw / n : 0;
  // Line and area: how many gaps the width is divided into (more than the points when `slots` leaves room to grow).
  const span = Math.max(1, Math.max(n, !isBar && slots ? slots : 0) - 1);
  const gid = id.replace(/[^a-zA-Z0-9_-]/g, "");
  const px = (i: number) => (isBar ? left + band * (i + 0.5) : left + (n > 1 || slots ? (iw * i) / span : iw / 2));
  const marks = (annotations ?? []).map((a) => ({ ...a, i: data.findIndex((d) => String(d[x] ?? "") === a.x) })).filter((a) => a.i >= 0);
  const dim = (key: string) => (focusSeries && focus !== null && focus !== key ? 0.2 : 1);
  const stackedRows = useMemo(() => (stack ? stackRows(data, keys) : []), [stack, data, keys.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - r.left - left;
    const at = Math.max(0, Math.min(n - 1, isBar ? Math.floor(sx / band) : Math.round((sx / (iw || 1)) * span)));
    setActive(at);
    if (hoverSeries && !isBar) {
      // The band the pointer is in (stacked), else the line nearest to it.
      const py = e.clientY - r.top;
      let hit: string | null = null;
      if (stack) {
        const v = lo + ((m.top + ih - py) / (ih || 1)) * (hi - lo);
        const cell = stackedRows[at]?.findIndex((c) => c.to > c.from && v >= c.from && v <= c.to) ?? -1;
        hit = cell >= 0 ? (keys[cell] ?? null) : null;
      } else {
        let best = Infinity;
        for (const l of lines) {
          const yy = l.pts[at]?.y;
          if (yy == null) continue;
          const dist = Math.abs(yy - py);
          if (dist < best) {
            best = dist;
            hit = l.s.key;
          }
        }
      }
      if (hit !== focus) setFocus(hit);
    }
  };
  const choose = (i: number) => {
    const d = data[i];
    if (i < 0 || !d) return;
    if (selected === undefined) setKept(i);
    onSelect?.(i, d);
  };
  const key = (e: KeyboardEvent) => {
    if (!n) return;
    if ((e.key === "Enter" || e.key === " ") && onSelect) {
      e.preventDefault();
      if (active !== null) choose(active);
      return;
    }
    const next = e.key === "ArrowRight" || e.key === "ArrowDown" ? (active === null ? 0 : active + 1) : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (active === null ? n - 1 : active - 1) : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (e.key === "Escape") return setActive(null);
    if (next === null) return;
    e.preventDefault();
    setActive(Math.max(0, Math.min(n - 1, next)));
  };

  const everyX = band || (n > 1 ? iw / (n - 1) : iw) ? Math.max(1, Math.ceil(64 / (isBar ? band : iw / Math.max(1, n - 1)))) : 1;
  const act = active !== null && active < n ? active : null;
  const chosen = selected !== undefined ? selected : kept;
  const sel = chosen !== null && chosen >= 0 && chosen < n ? chosen : null;
  // A bar is lit when it is hovered or selected, or when neither exists.
  const lit = (i: number) => (act === null && sel === null) || i === act || i === sel;
  const showLegend = legend ?? series.length > 1;
  const bw = isBar ? (stack ? Math.min(band * 0.62, 44) : Math.min((band * 0.72) / Math.max(1, shown.length), 28)) : 0;
  const gap = stack ? 0 : 3;
  const groupW = stack ? bw : shown.length * bw + (shown.length - 1) * gap;

  // What the marks show, as data: a change of it (not of width or hover) is what animates.
  const firstSig = useRef<string | null>(null);
  const sig = JSON.stringify([type, stack, pct, keys, data.map((d) => [d[x] ?? null, ...keys.map((k) => valueAt(d, k))])]);
  if (firstSig.current === null) firstSig.current = sig;
  const labelsPlay = sig !== firstSig.current;

  const bars: Bar[] = [];
  if (isBar)
    shown.forEach((s, si) =>
      data.forEach((d, i) => {
        const c = stack ? stackedRows[i]?.[si] : undefined;
        const v = valueAt(d, s.key);
        const k = `${s.key}-${i}`;
        const own = barColors?.[i];
        const fill = stack || !own ? seriesColor(s, series.indexOf(s)) : own;
        if (v === null && bare && !stack) return void bars.push({ key: k, i, fill, d: "", stub: true, x: px(i) - bw / 2, top: y(0) - 2, w: bw, h: 2, up: true });
        if (v === null || (stack && (!c || c.to === c.from))) return;
        const y0 = y(stack && c ? c.from : 0);
        const y1 = y(stack && c ? c.to : v);
        const top = Math.min(y0, y1);
        const h = Math.max(1, Math.abs(y0 - y1) - (stack ? 1 : 0));
        const bx = px(i) - groupW / 2 + (stack ? 0 : si * (bw + gap));
        // Only the outer end of a bar is rounded; inner joins of a stack stay square.
        const outer = stack ? !(stackedRows[i]?.slice(si + 1) ?? []).some((o) => o.to > o.from) : true;
        const up = stack || v >= 0;
        bars.push({ key: k, i, fill, v, x: bx, top, w: bw, h, up, d: outer ? endRounded(bx, top, bw, h, Math.min(4, bw / 2, h), up) : `M${bx},${top}h${bw}v${h}h${-bw}Z` });
      }),
    );

  const lines = isBar
    ? []
    : shown.map((s, si) => {
        const pts = data.map((d, i) => {
          const v = valueAt(d, s.key);
          const to = stack ? stackedRows[i]?.[si]?.to : undefined;
          const yy = stack ? (v === null || to === undefined ? null : y(to)) : v === null ? null : yOf(s.key)(v);
          return { x: px(i), y: yy };
        });
        const base = stack && si > 0 ? data.map((_, i) => ({ x: px(i), y: y(stackedRows[i]?.[si]?.from ?? 0) })) : null;
        return { s, c: seriesColor(s, series.indexOf(s)), pts, base };
      });
  // Only lines with every point can morph; one with a gap swaps at once.
  const targets = new Map<string, Shape>();
  for (const l of lines) if (l.pts.every((p) => p.y !== null)) targets.set(l.s.key, { pts: l.pts as Pt[], base: l.base });

  const svgRef = useRef<SVGSVGElement>(null);
  const seen = useRef<{ sig: string; bars: Map<string, Bar>; shapes: Map<string, Shape>; lo: number; hi: number; ticks: number[] } | null>(null);
  const [leaving, setLeaving] = useState<Bar[]>([]);
  /** A restart with `slots`: the old lines fade out over the new ones, which fade in. */
  const [fade, setFade] = useState<Map<string, Shape> | null>(null);
  /** A running tween: the old shapes and the old value axis, and the eased progress. */
  const [tween, setTween] = useState<{ from: Map<string, Shape>; lo: number; hi: number; ticks: number[]; t: number } | null>(null);
  useLayoutEffect(() => {
    if (!width) return;
    const now = new Map(bars.filter((b) => !b.stub).map((b) => [b.key, b]));
    const prev = seen.current;
    seen.current = { sig, bars: now, shapes: targets, lo, hi, ticks };
    if (!prev || prev.sig === sig || prefersReducedMotion()) {
      setTween(null);
      return;
    }
    // Bars: FLIP. Drawn at the new box, started from the old one, transform only.
    for (const b of now.values()) {
      const el = svgRef.current?.querySelector<SVGElement>(`[data-bar="${b.key}"]`);
      if (!el || typeof el.animate !== "function") continue;
      el.getAnimations?.().forEach((a) => a.cancel());
      const o = prev.bars.get(b.key);
      const from = o ? barFlip(o, b) : null;
      if (from) el.animate([{ transform: from }, { transform: "none" }], { duration: MOTION.slow, easing: EASE.inOut });
      else if (!o) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOTION.base, easing: EASE.out });
    }
    const gone = [...prev.bars.values()].filter((o) => !now.has(o.key));
    setLeaving(gone);
    const done = gone.length ? setTimeout(() => setLeaving([]), MOTION.fast) : undefined;
    // Lines and areas tween their points, and the value axis tweens its range, on the same timing (rAF: SVG path d
    // has no reliable CSS transition). The axis is what shows a new scale: gridlines slide to where their value now
    // sits while old labels fade out and new ones fade in.
    let raf = 0;
    let fadeT: ReturnType<typeof setTimeout> | undefined;
    // With `slots` a longer line starts from the old one: old points stay put and each new point starts where the line ended.
    let fromShapes = prev.shapes;
    if (slots) {
      fromShapes = new Map();
      let restarted = false;
      for (const [k, to] of targets) {
        const old = prev.shapes.get(k);
        if (!old) continue;
        if (to.pts.length < old.pts.length) {
          restarted = true;
          continue;
        }
        const tail = old.pts[old.pts.length - 1];
        fromShapes.set(k, { pts: to.pts.map((p, i) => old.pts[i] ?? tail ?? p), base: null });
      }
      if (restarted) {
        setFade(prev.shapes);
        fadeT = setTimeout(() => setFade(null), MOTION.fast);
      }
    }
    if ((fromShapes.size && targets.size) || prev.lo !== lo || prev.hi !== hi) {
      const start = performance.now();
      const from = { from: fromShapes, lo: prev.lo, hi: prev.hi, ticks: prev.ticks };
      const step = (t: number) => {
        const p = Math.min(1, (t - start) / MOTION.slow);
        setTween(p >= 1 ? null : { ...from, t: EASE_INOUT(p) });
        if (p < 1) raf = requestAnimationFrame(step);
      };
      setTween({ ...from, t: 0 });
      raf = requestAnimationFrame(step);
    }
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
      clearTimeout(fadeT);
    };
  }, [sig, width]); // eslint-disable-line react-hooks/exhaustive-deps

  /** The points to draw now: mid-tween, between the old shape and the new. */
  /** A stacked band on one curve top and bottom; null when a point is missing (the straight-edged fallback draws it). */
  const bandOf = (top: { x: number; y: number | null }[], base: Pt[]) => (top.every((p) => p.y !== null) ? bandPath(top as Pt[], base, smooth) : null);
  const drawn = (key: string, pts: (Pt | { x: number; y: number | null })[], base: Pt[] | null) => {
    const from = tween?.from.get(key);
    const to = targets.get(key);
    if (!tween || !from || !to) return { pts, base };
    return { pts: lerpPoints(from.pts, to.pts, tween.t), base: to.base && from.base ? lerpPoints(from.base, to.base, tween.t) : to.base ? lerpPoints(from.pts, to.base, tween.t) : base };
  };

  // The value axis mid-tween: the range eases from the old one, old ticks fade out (twice as fast, so labels never crowd) and new ones in where they sit now.
  const mix = (a: number, b: number) => (tween ? a + (b - a) * tween.t : b);
  const tickY = tween ? linear(mix(tween.lo, lo), mix(tween.hi, hi), m.top + ih, m.top) : y;
  const tickRows = bare
    ? [{ t: lo, o: 1 }]
    : tween
      ? [...ticks.map((t) => ({ t, o: tween.ticks.includes(t) ? 1 : tween.t })), ...tween.ticks.filter((t) => !ticks.includes(t)).map((t) => ({ t, o: Math.max(0, 1 - tween.t * 2) }))]
      : ticks.map((t) => ({ t, o: 1 }));

  // The hover band and crosshair stay mounted at the last point, so leaving fades them instead of cutting them.
  const lastAct = useRef<number | null>(null);
  if (act !== null) lastAct.current = act;
  const bandAt = act ?? (lastAct.current !== null && lastAct.current < n ? lastAct.current : null);

  const actRow = act === null ? undefined : data[act];
  const rawRow = act === null ? undefined : rawData[act];
  const tipRows = actRow ? shown.map((s) => ({ s, i: series.indexOf(s), v: valueAt(actRow, s.key), raw: rawRow ? valueAt(rawRow, s.key) : null })) : [];
  const labelAt = (i: number) => formatX(String(data[i]?.[x] ?? ""));
  const total = stack && act !== null ? tipRows.reduce((a, r) => a + ((pct ? r.raw : r.v) ?? 0), 0) : null;
  // fadeArea: the opacity at the top of an area's gradient (stacked bands fade from a stronger one, down to 45% of it).
  const topA = typeof fadeArea === "number" ? fadeArea : stack ? 0.6 : 0.14;
  const gradient = !!fadeArea && type === "area";
  const tipLeft = act === null ? 0 : px(act);
  const flip = tipLeft > width * 0.6;

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
                ref={svgRef}
                role="img"
                aria-label={`${label}. ${type} chart, ${n} points. Arrow keys read each point${onSelect ? ", Enter selects it" : ""}; the data table follows.${sel !== null ? ` Selected: ${labelAt(sel)}.` : ""}`}
                tabIndex={0}
                aria-describedby={`${id}-live`}
                className={cn("block rounded-md text-muted-foreground", onSelect && "cursor-pointer", focusRing)}
                onPointerMove={move}
                onClick={onSelect ? (e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const sx = e.clientX - r.left - left;
                  choose(Math.max(0, Math.min(n - 1, isBar ? Math.floor(sx / band) : Math.round((sx / (iw || 1)) * span))));
                } : undefined}
                onPointerLeave={() => {
                  setActive(null);
                  if (hoverSeries) setFocus(null);
                }}
                onKeyDown={key}
                onBlur={() => setActive(null)}
              >
                {tickRows.map(({ t, o }) => (
                  <g key={t} opacity={tickY(t) < m.top - 1 || tickY(t) > m.top + ih + 1 ? 0 : o}>
                    <line x1={left} x2={width - m.right} y1={tickY(t)} y2={tickY(t)} stroke="currentColor" strokeOpacity={t === 0 || bare ? 0.35 : 0.14} />
                    {!bare && <text x={left - 8} y={tickY(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="currentColor" className="tabular-nums">
                      {format(t)}
                    </text>}
                  </g>
                ))}
                {domR &&
                  !bare &&
                  ticksR.map((t) => (
                    <text key={`r${t}`} data-right-tick="" x={left + iw + 8} y={yR(t)} dy="0.32em" fontSize={11} fill="currentColor" className="tabular-nums">
                      {fmtR(t)}
                    </text>
                  ))}
                {marks.map((a) => (
                  <line key={`ann-${a.x}`} data-annotation-line={a.x} x1={px(a.i)} x2={px(a.i)} y1={m.top} y2={m.top + ih} stroke="currentColor" strokeOpacity={0.45} strokeDasharray="3 3" />
                ))}
                {!bare && data.map((d, i) =>
                  (n - 1 - i) % everyX === 0 ? (
                    <text key={i} x={px(i)} y={height - 7} textAnchor={!isBar && i === 0 && n > 1 ? "start" : !isBar && i === n - 1 ? "end" : "middle"} fontSize={11} fill="currentColor">
                      {formatX(String(d[x] ?? ""))}
                    </text>
                  ) : null,
                )}
                {sel !== null &&
                  (isBar ? (
                    <rect data-selected-band="" x={left + band * sel} y={m.top} width={band} height={ih} rx={6} fill="currentColor" opacity={0.1} />
                  ) : (
                    <line data-selected-band="" x1={px(sel)} x2={px(sel)} y1={m.top} y2={m.top + ih} stroke="currentColor" strokeOpacity={0.5} />
                  ))}
                {bandAt !== null &&
                  (isBar ? (
                    <rect data-band="" x={left + band * bandAt} y={m.top} width={band} height={ih} rx={6} fill="currentColor" className={HOVER} style={{ opacity: act === null ? 0 : 0.08 }} />
                  ) : (
                    <line data-band="" x1={px(bandAt)} x2={px(bandAt)} y1={m.top} y2={m.top + ih} stroke="currentColor" strokeOpacity={0.4} strokeDasharray={cursorLine === "dashed" ? "3 3" : undefined} className={HOVER} style={{ opacity: act === null ? 0 : 1 }} />
                  ))}

                {bars.map((b) =>
                  b.stub ? (
                    <rect key={b.key} x={b.x} y={b.top} width={b.w} height={b.h} rx={1} fill="currentColor" opacity={0.2} />
                  ) : (
                    <path
                      key={b.key}
                      data-bar={b.key}
                      d={b.d}
                      fill={b.fill}
                      className={HOVER}
                      data-selected={b.i === sel ? "" : undefined}
                      style={{ opacity: lit(b.i) ? 1 : 0.55, transformBox: "fill-box", transformOrigin: b.up ? "50% 100%" : "50% 0%" }}
                    />
                  ),
                )}
                {valueLabels &&
                  isBar &&
                  !stack &&
                  bars.map((b) =>
                    b.v && b.v > 0 ? (
                      <text key={`v-${b.key}`} data-bar-label={b.key} x={b.x + b.w / 2} y={b.top - 6} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="currentColor" className={cn("tabular-nums", labelsPlay && "knch-tip")} style={labelsPlay ? { animationDelay: `${MOTION.slow}ms` } : undefined}>
                        {format(b.v)}
                      </text>
                    ) : null,
                  )}
                {leaving.map((b) => (
                  <path key={`leave-${b.key}`} data-leaving="" d={b.d} fill={b.fill} className="knch-leave" />
                ))}

                {fade &&
                  lines.map(({ s, c }) => {
                    const old = fade.get(s.key);
                    if (!old) return null;
                    return (
                      <g key={`fade-${s.key}`} className="knch-leave" style={{ color: c }}>
                        {type === "area" && <path d={areaPath(old.pts, y(Math.max(lo, Math.min(0, hi))), smooth)} fill={gradient && !stack ? `url(#${gid}-${s.key})` : "currentColor"} opacity={gradient && !stack ? 1 : 0.14} />}
                        <path d={linePath(old.pts, smooth)} fill="none" stroke="currentColor" strokeWidth={gradient ? 1.5 : 1.75} strokeLinecap="round" strokeLinejoin="round" />
                      </g>
                    );
                  })}
                {lines.map(({ s, c, pts: target, base: targetBase }) => {
                  const { pts, base } = drawn(s.key, target, targetBase);
                  return (
                    <g key={s.key} style={{ color: c, opacity: dim(s.key) }} className={cn(HOVER, fade && "knch-tip")}>
                      {gradient && (
                        <defs>
                          <linearGradient id={`${gid}-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0" stopColor="currentColor" stopOpacity={topA} />
                            <stop offset="1" stopColor="currentColor" stopOpacity={stack ? topA * 0.45 : 0} />
                          </linearGradient>
                        </defs>
                      )}
                      {type === "area" &&
                        (!base ? (
                          <path d={areaPath(pts, y(Math.max(lo, Math.min(0, hi))), smooth)} fill={gradient ? `url(#${gid}-${s.key})` : "currentColor"} opacity={gradient ? 1 : stack ? 0.5 : 0.14} />
                        ) : (
                          <path d={bandOf(pts, base) ?? `${linePath(pts, smooth)}L${[...base].reverse().map((p) => `${p.x},${p.y}`).join("L")}Z`} fill={gradient ? `url(#${gid}-${s.key})` : "currentColor"} opacity={gradient ? 1 : 0.5} />
                        ))}
                      <path data-line={s.key} d={linePath(pts, smooth)} fill="none" stroke="currentColor" strokeWidth={gradient ? 1.5 : 1.75} strokeLinecap={s.dashed ? "butt" : "round"} strokeLinejoin="round" strokeDasharray={s.dashed ? "5 4" : undefined} />
                      {endDot && (() => {
                        const end = pts[pts.length - 1];
                        return end && end.y != null ? <circle data-end-dot={s.key} cx={end.x} cy={end.y} r={3.5} fill="currentColor" stroke="var(--card, #fff)" strokeWidth={2} /> : null;
                      })()}
                      {sel !== null && pts[sel]?.y != null && <circle data-selected-point="" cx={pts[sel].x} cy={pts[sel].y!} r={5} fill="currentColor" stroke="var(--card, #fff)" strokeWidth={2} />}
                      {act !== null && act !== sel && pts[act]?.y != null && <circle cx={pts[act].x} cy={pts[act].y!} r={4} fill="var(--card, #fff)" stroke="currentColor" strokeWidth={2} />}
                    </g>
                  );
                })}
              </svg>

              {marks.map((a, k) => (
                <button
                  key={`annb-${a.x}`}
                  type="button"
                  data-annotation={a.x}
                  aria-label={a.label}
                  onPointerEnter={() => setAnnAt(k)}
                  onPointerLeave={() => setAnnAt(null)}
                  onFocus={() => setAnnAt(k)}
                  onBlur={() => setAnnAt(null)}
                  className={cn("absolute z-10 grid size-4 place-items-center rounded-full bg-popover text-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_22%,transparent)]", focusRing)}
                  style={{ left: px(a.i) - 8, top: Math.max(0, m.top - 8) }}
                >
                  <span aria-hidden="true" className="size-1.5 rotate-45 bg-current" />
                </button>
              ))}
              {marks.map((a) =>
                a.showLabel ? (
                  <span
                    key={`annl-${a.x}`}
                    aria-hidden="true"
                    data-annotation-label={a.x}
                    className="pointer-events-none absolute z-10 whitespace-nowrap font-mono text-[12px] leading-4 text-muted-foreground"
                    style={{ top: Math.max(0, m.top - 8), ...(px(a.i) > width / 2 ? { right: width - px(a.i) + 12 } : { left: px(a.i) + 12 }) }}
                  >
                    {a.label}
                  </span>
                ) : null,
              )}
              {annAt !== null && marks[annAt] && (
                <div
                  data-annotation-tip=""
                  role="tooltip"
                  className="knch-tip pointer-events-none absolute z-20 w-max max-w-56 rounded-xl border border-border bg-popover px-3 py-2 text-[12.5px] text-popover-foreground shadow-md"
                  style={{ left: px(marks[annAt].i), top: m.top + 14, transform: px(marks[annAt].i) > width / 2 ? "translateX(calc(-100% + 12px))" : "translateX(-12px)" }}
                >
                  <div className="font-medium">{marks[annAt].label}</div>
                  {marks[annAt].tooltip && <div className="mt-0.5 text-muted-foreground">{marks[annAt].tooltip}</div>}
                </div>
              )}
              {endLabels && !isBar && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                  {(() => {
                    const items = lines
                      .map(({ s, c, pts: target, base: tb }) => {
                        const end = drawn(s.key, target, tb).pts[n - 1];
                        const v = valueAt(data[n - 1] ?? {}, s.key);
                        return end && end.y != null && v !== null ? { s, c, x: end.x, y: end.y, v } : null;
                      })
                      .filter((it): it is NonNullable<typeof it> => it !== null)
                      .sort((a, b) => a.y - b.y);
                    // Labels that would overlap are pushed apart, top to bottom.
                    let floor = -Infinity;
                    const placed = items.map((it) => {
                      const ty = Math.max(it.y, floor + END_GAP);
                      floor = ty;
                      return { ...it, ty };
                    });
                    return placed.map((it) => (
                      <div
                        key={it.s.key}
                        data-end-label={it.s.key}
                        onPointerEnter={() => focusSeries && setFocus(it.s.key)}
                        onPointerLeave={() => focusSeries && setFocus(null)}
                        className={cn("absolute left-0 top-0 flex h-[18px] items-center gap-1.5 whitespace-nowrap text-[12px] font-medium text-foreground tabular-nums", HOVER, focusSeries && "pointer-events-auto")}
                        style={{ transform: `translate(${it.x + 10}px, ${it.ty - 9}px)`, opacity: dim(it.s.key) }}
                      >
                        {it.s.icon ?? <span className="size-2 flex-none rounded-[3px]" style={{ background: it.c }} />}
                        <AnimatedNumber value={it.v} format={fmtOf(it.s.key)} />
                      </div>
                    ));
                  })()}
                </div>
              )}

              {act !== null && (
                <div
                  aria-hidden="true"
                  className={cn("knch-tip pointer-events-none absolute z-10 min-w-36 rounded-xl border border-border bg-popover px-3 py-2 text-[12.5px] text-popover-foreground shadow-md", bare ? "-top-1.5" : "top-1")}
                  style={{ left: tipLeft, transform: bare ? `translate(${flip ? "calc(-100% - 12px)" : "12px"}, -100%)` : `translateX(${flip ? "calc(-100% - 12px)" : "12px"})` }}
                >
                  <div className="mb-1.5 font-medium">{labelAt(act)}</div>
                  <ul className="flex flex-col gap-1">
                    {tipRows.map((r) => (
                      <li key={r.s.key} className="flex items-center gap-2">
                        <span className="size-2 flex-none rounded-[3px]" style={{ background: seriesColor(r.s, r.i) }} />
                        <span className="text-muted-foreground">{r.s.label}</span>
                        <span className="ml-auto pl-3 font-medium tabular-nums">
                          {r.v === null ? "-" : fmtOf(r.s.key)(r.v)}
                          {pct && r.raw !== null && <span className="ml-1.5 font-normal text-muted-foreground">{formatProp(r.raw)}</span>}
                        </span>
                      </li>
                    ))}
                    {total !== null && tipRows.length > 1 && (
                      <li className="mt-0.5 flex items-center gap-2 border-t border-border pt-1.5">
                        <span className="text-muted-foreground">Total</span>
                        <span className="ml-auto pl-3 font-medium tabular-nums">{formatProp(total)}</span>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </>
          )
        )}
      </div>

      <div id={`${id}-live`} className="sr-only" aria-live="polite">
        {act === null && sel !== null && `Selected ${labelAt(sel)}`}
        {act !== null && `${sel === act ? "Selected, " : ""}${labelAt(act)}: ${tipRows.map((r) => `${r.s.label} ${r.v === null ? "no value" : fmtOf(r.s.key)(r.v)}${pct && r.raw !== null ? `, ${formatProp(r.raw)}` : ""}`).join(", ")}`}
      </div>

      {showLegend && hasData && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px]" aria-label="Series">
          {series.map((s, i) => {
            const on = !off.has(s.key);
            return (
              <li key={s.key}>
                <button
                  type="button"
                  aria-pressed={on}
                  onPointerEnter={() => focusSeries && on && setFocus(s.key)}
                  onPointerLeave={() => focusSeries && setFocus(null)}
                  disabled={on && shown.length === 1}
                  onClick={() => setOff((p) => { const nx = new Set(p); if (on) nx.add(s.key); else nx.delete(s.key); return nx; })}
                  className={cn("inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out)", on ? "text-foreground" : "text-muted-foreground line-through", "enabled:hover:bg-muted", focusRing)}
                >
                  <span className="size-2 flex-none rounded-[3px]" style={{ background: seriesColor(s, i), opacity: on ? 1 : 0.35 }} />
                  {s.label}
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
                {series.map((s) => <th key={s.key} scope="col">{s.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rawData.map((d, i) => (
                <tr key={i}>
                  <th scope="row">{formatX(String(d[x] ?? ""))}</th>
                  {series.map((s) => { const v = valueAt(d, s.key); return <td key={s.key}>{v === null ? "" : fmtRaw(s.key)(v)}</td>; })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
