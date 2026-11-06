"use client";

import { useState, useSyncExternalStore } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { Button } from "./button";
import { Select } from "./select";

/* ── Pure helpers (exported for tests) ── */

export type PageItem = number | "start-ellipsis" | "end-ellipsis";

/**
 * Page numbers to show: the first and last `boundaries` pages, `siblings` on each side of the current
 * page, and an ellipsis for each gap. The list keeps the same length while you page through, so the
 * buttons don't jump. A gap of exactly one page shows that page instead of an ellipsis.
 */
export function pageRange(page: number, count: number, siblings = 1, boundaries = 1): PageItem[] {
  if (count <= 0) return [];
  const current = Math.min(Math.max(1, page), count);
  // Slots: boundaries on both ends, siblings + current, and two ellipses.
  const slots = boundaries * 2 + siblings * 2 + 3;
  if (count <= slots) return Array.from({ length: count }, (_, i) => i + 1);

  const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
  const start = range(1, boundaries);
  const end = range(count - boundaries + 1, count);
  // Keep the sibling window a fixed width, sliding it away from the ends.
  const winStart = Math.max(Math.min(current - siblings, count - boundaries - siblings * 2 - 1), boundaries + 2);
  const winEnd = Math.min(Math.max(current + siblings, boundaries + siblings * 2 + 2), count - boundaries - 1);

  const items: PageItem[] = [...start];
  if (winStart > boundaries + 2) items.push("start-ellipsis");
  else if (boundaries + 1 < count - boundaries) items.push(boundaries + 1);
  items.push(...range(winStart, winEnd));
  if (winEnd < count - boundaries - 1) items.push("end-ellipsis");
  else if (count - boundaries > boundaries) items.push(count - boundaries);
  items.push(...end);
  return items;
}

/** Number of pages for `total` items at `pageSize` per page (at least 1). */
export function pageCountOf(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
}

/** "21–40 of 243" style bounds for the current page (1-based, inclusive). */
export function itemBounds(page: number, pageSize: number, total: number): [from: number, to: number] {
  if (total <= 0) return [0, 0];
  const from = (page - 1) * pageSize + 1;
  return [Math.min(from, total), Math.min(page * pageSize, total)];
}

/* ── Component ── */

const NARROW = "(max-width: 639.98px)";
const subscribeNarrow = (cb: () => void) => {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
/** True below the sm breakpoint. False on the server and during hydration. */
function useNarrow() {
  return useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches, () => false);
}

const Chevron = ({ dir }: { dir: "left" | "right" }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === "left" ? "M10 3.5 5.5 8l4.5 4.5" : "M6 3.5 10.5 8 6 12.5"} />
  </svg>
);

export interface PaginationProps {
  /** Current page, 1-based. Controlled. */
  page?: number;
  defaultPage?: number;
  onPageChange?: (page: number) => void;
  /** Total number of items; with `pageSize` this gives the page count. */
  total?: number;
  /** Or pass the page count directly. */
  pageCount?: number;
  pageSize?: number;
  /** Shows a page-size Select; changing it calls onPageSizeChange and goes back to page 1. */
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  /** "default": numbered pages. "compact": Prev · "Page 3 of 12" · Next, for tight spaces. */
  variant?: "default" | "compact";
  /** Pages on each side of the current one. Default 1; 0 below 640px so the row fits a phone. */
  siblings?: number;
  /** Shows "21–40 of 243" when `total` is known. Default true. */
  showSummary?: boolean;
  size?: "sm" | "md";
  /** Item noun for the summary and the page-size label, e.g. "runs". Default "items". */
  noun?: string;
  className?: string;
  "aria-label"?: string;
}

/** Page through a long list: numbered pages with ellipses, Prev / Next, an optional page-size Select. */
export function Pagination({
  page: pageProp,
  defaultPage = 1,
  onPageChange,
  total,
  pageCount: countProp,
  pageSize = 20,
  pageSizeOptions,
  onPageSizeChange,
  variant = "default",
  siblings = 1,
  showSummary = true,
  size = "md",
  noun = "items",
  className,
  "aria-label": label = "Pagination",
}: PaginationProps) {
  const [own, setOwn] = useState(defaultPage);
  const count = countProp ?? pageCountOf(total ?? 0, pageSize);
  const page = Math.min(Math.max(1, pageProp ?? own), count);
  const go = (p: number) => {
    const next = Math.min(Math.max(1, p), count);
    if (next === page) return;
    if (pageProp === undefined) setOwn(next);
    onPageChange?.(next);
  };
  const btn = size === "sm" ? "sm" : "md";
  const narrow = useNarrow();
  const [from, to] = total !== undefined ? itemBounds(page, pageSize, total) : [0, 0];

  const summary =
    showSummary && total !== undefined ? (
      <p className="text-[13px] tabular-nums text-muted-foreground" aria-live="polite">
        {total === 0 ? `No ${noun}` : `${from}–${to} of ${total.toLocaleString()} ${noun}`}
      </p>
    ) : null;

  const sizeSelect =
    pageSizeOptions && onPageSizeChange ? (
      <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <span className="whitespace-nowrap">Per page</span>
        <span className="w-[4.5rem] flex-none">
          <Select
            size="sm"
            aria-label={`${noun} per page`}
            value={String(pageSize)}
            options={pageSizeOptions.map(String)}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              if (pageProp === undefined) setOwn(1);
              if (page !== 1) onPageChange?.(1);
            }}
          />
        </span>
      </label>
    ) : null;

  const prev = (
    <Button variant="ghost" size={btn} icon={<Chevron dir="left" />} disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Previous page">
      {variant === "compact" || narrow ? undefined : "Previous"}
    </Button>
  );
  const next = (
    <Button variant="ghost" size={btn} iconRight={<Chevron dir="right" />} disabled={page >= count} onClick={() => go(page + 1)} aria-label="Next page">
      {variant === "compact" || narrow ? undefined : "Next"}
    </Button>
  );

  return (
    <nav aria-label={label} className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-3", className)}>
      {summary}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {sizeSelect}
        {variant === "compact" ? (
          <div className="flex items-center gap-1">
            {prev}
            <span className="min-w-[7.5rem] text-center text-[13px] tabular-nums text-muted-foreground" aria-current="page">
              Page <span className="font-medium text-foreground">{page}</span> of {count}
            </span>
            {next}
          </div>
        ) : (
          <ul className="flex items-center gap-1">
            <li>{prev}</li>
            {pageRange(page, count, narrow ? 0 : siblings).map((item) =>
              typeof item === "number" ? (
                <li key={item}>
                  <Button
                    size={btn}
                    variant={item === page ? "secondary" : "ghost"}
                    aria-current={item === page ? "page" : undefined}
                    aria-label={`Page ${item}`}
                    onClick={() => go(item)}
                    className={cn("min-w-8 px-2 tabular-nums", size === "sm" && "min-w-7", item === page && "text-foreground")}
                  >
                    {item}
                  </Button>
                </li>
              ) : (
                <li key={item} aria-hidden="true" className="grid w-6 place-items-center text-[13px] text-muted-foreground select-none">
                  …
                </li>
              ),
            )}
            <li>{next}</li>
          </ul>
        )}
      </div>
    </nav>
  );
}
