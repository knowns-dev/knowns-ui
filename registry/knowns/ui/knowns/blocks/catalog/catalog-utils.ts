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
