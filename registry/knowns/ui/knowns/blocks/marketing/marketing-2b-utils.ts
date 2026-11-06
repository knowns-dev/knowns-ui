/** @registry name="marketing-2b-core" type="ui" title="Marketing 2b core" description="Pure helpers for Testimonials, FAQ Section, Newsletter, Contact Section and Team Grid: email and contact validation, FAQ filter, ids and hash links, carousel steps and the auto-advance gate, masonry columns, rating labels." */
/**
 * Pure helpers for the wave 2b marketing blocks: Testimonials (carousel and masonry), FAQ Section
 * (filter, deep links), Newsletter and Contact Section (validation), Team Grid. No React.
 */

/* ── Forms ── */

/** A practical email check: one @, a dot in the domain, no spaces. Servers still verify. */
export function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(s.trim());
}

export function newsletterError(email: string): string | null {
  if (!email.trim()) return "Enter your email address.";
  if (!isEmail(email)) return "That email address doesn't look right.";
  return null;
}

export interface ContactValues {
  name: string;
  email: string;
  topic: string;
  message: string;
}
export type ContactErrors = Partial<Record<keyof ContactValues, string>>;

/** Field errors for the contact form; an empty object means it can be sent. */
export function contactErrors(v: ContactValues, o: { topics?: string[]; minMessage?: number; maxMessage?: number } = {}): ContactErrors {
  const e: ContactErrors = {};
  const min = o.minMessage ?? 10;
  const max = o.maxMessage ?? 2000;
  if (!v.name.trim()) e.name = "Enter your name.";
  const em = newsletterError(v.email);
  if (em) e.email = em;
  if (o.topics?.length && !o.topics.includes(v.topic)) e.topic = "Choose a topic.";
  const m = v.message.trim();
  if (!m) e.message = "Write a message.";
  else if (m.length < min) e.message = `Add a little more detail (at least ${min} characters).`;
  else if (m.length > max) e.message = `Keep it under ${max} characters.`;
  return e;
}

/* ── FAQ ── */

export interface FaqLike {
  id?: string;
  question: string;
  /** Plain text of the answer for search (answers can be rich). */
  answerText?: string;
  category?: string;
}

/** URL-safe id for a question: its own id, else a slug of the question. */
export const faqId = (it: Pick<FaqLike, "id" | "question">) =>
  it.id ??
  it.question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Questions in a category ("all" for every one) whose question or answer has every word of the query. */
export function filterFaq<T extends FaqLike>(items: T[], o: { category?: string; query?: string }): T[] {
  const words = fold(o.query ?? "")
    .split(/\s+/)
    .filter(Boolean);
  return items.filter((it) => {
    if (o.category && o.category !== "all" && it.category !== o.category) return false;
    if (!words.length) return true;
    const hay = fold(`${it.question} ${it.answerText ?? ""}`);
    return words.every((w) => hay.includes(w));
  });
}

/** Categories in first-seen order. */
export const faqCategories = (items: FaqLike[]) => [...new Set(items.map((i) => i.category).filter((c): c is string => !!c))];

/** The question a URL hash points at ("#refunds" or "#faq-refunds"), or null. */
export function faqFromHash(hash: string, items: Pick<FaqLike, "id" | "question">[], prefix = ""): string | null {
  const h = decodeURIComponent(hash.replace(/^#/, ""));
  if (!h) return null;
  const want = prefix && h.startsWith(prefix) ? h.slice(prefix.length) : h;
  return items.map(faqId).find((id) => id === want) ?? null;
}

/* ── Carousel ── */

/** Index after a step, wrapping both ways. */
export const wrapIndex = (i: number, n: number) => (n <= 0 ? 0 : ((i % n) + n) % n);

export type CarouselKey = "prev" | "next" | "first" | "last";
export function carouselKey(key: string): CarouselKey | null {
  switch (key) {
    case "ArrowLeft":
      return "prev";
    case "ArrowRight":
      return "next";
    case "Home":
      return "first";
    case "End":
      return "last";
    default:
      return null;
  }
}

export function carouselStep(i: number, n: number, k: CarouselKey): number {
  if (k === "first") return 0;
  if (k === "last") return Math.max(0, n - 1);
  return wrapIndex(i + (k === "next" ? 1 : -1), n);
}

/** Auto-advance only when switched on, more than one slide, and nobody is reading or has paused it. */
export function shouldAutoAdvance(o: { interval: number; count: number; hovered: boolean; focused: boolean; paused: boolean; reduced: boolean; inView: boolean }): boolean {
  return o.interval > 0 && o.count > 1 && !o.hovered && !o.focused && !o.paused && !o.reduced && o.inView;
}

/* ── Masonry ── */

/**
 * Spreads cards over `cols` columns so the columns end at about the same height, keeping reading
 * order across rows (each card goes to the currently shortest column). `weight` estimates a card's height.
 */
export function masonry<T>(items: T[], cols: number, weight: (it: T) => number): number[][] {
  const n = Math.max(1, cols);
  const out: number[][] = Array.from({ length: n }, () => []);
  const h = new Array(n).fill(0);
  items.forEach((it, i) => {
    let c = 0;
    for (let j = 1; j < n; j++) if (h[j] < h[c] - 0.001) c = j;
    out[c].push(i);
    h[c] += weight(it);
  });
  return out;
}

/** Rough height of a testimonial: quote lines plus the footer; highlighted quotes use bigger type. */
export const quoteWeight = (q: { quote: string; highlight?: boolean; rating?: number }) => Math.ceil(q.quote.length / (q.highlight ? 34 : 46)) * (q.highlight ? 1.35 : 1) + 3 + (q.rating ? 1 : 0);

/** "Rated 4.5 out of 5" for ratings in halves. */
export function ratingLabel(r: number, max = 5) {
  const v = Math.round(Math.min(max, Math.max(0, r)) * 2) / 2;
  return `Rated ${v} out of ${max}`;
}
