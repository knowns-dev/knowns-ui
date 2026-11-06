"use client";
/** @registry name="search-results" type="block" title="Search results" description="A search results page: query box, result count and timing, type facets with counts, highlighted matches with breadcrumbs, keyboard moves, suggestions when nothing matches, and pages." */

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Input } from "../../input";
import { Pagination } from "../../pagination";
import { Toggle } from "../../toggle-group";
import { excerptAround, facetCounts, highlightMatches, listKey, pageOf, suggestionsFor } from "./content-utils";

export interface SearchResult {
  id: string;
  /** Facet, e.g. "docs", "blog" or "changelog". */
  type: string;
  title: string;
  /** The text around the match; long text is cut to a window around the first match. */
  excerpt?: string;
  href?: string;
  /** Where it lives, root first, e.g. ["Docs", "Agents", "Agent Graph"]. */
  crumbs?: string[];
}

export interface SearchResultsProps {
  query: string;
  onQueryChange: (query: string) => void;
  /** The matches for `query`, best first (see searchItems for a small client-side search). */
  results: SearchResult[];
  /** Facets in order. Default docs, blog, changelog. */
  types?: { value: string; label: string }[];
  /** Controlled facet ("all" or a type). */
  type?: string;
  onTypeChange?: (type: string) => void;
  /** How long the search took, for "12 results in 18 ms". */
  timeMs?: number;
  loading?: boolean;
  /** Results per page. Default 8. */
  pageSize?: number;
  /** Queries to offer when nothing matches. */
  suggestions?: string[];
  onSelect?: (result: SearchResult) => void;
  placeholder?: string;
  /** Shown above the input, e.g. the page title. */
  title?: ReactNode;
  className?: string;
}

const DEFAULT_TYPES = [
  { value: "docs", label: "Docs" },
  { value: "blog", label: "Blog" },
  { value: "changelog", label: "Changelog" },
];

function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightMatches(text, query).map((s, i) =>
        s.match ? (
          <mark key={i} className="rounded-[3px] bg-amber-300/45 px-px text-inherit dark:bg-amber-400/30">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

const SearchGlyph = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
    <circle cx="7" cy="7" r="4.75" />
    <path d="m10.5 10.5 3 3" />
  </svg>
);

/**
 * A search results page: the query box, how many results and how fast, type facets with counts, results
 * with highlighted matches and breadcrumbs, keyboard moves between the box and the results, suggestions
 * when nothing matches, and pages.
 */
export function SearchResults({
  query,
  onQueryChange,
  results,
  types = DEFAULT_TYPES,
  type: typeProp,
  onTypeChange,
  timeMs,
  loading = false,
  pageSize = 8,
  suggestions = [],
  onSelect,
  placeholder = "Search",
  title,
  className,
}: SearchResultsProps) {
  const [own, setOwn] = useState("all");
  const type = typeProp ?? own;
  const setType = (t: string) => {
    if (typeProp === undefined) setOwn(t);
    onTypeChange?.(t);
    setPage(1);
  };
  const [page, setPage] = useState(1);
  const [lastQuery, setLastQuery] = useState(query);
  if (lastQuery !== query) {
    setLastQuery(query);
    setPage(1);
  }
  const statusId = useId();
  const input = useRef<HTMLInputElement>(null);
  const links = useRef<(HTMLElement | null)[]>([]);

  const facets = facetCounts(results, types.map((t) => t.value));
  const filtered = type === "all" ? results : results.filter((r) => r.type === type);
  const shown = pageOf(filtered, page, pageSize);
  const labelOf = (v: string) => (v === "all" ? "All" : (types.find((t) => t.value === v)?.label ?? v));

  const focusAt = (i: number) => {
    if (i < 0) input.current?.focus();
    else links.current[i]?.focus();
  };
  const onListKey = (e: KeyboardEvent, i: number) => {
    if (e.key === "Escape") {
      e.preventDefault();
      input.current?.focus();
      return;
    }
    const next = listKey(i, e.key, shown.items.length);
    if (next === null) return;
    e.preventDefault();
    focusAt(next);
  };

  const hasQuery = query.trim().length > 0;
  const count = filtered.length;

  return (
    <section aria-label="Search" className={cn("@container w-full", className)}>
      {title && <h2 className="mb-4 text-[32px] leading-tight font-semibold text-foreground">{title}</h2>}
      <form role="search" onSubmit={(e) => e.preventDefault()} className="max-w-2xl">
        <Input
          ref={input}
          type="search"
          size="lg"
          icon={<SearchGlyph />}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && shown.items.length) {
              e.preventDefault();
              focusAt(0);
            }
          }}
          placeholder={placeholder}
          aria-label="Search"
          aria-describedby={statusId}
        />
      </form>

      <p id={statusId} aria-live="polite" className="mt-3 text-[13px] text-muted-foreground">
        {loading ? "Searching…" : hasQuery ? `${count} ${count === 1 ? "result" : "results"}${type !== "all" ? ` in ${labelOf(type)}` : ""}${timeMs !== undefined ? ` in ${Math.round(timeMs)} ms` : ""}` : "Type to search docs, posts and the changelog."}
      </p>

      {hasQuery && results.length > 0 && (
        <div role="group" aria-label="Filter by type" className="mt-4 flex flex-wrap gap-1.5">
          {facets.map((f) => (
            <Toggle key={f.type} size="sm" variant="outline" pressed={type === f.type} disabled={f.count === 0 && f.type !== "all"} onPressedChange={() => setType(f.type)}>
              {labelOf(f.type)} <span className="text-muted-foreground tabular-nums">{f.count}</span>
            </Toggle>
          ))}
        </div>
      )}

      {hasQuery && !loading && count === 0 ? (
        <div className="mt-8 max-w-2xl rounded-[12px] bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] px-5 py-8">
          <p className="text-[15px] font-semibold text-foreground">No results for “{query}”</p>
          <p className="mt-1 text-[14px] text-muted-foreground">Check the spelling, use fewer words, or try one of these:</p>
          {suggestions.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {suggestionsFor(query, suggestions).map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => {
                      onQueryChange(s);
                      input.current?.focus();
                    }}
                    className={cn("rounded-full bg-card px-3 py-1 text-[13px] text-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_12%,transparent)] transition-colors hover:bg-muted", focusRing)}
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <ol aria-label="Results" className="mt-6 flex max-w-3xl flex-col gap-1">
          {shown.items.map((r, i) => {
            const body = (
              <>
                {r.crumbs && r.crumbs.length > 0 && (
                  <span className="flex min-w-0 items-center gap-1 truncate text-[13px] text-muted-foreground">
                    {r.crumbs.map((c, j) => (
                      <span key={j} className="inline-flex min-w-0 items-center gap-1">
                        {j > 0 && <span aria-hidden="true">›</span>}
                        <span className="truncate">{c}</span>
                      </span>
                    ))}
                  </span>
                )}
                <span className="mt-0.5 flex items-center gap-2">
                  <span className="min-w-0 text-[16px] font-semibold text-foreground">
                    <Highlight text={r.title} query={query} />
                  </span>
                  <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] px-1.5 py-px text-[13px] text-muted-foreground">{labelOf(r.type)}</span>
                </span>
                {r.excerpt && (
                  <span className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-muted-foreground">
                    <Highlight text={excerptAround(r.excerpt, query)} query={query} />
                  </span>
                )}
              </>
            );
            const cls = cn("flex w-full flex-col rounded-[12px] px-3 py-3 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)]", focusRing);
            const common = { ref: (el: HTMLElement | null) => void (links.current[i] = el), onKeyDown: (e: KeyboardEvent) => onListKey(e, i), className: cls };
            return (
              <li key={r.id}>
                {r.href ? (
                  <a {...common} href={r.href} onClick={onSelect ? () => onSelect(r) : undefined}>
                    {body}
                  </a>
                ) : (
                  <button {...common} type="button" onClick={() => onSelect?.(r)}>
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {filtered.length > pageSize && (
        <div className="mt-6 max-w-3xl">
          <Pagination page={shown.page} onPageChange={setPage} total={filtered.length} pageSize={pageSize} noun="results" size="sm" />
        </div>
      )}
    </section>
  );
}

export default SearchResults;
