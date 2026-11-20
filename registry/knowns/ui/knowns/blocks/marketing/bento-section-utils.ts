/** @registry part-of="bento-section" */
/** Pure span and timing logic for BentoSection. No React. */

export type TileCols = 1 | 2 | 3 | 4;
export type TileRows = 1 | 2 | 3;

/** The widest and tallest a tile may be: the grid has 4 columns from 896px, so a wider tile would leave a hole. */
export const MAX_COLS = 4;
export const MAX_ROWS = 3;

/** A span as given by a caller (any number, maybe missing) turned into one the grid can place. */
export function clampSpan(cols?: number, rows?: number): { cols: TileCols; rows: TileRows } {
  const c = Math.min(MAX_COLS, Math.max(1, Math.round(Number.isFinite(cols) ? (cols as number) : 1)));
  const r = Math.min(MAX_ROWS, Math.max(1, Math.round(Number.isFinite(rows) ? (rows as number) : 1)));
  return { cols: c as TileCols, rows: r as TileRows };
}

/**
 * Span classes, as whole literals so the class scanner sees them. Container queries: below 576px one column and no
 * span; from 576px two columns (a tile of 2 or more takes the row); from 896px four columns and the span as asked.
 */
const COLS: Record<TileCols, string> = {
  1: "",
  2: "@xl:col-span-2",
  3: "@xl:col-span-2 @4xl:col-span-3",
  4: "@xl:col-span-2 @4xl:col-span-4",
};
const ROWS: Record<TileRows, string> = {
  1: "",
  2: "@xl:row-span-2",
  3: "@xl:row-span-3",
};

export function tileSpan(cols?: number, rows?: number): string {
  const s = clampSpan(cols, rows);
  return [COLS[s.cols], ROWS[s.rows]].filter(Boolean).join(" ");
}

/** Stagger of the reveal: 40ms a tile, and no tile waits for more than the fourth step. */
export const REVEAL_STEP_MS = 40;
export const REVEAL_STEPS = 4;
export function revealDelay(index: number): number {
  return Math.min(Math.max(0, Math.floor(index)), REVEAL_STEPS - 1) * REVEAL_STEP_MS;
}

/** Cells the tiles use at four columns, to check a layout fills whole rows (a tile spans `cols` x `rows`). */
export function bentoCells(tiles: { cols?: number; rows?: number }[]): number {
  return tiles.reduce((n, t) => {
    const s = clampSpan(t.cols, t.rows);
    return n + s.cols * s.rows;
  }, 0);
}
