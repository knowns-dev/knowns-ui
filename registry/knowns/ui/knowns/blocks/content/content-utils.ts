/** @registry part-of="content-core" */
/**
 * Pure helpers shared by the content blocks (Blog Grid, Blog Post, Changelog Feed, Help Center, Search
 * Results): reading time, table of contents, reading progress, filters, match highlighting and a small
 * client-side search. No React, so they are easy to test.
 */

/* ── Text ── */

/** "Getting started with runs" → "getting-started-with-runs". Unique ids come from `uniqueSlugs`. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Slugs for a list of headings, with -2, -3 … on repeats. */
export function uniqueSlugs(texts: string[]): string[] {
  const seen = new Map<string, number>();
  return texts.map((t) => {
    const base = slugify(t) || "section";
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

/** Minutes to read at `wpm` words a minute, at least 1. */
export function readingMinutes(text: string, wpm = 230): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / wpm));
}

export const readingLabel = (minutes: number) => `${minutes} min read`;

/** "Nov 6, 2026" in English; pass `locale` to change. Accepts ms, Date or an ISO date. */
export function formatDate(date: number | string | Date, locale = "en-US"): string {
  const d = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00`) : new Date(date);
  return d.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

/** Two-letter initials for an author without a photo. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ── Table of contents and reading progress ── */

export interface TocItem {
  id: string;
  text: string;
  /** 2 for h2, 3 for h3. */
  level: number;
}

/**
 * The heading to highlight: the last one whose top has passed `offset` px below the top of the viewport.
 * `tops` are each heading's top relative to the viewport, in document order. Before the first: the first.
 */
export function activeHeading(tops: { id: string; top: number }[], offset = 96): string | undefined {
  let active = tops[0]?.id;
  for (const t of tops) if (t.top - offset <= 0) active = t.id;
  return active;
}

/**
 * How much of an article has been read, 0..1: 0 while its top is below the top of the viewport, 1 once
 * its bottom is in view. `top` and `height` are the article's bounding box, `viewport` the window height.
 */
export function readingProgress(top: number, height: number, viewport: number): number {
  const total = height - viewport;
  if (total <= 0) return top <= 0 ? 1 : 0;
  return Math.min(1, Math.max(0, -top / total));
}

/* ── Filters and pages ── */

/** Every distinct tag, in order of first use, with counts. */
export function tagCounts<T extends { tags?: string[] }>(items: T[]): { tag: string; count: number }[] {
  const m = new Map<string, number>();
  for (const it of items) for (const t of it.tags ?? []) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m].map(([tag, count]) => ({ tag, count }));
}

/** Items that have every selected tag (no tags selected: all). */
export function filterByTags<T extends { tags?: string[] }>(items: T[], selected: string[]): T[] {
  if (!selected.length) return items;
  return items.filter((it) => selected.every((t) => it.tags?.includes(t)));
}

/** One page of a list, 1-based, clamped to the last page. */
export function pageOf<T>(items: T[], page: number, size: number): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / Math.max(1, size)));
  const p = Math.min(Math.max(1, Math.floor(page)), pages);
  return { items: items.slice((p - 1) * size, p * size), page: p, pages };
}

/* ── Search ── */

export type Segment = { text: string; match: boolean };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Query words (2+ characters), lower case, longest first so longer matches win. */
export function queryTerms(query: string): string[] {
  return [...new Set(query.toLowerCase().split(/\s+/).filter((w) => w.length >= 2))].sort((a, b) => b.length - a.length);
}

/** `text` split into plain and matched runs for every query word, case-insensitive. */
export function highlightMatches(text: string, query: string): Segment[] {
  const terms = queryTerms(query);
  if (!terms.length || !text) return text ? [{ text, match: false }] : [];
  const re = new RegExp(`(${terms.map(escapeRe).join("|")})`, "gi");
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index), match: false });
    out.push({ text: m[0], match: true });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), match: false });
  return out;
}

/**
 * A window of `text` around the first match, about `size` characters, with … where it was cut.
 * Without a match: the start of the text.
 */
export function excerptAround(text: string, query: string, size = 160): string {
  if (text.length <= size) return text;
  const terms = queryTerms(query);
  const lower = text.toLowerCase();
  const hit = Math.min(...terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0), Infinity);
  const at = Number.isFinite(hit) ? Math.max(0, hit - Math.floor(size / 3)) : 0;
  const start = at > 0 ? text.indexOf(" ", at) + 1 || at : 0;
  const end = Math.min(text.length, start + size);
  const cut = end < text.length ? text.lastIndexOf(" ", end) : end;
  return `${start > 0 ? "…" : ""}${text.slice(start, cut > start ? cut : end).trim()}${end < text.length ? "…" : ""}`;
}

export interface Searchable {
  id: string;
  title: string;
  text?: string;
  type?: string;
  tags?: string[];
}

/**
 * A small ranked search for docs, posts or articles: every query word must appear; title hits count
 * most, then tags, then body. Ties keep the input order. Good for a few hundred items in the browser.
 */
export function searchItems<T extends Searchable>(items: T[], query: string): T[] {
  const terms = queryTerms(query);
  if (!terms.length) return [];
  const scored = items
    .map((it, i) => {
      const title = it.title.toLowerCase();
      const tags = (it.tags ?? []).join(" ").toLowerCase();
      const body = (it.text ?? "").toLowerCase();
      let score = 0;
      for (const t of terms) {
        const s = (title.includes(t) ? 6 : 0) + (title.startsWith(t) ? 2 : 0) + (tags.includes(t) ? 3 : 0) + (body.includes(t) ? 1 : 0);
        if (!s) return null;
        score += s;
      }
      return { it, i, score };
    })
    .filter((x): x is { it: T; i: number; score: number } => x !== null);
  return scored.sort((a, b) => b.score - a.score || a.i - b.i).map((x) => x.it);
}

/** Counts per type, in the order given, with the total first as "all". */
export function facetCounts<T extends { type?: string }>(items: T[], types: string[]): { type: string; count: number }[] {
  return [{ type: "all", count: items.length }, ...types.map((type) => ({ type, count: items.filter((i) => i.type === type).length }))];
}

/** "Did you mean" ideas: the suggestions that share a word with the query, else all of them. */
export function suggestionsFor(query: string, suggestions: string[], max = 4): string[] {
  const terms = queryTerms(query);
  const near = suggestions.filter((s) => terms.some((t) => s.toLowerCase().includes(t.slice(0, 3))));
  return (near.length ? near : suggestions).slice(0, max);
}

/* ── Keyboard ── */

/** Roving focus in a vertical list: the next index for a key, -1 to go back to the search box, or null. */
export function listKey(i: number, key: string, n: number): number | null {
  if (!n) return null;
  if (key === "ArrowDown") return Math.min(n - 1, i + 1);
  if (key === "ArrowUp") return i <= 0 ? -1 : i - 1;
  if (key === "Home") return 0;
  if (key === "End") return n - 1;
  return null;
}
