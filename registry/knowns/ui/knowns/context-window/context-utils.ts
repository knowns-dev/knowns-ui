/** What fills a model's context window, and how full it is. Pure helpers. */

export type ContextKind = "system" | "tools" | "history" | "files" | "output" | "other";

export interface ContextSegment {
  id: string;
  label: string;
  tokens: number;
  /** Picks the default colour; "output" is a reserve by default. */
  kind?: ContextKind;
  color?: string;
  /** Space held back (e.g. for the model's answer): drawn hatched after what's used, not counted as used. */
  reserve?: boolean;
}

export type ContextState = "ok" | "warn" | "full" | "over";

export const KIND_COLOR: Record<ContextKind, string> = {
  system: "#64748b",
  tools: "#8b5cf6",
  history: "#6366f1",
  files: "#0ea5e9",
  output: "#f59e0b",
  other: "#14b8a6",
};
/** Colours for segments without a kind, in order. */
const EXTRA = ["#14b8a6", "#ec4899", "#06b6d4", "#84cc16", "#f43f5e"];

export const isReserve = (s: ContextSegment) => s.reserve ?? s.kind === "output";

/** Segment colours: its own, else its kind's, else the next extra colour. */
export function segmentColors(segments: ContextSegment[]): Map<string, string> {
  let k = 0;
  return new Map(segments.map((s) => [s.id, s.color ?? (s.kind ? KIND_COLOR[s.kind] : EXTRA[k++ % EXTRA.length])]));
}

/**
 * The window size: `limit` if given, else the `model`'s entry in `limits` (exact, then ignoring case and
 * spacing). Null when unknown - the bar then shows the breakdown without a percentage.
 */
export function resolveLimit(limit?: number, model?: string, limits?: Record<string, number>): number | null {
  if (limit !== undefined && limit > 0) return limit;
  if (!model || !limits) return null;
  if (limits[model] > 0) return limits[model];
  const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");
  const hit = Object.entries(limits).find(([k]) => norm(k) === norm(model));
  return hit && hit[1] > 0 ? hit[1] : null;
}

export interface ContextTotals {
  used: number;
  reserved: number;
  /** Room left after what's used and reserved (negative when over). */
  free: number;
  /** used / limit. */
  pct: number;
  /** (used + reserved) / limit: what the thresholds look at. */
  fill: number;
}

export function contextTotals(segments: ContextSegment[], limit: number | null): ContextTotals {
  const used = segments.filter((s) => !isReserve(s)).reduce((n, s) => n + Math.max(0, s.tokens), 0);
  const reserved = segments.filter(isReserve).reduce((n, s) => n + Math.max(0, s.tokens), 0);
  if (!limit) return { used, reserved, free: 0, pct: 0, fill: 0 };
  return { used, reserved, free: limit - used - reserved, pct: used / limit, fill: (used + reserved) / limit };
}

/** ok below `warnAt`; warn up to `fullAt`; full up to 100%; over past the limit. */
export function contextState(fill: number, warnAt = 0.8, fullAt = 0.95): ContextState {
  if (fill > 1) return "over";
  if (fill >= fullAt) return "full";
  if (fill >= warnAt) return "warn";
  return "ok";
}

/** "950", "12.4k", "124k", "1M", "1.05M". */
export function formatTokens(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a < 1000) return `${sign}${Math.round(a)}`;
  if (a < 1_000_000) {
    const k = a / 1000;
    return `${sign}${k < 10 ? +k.toFixed(1) : k < 100 ? +k.toFixed(1) : Math.round(k)}k`;
  }
  const m = a / 1_000_000;
  return `${sign}${m < 10 ? +m.toFixed(2) : +m.toFixed(1)}M`;
}

/** "62%" (whole percent; "<1%" for a sliver, never "0%" when something is there). */
export function formatPct(p: number): string {
  if (p > 0 && p < 0.01) return "<1%";
  return `${Math.round(p * 100)}%`;
}

/** The state in words, with what to do about it. */
export function stateSentence(state: ContextState, t: ContextTotals, fmt: (n: number) => string = formatTokens): string {
  switch (state) {
    case "ok":
      return `${fmt(Math.max(0, t.free))} free`;
    case "warn":
      return `Filling up · ${fmt(Math.max(0, t.free))} left, compact soon`;
    case "full":
      return `Almost full · ${fmt(Math.max(0, t.free))} left, the next turn may not fit`;
    case "over":
      // What's used still fits; the output reserve is what doesn't.
      if (t.pct <= 1) return `Output reserve doesn't fit · ${fmt(-t.free)} short, compact now`;
      return `Over the limit by ${fmt(-t.free)} · compact or drop something`;
  }
}

/** "Warns at 80% · full at 95%". */
export const thresholdsText = (warnAt: number, fullAt: number) => `Warns at ${formatPct(warnAt)} · full at ${formatPct(fullAt)}`;

/** Turns where usage dropped by more than a fifth (a compaction, or history cut): their indexes. */
export function drops(history: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < history.length; i++) if (history[i] < history[i - 1] * 0.8) out.push(i);
  return out;
}
