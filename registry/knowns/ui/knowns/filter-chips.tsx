"use client";
/** @registry name="filter-chips" type="ui" title="Filter Chips" description="A standalone, fully controlled filter bar: a chip per field with a multi-select menu (search, avatars), a value summary, clear buttons and Clear all. It filters nothing itself, so the value can live in the URL or on the server." */
/**
 * FilterChips edits a `Record<fieldId, string[]>` and nothing else: no rows, no counting, no data filtering. Every
 * field is one chip in a fixed place. Empty, it is a ghost "+ Field" that opens the field's menu; with a value it
 * reads "Field is Value" with a clear button. `collapsed` (or a narrow container, with "auto") folds the ghosts into
 * one "+ Filter" menu. Chips are in the tab order; Backspace or Delete on a focused chip clears it.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Avatar, AvatarGroup } from "./avatar";
import { Button } from "./button";
import { filterOptions, toggleValue } from "./combobox";
import { Input } from "./input";
import { Menu, MenuCheck, matchIndex, nextIndex } from "./menu";
import { Popover } from "./popover";

export interface FilterOption {
  value: string;
  label: string;
  /** A glyph before the label. */
  icon?: ReactNode;
  /** A photo URL, or your own avatar node (a person, an agent). Shown in the menu and stacked on the chip. */
  avatar?: string | ReactNode;
  /** Extra words the search matches, e.g. an email. */
  keywords?: string;
}

export interface FilterField {
  id: string;
  label: string;
  /** A glyph before the label on the chip and in the "+ Filter" menu. */
  icon?: ReactNode;
  options: FilterOption[];
  /** Several values at once. Default true; false picks one and closes the menu. */
  multiple?: boolean;
  /** What two or more values are called on the chip: "people" reads "Assignee is 2 people". Default "selected". */
  plural?: string;
}

/** Field id to the chosen option values. A field with no values is not active. */
export type FilterValue = Record<string, string[]>;

export interface FilterChipsProps {
  fields: FilterField[];
  value: FilterValue;
  onChange: (next: FilterValue) => void;
  /** true: one "+ Filter" menu instead of a ghost chip per field. "auto" (default): folds when the container is narrow or there are many fields. false: always chips. */
  collapsed?: boolean | "auto";
  /** Show a search box in a menu with more options than this. Default 8. */
  searchFrom?: number;
  /** Label of the "+ Filter" button. Default "Filter". */
  addLabel?: string;
  className?: string;
  "aria-label"?: string;
}

/* ── Pure helpers (exported for tests) ── */

/** The value without empty entries, without fields that are not in `fields` and without values their options do not have. */
export function cleanValue(fields: FilterField[], value: FilterValue): FilterValue {
  const out: FilterValue = {};
  for (const f of fields) {
    const have = new Set(f.options.map((o) => o.value));
    const kept = (value[f.id] ?? []).filter((v) => have.has(v));
    if (kept.length) out[f.id] = kept;
  }
  return out;
}

/** The value with `id` set to `values`; an empty list removes the field. */
export function withField(value: FilterValue, id: string, values: string[]): FilterValue {
  const { [id]: _drop, ...rest } = value;
  return values.length ? { ...rest, [id]: values } : rest;
}

/** Fields that currently have a value, in `fields` order. */
export function activeFields<F extends Pick<FilterField, "id">>(fields: F[], value: FilterValue): F[] {
  return fields.filter((f) => (value[f.id]?.length ?? 0) > 0);
}

/** The values of a field that still exist among its options (a stale id from a URL is ignored). */
export function knownValues(field: FilterField, value: FilterValue): string[] {
  const have = new Set(field.options.map((o) => o.value));
  return (value[field.id] ?? []).filter((v) => have.has(v));
}

/** Chip text for a field: the option's label for one value, "N plural" for more. */
export function summaryText(field: FilterField, values: string[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return field.options.find((o) => o.value === values[0])?.label ?? values[0]!;
  return `${values.length} ${field.plural ?? "selected"}`;
}

/** The chip's accessible name, the same words it shows: "Status is In progress", "Assignee is 2 people". */
export function chipName(field: FilterField, values: string[]): string {
  return `${field.label} is ${summaryText(field, values)}`;
}

/** A container this narrow, or this many empty fields, makes "auto" fold the ghosts into one menu. */
export const COLLAPSE_BELOW = 520;
export const COLLAPSE_FIELDS = 5;
export const shouldCollapse = (mode: boolean | "auto", width: number, empty: number) => (mode === "auto" ? (width > 0 && width < COLLAPSE_BELOW) || empty > COLLAPSE_FIELDS : mode);

/* ── Pieces ── */

const PlusGlyph = () => (
  <svg viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="size-3.5">
    <path d="M8 3.5v9M3.5 8h9" />
  </svg>
);
const CrossGlyph = () => (
  <svg viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="size-3">
    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
  </svg>
);
const SearchGlyph = () => (
  <svg viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="size-3.5">
    <circle cx="7" cy="7" r="4" />
    <path d="m10 10 3 3" />
  </svg>
);

function Lead({ o, size = "xs" }: { o: FilterOption; size?: "xs" | "sm" }) {
  if (typeof o.avatar === "string") return <Avatar label={o.label} src={o.avatar} size={size} shape="circle" decorative />;
  if (o.avatar) return <span className="flex-none">{o.avatar}</span>;
  if (o.icon) return <span aria-hidden className="grid size-4 flex-none place-items-center text-muted-foreground [&_svg]:size-4">{o.icon}</span>;
  return null;
}

/** The menu of one field: optional search, then check rows. Arrows, Home, End, Space, Enter and typeahead work on the rows. */
function FieldPanel({ field, selected, searchFrom, onToggle }: { field: FilterField; selected: string[]; searchFrom: number; onToggle: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const searchable = field.options.length > searchFrom;
  const shown = useMemo(() => filterOptions(field.options, query), [field.options, query]);
  const firstSelected = shown.findIndex((o) => selected.includes(o.value));
  const [cur, setCur] = useState(Math.max(0, firstSelected));
  const rows = useRef<(HTMLElement | null)[]>([]);
  const search = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const listId = useId();
  const multiple = field.multiple !== false;
  const at = Math.min(cur, Math.max(0, shown.length - 1));

  const focusRow = (i: number) => {
    setCur(i);
    rows.current[i]?.focus({ preventScroll: false });
  };

  const onListKey = (e: ReactKeyboardEvent) => {
    const i = Number((e.target as HTMLElement).dataset.index ?? at);
    const items = shown.map(() => ({ disabled: false }));
    if (e.key === "ArrowDown") (e.preventDefault(), focusRow(nextIndex(items, i, 1)));
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (i === 0 && searchable) search.current?.focus();
      else focusRow(nextIndex(items, i, -1));
    } else if (e.key === "Home") (e.preventDefault(), focusRow(0));
    else if (e.key === "End") (e.preventDefault(), focusRow(shown.length - 1));
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const o = shown[i];
      if (o) onToggle(o.value);
    } else if (!searchable && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      const t = typed.current;
      t.text = now - t.at > 700 ? e.key : t.text + e.key;
      t.at = now;
      const j = matchIndex(shown.map((o) => ({ label: o.label })), i, t.text);
      if (j >= 0) focusRow(j);
    }
  };

  return (
    <div className="flex w-60 flex-col gap-1 p-1.5">
      {searchable && (
        <Input
          ref={search}
          size="sm"
          icon={<SearchGlyph />}
          aria-label={`Search ${field.label}`}
          aria-controls={listId}
          placeholder={`Search ${field.label.toLowerCase()}`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCur(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && shown.length) (e.preventDefault(), focusRow(Math.max(0, firstSelected)));
          }}
        />
      )}
      <ul id={listId} role="listbox" aria-label={field.label} aria-multiselectable={multiple || undefined} onKeyDown={onListKey} className="flex max-h-64 flex-col gap-0.5 overflow-auto">
        {shown.map((o, i) => {
          const on = selected.includes(o.value);
          return (
            <li
              key={o.value}
              ref={(el) => {
                rows.current[i] = el;
              }}
              role="option"
              aria-selected={on}
              data-index={i}
              tabIndex={i === at ? 0 : -1}
              onClick={() => onToggle(o.value)}
              onFocus={() => setCur(i)}
              className={cn("flex cursor-pointer items-center gap-2 rounded-[7px] px-2 py-1.5 text-[13px] outline-none", "transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) motion-reduce:transition-none", "hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60")}
            >
              <Lead o={o} />
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {on && <MenuCheck className="size-3.5 flex-none text-[color:var(--kn-accent,var(--primary))]" />}
            </li>
          );
        })}
        {shown.length === 0 && <li role="presentation" className="px-2 py-3 text-center text-[12.5px] text-muted-foreground">No matches</li>}
      </ul>
    </div>
  );
}

/** What a chip says after the field name: avatars (stacked from two) when the options have them, then the summary. */
function Summary({ field, values }: { field: FilterField; values: string[] }) {
  const picked = values.map((v) => field.options.find((o) => o.value === v)).filter((o): o is FilterOption => Boolean(o));
  const photos = picked.filter((o) => typeof o.avatar === "string");
  return (
    <span className="flex min-w-0 items-center gap-1.5 font-medium text-foreground">
      {photos.length === 1 && picked.length === 1 && <Lead o={photos[0]!} />}
      {photos.length > 1 && photos.length === picked.length && (
        <span aria-hidden="true" className="flex">
        <AvatarGroup size="xs" max={3} label={summaryText(field, values)}>
          {photos.map((o) => (
            <Avatar key={o.value} label={o.label} src={o.avatar as string} />
          ))}
        </AvatarGroup>
        </span>
      )}
      <span className="truncate">{summaryText(field, values)}</span>
    </span>
  );
}

/* ── FilterChips ── */

export function FilterChips({ fields, value, onChange, collapsed = "auto", searchFrom = 8, addLabel = "Filter", className, "aria-label": label = "Filters" }: FilterChipsProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const add = useRef<HTMLButtonElement>(null);
  const chips = useRef(new Map<string, HTMLButtonElement | null>());

  useEffect(() => {
    const el = root.current;
    if (!el || collapsed !== "auto" || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [collapsed]);

  const current = useMemo(() => cleanValue(fields, value), [fields, value]);
  const active = activeFields(fields, current);
  const empty = fields.length - active.length;
  const fold = shouldCollapse(collapsed, width, empty);

  const setValues = (f: FilterField, values: string[]) => onChange(withField(current, f.id, values));
  const toggle = (f: FilterField, v: string, close: () => void) => {
    const had = knownValues(f, current);
    if (f.multiple === false) {
      setValues(f, had.includes(v) ? [] : [v]);
      close();
    } else setValues(f, toggleValue(had, v));
  };
  const clear = (f: FilterField) => {
    setValues(f, []);
    if (openId === f.id) setOpenId(null);
    // Keep focus in the bar: on the same chip when it stays (ghost), else on "+ Filter".
    requestAnimationFrame(() => (chips.current.get(f.id)?.isConnected ? chips.current.get(f.id) : add.current)?.focus());
  };

  const menuItems = fields.filter((f) => !(current[f.id]?.length ?? 0)).map((f) => ({ id: f.id, label: f.label, icon: f.icon }));

  return (
    <div ref={root} role="group" aria-label={label} className={cn("flex flex-wrap items-center gap-2", className)}>
      {fields.map((f) => {
        const values = knownValues(f, current);
        const on = values.length > 0;
        const drafting = openId === f.id;
        if (!on && fold && !drafting) return null;
        const clearBtn = on && (
          <button
            type="button"
            aria-label={`Clear ${f.label} filter`}
            onClick={() => clear(f)}
            className={cn("inline-flex h-8 w-7 items-center justify-center rounded-r-[9px] shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_14%,transparent)] bg-secondary text-muted-foreground", "transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:text-foreground motion-reduce:transition-none pointer-coarse:h-10 pointer-coarse:w-9", focusRing)}
          >
            <CrossGlyph />
          </button>
        );
        return (
          <span key={f.id} className="inline-flex animate-[kn-fade-in_var(--kn-dur-fast)_var(--kn-ease-out)_both] items-center motion-reduce:animate-none">
            <Popover
              aria-label={`${f.label} filter`}
              open={drafting}
              className="p-0!"
              onOpenChange={(o) => {
                setOpenId(o ? f.id : openId === f.id ? null : openId);
                // A folded field that was opened and left empty has no chip to return to.
                if (!o && !on && fold) requestAnimationFrame(() => add.current?.focus());
              }}
              trigger={
                <Button
                  ref={(el) => {
                    chips.current.set(f.id, el);
                  }}
                  size="sm"
                  variant={on ? "secondary" : "ghost"}
                  icon={on ? f.icon : <PlusGlyph />}
                  aria-label={on ? undefined : `Add ${f.label} filter`}
                  onKeyDown={(e: ReactKeyboardEvent) => {
                    if (on && (e.key === "Backspace" || e.key === "Delete")) (e.preventDefault(), clear(f));
                  }}
                  className={cn("max-w-64", on && "rounded-r-none border-r-0", !on && "border border-dashed text-muted-foreground")}
                >
                  {on ? (
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="font-normal text-muted-foreground">{f.label} is{" "}</span>
                      <Summary field={f} values={values} />
                    </span>
                  ) : (
                    f.label
                  )}
                </Button>
              }
            >
              <FieldPanel field={f} selected={values} searchFrom={searchFrom} onToggle={(v) => toggle(f, v, () => setOpenId(null))} />
            </Popover>
            {clearBtn}
          </span>
        );
      })}
      {fold && menuItems.length > 0 && (
        <Menu
          aria-label={`Add a ${addLabel.toLowerCase()}`}
          items={menuItems}
          onSelect={(item) => setOpenId(item.id)}
          trigger={
            <Button ref={add} size="sm" variant="ghost" icon={<PlusGlyph />} className="border border-dashed text-muted-foreground">
              {addLabel}
            </Button>
          }
        />
      )}
      {active.length >= 2 && (
        <Button size="sm" variant="quiet" onClick={() => onChange({})}>
          Clear all
        </Button>
      )}
    </div>
  );
}
