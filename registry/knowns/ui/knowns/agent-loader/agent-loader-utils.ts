/* Pure helpers for AgentLoader (no React), exported for tests. */

export type AgentPhase = "think" | "search" | "read" | "write" | "tool" | "wait" | "done" | "error";

export const AGENT_PHASES: AgentPhase[] = ["think", "search", "read", "write", "tool", "wait", "done", "error"];

/** The phases whose glyph loops while they last. "wait" pulses too, but slowly, and is not shimmered. done and error are one-shots. */
const LOOPING: ReadonlySet<AgentPhase> = new Set(["think", "search", "read", "write", "tool", "wait"]);

export const isLoopPhase = (phase: AgentPhase): boolean => LOOPING.has(phase);

/** A phase that is still working (the label shimmers, the timer runs). wait is not one: the agent is stopped until a person answers. */
export const isBusyPhase = (phase: AgentPhase): boolean => LOOPING.has(phase) && phase !== "wait";

/** A phase that ended the run. */
export const isEndPhase = (phase: AgentPhase): boolean => phase === "done" || phase === "error";

const LABELS: Record<AgentPhase, string> = {
  think: "Thinking",
  search: "Searching",
  read: "Reading",
  write: "Writing",
  tool: "Running a tool",
  wait: "Waiting for you",
  done: "Done",
  error: "Failed",
};

export const defaultLabel = (phase: AgentPhase): string => LABELS[phase];

/** Which one-shot to play when the phase changes from `prev` to `next`: never on first render, never when nothing changed. */
export function playFor(prev: AgentPhase, next: AgentPhase): "done" | "error" | undefined {
  if (prev === next) return undefined;
  return next === "done" ? "done" : next === "error" ? "error" : undefined;
}

/** "0s", "12s", then "1m 05s" from a minute on. Bad input reads as "0s". */
export function formatElapsed(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0s";
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

/** Seconds spent. An explicit `elapsed` wins, then `startedAt` to `endedAt` (or to `now`). Undefined when there is nothing to show. */
export function elapsedSeconds(o: { elapsed?: number; startedAt?: number | Date; endedAt?: number | Date; now: number }): number | undefined {
  if (o.elapsed !== undefined) return Math.max(0, o.elapsed);
  if (o.startedAt === undefined) return undefined;
  const ms = (t: number | Date) => (typeof t === "number" ? t : t.getTime());
  const end = o.endedAt === undefined ? o.now : ms(o.endedAt);
  return Math.max(0, (end - ms(o.startedAt)) / 1000);
}
