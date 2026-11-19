"use client";
/** @registry name="json-inspector" type="ui" title="JSON inspector" description="Read a JSON payload as a tree: fold any level, search keys and values with next and previous, copy the path or the value of the focused node, move with the keyboard, and see where broken JSON breaks." */

/**
 * JsonInspector: one JSON value (a webhook body, an API response, a tool result) as a tree with indent guides and
 * type colours. Containers fold; a search finds keys and values anywhere, opens what hides them and steps through
 * the matches; the footer shows the focused path with Copy path and Copy value. Rows are a fixed 24px and only the
 * ones in view are rendered, so a payload of many thousand lines scrolls as fast as a short one.
 *
 * Pass `value` (already parsed) or `text` (raw). Text that does not parse shows the broken state: what is wrong,
 * the line and column, and the lines around it with a mark under the spot.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type UIEvent } from "react";
import { cn, focusRing, writeClipboard } from "@/registry/knowns/lib/knowns/utils";
import { JSON_TOKEN_CLASS } from "@/registry/knowns/lib/knowns/json";
import { MotionStyle, usePlay } from "@/registry/knowns/lib/knowns/motion";
import { fieldClass } from "../field-class";
import { Kbd } from "../kbd";
import {
  copyText,
  cycle,
  excerpt,
  expandedAll,
  expandedTo,
  formatPath,
  isContainer,
  openFor,
  ownerId,
  parseJson,
  scalarText,
  scrollToRow,
  search,
  sizeText,
  splitMatch,
  treeKey,
  windowRange,
  flatten,
  type JsonError,
  type JsonRow,
  type JsonType,
  type PathPart,
} from "./json-inspector-utils";

/* ── Shared pieces (the Pro diff and schema views use them too) ── */

/** Row height in px. Fixed, so the list can be windowed without measuring. */
export const JSON_ROW_H = 24;
/** Indent per level in px. */
export const JSON_INDENT = 16;
/** Left padding of a depth-0 row in px. */
export const JSON_PAD = 10;

const VALUE_CLASS: Record<JsonType, string> = {
  string: JSON_TOKEN_CLASS.string,
  number: JSON_TOKEN_CLASS.number,
  boolean: JSON_TOKEN_CLASS.literal,
  null: JSON_TOKEN_CLASS.literal,
  object: "text-muted-foreground",
  array: "text-muted-foreground",
};

/** Text with every match of `query` marked. `strong` marks the current match more firmly. */
export function Marked({ text, query, strong }: { text: string; query?: string; strong?: boolean }) {
  if (!query?.trim()) return <>{text}</>;
  return (
    <>
      {splitMatch(text, query).map((p, i) =>
        p.hit ? (
          <mark key={i} className={cn("rounded-[3px] text-inherit", strong ? "bg-amber-400/45 dark:bg-amber-400/35" : "bg-amber-400/20 dark:bg-amber-400/15")}>
            {p.text}
          </mark>
        ) : (
          p.text
        ),
      )}
    </>
  );
}

/** The key part of a row: an object key in the key colour, an array index muted. */
export function JsonKey({ name, query, strong }: { name: PathPart; query?: string; strong?: boolean }) {
  return typeof name === "number" ? (
    <span className="text-muted-foreground">{name}</span>
  ) : (
    <span className={JSON_TOKEN_CLASS.key}>
      <Marked text={name} query={query} strong={strong} />
    </span>
  );
}

/** A scalar in its type colour. Long strings are cut by the row (truncate); the full value is one copy away. */
export function JsonScalar({ value, query, strong, className }: { value: unknown; query?: string; strong?: boolean; className?: string }) {
  const type = typeof value === "string" ? "string" : value === null || value === undefined ? "null" : typeof value === "boolean" ? "boolean" : "number";
  return (
    <span className={cn(VALUE_CLASS[type], className)}>
      <Marked text={scalarText(value)} query={query} strong={strong} />
    </span>
  );
}

/** `{ 3 keys }` or `[ 12 items ]` for a shut container. */
export function JsonSummary({ type, size }: { type: JsonType; size: number }) {
  const [o, c] = type === "array" ? ["[", "]"] : ["{", "}"];
  return (
    <span className="text-muted-foreground">
      {o}
      {size > 0 && <span className="mx-1 rounded-[4px] bg-muted px-1 font-sans text-[11px] font-medium">{sizeText(type, size)}</span>}
      {c}
    </span>
  );
}

/** The fold chevron. Rotates on open: the one movement in the tree. */
export function JsonChevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={cn("size-3.5 transition-transform duration-(--kn-dur-fast) ease-(--kn-ease-out) motion-reduce:transition-none", open && "rotate-90")}>
      <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Vertical guides, one per ancestor level, centred under each parent's chevron. */
export function JsonGuides({ depth }: { depth: number }) {
  if (depth < 1) return null;
  return (
    <>
      {Array.from({ length: depth }, (_, d) => (
        <span key={d} aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-border" style={{ left: JSON_PAD + d * JSON_INDENT + 7 }} />
      ))}
    </>
  );
}

/** Windowing for a fixed-height list: which rows to render, the scroll handler, and a way to bring a row into view. */
export function useRowWindow(count: number, viewH: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  const [start, end] = windowRange(count, JSON_ROW_H, top, viewH);
  const onScroll = useCallback((e: UIEvent<HTMLDivElement>) => setTop(e.currentTarget.scrollTop), []);
  const reveal = useCallback(
    (i: number) => {
      const el = ref.current;
      if (!el || i < 0) return;
      const next = scrollToRow(i, JSON_ROW_H, el.scrollTop, el.clientHeight || viewH);
      if (next !== null) {
        el.scrollTop = next;
        setTop(next);
      }
    },
    [viewH],
  );
  return { ref, start, end, onScroll, reveal };
}

/** Copy button that swaps its label to "Copied" for a moment. The check pops in once (a rare confirm). */
export function CopyButton({ label, text, onCopied, ping = 0, className }: { label: string; text: () => string; onCopied?: (text: string) => void; /** Bump to show "Copied" after a copy made elsewhere (a key). */ ping?: number; className?: string }) {
  const [done, setDone] = useState(0);
  const [lastPing, setLastPing] = useState(ping);
  if (ping !== lastPing) {
    setLastPing(ping);
    if (ping > 0) setDone((n) => n + 1);
  }
  const play = usePlay(done, (_, n) => (n > 0 ? "pop" : undefined));
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(0), 1400);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <button
      type="button"
      onClick={async () => {
        const t = text();
        await writeClipboard(t);
        setDone((n) => n + 1);
        onCopied?.(t);
      }}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-[7px] px-2 text-[12px] font-medium text-muted-foreground transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:bg-muted hover:text-foreground pointer-coarse:h-8",
        focusRing,
        className,
      )}
    >
      {done ? (
        <svg key={done} data-kn-m={play} viewBox="0 0 16 16" aria-hidden="true" className="size-3.5 text-emerald-600 dark:text-emerald-400">
          <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10.5 3.5v-.3A1.7 1.7 0 0 0 8.8 1.5H4.2A1.7 1.7 0 0 0 2.5 3.2v4.6a1.7 1.7 0 0 0 1.7 1.7h.3" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      )}
      <span aria-live="polite">{done ? "Copied" : label}</span>
    </button>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-[8px] text-muted-foreground transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 pointer-coarse:size-9",
        focusRing,
      )}
    >
      {children}
    </button>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/* ── Broken state ── */

/** What is wrong with the text, where, and the lines around it with a mark under the column. */
export function JsonBroken({ text, error, className }: { text: string; error: JsonError; className?: string }) {
  const lines = excerpt(text, error.line);
  const width = String(lines[lines.length - 1]?.no ?? 1).length;
  return (
    <div role="alert" className={cn("flex flex-col gap-3 p-4", className)}>
      <div className="flex items-start gap-2.5">
        <span className="mt-px inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-red-500/12 text-red-700 dark:text-red-300">
          <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
            <path d="M8 4.5v4M8 11.2v.1" {...stroke} strokeWidth={1.8} />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-foreground">This JSON does not parse</p>
          <p className="text-[12.5px] text-muted-foreground">
            {error.message}, line {error.line}, column {error.column}.
          </p>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl bg-muted/60 py-2 font-mono text-[12px] leading-5">
        {lines.map((l) => {
          const bad = l.no === error.line;
          return (
            <div key={l.no}>
              <div className={cn("flex min-w-max pr-4", bad && "bg-red-500/10")}>
                <span className="w-[calc(var(--w)*1ch+1.5rem)] shrink-0 pr-3 text-right text-muted-foreground select-none" style={{ "--w": width } as CSSProperties}>
                  {l.no}
                </span>
                <span className="whitespace-pre text-foreground">{l.text || " "}</span>
              </div>
              {bad && (
                <div className="flex min-w-max pr-4" aria-hidden="true">
                  <span className="w-[calc(var(--w)*1ch+1.5rem)] shrink-0" style={{ "--w": width } as CSSProperties} />
                  <span className="whitespace-pre text-red-700 dark:text-red-300">{" ".repeat(Math.max(0, error.column - 1))}^</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── The inspector ── */

export interface JsonRowDecoration {
  after?: ReactNode;
  tone?: "error" | "warning";
}

export interface JsonInspectorProps {
  /** A parsed value. Takes precedence over `text`. */
  value?: unknown;
  /** Raw JSON text. Parsed here; text that does not parse shows the broken state. */
  text?: string;
  /** Levels open on first render. Default 2. */
  defaultExpandDepth?: number;
  /** Height of the tree area in px; the list scrolls inside it and shrinks when the value is shorter. Default 360. */
  height?: number;
  /** A label in the toolbar, such as "Response" or "payload.json". */
  label?: ReactNode;
  /** Something after the label, such as a status badge or a size. */
  meta?: ReactNode;
  /** Show the search field. Default true. */
  searchable?: boolean;
  /** Prefix for copied paths, such as "$" or "body". Default none: `data.items[0].id`. */
  pathRoot?: string;
  /** Called after a copy, with what was copied. */
  onCopy?: (what: "path" | "value", text: string) => void;
  /** Called when the focused node changes. */
  onFocusPath?: (path: PathPart[]) => void;
  /** Extra content at the end of a row (a type hint, a badge) and a tone for the row. Rows are 24px: keep it to one line. */
  decorate?: (row: JsonRow) => JsonRowDecoration | undefined;
  /** Content under the toolbar, above the tree (a summary, a warning). */
  banner?: ReactNode;
  /** No outer card: for use inside your own panel. */
  bare?: boolean;
  className?: string;
}

export function JsonInspector({ value, text, defaultExpandDepth = 2, height = 360, label, meta, searchable = true, pathRoot = "", onCopy, onFocusPath, decorate, banner, bare, className }: JsonInspectorProps) {
  const parsed = useMemo(() => (value !== undefined ? ({ ok: true, value } as const) : text !== undefined ? parseJson(text) : ({ ok: true, value: undefined } as const)), [value, text]);
  const data = parsed.ok ? parsed.value : undefined;
  const empty = parsed.ok && data === undefined;

  const [expanded, setExpanded] = useState<Set<string>>(() => expandedTo(data, defaultExpandDepth));
  // A new document resets the tree to its first look.
  const [seen, setSeen] = useState(data);
  if (seen !== data) {
    setSeen(data);
    setExpanded(expandedTo(data, defaultExpandDepth));
  }

  const rows = useMemo(() => flatten(data, expanded), [data, expanded]);
  const [focus, setFocus] = useState(0);
  const at = Math.min(focus, Math.max(0, rows.length - 1));
  const row = rows[at];

  const [query, setQuery] = useState("");
  const hits = useMemo(() => (searchable ? search(data, query) : []), [data, query, searchable]);
  const [hit, setHit] = useState(-1);

  // The rows that an expand just revealed fade in once; first render and search jumps reveal nothing.
  const [revealed, setRevealed] = useState<{ id: string; n: number } | null>(null);

  const viewH = Math.min(height, Math.max(1, rows.length) * JSON_ROW_H + 8);
  const win = useRowWindow(rows.length, viewH);
  const treeRef = win.ref;
  const searchRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const rowId = (i: number) => `${uid}-r${i}`;

  const focusAt = useCallback(
    (i: number) => {
      setFocus(i);
      win.reveal(i);
    },
    [win],
  );

  useEffect(() => {
    if (row && !row.close) onFocusPath?.(row.path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);

  const toggle = (id: string) => {
    const opening = !expanded.has(id);
    const next = new Set(expanded);
    if (opening) next.add(id);
    else for (const k of expanded) if (k === id || k.startsWith(id + "\u001f")) next.delete(k);
    setExpanded(next);
    setRevealed(opening ? { id, n: (revealed?.n ?? 0) + 1 } : null);
    // Keep focus on the row that was toggled (a close row hands it to its owner).
    const owner = flatten(data, next).findIndex((r) => r.id === id);
    if (owner >= 0) focusAt(owner);
  };

  /** Focus the match at index `i`, opening its ancestors. */
  const goHit = (i: number) => {
    const h = hits[i];
    if (!h) return;
    setHit(i);
    const next = openFor(expanded, [h.path]);
    if (next !== expanded) setExpanded(next);
    setRevealed(null);
    const idx = flatten(data, next).findIndex((r) => r.id === h.id && !r.close);
    if (idx >= 0) focusAt(idx);
  };

  const onQuery = (q: string) => {
    setQuery(q);
    setHit(-1);
  };
  // Jump to the first match once a query settles on a new set of matches.
  useEffect(() => {
    if (hits.length) goHit(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hits]);

  const copyPath = () => (row ? formatPath(row.path, pathRoot) : "");
  const copyValue = () => (row ? copyText(row.value) : "");
  const [pings, setPings] = useState({ path: 0, value: 0 });

  const onTreeKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "/" && searchable) {
      e.preventDefault();
      searchRef.current?.focus();
      return;
    }
    if (e.key === "c" || e.key === "p") {
      e.preventDefault();
      const what = e.key === "c" ? "value" : "path";
      const t = what === "value" ? copyValue() : copyPath();
      void writeClipboard(t);
      setPings((p) => ({ ...p, [what]: p[what] + 1 }));
      onCopy?.(what, t);
      return;
    }
    if (e.key === "*") {
      e.preventDefault();
      setExpanded(expandedAll(data));
      return;
    }
    const r = treeKey(rows, at, e.key);
    if (r.focus === undefined && r.toggle === undefined) return;
    e.preventDefault();
    if (r.toggle !== undefined) toggle(r.toggle);
    else if (r.focus !== undefined && r.focus >= 0) focusAt(r.focus);
  };

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      goHit(cycle(hit, hits.length, e.shiftKey ? -1 : 1));
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (query) onQuery("");
      else treeRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      treeRef.current?.focus();
    }
  };

  const current = hits[hit];
  const hitIds = useMemo(() => new Set(hits.map((h) => h.id)), [hits]);

  const shell = cn(!bare && "overflow-hidden rounded-2xl border border-border bg-card shadow-xs", "flex min-w-0 flex-col text-foreground", className);

  if (!parsed.ok)
    return (
      <div className={shell} data-state="broken">
        {(label || meta) && (
          <div className="flex h-11 items-center gap-2 border-b border-border px-3">
            {label && <span className="truncate text-[13px] font-medium">{label}</span>}
            {meta}
          </div>
        )}
        <JsonBroken text={text ?? ""} error={parsed.error} />
      </div>
    );

  return (
    <div className={shell} data-state={empty ? "empty" : "ready"}>
      <MotionStyle />
      <div className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-border px-3 py-2">
        {(label || meta) && (
          <div className="flex min-w-0 items-center gap-2 max-sm:basis-full">
            {label && <span className="truncate text-[13px] font-medium">{label}</span>}
            {meta}
          </div>
        )}
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1 sm:max-w-80">
          {searchable && (
            <div className="relative min-w-0 flex-1">
              <svg viewBox="0 0 16 16" aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground">
                <circle cx="7" cy="7" r="4.3" {...stroke} />
                <path d="M10.3 10.3L13.5 13.5" {...stroke} />
              </svg>
              <input
                ref={searchRef}
                type="search"
                value={query}
                disabled={empty}
                onChange={(e) => onQuery(e.target.value)}
                onKeyDown={onSearchKey}
                placeholder="Search"
                aria-label="Search keys and values"
                aria-controls={`${uid}-tree`}
                className={cn(fieldClass, "h-7 pl-7.5 text-[12.5px]", query.trim() ? "pr-16" : "pr-2.5", "pointer-coarse:h-9 [&::-webkit-search-cancel-button]:hidden")}
              />
              {query.trim() && (
                <span aria-live="polite" className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[11.5px] text-muted-foreground tabular-nums">
                  {hits.length ? `${hit + 1} of ${hits.length}` : "No match"}
                </span>
              )}
            </div>
          )}
          {searchable && (
            <>
              <IconButton label="Previous match" disabled={!hits.length} onClick={() => goHit(cycle(hit, hits.length, -1))}>
                <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
                  <path d="M4.5 9.5L8 6l3.5 3.5" {...stroke} />
                </svg>
              </IconButton>
              <IconButton label="Next match" disabled={!hits.length} onClick={() => goHit(cycle(hit, hits.length, 1))}>
                <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
                  <path d="M4.5 6.5L8 10l3.5-3.5" {...stroke} />
                </svg>
              </IconButton>
            </>
          )}
          <IconButton label="Expand all" disabled={empty} onClick={() => setExpanded(expandedAll(data))}>
            <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
              <path d="M5 3.5L8 1.8l3 1.7M5 12.5l3 1.7 3-1.7M8 5v6" {...stroke} />
            </svg>
          </IconButton>
          <IconButton
            label="Collapse all"
            disabled={empty}
            onClick={() => {
              setExpanded(expandedTo(data, 1));
              focusAt(0);
            }}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
              <path d="M5 1.8L8 3.5l3-1.7M5 14.2l3-1.7 3 1.7M3 8h10" {...stroke} />
            </svg>
          </IconButton>
        </div>
      </div>

      {banner}
      {empty ? (
        <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
          <p className="text-[13px] font-medium">Nothing to inspect yet</p>
          <p className="text-[12.5px] text-muted-foreground">Pass a value or JSON text and it opens here as a tree.</p>
        </div>
      ) : (
        <div
          ref={treeRef}
          id={`${uid}-tree`}
          role="tree"
          aria-label={typeof label === "string" ? label : "JSON"}
          aria-activedescendant={row ? rowId(at) : undefined}
          tabIndex={0}
          onKeyDown={onTreeKey}
          onScroll={win.onScroll}
          style={{ height: viewH }}
          className={cn("relative overflow-auto py-1 font-mono text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset")}
        >
          <div style={{ height: rows.length * JSON_ROW_H, position: "relative" }}>
            <div style={{ transform: `translateY(${win.start * JSON_ROW_H}px)` }}>
              {rows.slice(win.start, win.end).map((r, k) => {
                const i = win.start + k;
                const fresh = revealed && !r.close && r.id.startsWith(revealed.id + "\u001f") ? revealed.n : 0;
                const fresher = revealed && r.close && ownerId(r).startsWith(revealed.id + "\u001f") ? revealed.n : 0;
                return (
                  <JsonTreeRow
                    key={`${r.id}:${fresh || fresher}`}
                    id={rowId(i)}
                    row={r}
                    focused={i === at}
                    query={hitIds.has(r.id) && !r.close ? query : undefined}
                    current={!!current && current.id === r.id && !r.close}
                    fresh={!!(fresh || fresher)}
                    decoration={r.close ? undefined : decorate?.(r)}
                    onFocus={() => {
                      setFocus(i);
                      treeRef.current?.focus({ preventScroll: true });
                    }}
                    onToggle={() => toggle(ownerId(r))}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!empty && (
        <div className="flex min-h-10 flex-wrap items-center gap-x-2 gap-y-1 border-t border-border px-3 py-1.5">
          <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-muted-foreground max-sm:basis-full" title={row ? formatPath(row.path, pathRoot) : undefined}>
            {row ? formatPath(row.path, pathRoot) : ""}
          </code>
          <span className="hidden items-center gap-1 text-[11px] text-muted-foreground lg:inline-flex" aria-hidden="true">
            <Kbd size="sm">p</Kbd> path <Kbd size="sm">c</Kbd> value <Kbd size="sm">/</Kbd> search
          </span>
          <CopyButton label="Copy path" ping={pings.path} text={copyPath} onCopied={(t) => onCopy?.("path", t)} />
          <CopyButton label="Copy value" ping={pings.value} text={copyValue} onCopied={(t) => onCopy?.("value", t)} />
        </div>
      )}
    </div>
  );
}

/* ── One row ── */

interface TreeRowProps {
  id: string;
  row: JsonRow;
  focused: boolean;
  query?: string;
  current: boolean;
  fresh: boolean;
  decoration?: JsonRowDecoration;
  onFocus: () => void;
  onToggle: () => void;
}

function JsonTreeRow({ id, row, focused, query, current, fresh, decoration, onFocus, onToggle }: TreeRowProps) {
  const foldable = isContainer(row.type) && row.size > 0 && !row.close;
  const [o, c] = row.type === "array" ? ["[", "]"] : ["{", "}"];
  const comma = row.last ? "" : ",";
  return (
    <div
      id={id}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-expanded={foldable ? row.open : undefined}
      aria-selected={focused}
      aria-label={row.close ? `end of ${row.name ?? "root"}` : undefined}
      onMouseDown={(e) => {
        e.preventDefault();
        onFocus();
      }}
      onDoubleClick={() => foldable && onToggle()}
      data-focused={focused || undefined}
      data-current={current || undefined}
      className={cn(
        "relative flex items-center whitespace-pre transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:bg-muted/50",
        decoration?.tone === "error" && "bg-red-500/8",
        decoration?.tone === "warning" && "bg-amber-500/8",
        focused && "bg-muted hover:bg-muted",
        fresh && "animate-[kn-fade-in_var(--kn-dur-fast)_var(--kn-ease-out)_backwards]",
      )}
      style={{ height: JSON_ROW_H, paddingLeft: JSON_PAD + row.depth * JSON_INDENT }}
    >
      <JsonGuides depth={row.depth} />
      {focused && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-primary" />}
      {foldable ? (
        <span
          aria-hidden="true"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFocus();
            onToggle();
          }}
          className="mr-0.5 inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] text-muted-foreground hover:bg-foreground/8 hover:text-foreground"
        >
          <JsonChevron open={row.open} />
        </span>
      ) : (
        <span aria-hidden="true" className="mr-0.5 inline-block w-4 shrink-0" />
      )}
      <span className="min-w-0 truncate pr-3">
        {row.close ? (
          <span className="text-muted-foreground">
            {c}
            {comma}
          </span>
        ) : (
          <>
            {row.name !== undefined && (
              <>
                <JsonKey name={row.name} query={query} strong={current} />
                <span className="text-muted-foreground">: </span>
              </>
            )}
            {isContainer(row.type) ? (
              row.open ? (
                <span className="text-muted-foreground">{o}</span>
              ) : (
                <>
                  <JsonSummary type={row.type} size={row.size} />
                  <span className="text-muted-foreground">{comma}</span>
                </>
              )
            ) : (
              <>
                <JsonScalar value={row.value} query={query} strong={current} />
                <span className="text-muted-foreground">{comma}</span>
              </>
            )}
          </>
        )}
      </span>
      {decoration?.after && <span className="ml-auto flex shrink-0 items-center gap-1.5 pr-3 font-sans text-[11.5px]">{decoration.after}</span>}
    </div>
  );
}

export default JsonInspector;
