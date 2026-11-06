/** @registry part-of="thinking-state" */
/* Pure helpers for ThinkingState (no React), exported for tests. */

export type ThinkingStatus = "thinking" | "done" | "stopped" | "failed";
export type ThinkingStepStatus = "running" | "done" | "failed";
/** What a step shows: its own status, or "stopped" / "pending" derived from the run. */
export type ResolvedStepStatus = ThinkingStepStatus | "stopped";

export type TimeLike = number | Date;

export const toMs = (t: TimeLike | undefined): number | undefined => (t === undefined ? undefined : typeof t === "number" ? t : t.getTime());

/** "<1s", "12s", "1m 05s", "1h 02m". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0s";
  if (seconds < 1) return "<1s";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
}

/** Seconds spent: `elapsed` wins; else end (or now) minus start. Null when nothing is known. */
export function elapsedSeconds(o: { elapsed?: number; startedAt?: TimeLike; endedAt?: TimeLike; now: number }): number | null {
  if (o.elapsed !== undefined) return Math.max(0, o.elapsed);
  const start = toMs(o.startedAt);
  if (start === undefined) return null;
  return Math.max(0, ((toMs(o.endedAt) ?? o.now) - start) / 1000);
}

/**
 * A step's status. An explicit status wins. Otherwise the last step follows the run (running while
 * thinking, failed / stopped when the run is), and earlier steps count as done.
 */
export function stepStatus(step: { status?: ThinkingStepStatus }, index: number, count: number, run: ThinkingStatus): ResolvedStepStatus {
  const last = index === count - 1;
  if (step.status) {
    // A step still "running" when the run has ended did not finish.
    if (step.status === "running" && run !== "thinking") return run === "failed" ? "failed" : run === "done" ? "done" : "stopped";
    return step.status;
  }
  if (!last) return "done";
  return run === "thinking" ? "running" : run === "failed" ? "failed" : run === "stopped" ? "stopped" : "done";
}

/** "https://www.example.com/a" → "example.com". Falls back to the input. */
export function domainOf(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^[a-z]+:\/\//i, "").replace(/^www\./, "").split(/[/?#]/)[0];
  }
}

/** One letter for a source without an icon. */
export function initialOf(text: string): string {
  const m = text.match(/[\p{L}\p{N}]/u);
  return m ? m[0].toUpperCase() : "?";
}

/** The header's main text once the run has ended. */
export function endedLabel(run: Exclude<ThinkingStatus, "thinking">, seconds: number | null): string {
  const d = seconds === null ? null : formatDuration(seconds);
  if (run === "done") return d ? `Thought for ${d}` : "Thought";
  if (run === "stopped") return d ? `Stopped after ${d}` : "Stopped";
  return d ? `Failed after ${d}` : "Failed";
}

/** Ids in `next` that are not in `seen`, in order. */
export function newIds(seen: ReadonlySet<string>, next: { id: string }[]): string[] {
  return next.filter((s) => !seen.has(s.id)).map((s) => s.id);
}

/**
 * Throttle for the live region: when may the next announcement go out, given the last one at `last`
 * (ms, or null) and a gap of `gap` ms. Returns a delay in ms (0 = now).
 */
export function announceDelay(last: number | null, now: number, gap: number): number {
  if (last === null) return 0;
  return Math.max(0, last + gap - now);
}
