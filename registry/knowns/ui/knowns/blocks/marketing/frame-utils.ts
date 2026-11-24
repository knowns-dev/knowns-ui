/** @registry part-of="frame" */
/** Pure maths for the frame grid: which hairlines a cell draws so that neighbours share one line and no line is doubled. No React. */

export type Cols = 1 | 2 | 3 | 4;
export type GridAt = "md" | "lg";

/** Which edges of a cell draw a hairline. `end` is the inline end (right in LTR, left in RTL). The outer edges are never drawn: the frame rules and the section rows own them. */
export interface CellEdges {
  end: boolean;
  bottom: boolean;
}

/** Row and column of cell `index` in a grid of `cols` columns. */
export function cellPosition(index: number, cols: number): { row: number; col: number } {
  const c = Math.max(1, Math.floor(cols));
  return { row: Math.floor(index / c), col: index % c };
}

/** Rows a grid of `count` cells takes at `cols` columns. */
export const rowCount = (count: number, cols: number): number => Math.ceil(Math.max(0, count) / Math.max(1, Math.floor(cols)));

/**
 * The hairlines cell `index` of `count` draws at `cols` columns: an end line unless it is in the last column, a bottom line
 * unless it is in the last row. A cell that has no neighbour below it (a short last row) draws no bottom line, and a cell
 * that has no neighbour after it draws an end line only when it is not in the last column, so the empty space stays open.
 */
export function cellEdges(index: number, count: number, cols: number): CellEdges {
  const c = Math.max(1, Math.floor(cols));
  const { row, col } = cellPosition(index, c);
  const lastRow = rowCount(count, c) - 1;
  return { end: col < c - 1, bottom: row < lastRow };
}

/** A tick sits where two hairlines cross: the bottom-end corner of a cell that draws both an end and a bottom line. */
export function hasTick(index: number, count: number, cols: number): boolean {
  const e = cellEdges(index, count, cols);
  return e.end && e.bottom;
}

/**
 * The classes a cell takes. Mobile is one column, so every cell but the last draws a bottom line; from the breakpoint on
 * the cell follows `cellEdges` for `cols`. Literal strings, so Tailwind finds them.
 */
export function cellClasses(index: number, count: number, cols: number, at: GridAt = "md"): string {
  const mobileBottom = index < count - 1;
  const e = cellEdges(index, count, cols);
  const out: string[] = [];
  if (mobileBottom) out.push("border-b");
  if (cols > 1) {
    // A cell with a row below it also has a cell after it, so the wide bottom line is always a subset of the phone one: nothing to switch on, only off.
    if (mobileBottom && !e.bottom) out.push(at === "lg" ? "lg:border-b-0" : "md:border-b-0");
    if (e.end) out.push(at === "lg" ? "lg:border-e" : "md:border-e");
  }
  return out.join(" ");
}

/** The grid-template class for `cols` from the breakpoint on. One column at every width is the default. */
export function gridClass(cols: number, at: GridAt = "md"): string {
  const map: Record<GridAt, Record<number, string>> = {
    md: { 1: "", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4" },
    lg: { 1: "", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" },
  };
  return map[at][Math.min(4, Math.max(1, Math.floor(cols)))] ?? "";
}
