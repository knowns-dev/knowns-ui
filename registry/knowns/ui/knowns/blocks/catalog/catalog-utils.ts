/** @registry part-of="catalog-grid" */
/** Pure helpers for Catalog Grid: category order, counts and filtering. No React, so they are easy to test. */

export interface CatalogEntry {
  id: string;
  category: string;
  title: string;
  /** Filters by tier read these. Both optional: an entry with neither is Free and not new. */
  pro?: boolean;
  isNew?: boolean;
}

/** The tier filter: everything, what is new, Free (not Pro) or Pro. */
export type CatalogTier = "all" | "new" | "free" | "pro";
export const CATALOG_TIERS: CatalogTier[] = ["all", "new", "free", "pro"];

/** Whether an entry belongs to a tier filter. */
export function inTier(item: Pick<CatalogEntry, "pro" | "isNew">, tier: CatalogTier): boolean {
  return tier === "all" || (tier === "new" ? Boolean(item.isNew) : tier === "pro" ? Boolean(item.pro) : !item.pro);
}

/** How many entries each tier filter holds. */
export function tierCounts(items: Pick<CatalogEntry, "pro" | "isNew">[]): Record<CatalogTier, number> {
  return { all: items.length, new: items.filter((i) => inTier(i, "new")).length, free: items.filter((i) => inTier(i, "free")).length, pro: items.filter((i) => inTier(i, "pro")).length };
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

/** Items in a category ("all": every item), optionally narrowed by a text query on the title and by tier. */
export function filterCatalog<T extends CatalogEntry>(items: T[], category: string, query = "", tier: CatalogTier = "all"): T[] {
  const q = query.trim().toLowerCase();
  return items.filter((i) => (category === "all" || i.category === category) && (!q || i.title.toLowerCase().includes(q)) && inTier(i, tier));
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

/**
 * How many previews may run at once. A one-column phone layout runs only the card nearest the middle of the screen;
 * everywhere else the cap is `max` (at least 1).
 */
export function effectiveMaxLive(max: number, narrow: boolean, interactive: boolean): number {
  const cap = Math.max(1, Math.floor(Number.isFinite(max) ? max : 1));
  return interactive && narrow ? 1 : cap;
}

/** Column classes of the grid. Interactive demos need room to be used, so phones get one column and tablets two. */
export function gridColumns(size: "card" | "page", interactive: boolean): string {
  if (size === "page") return "grid grid-cols-1 gap-x-6 gap-y-8 @[640px]:grid-cols-2";
  if (interactive) return "grid grid-cols-1 gap-x-4 gap-y-6 @[520px]:grid-cols-2 @[900px]:grid-cols-3";
  return "grid grid-cols-2 gap-x-4 gap-y-6 @[640px]:grid-cols-3 @[1080px]:grid-cols-5";
}

/**
 * What a card's poster is before its live preview shows. "unknown": the grid has not checked the device yet (first
 * paint, server render). "live": cards go live as they come into view, so a waiting card shows its placeholder.
 * "still": cards never go live here (reduced motion, Save-Data, a touch or narrow screen on a non-interactive grid,
 * live off, or hover mode, where a card that is not hovered stays as it is), so the thumbnail is the picture.
 */
export type PosterMode = "unknown" | "live" | "still";

export function posterMode({ enabled, hover, known, allowed }: { enabled: boolean; hover: boolean; known: boolean; allowed: boolean }): PosterMode {
  if (!enabled || hover) return "still";
  if (!known) return "unknown";
  return allowed ? "live" : "still";
}

/**
 * Which poster a card paints: its thumbnail, its placeholder, or "either" (both, CSS shows the one this device will
 * want, while the mode is still unknown). Only a card with a scaled live preview and a placeholder ever shows the
 * placeholder; inline text cards render their own still frame.
 */
export function posterFor(mode: PosterMode, card: { preview: boolean; inline: boolean; placeholder: boolean }): "thumb" | "placeholder" | "either" {
  if (!card.preview || card.inline || !card.placeholder || mode === "still") return "thumb";
  return mode === "live" ? "placeholder" : "either";
}

/** The card's window is 16:10. */
const WINDOW_RATIO = 10 / 16;

/**
 * How far a template card's shot scrolls, as a negative percentage of the shot's own height (translateY percentages
 * refer to the element itself): the shot is `height / width` times as tall as the card is wide, the window shows
 * 10/16 of the width. A shot no taller than the window does not scroll.
 */
export function templateShift(width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) return 0;
  const ratio = height / width;
  if (ratio <= WINDOW_RATIO) return 0;
  return -Math.round((1 - WINDOW_RATIO / ratio) * 1000) / 10;
}

/** How long the scroll takes, in ms: slow enough to read, about 3.2s for each window of page past the first, between 3 and 8 seconds. */
export function templateDuration(width: number, height: number): number {
  const ratio = height / width;
  const windows = Math.max(0, ratio / WINDOW_RATIO - 1);
  return Math.round(Math.min(8000, Math.max(3000, 2000 + windows * 3200)));
}
