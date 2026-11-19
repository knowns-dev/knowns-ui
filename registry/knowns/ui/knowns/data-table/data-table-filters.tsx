"use client";
/** @registry part-of="data-table" */
/**
 * The filter bar of DataTable: one chip per filterable column, each opening a small panel that fits its kind. A
 * select shows every value with how many rows carry it (counted with the other filters applied), a range is a
 * slider with two number fields, a date is a calendar range, text is a field. Active chips show their summary and
 * a clear button; "Reset" clears them all. State is the plain `FilterState` object, so it can be controlled.
 */
import { useMemo, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { MotionStyle, SwapText } from "@/registry/knowns/lib/knowns/motion";
import { Button } from "../button";
import { Calendar } from "../calendar/calendar";
import { formatRange } from "../date-range-picker";
import { Checkbox } from "../checkbox";
import { Input } from "../input";
import { Popover } from "../popover";
import { Slider } from "../slider";
import { applyFilters, activeCount, facetCounts, isActiveFilter, numberBounds, optionsFromRows, setFilter, toggleValue, type FilterOption, type FilterState, type FilterVariant } from "./table-filters";

export interface FilterColumn<T> {
  id: string;
  label: string;
  variant: FilterVariant;
  /** The value the filter reads from a row. */
  get: (row: T) => unknown;
  /** Select options. Without them the values found in the rows are used. */
  options?: FilterOption[];
  /** How a number reads in a range filter, e.g. (n) => `$${n.toFixed(2)}`. */
  format?: (n: number) => string;
}

export interface DataTableFiltersProps<T> {
  rows: T[];
  columns: FilterColumn<T>[];
  value: FilterState;
  onValueChange: (next: FilterState) => void;
  className?: string;
}

const PanelGlyph = ({ kind }: { kind: FilterVariant }) => (
  <svg viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
    {kind === "date" ? <path d="M3 5.5h10M5 2.5v2M11 2.5v2M3.5 4h9a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" /> : <path d="M8 3.5v9M3.5 8h9" />}
  </svg>
);

const niceStep = (span: number) => {
  if (span <= 0) return 1;
  const raw = span / 100;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / pow;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * pow;
};

const labelOf = (o: FilterOption) => o.label ?? o.value;

function summary<T>(col: FilterColumn<T>, f: FilterState[string], options: FilterOption[]): string {
  const fmt = col.format ?? ((n: number) => String(n));
  switch (f.kind) {
    case "text":
      return f.value;
    case "select": {
      const names = f.values.map((v) => labelOf(options.find((o) => o.value === v) ?? { value: v }));
      return names.length > 2 ? `${names.length} selected` : names.join(", ");
    }
    case "range":
      return f.min !== undefined && f.max !== undefined ? `${fmt(f.min)} to ${fmt(f.max)}` : f.min !== undefined ? `from ${fmt(f.min)}` : `up to ${fmt(f.max!)}`;
    case "date":
      return f.from ? formatRange({ from: f.from, to: f.to }) : f.to ? `until ${formatRange({ from: f.to })}` : "";
  }
}

function SelectPanel({ options, counts, selected, onToggle, label }: { options: FilterOption[]; counts: Map<string, number>; selected: string[]; onToggle: (value: string) => void; label: string }) {
  return (
    <ul role="group" aria-label={label} className="flex max-h-64 min-w-48 flex-col gap-0.5 overflow-auto p-1.5">
      {options.map((o) => (
        <li key={o.value} className="flex items-center gap-2 rounded-[7px] px-1.5 py-1 transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)]">
          <Checkbox size="sm" label={labelOf(o)} checked={selected.includes(o.value)} onChange={() => onToggle(o.value)} className="flex-1" />
          <span className="text-[12px] tabular-nums text-muted-foreground">{counts.get(o.value) ?? 0}</span>
        </li>
      ))}
    </ul>
  );
}

function RangePanel({ bounds, min, max, format, label, onChange }: { bounds: [number, number] | null; min?: number; max?: number; format: (n: number) => string; label: string; onChange: (min?: number, max?: number) => void }) {
  if (!bounds) return <p className="p-3 text-[12.5px] text-muted-foreground">No values to filter.</p>;
  const [lo, hi] = bounds;
  const step = niceStep(hi - lo);
  const from = min ?? lo;
  const to = max ?? hi;
  const emit = (a: number, b: number) => onChange(a <= lo ? undefined : a, b >= hi ? undefined : b);
  const parse = (s: string, fallback: number) => (s.trim() === "" || Number.isNaN(Number(s)) ? fallback : Number(s));
  return (
    <div className="flex w-64 flex-col gap-3 p-3">
      <Slider aria-label={label} thumbLabels={["Minimum", "Maximum"]} min={lo} max={hi} step={step} value={[from, to]} onValueChange={([a, b]) => emit(a, b)} formatValue={format} hideValue size="sm" />
      <div className="flex items-center gap-2">
        <Input size="sm" type="number" aria-label={`${label} minimum`} value={min ?? ""} placeholder={format(lo)} step={step} onChange={(e) => emit(parse(e.target.value, lo), to)} />
        <span className="text-muted-foreground" aria-hidden>
          –
        </span>
        <Input size="sm" type="number" aria-label={`${label} maximum`} value={max ?? ""} placeholder={format(hi)} step={step} onChange={(e) => emit(from, parse(e.target.value, hi))} />
      </div>
    </div>
  );
}

/** The filter chips, for a DataTable or a table of your own. */
export function DataTableFilters<T>({ rows, columns, value, onValueChange, className }: DataTableFiltersProps<T>) {
  const getters = useMemo(() => new Map(columns.map((c) => [c.id, c.get])), [columns]);
  const valueOf = (id: string) => getters.get(id);
  const active = activeCount(value);
  return (
    <div role="group" aria-label="Filters" className={cn("flex flex-wrap items-center gap-2", className)}>
      <MotionStyle />
      {columns.map((col) => {
        const f = value[col.id];
        const on = isActiveFilter(f);
        // Facets count rows that pass every other filter, so the numbers answer "what would I get if I picked this".
        const scoped = col.variant === "select" || col.variant === "range" ? applyFilters(rows, value, valueOf, col.id) : rows;
        const options = col.variant === "select" ? (col.options ?? optionsFromRows(rows, col.get)) : [];
        let panel: ReactNode = null;
        if (col.variant === "select") {
          panel = <SelectPanel label={col.label} options={options} counts={facetCounts(scoped, col.get)} selected={f?.kind === "select" ? f.values : []} onToggle={(v) => onValueChange(toggleValue(value, col.id, v))} />;
        } else if (col.variant === "range") {
          const cur = f?.kind === "range" ? f : { kind: "range" as const };
          panel = <RangePanel label={col.label} bounds={numberBounds(scoped.length ? scoped : rows, col.get)} min={cur.min} max={cur.max} format={col.format ?? ((n) => String(Math.round(n * 100) / 100))} onChange={(min, max) => onValueChange(setFilter(value, col.id, { kind: "range", min, max }))} />;
        } else if (col.variant === "date") {
          const cur = f?.kind === "date" ? f : undefined;
          panel = (
            <div className="p-2">
              <Calendar
                mode="range"
                value={cur?.from ? { from: cur.from, to: cur.to } : null}
                onValueChange={(r) => onValueChange(setFilter(value, col.id, { kind: "date", from: r.from, to: r.to }))}
                aria-label={col.label}
              />
            </div>
          );
        } else {
          panel = (
            <div className="w-56 p-2">
              <Input size="sm" aria-label={`Filter ${col.label}`} placeholder={`Contains…`} value={f?.kind === "text" ? f.value : ""} onChange={(e) => onValueChange(setFilter(value, col.id, { kind: "text", value: e.target.value }))} />
            </div>
          );
        }
        return (
          <span key={col.id} className="inline-flex items-center">
            <Popover
              aria-label={`${col.label} filter`}
              trigger={
                <Button size="sm" variant="secondary" icon={<PanelGlyph kind={col.variant} />} className={cn(on && "rounded-r-none border-r-0")}>
                  {col.label}
                  {on && f && <span className="ml-1 max-w-36 truncate border-l pl-2 font-normal text-[color:var(--kn-accent,var(--primary))]"><SwapText value={summary(col, f, options)} className="inline-block max-w-full truncate align-bottom">{summary(col, f, options)}</SwapText></span>}
                </Button>
              }
            >
              {panel}
            </Popover>
            {on && (
              <button
                type="button"
                aria-label={`Clear ${col.label} filter`}
                onClick={() => onValueChange(setFilter(value, col.id, null))}
                className={cn("inline-flex h-8 w-7 animate-[kn-pop_var(--kn-dur-fast)_var(--kn-ease-out)_both] items-center justify-center rounded-r-[9px] border border-l-0 bg-secondary text-muted-foreground transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:text-foreground motion-reduce:animate-none", focusRing)}
              >
                <svg viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="size-3">
                  <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
                </svg>
              </button>
            )}
          </span>
        );
      })}
      {active > 0 && (
        <Button size="sm" variant="quiet" onClick={() => onValueChange({})}>
          Reset
        </Button>
      )}
    </div>
  );
}
