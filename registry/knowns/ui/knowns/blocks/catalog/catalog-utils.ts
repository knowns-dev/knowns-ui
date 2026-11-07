/** @registry part-of="catalog-grid" */
/** Pure helpers for Catalog Grid: category order, counts and filtering. No React, so they are easy to test. */

export interface CatalogEntry {
  id: string;
  category: string;
  title: string;
}

/** Categories in the given order, then any others in order of first use. Empty given categories are dropped. */
export function orderCategories<T extends CatalogEntry>(items: T[], order: string[] = []): string[] {
  const used = new Set(items.map((i) => i.category));
  const rest = [...new Set(items.map((i) => i.category))].filter((c) => !order.includes(c));
  return [...order.filter((c) => used.has(c)), ...rest];
}

/** Counts per category, with "all" first. */
export function categoryCounts<T extends CatalogEntry>(items: T[], categories: string[]): { id: string; count: number }[] {
  return [{ id: "all", count: items.length }, ...categories.map((id) => ({ id, count: items.filter((i) => i.category === id).length }))];
}

/** Items in a category ("all": every item), optionally narrowed by a text query on the title. */
export function filterCatalog<T extends CatalogEntry>(items: T[], category: string, query = ""): T[] {
  const q = query.trim().toLowerCase();
  return items.filter((i) => (category === "all" || i.category === category) && (!q || i.title.toLowerCase().includes(q)));
}

/** "3 examples", "1 example"; nothing for 0 or 1 unless `always`. */
export function countLabel(count: number | undefined, noun = "example", always = false): string | undefined {
  if (count === undefined || (!always && count < 2)) return undefined;
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

/** A card on screen: its id, the page-space top of its row, and the card's height. */
export interface LiveCard {
  id: string;
  top: number;
  height: number;
}

/**
 * Which cards go live: whole rows only (a row never mixes live and poster cards), nearest to `mid` (the middle of
 * the viewport, in page space) first, adding rows while they fit under `max`. The nearest row always goes live, even
 * when it alone is over the cap.
 */
export function pickLiveRows(cards: LiveCard[], mid: number, max: number): Set<string> {
  return new Set(pickLiveRowGroups(cards, mid, max).flat());
}

/** The same rows as pickLiveRows, as one list of ids per row, nearest row first (so mounting can be staggered row by row). */
export function pickLiveRowGroups(cards: LiveCard[], mid: number, max: number): string[][] {
  const rows = new Map<number, { dist: number; ids: string[] }>();
  for (const c of cards) {
    const row = rows.get(c.top) ?? { dist: Math.abs(c.top + c.height / 2 - mid), ids: [] };
    row.ids.push(c.id);
    rows.set(c.top, row);
  }
  const out: string[][] = [];
  let n = 0;
  for (const row of [...rows.values()].sort((x, y) => x.dist - y.dist)) {
    if (n > 0 && n + row.ids.length > max) continue;
    out.push(row.ids);
    n += row.ids.length;
  }
  return out;
}

/**
 * The scale for a sample shown at its own size ("fit"), in a card area `box`. A sample too big for the card
 * shrinks to fill at most 84% of it. A small one grows so it fills about 65% of the width or 60% of the height
 * (whichever binds first), by at most `maxUp` (1.75), so a row of small and large samples looks even. Never 0.
 */
export function sampleScale(box: { w: number; h: number }, nat: { w: number; h: number }, maxUp = 1.75): number {
  if (box.w <= 0 || box.h <= 0 || nat.w <= 0 || nat.h <= 0) return 0;
  const cap = Math.min((box.w * 0.84) / nat.w, (box.h * 0.84) / nat.h);
  if (cap < 1) return cap;
  const target = Math.min((box.w * 0.65) / nat.w, (box.h * 0.6) / nat.h);
  return Math.min(maxUp, cap, Math.max(1, target));
}
