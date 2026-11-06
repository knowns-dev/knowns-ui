"use client";
/** @registry name="agent-plan" type="ui" title="Agent plan" description="The steps an agent intends to take, checked off live: step states, sub-steps, elapsed times, a progress bar, animated plan changes, Approve plan / Edit plan and a one-line collapsed view. Reads the run store or plain props." */

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { useAgentSnapshot, type AgentRun } from "@/registry/knowns/lib/knowns/run";
import { Button } from "../button";
import { Spinner } from "../spinner";
import {
  STATUS_LABEL,
  elapsedOf,
  formatElapsed,
  mergeRun,
  planProgress,
  planState,
  planSummary,
  statusOf,
  type PlanState,
  type PlanStep,
  type PlanStepStatus,
} from "./plan-utils";

export type { PlanState, PlanStep, PlanStepStatus } from "./plan-utils";

export interface AgentPlanProps {
  /** The planned steps, in order. With `run`, steps whose id matches a task take its live state. */
  steps?: PlanStep[];
  /** Read live state from a run: tasks become step status, times and summaries. */
  run?: AgentRun;
  /** With `run`: this agent's tasks that are not in `steps` are added at the end. */
  actor?: string;
  title?: ReactNode;
  /** What the plan is for, one or two lines under the title. */
  goal?: ReactNode;
  /**
   * With `run`: the id of an approval request for this plan. While it is pending the footer shows
   * Approve plan / Edit plan, which resolve it as approved / denied.
   */
  approval?: string;
  /** Shows Approve plan while nothing has started (or while `approval` is pending). */
  onApprove?: () => void;
  /** Shows Edit plan next to Approve plan. */
  onEdit?: () => void;
  approveLabel?: string;
  editLabel?: string;
  /** Controlled collapsed state: one summary line instead of the list. */
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Let the header toggle the collapsed view. Default true. */
  collapsible?: boolean;
  /** Announce step changes to screen readers. Default true. */
  announce?: boolean;
  /** Clock for elapsed times. Default Date.now. */
  now?: () => number;
  className?: string;
}

const CSS = `
@keyframes knpl-in { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: none } }
@keyframes knpl-out { from { opacity: 1; transform: none } to { opacity: 0; transform: translateX(6px) } }
@keyframes knpl-pop { 0% { transform: scale(.6); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
`;
const EASE = "cubic-bezier(.22,1,.36,1)";
const LEAVE_MS = 280;
const NO_STEPS: PlanStep[] = [];

const STATE_TEXT: Record<PlanState, string> = { proposed: "Proposed", running: "Running", done: "Done", failed: "Failed" };

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Re-renders every second while `on`, for live elapsed times. */
function useTick(on: boolean, now: () => number) {
  // The clock goes through a ref, so an inline `now={() => …}` doesn't restart the interval each render.
  const clock = useRef(now);
  clock.current = now;
  const [t, setT] = useState(now);
  useEffect(() => {
    if (!on) return;
    setT(clock.current());
    const id = setInterval(() => setT(clock.current()), 1000);
    return () => clearInterval(id);
  }, [on]);
  return on ? t : now();
}

/* ── Icons ── */

const Check = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3">
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);
const Cross = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="size-3">
    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
  </svg>
);
const Dash = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="size-3">
    <path d="M4.5 8h7" />
  </svg>
);
const Chevron = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ease-out", open && "rotate-90")}
  >
    <path d="M6 4l4 4-4 4" />
  </svg>
);

/** The marker in front of a step: its number while pending, then a spinner, check, dash or cross. */
function Marker({ status, n, small }: { status: PlanStepStatus; n?: number; small?: boolean }) {
  const box = cn("grid shrink-0 place-items-center rounded-full", small ? "size-4" : "size-5");
  if (status === "active")
    return (
      <span className={cn(box, "text-foreground")}>
        <Spinner label="" className={small ? "size-3" : "size-3.5"} />
      </span>
    );
  if (status === "done")
    return <span className={cn(box, "bg-emerald-500/12 text-emerald-600 motion-safe:animate-[knpl-pop_220ms_cubic-bezier(.22,1,.36,1)] dark:bg-emerald-400/14 dark:text-emerald-400")}><Check /></span>;
  if (status === "failed") return <span className={cn(box, "bg-red-500/12 text-red-600 dark:bg-red-400/14 dark:text-red-400")}><Cross /></span>;
  if (status === "skipped") return <span className={cn(box, "text-muted-foreground/70")}><Dash /></span>;
  return (
    <span
      className={cn(
        box,
        "text-[10.5px] font-medium tabular-nums text-muted-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_14%,transparent)]",
      )}
    >
      {small ? <span className="size-1 rounded-full bg-current opacity-60" /> : n}
    </span>
  );
}

type Row = { step: PlanStep; leaving?: boolean };

/** Keeps removed steps on screen for a moment so they can fade out where they were. */
function usePresence(list: PlanStep[], reduced: boolean): Row[] {
  const prev = useRef(list);
  const [leaving, setLeaving] = useState<{ step: PlanStep; after: string | null }[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = list;
    if (reduced) return;
    const ids = new Set(list.map((s) => s.id));
    const gone = before.filter((s) => !ids.has(s.id)).map((s) => ({ step: s, after: before[before.indexOf(s) - 1]?.id ?? null }));
    if (!gone.length) return;
    setLeaving((l) => [...l.filter((x) => !ids.has(x.step.id) && !gone.some((g) => g.step.id === x.step.id)), ...gone]);
    timers.current.push(setTimeout(() => setLeaving((l) => l.filter((x) => !gone.some((g) => g.step.id === x.step.id))), LEAVE_MS));
  }, [list, reduced]);

  return useMemo(() => {
    const ids = new Set(list.map((s) => s.id));
    const rows: Row[] = list.map((step) => ({ step }));
    for (const g of leaving) {
      if (ids.has(g.step.id)) continue;
      const at = g.after === null ? 0 : rows.findIndex((r) => r.step.id === g.after) + 1;
      rows.splice(at > 0 || g.after === null ? at : rows.length, 0, { step: g.step, leaving: true });
    }
    return rows;
  }, [list, leaving]);
}

/** Slides rows to their new place when the order changes (FLIP with the Web Animations API). */
function useFlip(container: RefObject<HTMLElement | null>, reduced: boolean) {
  const tops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const next = new Map<string, number>();
    el.querySelectorAll<HTMLElement>("[data-step-row]").forEach((row) => {
      const id = row.dataset.stepRow!;
      const top = row.offsetTop;
      next.set(id, top);
      const was = tops.current.get(id);
      if (!reduced && was !== undefined && was !== top && typeof row.animate === "function")
        row.animate([{ transform: `translateY(${was - top}px)` }, { transform: "none" }], { duration: 320, easing: EASE });
    });
    tops.current = next;
  });
}

/** What changed since the last render, as one sentence for the live region. */
function useAnnouncement(steps: PlanStep[], on: boolean): string {
  const prev = useRef(new Map<string, PlanStepStatus>());
  const [text, setText] = useState("");
  useEffect(() => {
    const before = prev.current;
    const now = new Map(steps.map((s) => [s.id, statusOf(s)]));
    prev.current = now;
    if (!on || !before.size) return;
    const list = steps.filter((s) => !s.replacedBy);
    const changed = steps.find((s) => before.get(s.id) !== undefined && before.get(s.id) !== statusOf(s));
    const added = steps.filter((s) => !before.has(s.id));
    if (changed) {
      const n = list.indexOf(changed) + 1;
      const verb = { active: "started", done: "done", failed: "failed", skipped: "skipped", pending: "pending" }[statusOf(changed)];
      setText(`Step ${n > 0 ? n : ""} ${verb}: ${changed.title}`.replace("  ", " "));
    } else if (added.length) setText(`Plan changed: ${added.length} ${added.length === 1 ? "step" : "steps"} added`);
  }, [steps, on]);
  return text;
}

function StepRow({ row, n, now, fresh }: { row: Row; n: number | undefined; now: number; fresh: boolean }) {
  const { step } = row;
  const status = statusOf(step);
  const replaced = Boolean(step.replacedBy);
  const ms = elapsedOf(step, now);
  return (
    <li
      data-step-row={step.id}
      data-status={status}
      data-replaced={replaced || undefined}
      aria-label={`${replaced ? "Replaced" : STATUS_LABEL[status]}: ${step.title}`}
      className={cn(
        "relative flex gap-3 py-1.5",
        fresh && "motion-safe:animate-[knpl-in_300ms_cubic-bezier(.22,1,.36,1)_both]",
        row.leaving && "pointer-events-none motion-safe:animate-[knpl-out_280ms_cubic-bezier(.22,1,.36,1)_both]",
      )}
    >
      <span className="relative flex flex-col items-center pt-px">
        <Marker status={replaced ? "skipped" : status} n={n} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 text-[13.5px] leading-5",
              status === "active" ? "font-medium text-foreground" : "text-foreground/90",
              (status === "skipped" || replaced) && "text-muted-foreground",
              replaced && "line-through decoration-foreground/35",
              status === "failed" && "text-red-700 dark:text-red-300",
            )}
          >
            {step.title}
          </span>
          {replaced ? (
            <span className="shrink-0 text-[11.5px] text-muted-foreground">Replaced</span>
          ) : status === "skipped" ? (
            <span className="shrink-0 text-[11.5px] text-muted-foreground">Skipped</span>
          ) : ms !== undefined ? (
            <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground">{formatElapsed(ms)}</span>
          ) : null}
        </span>
        {step.detail && <span className={cn("mt-0.5 block truncate text-[12px] text-muted-foreground", replaced && "line-through decoration-foreground/25")}>{step.detail}</span>}
        {step.steps && step.steps.length > 0 && (
          <ol className="mt-1.5 flex flex-col gap-1 border-l border-[color-mix(in_srgb,var(--foreground)_9%,transparent)] pl-3">
            {step.steps.map((sub) => {
              const s = statusOf(sub);
              const sms = elapsedOf(sub, now);
              return (
                <li key={sub.id} data-status={s} aria-label={`${STATUS_LABEL[s]}: ${sub.title}`} className="flex items-center gap-2">
                  <Marker status={sub.replacedBy ? "skipped" : s} small />
                  <span className={cn("min-w-0 flex-1 truncate text-[12.5px]", s === "active" ? "text-foreground" : "text-muted-foreground", sub.replacedBy && "line-through")}>{sub.title}</span>
                  {sms !== undefined && s !== "skipped" && <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{formatElapsed(sms)}</span>}
                </li>
              );
            })}
          </ol>
        )}
      </span>
    </li>
  );
}

/**
 * The steps an agent intends to take, checked off live: numbered steps with states, sub-steps, elapsed times
 * and a progress bar. When the plan changes, new steps fade in, removed ones fade out, moved ones slide, and
 * replaced ones are struck through. Optionally asks for approval before it runs, and collapses to one line.
 */
export function AgentPlan({
  steps: stepsProp = NO_STEPS,
  run,
  actor,
  title = "Plan",
  goal,
  approval,
  onApprove,
  onEdit,
  approveLabel = "Approve plan",
  editLabel = "Edit plan",
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  collapsible = true,
  announce = true,
  now = Date.now,
  className,
}: AgentPlanProps) {
  const snap = useAgentSnapshot(run);
  const steps = useMemo(() => (snap ? mergeRun(stepsProp, snap.tasks, actor) : stepsProp), [snap, stepsProp, actor]);
  const reduced = useReducedMotion();
  const listRef = useRef<HTMLOListElement>(null);
  const rows = usePresence(steps, reduced);
  useFlip(listRef, reduced);

  // Steps that appear after the first render animate in; the first render does not.
  const known = useRef<Set<string> | null>(null);
  if (known.current === null) known.current = new Set(steps.map((s) => s.id));
  const fresh = useRef(new Set<string>());
  for (const s of steps) if (!known.current.has(s.id)) {
    known.current.add(s.id);
    fresh.current.add(s.id);
  }

  const [localCollapsed, setLocalCollapsed] = useState(defaultCollapsed);
  const collapsed = collapsedProp ?? localCollapsed;
  const toggle = () => {
    const next = !collapsed;
    if (collapsedProp === undefined) setLocalCollapsed(next);
    onCollapsedChange?.(next);
  };

  const progress = planProgress(steps);
  const state = planState(steps);
  const anyActive = steps.some((s) => statusOf(s) === "active" || s.steps?.some((x) => statusOf(x) === "active"));
  const t = useTick(anyActive, now);
  const message = useAnnouncement(steps, announce);

  const pending = approval ? snap?.approvals.find((a) => a.id === approval && !a.decision) : undefined;
  const asking = approval ? Boolean(pending) : Boolean(onApprove) && state === "proposed";
  const decide = (decision: "approved" | "denied") => {
    if (pending && run) run.emit({ type: "approval.resolve", id: pending.id, decision });
    if (decision === "approved") onApprove?.();
    else onEdit?.();
  };

  const startedAt = Math.min(...steps.map((s) => s.startedAt ?? Infinity));
  const endedAt = state === "done" || state === "failed" ? Math.max(...steps.map((s) => s.endedAt ?? s.startedAt ?? 0)) : t;
  const total = Number.isFinite(startedAt) ? formatElapsed(endedAt - startedAt) : undefined;

  const bodyId = useId();
  const summary = planSummary(steps);
  let n = 0;

  const header = (
    <>
      {collapsible && <Chevron open={!collapsed} />}
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground">{title}</span>
      <span
        className={cn(
          "shrink-0 rounded-full px-1.5 py-px text-[11px] font-medium",
          state === "running" && "bg-sky-500/10 text-sky-700 dark:text-sky-300",
          state === "done" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
          state === "failed" && "bg-red-500/10 text-red-700 dark:text-red-300",
          state === "proposed" && "bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] text-muted-foreground",
        )}
      >
        {asking ? "Needs approval" : STATE_TEXT[state]}
      </span>
      <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
        {progress.done}/{progress.total}
        {total && <span className="ml-2">{total}</span>}
      </span>
    </>
  );

  return (
    <section
      aria-label={typeof title === "string" ? title : "Plan"}
      className={cn(
        "w-full rounded-[14px] bg-card text-card-foreground",
        "shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_8%,transparent),0_1px_2px_rgb(0_0_0/0.04),inset_0_1px_0_color-mix(in_srgb,white_4%,transparent)]",
        "dark:bg-[color-mix(in_srgb,var(--muted)_30%,var(--card))]",
        className,
      )}
    >
      <style href="kn-agent-plan" precedence="default">
        {CSS}
      </style>
      {collapsible ? (
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={toggle}
          className={cn("flex w-full items-center gap-2 rounded-[14px] px-4 pt-3.5 text-left", collapsed ? "pb-3.5" : "pb-2", focusRing)}
        >
          {header}
        </button>
      ) : (
        <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">{header}</div>
      )}

      {/* Progress: a hairline track with a bar that grows by transform. */}
      <div
        role="progressbar"
        aria-label="Plan progress"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
        aria-valuetext={summary}
        className="mx-4 h-[3px] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]"
      >
        <div
          className={cn(
            "h-full w-full origin-left rounded-full transition-transform duration-500",
            state === "failed" ? "bg-red-500/80" : state === "done" ? "bg-emerald-500/85" : "bg-foreground/70",
          )}
          style={{ transform: `scaleX(${progress.ratio})`, transitionTimingFunction: EASE }}
        />
      </div>

      <div id={bodyId}>
        {collapsed ? (
          <p className="flex items-center gap-2 px-4 pt-2.5 pb-3.5 text-[12.5px] text-muted-foreground">
            {state === "done" ? <Marker status="done" small /> : progress.current && <Marker status={statusOf(progress.current)} n={progress.index} small />}
            <span className="min-w-0 truncate">{summary}</span>
          </p>
        ) : (
          <>
            {goal && <p className="px-4 pt-2.5 text-[12.5px] leading-relaxed text-muted-foreground">{goal}</p>}
            <ol ref={listRef} className="relative flex flex-col px-4 pt-2 pb-3">
              {rows.map((row) => {
                const counted = !row.step.replacedBy && !row.leaving;
                if (counted) n++;
                return <StepRow key={row.step.id} row={row} n={counted ? n : undefined} now={t} fresh={fresh.current.has(row.step.id)} />;
              })}
              {rows.length === 0 && <li className="py-2 text-[12.5px] text-muted-foreground">No steps yet.</li>}
            </ol>
          </>
        )}
        {asking && (
          <div className="flex items-center justify-end gap-2 border-t border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] px-4 py-3">
            {(onEdit || pending) && (
              <Button variant="secondary" size="sm" onClick={() => decide("denied")}>
                {editLabel}
              </Button>
            )}
            <Button size="sm" onClick={() => decide("approved")}>
              {approveLabel}
            </Button>
          </div>
        )}
      </div>

      <span className="sr-only" aria-live="polite">
        {message}
      </span>
    </section>
  );
}

export default AgentPlan;
