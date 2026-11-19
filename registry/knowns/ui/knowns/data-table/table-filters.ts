/** @registry part-of="data-table" */
/**
 * Typed column filters for DataTable: pure functions, no React. One plain object holds every active filter, keyed by
 * column id, so it can be controlled, saved or put in a URL (dates travel as ISO day strings through `toJSON`).
 */

export type FilterValue =
  | { kind: "text"; value: string }
  /** Any of these values. A row value that is a list matches when it shares one. */
  | { kind: "select"; values: string[] }
  /** Inclusive on both ends; either end may be left open. */
  | { kind: "range"; min?: number; max?: number }
  /** Whole days, inclusive on both ends; either end may be left open. */
  | { kind: "date"; from?: Date; to?: Date };

export type FilterState = Record<string, FilterValue>;

export type FilterVariant = FilterValue["kind"];

/** An option of a select filter. */
export interface FilterOption {
  value: string;
  label?: string;
}

const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const asDate = (v: unknown): Date | null => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

/** A filter that does nothing (empty text, no values, both ends open) is not active. */
export function isActiveFilter(f: FilterValue | undefined): boolean {
  if (!f) return false;
  switch (f.kind) {
    case "text":
      return f.value.trim() !== "";
    case "select":
      return f.values.length > 0;
    case "range":
      return f.min !== undefined || f.max !== undefined;
    case "date":
      return f.from !== undefined || f.to !== undefined;
  }
}

/** Does a cell value pass one filter? A missing value never passes an active filter. */
export function matchFilter(value: unknown, f: FilterValue): boolean {
  if (!isActiveFilter(f)) return true;
  switch (f.kind) {
    case "text":
      return String(value ?? "").toLowerCase().includes(f.value.trim().toLowerCase());
    case "select": {
      const parts = Array.isArray(value) ? value.map(String) : value === null || value === undefined ? [] : [String(value)];
      return parts.some((p) => f.values.includes(p));
    }
    case "range": {
      const n = typeof value === "number" ? value : value === null || value === undefined || value === "" ? NaN : Number(value);
      if (Number.isNaN(n)) return false;
      return (f.min === undefined || n >= f.min) && (f.max === undefined || n <= f.max);
    }
    case "date": {
      const d = asDate(value);
      if (!d) return false;
      const t = day(d);
      return (f.from === undefined || t >= day(f.from)) && (f.to === undefined || t <= day(f.to));
    }
  }
}

/** Rows that pass every active filter, optionally leaving one column out (for that column's own facet counts). */
export function applyFilters<T>(rows: T[], state: FilterState, valueOf: (id: string) => ((row: T) => unknown) | undefined, except?: string): T[] {
  const active = Object.entries(state).filter(([id, f]) => id !== except && isActiveFilter(f) && valueOf(id));
  if (!active.length) return rows;
  return rows.filter((row) => active.every(([id, f]) => matchFilter(valueOf(id)!(row), f)));
}

/** How many rows carry each value of a column, so a select filter can show "Failed 3". */
export function facetCounts<T>(rows: T[], get: (row: T) => unknown): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) {
    const v = get(row);
    for (const p of Array.isArray(v) ? v : [v]) {
      if (p === null || p === undefined || p === "") continue;
      const k = String(p);
      out.set(k, (out.get(k) ?? 0) + 1);
    }
  }
  return out;
}

/** Smallest and largest number in a column, or null when there is none. */
export function numberBounds<T>(rows: T[], get: (row: T) => unknown): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const row of rows) {
    const v = get(row);
    const n = typeof v === "number" ? v : v === null || v === undefined || v === "" ? NaN : Number(v);
    if (Number.isNaN(n)) continue;
    lo = Math.min(lo, n);
    hi = Math.max(hi, n);
  }
  return lo <= hi ? [lo, hi] : null;
}

/** Options for a select filter taken from the data when the column gives none: sorted, each value once. */
export function optionsFromRows<T>(rows: T[], get: (row: T) => unknown): FilterOption[] {
  return [...facetCounts(rows, get).keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((value) => ({ value }));
}

/** Adds, replaces or (when inactive) removes one column's filter. */
export function setFilter(state: FilterState, id: string, f: FilterValue | null): FilterState {
  const next = { ...state };
  if (f && isActiveFilter(f)) next[id] = f;
  else delete next[id];
  return next;
}

/** Toggles one value of a select filter. */
export function toggleValue(state: FilterState, id: string, value: string): FilterState {
  const cur = state[id];
  const values = cur?.kind === "select" ? cur.values : [];
  return setFilter(state, id, { kind: "select", values: values.includes(value) ? values.filter((v) => v !== value) : [...values, value] });
}

/** The count of active filters. */
export const activeCount = (state: FilterState) => Object.values(state).filter(isActiveFilter).length;
