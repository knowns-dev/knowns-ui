/** @registry part-of="agent-plan" */
/**
 * Pure helpers for Agent Plan: progress, overall state, elapsed time, plan diffs and merging a plan with
 * the tasks of a run. No React, so they are easy to test.
 */
import type { Task } from "@/registry/knowns/lib/knowns/types";

/** pending: not started · active: running now · done · skipped: left out on purpose · failed. */
export type PlanStepStatus = "pending" | "active" | "done" | "skipped" | "failed";

export interface PlanStep {
  id: string;
  title: string;
  /** One line under the title: a file, a command, a result. */
  detail?: string;
  /** Default "pending". */
  status?: PlanStepStatus;
  /** Epoch ms. */
  startedAt?: number;
  endedAt?: number;
  /** Smaller steps inside this one, shown indented. */
  steps?: PlanStep[];
  /** The id of the step that replaced this one: it is struck through and no longer counts. */
  replacedBy?: string;
}

/** proposed: nothing started yet · running · done: every step done or skipped · failed: a step failed and nothing runs. */
export type PlanState = "proposed" | "running" | "done" | "failed";

export const statusOf = (s: PlanStep): PlanStepStatus => s.status ?? "pending";

/** Steps that count toward progress: everything not replaced. */
export const countable = (steps: PlanStep[]) => steps.filter((s) => !s.replacedBy);

export interface PlanProgress {
  /** Done plus skipped. */
  done: number;
  total: number;
  failed: number;
  /** 0..1 */
  ratio: number;
  /** The running step, else the first failed one, else the next pending one. */
  current?: PlanStep;
  /** 1-based position of `current` among the counted steps. */
  index?: number;
}

export function planProgress(steps: PlanStep[]): PlanProgress {
  const list = countable(steps);
  const done = list.filter((s) => statusOf(s) === "done" || statusOf(s) === "skipped").length;
  const failed = list.filter((s) => statusOf(s) === "failed").length;
  const current = list.find((s) => statusOf(s) === "active") ?? list.find((s) => statusOf(s) === "failed") ?? list.find((s) => statusOf(s) === "pending");
  return { done, total: list.length, failed, ratio: list.length ? done / list.length : 0, current, index: current ? list.indexOf(current) + 1 : undefined };
}

export function planState(steps: PlanStep[]): PlanState {
  const list = countable(steps);
  const st = list.map(statusOf);
  if (st.includes("active")) return "running";
  // A failure counts until a later step finishes: an agent that recovers (e.g. adds a fix) is not failed.
  const lastFail = st.lastIndexOf("failed");
  if (lastFail !== -1 && !st.slice(lastFail + 1).some((s) => s === "done")) return "failed";
  if (st.every((s) => s === "pending")) return "proposed";
  if (st.every((s) => s !== "pending")) return "done";
  return "running";
}

/** 0s · 12s · 1m 04s · 1h 02m */
export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/** How long a step ran (or has been running). Undefined before it started. */
export function elapsedOf(step: PlanStep, now: number): number | undefined {
  if (step.startedAt === undefined) return undefined;
  return (step.endedAt ?? (statusOf(step) === "active" ? now : step.startedAt)) - step.startedAt;
}

export interface PlanDiff {
  added: string[];
  removed: string[];
  /** Ids in both lists whose order relative to the other kept ids changed. */
  moved: string[];
}

export function diffPlan(prev: string[], next: string[]): PlanDiff {
  const a = new Set(prev);
  const b = new Set(next);
  const keptPrev = prev.filter((id) => b.has(id));
  const keptNext = next.filter((id) => a.has(id));
  return {
    added: next.filter((id) => !a.has(id)),
    removed: prev.filter((id) => !b.has(id)),
    moved: keptNext.filter((id, i) => keptPrev[i] !== id),
  };
}

const fromTask = (t: Task): Pick<PlanStep, "status" | "startedAt" | "endedAt" | "detail"> => ({
  status: !t.outcome ? "active" : t.outcome === "success" ? "done" : "failed",
  startedAt: t.startedAt,
  endedAt: t.endedAt,
  ...(t.summary ? { detail: t.summary } : {}),
});

/**
 * A plan with live state from a run: a step whose id matches a task takes the task's status, times and
 * summary (sub-steps too). With `actor`, that agent's tasks that are not in the plan are added at the end.
 */
export function mergeRun(steps: PlanStep[], tasks: Task[], actor?: string): PlanStep[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const merge = (list: PlanStep[]): PlanStep[] =>
    list.map((s) => {
      seen.add(s.id);
      const t = byId.get(s.id);
      const steps = s.steps ? merge(s.steps) : undefined;
      return { ...s, ...(t ? fromTask(t) : {}), ...(steps ? { steps } : {}) };
    });
  const merged = merge(steps);
  if (!actor) return merged;
  const extra = tasks.filter((t) => t.actor === actor && !seen.has(t.id)).map((t): PlanStep => ({ id: t.id, title: t.title, ...fromTask(t) }));
  return [...merged, ...extra];
}

/** One line for the collapsed view and for screen readers. */
export function planSummary(steps: PlanStep[]): string {
  const p = planProgress(steps);
  const state = planState(steps);
  if (!p.total) return "No steps yet";
  if (state === "proposed") return `Plan: ${p.total} ${p.total === 1 ? "step" : "steps"}, not started`;
  if (state === "done") return p.failed ? `Done: ${p.done} of ${p.total} steps, ${p.failed} failed` : `Done: ${p.total} of ${p.total} steps`;
  if (state === "failed" && p.current) return `Failed at step ${p.index}: ${p.current.title}`;
  if (p.current && statusOf(p.current) === "active") return `Step ${p.index} of ${p.total}: ${p.current.title}`;
  return `${p.done} of ${p.total} steps done`;
}

export const STATUS_LABEL: Record<PlanStepStatus, string> = {
  pending: "Pending",
  active: "In progress",
  done: "Done",
  skipped: "Skipped",
  failed: "Failed",
};
