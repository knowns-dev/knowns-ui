/** @registry part-of="error-pages" */
/** Error page helpers: pure, so they are easy to test and reuse. */

/** "in about 40 minutes", "in about 2 hours", "any minute now" or null once the time has passed. */
export function etaText(eta: Date | string | number, now: number = Date.now()): string | null {
  const end = new Date(eta).getTime();
  if (!Number.isFinite(end) || end < now) return null;
  const min = Math.round((end - now) / 60_000);
  if (min < 2) return "any minute now";
  if (min < 60) return `in about ${Math.round(min / 5) * 5 || min} minutes`;
  const h = Math.round(min / 30) / 2;
  return `in about ${h} ${h === 1 ? "hour" : "hours"}`;
}

/** The clock time of the ETA in the reader's locale, e.g. "14:30" or "2:30 PM". */
export function etaClock(eta: Date | string | number, locale?: string): string | null {
  const d = new Date(eta);
  return Number.isFinite(d.getTime()) ? d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }) : null;
}

/** Loose shape check for an email address (the server has the last word). */
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** The search URL for a 404 search box: `${action}?q=<query>`. Empty queries return null. */
export function searchUrl(action: string, query: string, param = "q"): string | null {
  const q = query.trim();
  if (!q) return null;
  return `${action}${action.includes("?") ? "&" : "?"}${param}=${encodeURIComponent(q)}`;
}

/** What to say in a support request: the error id, the page and the time. */
export function errorReport(errorId: string, page?: string, at: Date = new Date()): string {
  return [`Error ID: ${errorId}`, page && `Page: ${page}`, `Time: ${at.toISOString()}`].filter(Boolean).join("\n");
}
