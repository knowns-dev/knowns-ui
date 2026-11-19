"use client";
/** @registry name="heatmap" type="ui" title="Heatmap" description="A two-axis grid of values, such as weekday by hour or region by month, built with CSS grid and no chart library. Each cell mixes the accent into the track by its value so light and dark follow the theme, with row and column labels, a Less to More legend, one tab stop with the arrow keys to move between cells, and the focused cell announced with its row, column and value. Pointing at or focusing a cell rings it and brightens its two labels." */

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { bucketColumns, cellColor, describeCell, legendLevels, level, moveCell, scaleOf, summaryText, type Aggregate, type HeatCell, type HeatValue } from "./heatmap-utils";

export type { Aggregate, HeatCell, HeatValue } from "./heatmap-utils";

/** The active cell as the grid shows it, with the source columns it covers and its value (a bucket of columns when the grid is narrow). */
export interface HeatActive extends HeatCell {
  /** The first and last source column of this cell: equal unless the columns are bucketed. */
  from: number;
  to: number;
  value: HeatValue;
}

export interface HeatmapProps {
  /** One label per row, top to bottom: "Mon", "Tue", "EU", "US"... */
  rows: string[];
  /** One label per column, left to right: "00", "01"... */
  columns: string[];
  /** values[row][column]. null or a missing value is "no data": an empty cell, never a zero. */
  values: HeatValue[][];
  /** Names the grid for assistive tech, e.g. "Agent runs per hour". */
  label: string;
  /** The lowest value of the scale. Default: 0, or the lowest value when that is below 0. */
  min?: number;
  /** The value that gets the full accent. Default: the highest value in the grid. Pin it to compare grids. */
  max?: number;
  /** The text of a value for the legend and for screen readers. Default: grouped integers. */
  format?: (n: number) => string;
  /** Show only every nth column label (the full name is still read out). Default 1. */
  columnLabelEvery?: number;
  /** The Less to More legend under the grid. Default true. */
  legend?: boolean;
  /** Cell height: sm 20px, md 28px. Default "md". */
  size?: "sm" | "md";
  /** The narrowest a column gets before the grid scrolls sideways, in px. Default 22. */
  minCellWidth?: number;
  /**
   * Fit a wide grid to a narrow container by merging every `bucket` neighbouring columns (24 hours into 12 two-hour
   * columns) when the container is narrower than `below` px (default 480), so the whole range shows without scrolling.
   * `columnLabelEvery` then counts buckets; `aggregate` says how merged values combine (default "sum"; "mean" for rates).
   * A pinned `max` applies to the merged values.
   */
  narrow?: { bucket: number; below?: number; columnLabelEvery?: number; aggregate?: Aggregate };
  /** Controlled cell that is pointed at or focused (null for none), in the columns as shown. Leave it out to let the grid track it. */
  active?: HeatCell | null;
  /** Called when the pointed-at or focused cell changes, and with null when it leaves. */
  onActiveChange?: (cell: HeatActive | null) => void;
  /** Called on Enter, Space or a click on a cell. */
  onCellSelect?: (cell: HeatCell, value: HeatValue) => void;
  className?: string;
}

const GAP = 3;
const defaultFormat = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);

export function Heatmap({
  rows,
  columns,
  values,
  label,
  min,
  max,
  format = defaultFormat,
  columnLabelEvery = 1,
  legend = true,
  size = "md",
  minCellWidth = 22,
  narrow,
  active: activeProp,
  onActiveChange,
  onCellSelect,
  className,
}: HeatmapProps) {
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  // Narrow container: merge neighbouring columns so the whole range fits. Measured before paint, so a phone never shows the wide grid first.
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const read = () => setWidth(el.clientWidth);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const bucket = narrow && narrow.bucket > 1 && width > 0 && width < (narrow.below ?? 480) ? narrow.bucket : 1;
  const shown = useMemo(() => {
    if (bucket === 1) return { names: columns, labels: columns, values, spans: columns.map((_, i): [number, number] => [i, i]) };
    return bucketColumns(columns, values, bucket, narrow?.aggregate);
  }, [bucket, columns, values, narrow?.aggregate]);
  // Merged columns are few, so they may get narrower than a full grid's columns before anything scrolls.
  const cellMin = bucket > 1 ? Math.min(minCellWidth, 14) : minCellWidth;
  const labelEvery = bucket > 1 ? (narrow?.columnLabelEvery ?? columnLabelEvery) : columnLabelEvery;
  const scale = useMemo(() => scaleOf(shown.values, min, max), [shown.values, min, max]);
  const summary = useMemo(() => summaryText(rows, shown.names, shown.values, format), [rows, shown, format]);
  // The one tab stop moves with the arrow keys; hover and focus decide which cell is "active".
  const [tab, setTab] = useState<HeatCell>({ row: 0, col: 0 });
  const [hover, setHover] = useState<HeatCell | null>(null);
  const [focus, setFocus] = useState<HeatCell | null>(null);
  // The one tab stop stays inside the grid when the columns merge or split.
  const tabAt = { row: Math.min(tab.row, rows.length - 1), col: Math.min(tab.col, shown.names.length - 1) };
  const clip = (c: HeatCell | null) => (c && c.row < rows.length && c.col < shown.names.length ? c : null);
  const active = clip(activeProp !== undefined ? activeProp : (hover ?? focus));
  const sent = useRef<HeatActive | null>(null);
  useEffect(() => {
    const out: HeatActive | null = active ? { ...active, from: shown.spans[active.col]![0], to: shown.spans[active.col]![1], value: shown.values[active.row]?.[active.col] } : null;
    const p = sent.current;
    if (p === out || (p && out && p.row === out.row && p.col === out.col && p.from === out.from && p.to === out.to && p.value === out.value)) return;
    sent.current = out;
    onActiveChange?.(out);
  }, [active, shown, onActiveChange]);

  const labelCh = Math.max(2, ...rows.map((r) => r.length));
  const template = `calc(${labelCh}ch + 8px) repeat(${shown.names.length}, minmax(${cellMin}px, 1fr))`;
  const height = size === "sm" ? 20 : 28;
  const levels = legendLevels(5);

  const focusCell = (cell: HeatCell) => {
    setTab(cell);
    grid.current?.querySelector<HTMLElement>(`[data-r="${cell.row}"][data-c="${cell.col}"]`)?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>, cell: HeatCell) => {
    if (e.key === "Enter" || e.key === " ") {
      if (onCellSelect) {
        e.preventDefault();
        onCellSelect(cell, shown.values[cell.row]?.[cell.col]);
      }
      return;
    }
    const next = moveCell(cell, e.key, rows.length, shown.names.length, e.ctrlKey || e.metaKey);
    if (!next) return;
    e.preventDefault();
    focusCell(next);
  };

  return (
    <div ref={root} className={cn("w-full", className)}>
      <div className="kn-scroll overflow-x-auto pb-1">
        <div
          ref={grid}
          role="grid"
          aria-label={label}
          aria-describedby={`${uid}-summary`}
          aria-rowcount={rows.length + 1}
          aria-colcount={shown.names.length + 1}
          className="flex flex-col"
          style={{ gap: GAP, minWidth: `calc(${labelCh}ch + 8px + ${shown.names.length * (cellMin + GAP)}px)` }}
          onPointerLeave={() => setHover(null)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(null);
          }}
        >
          <div role="row" aria-rowindex={1} className="grid text-[12px] leading-none text-muted-foreground" style={{ gridTemplateColumns: template, columnGap: GAP }}>
            <span role="columnheader" className="sticky left-0 sr-only">
              {label}
            </span>
            {shown.labels.map((c, i) => (
              <span
                key={`${c}-${i}`}
                role="columnheader"
                aria-label={shown.names[i]}
                className={cn("text-center tabular-nums transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out)", active?.col === i && "text-foreground")}
              >
                {i % Math.max(1, labelEvery) === 0 ? c : <span aria-hidden="true">&nbsp;</span>}
              </span>
            ))}
          </div>
          {rows.map((r, ri) => (
            <div key={`${r}-${ri}`} role="row" aria-rowindex={ri + 2} className="grid items-center" style={{ gridTemplateColumns: template, columnGap: GAP }}>
              <span role="rowheader" className={cn("sticky left-0 z-[1] w-[calc(100%+3px)] bg-(--hm-bg,var(--background)) pr-2 text-[12px] leading-none text-muted-foreground transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out)", active?.row === ri && "text-foreground")}>
                {r}
              </span>
              {shown.labels.map((c, ci) => {
                const v = shown.values[ri]?.[ci];
                const has = typeof v === "number" && Number.isFinite(v);
                const on = active?.row === ri && active.col === ci;
                const cell = { row: ri, col: ci };
                return (
                  <div
                    key={`${c}-${ci}`}
                    role="gridcell"
                    tabIndex={tabAt.row === ri && tabAt.col === ci ? 0 : -1}
                    aria-label={describeCell(r, shown.names[ci]!, v, format)}
                    data-r={ri}
                    data-c={ci}
                    data-active={on || undefined}
                    data-empty={!has || undefined}
                    className={cn(
                      "rounded-[4px] outline-2 -outline-offset-1 outline-solid outline-transparent transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) focus:outline-transparent data-[active]:outline-foreground",
                      !has && "bg-muted/50",
                      onCellSelect && "cursor-pointer",
                    )}
                    style={{ height, ...(has ? { background: cellColor(level(v, scale.min, scale.max)) } : null) }}
                    onPointerEnter={() => setHover(cell)}
                    onFocus={() => {
                      setTab(cell);
                      setFocus(cell);
                    }}
                    onClick={() => onCellSelect?.(cell, v)}
                    onKeyDown={(e) => onKeyDown(e, cell)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p id={`${uid}-summary`} className="sr-only">
        {summary}
      </p>
      {legend && (
        <div role="img" aria-label={`Less to more, ${format(scale.min)} to ${format(scale.max)}`} className="mt-3 flex items-center justify-end gap-1.5 text-[12px] leading-none text-muted-foreground">
          <span aria-hidden="true">Less</span>
          {levels.map((t) => (
            <span key={t} aria-hidden="true" className="size-3 rounded-[3px]" style={{ background: cellColor(t) }} />
          ))}
          <span aria-hidden="true">More</span>
        </div>
      )}
    </div>
  );
}

export default Heatmap;
