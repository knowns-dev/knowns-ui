/** @registry part-of="heatmap" */
/** Pure logic for the heatmap: value to level, the colour mix, the legend steps, moving a focused cell and the spoken label of one. */

export type HeatValue = number | null | undefined;

export interface HeatCell {
  row: number;
  col: number;
}

/** The share of the scale a value fills, 0 to 1. Missing and non-finite values are 0; the scale is min to max. */
export function level(value: HeatValue, min: number, max: number): number {
  if (value === null || value === undefined || !Number.isFinite(value) || !(max > min)) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** How much accent a level mixes into the track, in percent: 12 for the lowest value up to 100 for the highest, so even the lowest cell is tinted and stays apart from a cell with no data. The legend uses the same function. */
export function mixPercent(t: number): number {
  return Math.round(12 + Math.min(1, Math.max(0, t)) * 88);
}

/** The background of one cell: the accent mixed into the track by value, so light and dark follow the theme. */
export function cellColor(t: number): string {
  return `color-mix(in oklab, var(--kn-accent, var(--primary)) ${mixPercent(t)}%, var(--muted))`;
}

/** The scale of the data: the lowest and highest finite value, with `min` and `max` pinning an end. */
export function scaleOf(values: readonly (readonly HeatValue[])[], min?: number, max?: number): { min: number; max: number } {
  let lo = Infinity;
  let hi = -Infinity;
  for (const row of values) for (const v of row) if (typeof v === "number" && Number.isFinite(v)) (lo = Math.min(lo, v)), (hi = Math.max(hi, v));
  if (lo === Infinity) lo = 0;
  if (hi === -Infinity) hi = 0;
  return { min: min ?? Math.min(0, lo), max: max ?? hi };
}

/** The legend swatches, from Less to More: `steps` levels from 0 to 1. */
export function legendLevels(steps = 5): number[] {
  const n = Math.max(2, Math.round(steps));
  return Array.from({ length: n }, (_, i) => i / (n - 1));
}

/** Moves a focused cell by a key and stops at the edges. Returns null for a key the grid does not use. */
export function moveCell(cell: HeatCell, key: string, rows: number, cols: number, ctrl = false): HeatCell | null {
  const last = { row: Math.max(0, rows - 1), col: Math.max(0, cols - 1) };
  const clamp = (r: number, c: number): HeatCell => ({ row: Math.min(last.row, Math.max(0, r)), col: Math.min(last.col, Math.max(0, c)) });
  switch (key) {
    case "ArrowRight":
      return clamp(cell.row, cell.col + 1);
    case "ArrowLeft":
      return clamp(cell.row, cell.col - 1);
    case "ArrowDown":
      return clamp(cell.row + 1, cell.col);
    case "ArrowUp":
      return clamp(cell.row - 1, cell.col);
    case "Home":
      return ctrl ? clamp(0, 0) : clamp(cell.row, 0);
    case "End":
      return ctrl ? clamp(last.row, last.col) : clamp(cell.row, last.col);
    case "PageUp":
      return clamp(0, cell.col);
    case "PageDown":
      return clamp(last.row, cell.col);
    default:
      return null;
  }
}

/** What a screen reader hears on a cell: row, column and value, or that there is no data. */
export function describeCell(row: string, col: string, value: HeatValue, format: (n: number) => string): string {
  const v = typeof value === "number" && Number.isFinite(value) ? format(value) : "no data";
  return `${row}, ${col}: ${v}`;
}

/** One line for the whole grid: the size, the busiest cell and the quietest one. */
export function summaryText(rows: readonly string[], cols: readonly string[], values: readonly (readonly HeatValue[])[], format: (n: number) => string): string {
  let hi: { v: number; r: number; c: number } | null = null;
  let lo: { v: number; r: number; c: number } | null = null;
  values.forEach((row, r) =>
    row.forEach((v, c) => {
      if (typeof v !== "number" || !Number.isFinite(v)) return;
      if (!hi || v > hi.v) hi = { v, r, c };
      if (!lo || v < lo.v) lo = { v, r, c };
    }),
  );
  const size = `${rows.length} rows by ${cols.length} columns.`;
  if (!hi || !lo) return `${size} No data.`;
  const h = hi as { v: number; r: number; c: number };
  const l = lo as { v: number; r: number; c: number };
  return `${size} Highest: ${rows[h.r]}, ${cols[h.c]}, ${format(h.v)}. Lowest: ${rows[l.r]}, ${cols[l.c]}, ${format(l.v)}.`;
}

/** How the values of the columns that share a bucket combine. */
export type Aggregate = "sum" | "mean" | "max";

export interface Bucketed {
  /** One name per bucket for screen readers: "10", or "10–11" for a bucket of two or more columns. */
  names: string[];
  /** The label a bucket shows: its first column's label. */
  labels: string[];
  values: HeatValue[][];
  /** The first and last source column of each bucket. */
  spans: [number, number][];
}

/** Merges every `size` neighbouring columns into one, so a wide grid fits a narrow container. Columns with no data are left out of a bucket; a bucket with none stays no data. */
export function bucketColumns(columns: readonly string[], values: readonly (readonly HeatValue[])[], size: number, how: Aggregate = "sum"): Bucketed {
  const n = Math.max(1, Math.round(size));
  const spans: [number, number][] = [];
  for (let i = 0; i < columns.length; i += n) spans.push([i, Math.min(columns.length - 1, i + n - 1)]);
  const combine = (row: readonly HeatValue[], [a, b]: [number, number]): HeatValue => {
    const xs: number[] = [];
    for (let c = a; c <= b; c++) {
      const v = row[c];
      if (typeof v === "number" && Number.isFinite(v)) xs.push(v);
    }
    if (!xs.length) return null;
    if (how === "max") return Math.max(...xs);
    const sum = xs.reduce((s, x) => s + x, 0);
    return how === "mean" ? sum / xs.length : sum;
  };
  return {
    names: spans.map(([a, b]) => (a === b ? columns[a]! : `${columns[a]}\u2013${columns[b]}`)),
    labels: spans.map(([a]) => columns[a]!),
    values: values.map((row) => spans.map((s) => combine(row, s))),
    spans,
  };
}
