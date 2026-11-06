"use client";
/** @registry name="agent-fleet" type="ui" title="Agent fleet" description="Many agents at a glance: a row (or card) per main agent with model, task, state, spend and clock, totals on top, and a sub-agent tree that unfolds under it with approve and retry right in it." */

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type CSSProperties,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";
import { cn, focusRing, localRect } from "@/registry/knowns/lib/knowns/utils";
import { modelIcon } from "@/registry/knowns/lib/knowns/icons/model-icons";
import { toolMark } from "@/registry/knowns/lib/knowns/icons/tool-icons";
import { formatUsd } from "@/registry/knowns/lib/knowns/status";
import type { AgentRun } from "@/registry/knowns/lib/knowns/run";
import type { AgentSnapshot } from "@/registry/knowns/lib/knowns/types";
import { Button } from "../button";
import { Toggle } from "../toggle-group";
import { Dialog } from "../dialog";
import { StatusDot, type StatusDotState } from "../status-dot";
import { useFloating } from "../use-floating";
import {
  FLEET_LABEL,
  belowPoints,
  depthMap,
  dropPoints,
  elapsed,
  findPath,
  fleetFromSnapshot,
  fleetTotals,
  formatDuration,
  fleetColumns,
  hiddenStats,
  inlineExpanded,
  mainSummary,
  roundedPath,
  rowEnd,
  treeKey,
  treeLeft,
  treeSpend,
  visibleRows,
  walk,
  type FleetAction,
  type FleetAgent,
  type FleetState,
  type FleetStep,
  type Pt,
  type SummaryTone,
} from "./fleet-utils";

export type { FleetAction, FleetAgent, FleetState, FleetStep } from "./fleet-utils";

export interface AgentFleetProps {
  /** Main agents with their sub-agent trees. */
  agents?: FleetAgent[];
  /** Or one card per run: the root agent is the card, the other agents its tree. Shown after `agents`. */
  runs?: AgentRun[];
  /** Id of the agent whose tree is open (null: none). */
  open?: string | null;
  defaultOpen?: string | null;
  onOpenChange?: (id: string | null) => void;
  /** A main card was clicked. */
  onSelect?: (agent: FleetAgent) => void;
  /**
   * Enables Answer (Approve / Reject) on waiting agents and Retry / Dismiss on failed ones. For agents
   * from a run, Approve / Reject also emit approval.resolve on that run.
   */
  onResolve?: (agent: FleetAgent, action: FleetAction) => void;
  /** Clock time (epoch ms). Default: ticks every second while something is live. */
  now?: number;
  formatCost?: (usd: number) => string;
  title?: ReactNode;
  /** "compact" (default): 14px titles, 12-16px padding, 3-4 cards a row on a wide page. "comfortable": larger cards. */
  density?: FleetDensity;
  /**
   * "list" (default): one agent per row in a single column; opening a row unfolds its sub-agent tree
   * right under it. "grid": cards side by side, the open card's tree in a row of its own.
   */
  layout?: FleetLayout;
  className?: string;
}

export type FleetLayout = "list" | "grid";

export type FleetDensity = "compact" | "comfortable";

/* ── Tokens ── */

const EASE = "cubic-bezier(.22,1,.36,1)";
/** Indent per nesting level. */
const NEST = 56;
/** Indent of the tree from the left edge of its main card. */
const TREE_INDENT = 48;
/** Gap between cards in the grid. */
const GAP = 12;
/** Levels shown inline under the panel's top (children + grandchildren); deeper ones collapse into a chip. */
const INLINE = 2;
/** "Expand all" shows this many levels. */
const EXPAND_MAX = 4;
/** Below this viewport width, tasks open as a bottom sheet instead of a popover. */
const SHEET_BELOW = 640;

/** Sizes per density. `min` / `max` bound a card's width in the grid; `sub` / `subMin` size the sub-agent cards. */
const DENSITY = {
  compact: {
    min: 248,
    max: 480,
    sub: 360,
    subMin: 264,
    pad: "p-3.5",
    gap: "gap-2.5",
    logo: "size-8 rounded-lg [&>*]:size-4",
    name: "text-[14px] leading-5",
    model: "text-[12.5px] leading-[18px]",
    pill: "h-5.5 gap-1 px-1.5 text-[12px] [&_svg]:size-3",
    task: "text-[13px]",
    row: "h-6",
    foot: "text-[12.5px]",
    chip: "h-6",
  },
  comfortable: {
    min: 320,
    max: 560,
    sub: 460,
    subMin: 300,
    pad: "p-5",
    gap: "gap-3.5",
    logo: "size-10 rounded-xl [&>*]:size-5",
    name: "text-[16px] leading-6",
    model: "text-[13.5px] leading-5",
    pill: "h-6.5 gap-1.5 px-2 text-[13px] [&_svg]:size-3.5",
    task: "text-[14.5px]",
    row: "h-7",
    foot: "text-[13.5px]",
    chip: "h-7",
  },
} as const;
type Sizes = (typeof DENSITY)[FleetDensity];

/* Quiet surface: faint hairline, a thin inner top light, a deeper card in dark mode. */
const CARD = cn(
  "relative rounded-xl border [border-color:color-mix(in_srgb,var(--foreground)_8%,transparent)] bg-card",
  "shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_5%,transparent),0_1px_2px_rgb(0_0_0/0.04)]",
  "dark:[background:color-mix(in_srgb,var(--card)_70%,#000)] dark:shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_7%,transparent),0_8px_20px_-12px_rgb(0_0_0/0.5)]",
);
/* List layout: an opaque surface colour and guide colour, so overlapping guide segments never darken. */
const LIST_SURFACE = "[--fleet-bg:var(--card)] dark:[--fleet-bg:color-mix(in_srgb,var(--card)_70%,#000)] [--fleet-guide:color-mix(in_srgb,var(--foreground)_18%,var(--fleet-bg))]";
/**
 * A tree item in the list: a guide segment down its left edge and an elbow into its row (20px down: the
 * row's 8px padding plus half its 24px mark). The segment reaches up by --fleet-up, far enough to meet the
 * parent's mark at any width, and the last item's stops at its elbow. Plain CSS in the item's own box:
 * nothing is measured, so zoom and transforms can't move it.
 */
const GUIDE_ITEM =
  "relative pl-6 before:absolute before:left-0 before:top-[calc(-1*var(--fleet-up))] before:h-[calc(100%+var(--fleet-up))] before:w-px before:bg-[var(--fleet-guide)] last:before:h-[calc(var(--fleet-up)+20px)] after:absolute after:left-0 after:top-5 after:h-px after:w-5 after:bg-[var(--fleet-guide)]";
/** The trunk past a breadcrumb or notice above the tree (no elbow; reaches across the 10px gap below). */
const GUIDE_TRUNK = "relative pl-6 before:absolute before:left-0 before:top-[calc(-1*var(--fleet-up))] before:h-[calc(100%+var(--fleet-up)+10px)] before:w-px before:bg-[var(--fleet-guide)]";
/*
 * List columns, shared by main and sub-rows: mark, name, task, then status 6.25rem, needs you 7.5rem,
 * spend 4.5rem, clock 3.5rem against the same right edge. A sub-row's name column gives up its indent.
 */
/** Where the task column starts in a main row: 16px padding + 32px mark + 12 + 11rem name + 12. */
const LIST_TASK_X = 16 + 32 + 12 + 176 + 12;
/** A first-level sub-row's content edge (tree indent 32 + item 24 + row padding 8), and each level deeper (20 + 24). */
const SUB_LEFT = 64;
const SUB_STEP = 44;
const ROW_HOVER = "transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--foreground)_3.5%,transparent)]";

const WIRE = "[--fleet-wire:rgb(59_110_230/0.6)] dark:[--fleet-wire:rgb(120_156_255/0.72)] [--fleet-head:rgb(59_110_230)] dark:[--fleet-head:rgb(190_210_255)]";

const PILL: Record<FleetState, string> = {
  running: "bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
  done: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300",
  waiting: "bg-amber-500/12 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  failed: "bg-red-500/10 text-red-700 dark:bg-red-400/15 dark:text-red-300",
  queued: "bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] text-muted-foreground",
  stopped: "bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] text-muted-foreground",
};
const SUMMARY_TEXT: Record<SummaryTone, string> = {
  waiting: "text-amber-700 dark:text-amber-300",
  failed: "text-red-700 dark:text-red-300",
  running: "text-muted-foreground",
  done: "text-muted-foreground",
  none: "text-muted-foreground",
};
const DOT: Record<FleetState, StatusDotState> = { queued: "idle", running: "busy", waiting: "blocked", done: "finished", failed: "failed", stopped: "idle" };

/* ── Hooks ── */

const NO_RUNS: AgentRun[] = [];

/** Snapshots of several runs, re-rendering when any of them changes. */
function useRunSnapshots(runs: AgentRun[] | undefined): AgentSnapshot[] {
  const list = runs ?? NO_RUNS;
  const cache = useRef<{ runs: AgentRun[]; snaps: AgentSnapshot[] }>({ runs: NO_RUNS, snaps: [] });
  const subscribe = useCallback(
    (cb: () => void) => {
      const offs = list.map((r) => r.subscribe(cb));
      return () => offs.forEach((off) => off());
    },
    [list],
  );
  const get = useCallback(() => {
    const next = list.map((r) => r.getSnapshot());
    const c = cache.current;
    if (c.runs === list && c.snaps.length === next.length && next.every((s, i) => s === c.snaps[i])) return c.snaps;
    cache.current = { runs: list, snaps: next };
    return next;
  }, [list]);
  return useSyncExternalStore(subscribe, get, get);
}

function useNow(on: boolean, fixed?: number) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    if (!on || fixed !== undefined) return;
    setT(Date.now());
    const id = setInterval(() => setT(Date.now()), 1000);
    return () => clearInterval(id);
  }, [on, fixed]);
  return fixed ?? t;
}

function useReducedMotion() {
  const [r, setR] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = () => setR(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return r;
}

/* ── Glyphs ── */

const S = { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const Spinner = () => (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden className="animate-spin [animation-duration:1.1s] motion-reduce:animate-none">
    <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeOpacity=".28" strokeWidth="1.8" />
    <path d="M8 2.25a5.75 5.75 0 0 1 5.75 5.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const Check = () => (
  <svg {...S} strokeWidth={1.9}>
    <path d="m3.75 8.5 2.75 2.75 5.75-6.5" />
  </svg>
);
const Clock = () => (
  <svg {...S}>
    <circle cx="8" cy="8" r="5.75" />
    <path d="M8 5v3.25l2 1.25" />
  </svg>
);
const Cross = () => (
  <svg {...S}>
    <circle cx="8" cy="8" r="5.75" />
    <path d="m6 6 4 4m0-4-4 4" />
  </svg>
);
const Ring = () => (
  <svg {...S}>
    <circle cx="8" cy="8" r="5.75" />
    <circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" />
  </svg>
);
const Sparkle = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path d="M6.5 1.5c.3 2.6 1.4 3.9 4 4.25-2.6.35-3.7 1.65-4 4.25-.3-2.6-1.4-3.9-4-4.25 2.6-.35 3.7-1.65 4-4.25zM12 9.5c.15 1.3.7 1.95 2 2.1-1.3.2-1.85.85-2 2.15-.15-1.3-.7-1.95-2-2.15 1.3-.15 1.85-.8 2-2.1z" />
  </svg>
);
const SparkGlyph = () => (
  <svg {...S}>
    <path d="M8 2.25 9.3 6.7l4.45 1.3-4.45 1.3L8 13.75 6.7 9.3 2.25 8l4.45-1.3L8 2.25z" />
  </svg>
);
const TaskGlyph = () => (
  <svg {...S}>
    <rect x="3" y="2.75" width="10" height="10.5" rx="2" />
    <path d="M5.75 6.25h4.5M5.75 9h3" />
  </svg>
);
const ChevronRight = () => (
  <svg {...S}>
    <path d="m6 4 4 4-4 4" />
  </svg>
);

const PILL_ICON: Record<FleetState, () => ReactNode> = { running: Spinner, done: Check, waiting: Clock, failed: Cross, queued: Ring, stopped: Ring };
const SUMMARY_ICON: Record<SummaryTone, () => ReactNode> = { waiting: Clock, failed: Cross, running: Ring, done: Check, none: Ring };

/* ── Card parts ── */

function Logo({ agent, z, size }: { agent: FleetAgent; z: Sizes; size?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid flex-none place-items-center border [border-color:color-mix(in_srgb,var(--foreground)_7%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] text-muted-foreground [&_svg]:size-full",
        size ?? z.logo,
      )}
    >
      {agent.icon ?? modelIcon(agent.model ?? agent.name) ?? <SparkGlyph />}
    </span>
  );
}

function Pill({ state, z }: { state: FleetState; z: Sizes }) {
  const Icon = PILL_ICON[state];
  return (
    <span className={cn("inline-flex flex-none items-center rounded-md font-medium whitespace-nowrap", z.pill, PILL[state])}>
      <Icon />
      {FLEET_LABEL[state]}
    </span>
  );
}

function ToolTile({ tool }: { tool?: string }) {
  return (
    <span
      aria-hidden
      title={tool}
      className="grid size-6 flex-none place-items-center rounded-md border [border-color:color-mix(in_srgb,var(--foreground)_8%,transparent)] bg-card text-muted-foreground [&>*]:size-4 [&_svg]:size-full dark:[background:color-mix(in_srgb,var(--card)_80%,#000)]"
    >
      {(tool && toolMark(tool)) ?? <TaskGlyph />}
    </span>
  );
}

/** A joined chip of tool logos. */
function ToolChip({ tools, max = 3, z }: { tools: string[]; max?: number; z: Sizes }) {
  if (!tools.length) return null;
  return (
    <span
      aria-label={`Tools: ${tools.join(", ")}`}
      className={cn("inline-flex flex-none items-center gap-1 rounded-md border [border-color:color-mix(in_srgb,var(--foreground)_8%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] px-1", z.chip)}
    >
      {tools.slice(0, max).map((t) => {
        const mark = toolMark(t);
        // A 16px mark, or the name when there is no square mark (wordmarks like Stripe, unknown tools).
        return mark ? (
          <span key={t} aria-hidden title={t} className="grid size-4 flex-none place-items-center text-muted-foreground [&>*]:size-full [&_svg]:size-full">
            {mark}
          </span>
        ) : (
          <span key={t} aria-hidden title={t} className="max-w-[72px] truncate px-0.5 text-[11.5px] font-medium text-muted-foreground">
            {t}
          </span>
        );
      })}
      {tools.length > max && (
        <span aria-hidden className="pl-0.5 text-[11px] text-muted-foreground tabular-nums">
          +{tools.length - max}
        </span>
      )}
    </span>
  );
}

/** What an agent is on: its error, the question it's waiting on, or its task. */
const taskOf = (agent: FleetAgent) =>
  agent.state === "failed" && agent.error ? agent.error : agent.state === "waiting" && agent.request ? agent.request.title : (agent.task ?? (agent.state === "queued" ? "Waiting to start" : "No current task"));

/** Same anatomy for main and sub-agents: logo, name + model, pill · tools + task · footer. */
function CardBody({ agent, tools, footerLeft, footerRight, z }: { agent: FleetAgent; tools: string[]; footerLeft: ReactNode; footerRight: ReactNode; z: Sizes }) {
  const task = taskOf(agent);
  return (
    <span className={cn("flex min-w-0 flex-col", z.gap)}>
      <span data-anchor="title" className="flex min-w-0 items-start gap-2.5">
        <Logo agent={agent} z={z} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn("truncate font-semibold text-foreground", z.name)}>{agent.name}</span>
          <span className={cn("truncate text-muted-foreground", z.model)}>{agent.model ?? "Agent"}</span>
        </span>
        <Pill state={agent.state} z={z} />
      </span>
      <span data-anchor="task" className={cn("flex min-w-0 items-center gap-2", z.row)}>
        <ToolChip tools={tools} z={z} />
        <span className={cn("min-w-0 truncate", z.task, agent.state === "failed" ? "text-red-700 dark:text-red-300" : "text-foreground/80")} title={task}>
          {task}
        </span>
      </span>
      <span className={cn("flex min-w-0 items-center justify-between gap-3 tabular-nums", z.row, z.foot)}>
        {footerLeft}
        {footerRight}
      </span>
    </span>
  );
}

function CostTime({ cost, time }: { cost: string; time: string }) {
  return (
    <span className="flex-none whitespace-nowrap">
      <span className="font-medium text-foreground">{cost}</span>
      {time && <span className="text-muted-foreground"> · {time}</span>}
    </span>
  );
}

const stop = (e: SyntheticEvent) => e.stopPropagation();

/* ── Tasks popover ── */

function TasksPopover({
  agent,
  anchor,
  now,
  resolve,
  onClose,
}: {
  agent: FleetAgent;
  anchor: HTMLElement;
  now: number;
  resolve?: (a: FleetAgent, action: FleetAction) => void;
  onClose: (refocus: boolean) => void;
}) {
  const { triggerRef, floatingRef, style, portalHost, ready } = useFloating<HTMLElement, HTMLDivElement>({ open: true, side: "bottom", align: "start", offset: 8 });
  triggerRef.current = anchor;
  const list = useRef<HTMLUListElement>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const known = useRef<Set<string> | null>(null);
  const steps = agent.steps ?? [];
  const done = steps.filter((s) => s.state === "done").length;
  const waiting = agent.state === "waiting" && agent.request;

  // Rows that arrive while it's open rise in; the first batch doesn't.
  const fresh = (id: string) => known.current !== null && !known.current.has(id);
  useEffect(() => {
    known.current = new Set(steps.map((s) => s.id));
  });

  useEffect(() => {
    if (ready) list.current?.querySelector<HTMLElement>("[data-task-row]")?.focus({ preventScroll: true });
  }, [ready]);

  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (floatingRef.current?.contains(t) || anchor.contains(t)) return;
      close.current(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      close.current(true);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [anchor, floatingRef]);

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const rows = [...(list.current?.querySelectorAll<HTMLElement>("[data-task-row]") ?? [])];
    const i = rows.indexOf(document.activeElement as HTMLElement);
    const go = (j: number) => {
      e.preventDefault();
      rows[Math.max(0, Math.min(rows.length - 1, j))]?.focus();
    };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(rows.length - 1);
    else if (e.key === "Tab") close.current(false);
  };

  const width = Math.min(anchor.offsetWidth + 110, window.innerWidth - 16);
  const row = (s: FleetStep) => {
    const time = s.startedAt !== undefined ? formatDuration((s.endedAt ?? now) - s.startedAt) : "";
    const expanded = openRow === s.id && !!s.summary;
    return (
      <li
        key={s.id}
        data-task-row
        tabIndex={-1}
        aria-label={`${s.title}, ${s.state === "running" ? "running" : s.state === "failed" ? "failed" : "done"}${time ? `, ${time}` : ""}`}
        aria-expanded={s.summary ? expanded : undefined}
        onClick={() => setOpenRow(expanded ? null : s.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpenRow(expanded ? null : s.id);
          }
        }}
        className={cn(
          "flex min-h-11 cursor-default flex-col justify-center rounded-lg px-2.5 py-1.5 outline-none",
          "transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] focus-visible:shadow-[inset_0_0_0_1.5px_var(--fleet-wire)]",
          s.summary && "cursor-pointer",
          fresh(s.id) && "animate-[kn-rise_200ms_cubic-bezier(.22,1,.36,1)_both] motion-reduce:animate-none",
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          <ToolTile tool={s.tool} />
          <span className="min-w-0 flex-1 truncate text-[14px] text-foreground/90">{s.title}</span>
          {s.state === "running" ? (
            <span className="flex flex-none items-center gap-1.5 text-[13px] text-blue-700 tabular-nums dark:text-blue-300 [&_svg]:size-3.5">
              <Spinner />
              {time}
            </span>
          ) : s.state === "failed" ? (
            <span className="flex flex-none items-center gap-1.5 text-[13px] text-red-700 dark:text-red-300 [&_svg]:size-3.5">
              <Cross />
              Failed
            </span>
          ) : (
            <span className="flex-none text-[13px] text-muted-foreground tabular-nums">{time}</span>
          )}
        </span>
        {expanded && <span className="pt-1 pl-9 text-[13px] leading-snug text-muted-foreground">{s.summary}</span>}
      </li>
    );
  };

  if (!portalHost) return null;
  return createPortal(
    <div
      ref={floatingRef}
      role="dialog"
      aria-label={`Tasks of ${agent.name}`}
      style={{ ...style, width }}
      className={cn(
        "z-[60] flex flex-col gap-2 overflow-auto rounded-2xl bg-popover p-2 pt-3 text-popover-foreground",
        "shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_10%,transparent),0_18px_40px_-14px_rgb(0_0_0/0.4),0_2px_6px_rgb(0_0_0/0.08)]",
        "dark:[background:color-mix(in_srgb,var(--popover)_80%,#000)]",
        ready && "animate-[kn-rise_160ms_cubic-bezier(.22,1,.36,1)_both] motion-reduce:animate-none",
      )}
    >
      <div className="flex items-baseline justify-between px-2.5">
        <span className="text-[14.5px] font-semibold text-foreground">Tasks</span>
        <span className="text-[13px] text-muted-foreground tabular-nums">
          {steps.length ? `${done}/${steps.length} done` : "No tasks yet"}
        </span>
      </div>
      <ul
        ref={list}
        onKeyDown={onListKey}
        className="flex flex-col gap-0.5 rounded-xl bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] p-1.5 shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)] dark:bg-[color-mix(in_srgb,#000_28%,transparent)]"
      >
        {steps.map(row)}
        {waiting && (
          <li data-task-row tabIndex={-1} className="flex min-h-11 flex-wrap items-center gap-3 rounded-lg px-2.5 py-1.5 outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--fleet-wire)]">
            <span className="grid size-6 flex-none place-items-center rounded-md bg-amber-500/12 text-amber-700 dark:text-amber-300 [&_svg]:size-3.5">
              <Clock />
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px] text-foreground/90">{agent.request!.title}</span>
            {resolve ? (
              <span className="flex flex-none gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => resolve(agent, "reject")}>
                  Reject
                </Button>
                <Button size="sm" onClick={() => resolve(agent, "approve")}>
                  Approve
                </Button>
              </span>
            ) : (
              <span className="text-[13px] font-medium text-amber-700 dark:text-amber-300">Needs you</span>
            )}
          </li>
        )}
        {!steps.length && !waiting && <li className="px-2.5 py-3 text-[13.5px] text-muted-foreground">{agent.name} hasn't started a task.</li>}
      </ul>
    </div>,
    portalHost,
  );
}

/* ── Connectors ── */

interface Wire {
  /** Child agent id. */
  id: string;
  parent: string;
  d: string;
  /** Geometric length, for an even draw speed. */
  len: number;
  running: boolean;
}
interface Dot {
  id: string;
  x: number;
  y: number;
}

const lengthOf = (pts: Pt[]) => pts.slice(1).reduce((n, p, i) => n + Math.abs(p.x - pts[i].x) + Math.abs(p.y - pts[i].y), 0);

/* ── Fleet ── */

/**
 * Many main agents at a glance: a quiet summary line, main agent cards on the left, and the open
 * agent's sub-agents on the right (or below, when narrow) as the same cards, joined by connectors
 * that grow from the parent into each child. Deep trees collapse past two levels; drill in to see more.
 */
export function AgentFleet({
  agents,
  runs,
  open: openProp,
  defaultOpen = null,
  onOpenChange,
  onSelect,
  onResolve,
  now: nowProp,
  formatCost = formatUsd,
  title = "Fleet",
  density = "compact",
  layout = "list",
  className,
}: AgentFleetProps) {
  const list = layout === "list";
  const z = DENSITY[density];
  const snaps = useRunSnapshots(runs);
  const fleet = useMemo(() => {
    const fromRuns = snaps.map((s, i) => fleetFromSnapshot(s, runs?.[i], `r${i}:`)).filter((a): a is FleetAgent => !!a);
    return [...(agents ?? []), ...fromRuns];
  }, [agents, snaps, runs]);

  const [ownOpen, setOwnOpen] = useState<string | null>(defaultOpen);
  const openId = openProp !== undefined ? openProp : ownOpen;
  const live = fleet.some((a) => walk(a).some((x) => x.state === "running" || x.state === "waiting"));
  const now = useNow(live, nowProp);
  const reduced = useReducedMotion();
  const totals = fleetTotals(fleet);
  const treeId = useId();
  const labelId = useId();

  /* Layout: cards in an auto-fill grid; the open card's tree gets its own row right under that card's row. */
  const root = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  // One column count for the CSS grid and for where the tree row goes, so they always agree.
  const cols = width ? fleetColumns(width, fleet.length, z.min, z.max, GAP) : 1;

  /* What the panel shows: `shown` (lags openId by the exit animation), drilled `path`, expand-all. */
  const [shownId, setShownId] = useState<string | null>(openId);
  const [path, setPath] = useState<string[]>([]);
  const [expandAll, setExpandAll] = useState(false);
  const [taskFor, setTaskFor] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const shown = fleet.find((a) => a.id === shownId) ?? null;
  const depths = useMemo(() => (shown ? depthMap(shown) : new Map<string, number>()), [shown]);
  const trail = shown && path.length ? findPath(shown, path[path.length - 1]) : [];
  const panelRoot = trail.length > 1 ? trail[trail.length - 1] : shown;
  const drilled = !!shown && !!panelRoot && panelRoot !== shown;
  const limit = expandAll ? EXPAND_MAX : INLINE;
  const expanded = useMemo(() => (panelRoot ? inlineExpanded(panelRoot, limit) : new Set<string>()), [panelRoot, limit]);
  const revealKey = `${shownId}|${path.join("/")}|${expandAll ? 1 : 0}`;
  const deepest = panelRoot ? Math.max(0, ...walk(panelRoot).map((a) => (depths.get(a.id) ?? 0) - (depths.get(panelRoot.id) ?? 0))) : 0;

  const treeCol = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const anims = useRef<Animation[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const enterFrom = useRef<"left" | "right" | null>(null);
  const cancelAnims = () => {
    anims.current.forEach((a) => a.cancel());
    anims.current = [];
  };
  /** Play the current tree out (fade + slide), then run `then`. Cancels anything still animating. */
  const playOut = (dir: "left" | "right", then: () => void) => {
    clearTimeout(timer.current);
    cancelAnims();
    const dx = dir === "left" ? -14 : 14;
    const out: Keyframe[] = reduced ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translateX(${dx}px)` }];
    const ms = reduced ? 140 : 180;
    for (const el of [treeCol.current, svg.current]) if (el) anims.current.push(el.animate(out, { duration: ms, easing: EASE, fill: "forwards" }));
    timer.current = setTimeout(then, ms);
  };

  useEffect(() => {
    if (openId === shownId) return;
    const swap = () => {
      setShownId(openId);
      setPath([]);
      setTaskFor(null);
    };
    if (shownId === null) return swap();
    playOut("left", swap);
    return () => clearTimeout(timer.current);
  }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Re-root the panel (drill in or back up), with a slide. */
  const navigate = (next: string[]) => {
    if (!shown) return;
    const deeper = next.length > path.length;
    setTaskFor(null);
    focusTree.current = true;
    playOut(deeper ? "left" : "right", () => {
      enterFrom.current = deeper ? "right" : "left";
      setPath(next);
    });
  };
  const drill = (id: string) => shown && navigate(findPath(shown, id).slice(1).map((a) => a.id));
  const up = () => drilled && navigate(path.slice(0, -1));

  /* Polite totals: only the counts people act on. */
  const [said, setSaid] = useState({ text: "", n: 0 });
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaid((s) => ({ text: `${totals.running} running, ${totals.waiting} ${totals.waiting === 1 ? "needs" : "need"} you`, n: s.n + 1 }));
  }, [totals.running, totals.waiting]);

  /* Open / close and focus. */
  const focusTree = useRef(false);
  const returnTo = useRef<string | null>(null);
  const setOpen = (id: string | null) => {
    if (openProp === undefined) setOwnOpen(id);
    onOpenChange?.(id);
  };
  const toggle = (a: FleetAgent) => {
    onSelect?.(a);
    const next = openId === a.id ? null : a.id;
    focusTree.current = next !== null;
    if (next === null) returnTo.current = a.id;
    setOpen(next);
  };
  const close = () => {
    if (!openId) return;
    returnTo.current = openId;
    setOpen(null);
  };
  useLayoutEffect(() => {
    if (openId !== null || !returnTo.current) return;
    const id = returnTo.current;
    returnTo.current = null;
    root.current?.querySelector<HTMLElement>(`[data-fleet-card="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  }, [openId]);

  /* Actions. */
  const resolve = onResolve
    ? (a: FleetAgent, action: FleetAction) => {
        if (a.source && a.request && (action === "approve" || action === "reject")) {
          a.source.run.emit({ type: "approval.resolve", id: a.request.id, decision: action === "approve" ? "approved" : "denied" });
        }
        onResolve(a, action);
      }
    : undefined;
  const [sheet, setSheet] = useState<FleetAgent | null>(null);
  const [asking, setAsking] = useState<FleetAgent | null>(null);
  const tasksAgent = taskFor && shown ? (walk(shown).find((a) => a.id === taskFor.id) ?? null) : null;

  /** Open / close the Tasks popover for a sub-agent (a bottom sheet on small screens). */
  const toggleTasks = (a: FleetAgent, anchor: HTMLElement | null) => {
    if (typeof window !== "undefined" && window.innerWidth < SHEET_BELOW) return setSheet(a);
    if (!anchor) return;
    setTaskFor((t) => (t?.id === a.id ? null : { id: a.id, anchor }));
  };
  const closeTasks = (refocus: boolean) => {
    const id = taskFor?.id;
    setTaskFor(null);
    if (refocus && id) root.current?.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  };

  /* ── Measure connectors from the card rects ── */

  const wrap = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<{ key: string; for: string; wires: Wire[]; dots: Dot[]; left: number }>({ key: "", for: "", wires: [], dots: [], left: 0 });
  const [, bump] = useState(0);
  useLayoutEffect(() => {
    const w = wrap.current;
    if (!w) return;
    const ro = new ResizeObserver(() => bump((n) => n + 1));
    ro.observe(w);
    return () => ro.disconnect();
  }, [fleet.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const w = wrap.current;
    if (!w || !shown || !panelRoot || list) {
      if (geo.key) setGeo({ key: "", for: "", wires: [], dots: [], left: 0 });
      return;
    }
    // Everything in the wrapper's layout px (what the SVG draws in), so CSS zoom or a scaled parent can't shift the lines.
    const wrapW = w.offsetWidth;
    // The tree column may be mid-slide (a transform): measure where its cards will settle.
    const col = treeCol.current;
    const t = col ? getComputedStyle(col).transform : "none";
    const slide = t && t !== "none" ? new DOMMatrixReadOnly(t).f : 0;
    const dy = (el: Element) => (slide && col?.contains(el) ? slide : 0);
    const box = (el: Element) => {
      const r = localRect(el, w);
      const o = dy(el);
      return { left: r.left, right: r.right, top: r.top - o, bottom: r.bottom - o };
    };
    const midY = (card: Element, which: "title" | "task") => {
      const a = card.querySelector(`[data-anchor="${which}"]`) ?? card;
      const r = localRect(a, w);
      return r.top + r.height / 2 - dy(card);
    };
    const wires: Wire[] = [];
    const dots: Dot[] = [];
    const mainEl = w.querySelector(`[data-fleet-card="${CSS.escape(shown.id)}"]`);
    // The tree sits under the open card, indented from it, pulled in from the right edge so it fits.
    const left = mainEl ? treeLeft(box(mainEl).left, wrapW, z.sub, TREE_INDENT) : 0;
    // A dot on the parent's bottom edge, under its logo.
    const logoX = density === "compact" ? 30 : 40;

    const group = (parent: FleetAgent, kids: FleetAgent[], parentEl: Element, top: boolean) => {
      const kidEls = kids.map((k) => w.querySelector(`[data-fleet-node="${CSS.escape(k.id)}"]`));
      if (!kidEls.some(Boolean)) return; // collapsed: nothing drawn below
      const P = box(parentEl);
      const from: Pt = { x: P.left + logoX, y: P.bottom };
      dots.push({ id: parent.id, ...from });
      kids.forEach((k, i) => {
        const el = kidEls[i];
        if (!el) return;
        const C = box(el);
        const to: Pt = { x: C.left, y: midY(el, "title") };
        // From a main card the wire may have to step left in the gap under the card's row.
        const pts = top ? dropPoints(from, to, P.bottom + 10) : belowPoints(from, to);
        wires.push({ id: k.id, parent: parent.id, d: roundedPath(pts, 12), len: lengthOf(pts), running: k.state === "running" });
        group(k, k.children ?? [], el, false);
      });
    };
    // Drilled: the main card connects to the panel's top card, which connects to its own children.
    if (mainEl) group(shown, drilled ? [panelRoot] : (shown.children ?? []), mainEl, true);
    const key = JSON.stringify([revealKey, left, wires.map((x) => [x.id, x.d, x.running]), dots]);
    if (key !== geo.key) setGeo({ key, for: revealKey, wires, dots, left });
  });

  /* ── Reveal: the line grows from the parent's dot into each child; the child arrives with it ── */

  const revealed = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!shown || !treeCol.current) {
      revealed.current = null;
      return;
    }
    if (list) {
      // The guides are part of each row, so the tree simply arrives: a short fade, rows staggered.
      if (revealed.current === revealKey) return;
      revealed.current = revealKey;
      cancelAnims();
      const col = treeCol.current;
      const from = enterFrom.current;
      enterFrom.current = null;
      const go = (el: Element, k: Keyframe[], o: KeyframeAnimationOptions) => anims.current.push(el.animate(k, { easing: EASE, fill: "both", ...o }));
      if (reduced) {
        go(col, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
        return;
      }
      const sx = from ? (from === "right" ? 14 : -14) : 0;
      go(col, [{ opacity: 0, transform: `translate(${sx}px, ${sx ? 0 : -4}px)` }, { opacity: 1, transform: "none" }], { duration: 240 });
      col.querySelectorAll("[data-fleet-node]").forEach((el, i) => i < 10 && go(el, [{ opacity: 0, transform: "translateX(-6px)" }, { opacity: 1, transform: "none" }], { duration: 240, delay: 40 + i * 35 }));
      return;
    }
    const hasKids = drilled || !!shown.children?.length;
    if (revealed.current === revealKey || (hasKids && geo.for !== revealKey)) return;
    revealed.current = revealKey;
    cancelAnims();
    const run = (el: Element | null | undefined, k: Keyframe[], o: KeyframeAnimationOptions) => {
      if (el) anims.current.push(el.animate(k, { easing: EASE, fill: "both", ...o }));
    };
    const col = treeCol.current;
    const s = svg.current;
    const from = enterFrom.current;
    enterFrom.current = null;
    if (reduced) {
      run(col, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
      run(s, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
      return;
    }
    // Drilling: the new level slides in from its side while its connectors draw.
    const sx = from ? (from === "right" ? 18 : -18) : 0;
    if (sx) run(col, [{ transform: `translateX(${sx}px)` }, { transform: "none" }], { duration: 280 });
    col.querySelectorAll("[data-fleet-plain]").forEach((el) => run(el, [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 260 }));

    const SPEED = 1.5; // px per ms
    const dur = (len: number) => Math.max(150, Math.min(340, len / SPEED));
    const schedule = (parentId: string, start: number) => {
      run(s?.querySelector(`[data-dot="${CSS.escape(parentId)}"]`), [{ transform: "scale(0)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 180, delay: start });
      geo.wires
        .filter((wi) => wi.parent === parentId)
        .forEach((wi, i) => {
          const t = start + 70 + i * 60;
          const d = dur(wi.len);
          // pathLength=1: the line grows at an even pace along the trunk and around the elbow.
          run(s?.querySelector(`[data-wire="${CSS.escape(wi.id)}"]`), [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: d, delay: t, easing: "cubic-bezier(.4,0,.2,1)" });
          run(
            s?.querySelector(`[data-head="${CSS.escape(wi.id)}"]`),
            [
              { strokeDashoffset: 0.06, opacity: 1 },
              { strokeDashoffset: -0.88, opacity: 1, offset: 0.92 },
              { strokeDashoffset: -0.94, opacity: 0 },
            ],
            { duration: d, delay: t, easing: "cubic-bezier(.4,0,.2,1)" },
          );
          const arrive = t + d;
          const card = col.querySelector(`[data-fleet-node="${CSS.escape(wi.id)}"]`);
          run(card, [{ opacity: 0, transform: "translateX(-10px)" }, { opacity: 1, transform: "none" }], { duration: 260, delay: arrive - 50 });
          // A soft glow on the card's left edge as the line touches it.
          run(card?.querySelector("[data-contact]"), [{ opacity: 0 }, { opacity: 0.9, offset: 0.3 }, { opacity: 0 }], { duration: 560, delay: arrive - 30, fill: "none" });
          schedule(wi.id, arrive + 40);
        });
    };
    schedule(shown.id, 0);
  });
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      cancelAnims();
    },
    [],
  );

  /* Streaks on running connectors once drawn: a faint dash gliding from parent to child. */
  useEffect(() => {
    const s = svg.current;
    if (!s || reduced) return;
    const list: Animation[] = [];
    s.querySelectorAll("[data-streak]").forEach((el, i) => {
      // Fades in and out at the ends, so it never looks clipped.
      list.push(
        el.animate(
          [
            { strokeDashoffset: 0.1, opacity: 0 },
            { opacity: 1, offset: 0.2 },
            { opacity: 1, offset: 0.8 },
            { strokeDashoffset: -0.9, opacity: 0 },
          ],
          { duration: 1800, delay: 1200 + i * 240, iterations: Infinity, easing: "linear" },
        ),
      );
    });
    return () => list.forEach((a) => a.cancel());
  }, [geo.key, reduced]);

  /* ── Tree keyboard ── */

  // Rows reachable by keyboard: the panel's top (when drilled) and whatever is shown inline under it.
  const rows = panelRoot ? (drilled ? visibleRows(panelRoot, expanded) : visibleRows(panelRoot, expanded).slice(1).map((r) => ({ ...r, parent: r.parent === panelRoot.id ? null : r.parent }))) : [];
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = Math.max(0, rows.findIndex((r) => r.agent.id === activeId));
  const tree = useRef<HTMLDivElement>(null);
  const focusRow = (i: number) => {
    const id = rows[i]?.agent.id;
    if (!id) return;
    setActiveId(id);
    tree.current?.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(id)}"]`)?.focus();
  };
  useLayoutEffect(() => {
    if (!shown || !focusTree.current) return;
    focusTree.current = false;
    const firstItem = tree.current?.querySelector<HTMLElement>('[role="treeitem"]');
    if (firstItem) {
      setActiveId(firstItem.dataset.treeId ?? null);
      firstItem.focus({ preventScroll: true });
    }
  }, [revealKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const isCollapsed = (a: FleetAgent) => !!a.children?.length && !expanded.has(a.id);
  const onTreeKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).getAttribute("role") !== "treeitem") return;
    const row = rows[active];
    if (!row) return;
    // Backspace always goes back up a level; ← does at the top row (handled below via "collapse" / no parent).
    if (e.key === "Backspace" && drilled) {
      e.preventDefault();
      up();
      return;
    }
    if (e.key === "ArrowLeft" && drilled && row.parent === null && !row.hasChildren) {
      e.preventDefault();
      up();
      return;
    }
    if (e.key === "Enter" && isCollapsed(row.agent)) {
      e.preventDefault();
      drill(row.agent.id);
      return;
    }
    const r = treeKey(rows, active, e.key, expanded);
    if (!r) return;
    e.preventDefault();
    e.stopPropagation();
    if ("focus" in r) focusRow(r.focus);
    else if ("expand" in r) drill(r.expand); // → on a collapsed agent drills into it
    else if ("collapse" in r) {
      // Inline levels stay open (the connectors show the structure), so ← goes to the parent.
      const i = rows.findIndex((x) => x.agent.id === row.parent);
      if (i >= 0) focusRow(i);
      else if (drilled) up();
    } else if ("activate" in r) toggleTasks(row.agent, tree.current?.querySelector(`[data-fleet-node="${CSS.escape(row.agent.id)}"]`) ?? null);
    else if ("close" in r) close();
  };

  /* ── Render ── */

  const mainTools = (a: FleetAgent) => [...new Set(walk(a).flatMap((x) => x.tools ?? []))];

  const subCard = (a: FleetAgent): ReactNode => {
    const kids = a.children ?? [];
    const collapsed = isCollapsed(a);
    const tasks = a.steps?.length ?? 0;
    const time = formatDuration(elapsed(a, now));
    const hidden = collapsed ? hiddenStats(a) : null;
    const selected = taskFor?.id === a.id;
    const chip = hidden && (
      <Button
        size="sm"
        variant="secondary"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          drill(a.id);
        }}
        aria-label={`Open ${hidden.count} ${hidden.count === 1 ? "sub-agent" : "sub-agents"} of ${a.name}`}
        icon={
          (hidden.running > 0 || hidden.waiting > 0 || hidden.failed > 0) && (
            <span className="flex items-center gap-1">
              {hidden.running > 0 && <span className="size-1.5 rounded-full bg-blue-500" />}
              {hidden.waiting > 0 && <span className="size-1.5 rounded-full bg-amber-500" />}
              {hidden.failed > 0 && <span className="size-1.5 rounded-full bg-red-500" />}
            </span>
          )
        }
        iconRight={<ChevronRight />}
        className={cn(hidden.waiting ? "text-amber-700! dark:text-amber-300!" : hidden.failed && "text-red-700! dark:text-red-300!")}
      >
        {hidden.count} sub-agent{hidden.count === 1 ? "" : "s"}
      </Button>
    );
    const action =
      a.state === "waiting" && a.request && resolve ? (
        <span onKeyDown={stop}>
          <Button
            size="sm"
            variant="secondary"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              setAsking(a);
            }}
            aria-label={`Answer ${a.name}: ${a.request.title}`}
          >
            Answer
          </Button>
        </span>
      ) : a.state === "failed" && resolve ? (
        <span className="flex items-center gap-1" onClick={stop} onKeyDown={stop}>
          <Button size="sm" variant="ghost" tabIndex={-1} onClick={() => resolve(a, "dismiss")} aria-label={`Dismiss ${a.name}`}>
            Dismiss
          </Button>
          <Button size="sm" variant="secondary" tabIndex={-1} onClick={() => resolve(a, "retry")} aria-label={`Retry ${a.name}`}>
            Retry
          </Button>
        </span>
      ) : !chip && tasks ? (
        <Button
          size="sm"
          variant="quiet"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            toggleTasks(a, (e.currentTarget.closest("[data-fleet-node]") as HTMLElement) ?? null);
          }}
          className="font-normal"
        >
          {tasks} {tasks === 1 ? "task" : "tasks"}
        </Button>
      ) : null;
    const below = hidden && (hidden.waiting || hidden.failed) && (
      <span className={cn("truncate", hidden.waiting ? "text-amber-700 dark:text-amber-300" : "text-red-700 dark:text-red-300")}>
        · {hidden.waiting ? `${hidden.waiting} ${hidden.waiting === 1 ? "needs" : "need"} you below` : `${hidden.failed} failed below`}
      </span>
    );
    const item = {
      role: "treeitem",
      "data-tree-id": a.id,
      "aria-level": depths.get(a.id) ?? 1,
      "aria-expanded": kids.length ? !collapsed : undefined,
      "aria-selected": a.id === activeId,
      "aria-label": `${a.name}, ${FLEET_LABEL[a.state]}${a.task ? `, ${a.task}` : ""}${tasks ? `, ${tasks} ${tasks === 1 ? "task" : "tasks"}` : ""}${hidden ? `, ${hidden.count} sub-agents collapsed` : ""}`,
      tabIndex: a.id === rows[active]?.agent.id ? 0 : -1,
      onFocus: (e: FocusEvent<HTMLDivElement>) => e.target === e.currentTarget && setActiveId(a.id),
    } as const;
    const open = (e: MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      setActiveId(a.id);
      toggleTasks(a, e.currentTarget);
    };
    if (list) {
      const task = taskOf(a);
      // The chip, Answer or Retry / Dismiss: too wide to share the narrow row's second line ("n tasks" fits).
      const wide = !!chip || (!!action && (a.state === "waiting" || a.state === "failed"));
      // The name column gives up this level's indent, so the task and the numbers line up with the main rows.
      const level = (depths.get(a.id) ?? 1) - (panelRoot ? (depths.get(panelRoot.id) ?? 0) : 0) + (drilled ? 1 : 0);
      const nameW = Math.max(64, LIST_TASK_X - SUB_LEFT - (level - 1) * SUB_STEP - 24 - 12 - 12);
      return (
        <div key={a.id} {...item} className={cn(GUIDE_ITEM, "flex flex-col outline-none [&:focus-visible>[data-card]]:outline-2 [&:focus-visible>[data-card]]:-outline-offset-2 [&:focus-visible>[data-card]]:outline-ring")}>
          {/* Narrow: name and status, then task and spend. Wide: one line on the main rows' columns. */}
          <div
            data-card
            data-fleet-node={a.id}
            onClick={open}
            style={{ "--fleet-name": `${nameW}px` } as CSSProperties}
            className={cn(
              "relative z-[1] grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-lg px-2 py-2",
              // Mid widths (a docs column) leave out the clock and put needs-you under the task, so the task keeps room.
              "@[520px]:grid-cols-[auto_var(--fleet-name)_minmax(0,1fr)_6.25rem_4.5rem] @[820px]:grid-cols-[auto_var(--fleet-name)_minmax(0,1fr)_6.25rem_7.5rem_4.5rem_3.5rem]",
              ROW_HOVER,
              selected && "bg-[color-mix(in_srgb,var(--fleet-wire)_12%,transparent)] hover:bg-[color-mix(in_srgb,var(--fleet-wire)_12%,transparent)]",
            )}
          >
            <span className="row-span-2 self-start rounded-md bg-[var(--fleet-bg)] @[520px]:row-span-1">
              <Logo agent={a} z={z} size="size-6 rounded-md [&>*]:size-3.5" />
            </span>
            <span className="col-start-2 row-start-1 flex min-w-0 items-baseline gap-1.5">
              {/* The model gives way first, so the name keeps its room. */}
              <span title={a.name} className="max-w-full flex-none truncate text-[13.5px] font-semibold text-foreground">
                {a.name}
              </span>
              <span className="hidden min-w-0 truncate text-[12px] text-muted-foreground @[360px]:inline">{a.model ?? "Agent"}</span>
            </span>
            <span
              title={task}
              className={cn("col-start-2 row-start-2 min-w-0 truncate text-[13px] @[520px]:col-start-3 @[520px]:row-start-1", a.state === "failed" ? "text-red-700 dark:text-red-300" : "text-foreground/75")}
            >
              {task}
            </span>
            <span className="col-start-3 row-start-1 justify-self-end @[520px]:col-start-4 @[520px]:justify-self-start">
              <Pill state={a.state} z={DENSITY.compact} />
            </span>
            {/* The needs-you column: the chip, Answer, Retry / Dismiss or "n tasks". Narrow: a line of its own (n tasks is left out: the row itself opens them). */}
            {(chip || action) && (
              <span className={cn("items-center gap-1.5 @[520px]:col-span-1 @[520px]:col-start-3 @[520px]:row-start-2 @[520px]:flex @[520px]:pt-0 @[820px]:col-start-5 @[820px]:row-start-1", wide ? "col-span-2 col-start-2 row-start-3 flex pt-1" : "hidden")}>
                {chip}
                {action}
              </span>
            )}
            <span className="col-start-3 row-start-2 text-right text-[13px] font-medium text-foreground tabular-nums @[520px]:col-start-5 @[520px]:row-start-1 @[820px]:col-start-6">{formatCost(a.spend ?? 0)}</span>
            <span className="hidden text-right text-[12.5px] text-muted-foreground tabular-nums @[820px]:col-start-7 @[820px]:row-start-1 @[820px]:block">{time}</span>
          </div>
          {kids.length > 0 && !collapsed && (
            // The next level's guides hang from this row's mark: 8px padding + half the 24px mark.
            // Reach: 30px when the row is one line; 51px meets the mark under a two- or three-line narrow row.
            <div role="group" className={cn("ml-5 flex flex-col [--fleet-up:51px]", chip || action ? "@[820px]:[--fleet-up:30px]" : "@[520px]:[--fleet-up:30px]")}>
              {kids.map(subCard)}
            </div>
          )}
        </div>
      );
    }
    return (
      <div key={a.id} {...item} className="flex flex-col gap-2.5 outline-none [&:focus-visible>[data-card]]:outline-2 [&:focus-visible>[data-card]]:outline-offset-2 [&:focus-visible>[data-card]]:outline-ring">
        <div
          data-card
          data-fleet-node={a.id}
          onClick={open}
          style={{ maxWidth: z.sub, minWidth: z.subMin }}
          className={cn(
            CARD,
            "w-full cursor-pointer transition-[border-color,outline-color] duration-200 hover:[border-color:color-mix(in_srgb,var(--foreground)_16%,transparent)]",
            z.pad,
            // Selected (its Tasks are open): a soft accent ring, set off from the card.
            selected && "outline-2 outline-offset-[3px] [outline-color:var(--fleet-wire)]",
          )}
        >
          <span
            data-contact
            aria-hidden
            className="pointer-events-none absolute inset-y-3 -left-px w-8 rounded-l-xl bg-[radial-gradient(closest-side_at_0_50%,color-mix(in_srgb,var(--fleet-head)_45%,transparent),transparent)] opacity-0"
          />
          <CardBody
            z={z}
            agent={a}
            tools={a.tools ?? []}
            footerLeft={
              <span className="flex min-w-0 items-baseline gap-1.5">
                <CostTime cost={formatCost(a.spend ?? 0)} time={time} />
                {below}
              </span>
            }
            footerRight={
              chip || action ? (
                <span className="flex flex-none items-center gap-1.5">
                  {chip}
                  {action}
                </span>
              ) : (
                <span />
              )
            }
          />
        </div>
        {kids.length > 0 && !collapsed && (
          <div role="group" className="flex flex-col gap-2.5" style={{ marginLeft: NEST }}>
            {kids.map(subCard)}
          </div>
        )}
      </div>
    );
  };

  const notice =
    panelRoot && ((panelRoot.state === "waiting" && panelRoot.request && !drilled) || (panelRoot.state === "failed" && resolve && !drilled)) ? (
      <div
        data-fleet-plain
        style={list ? undefined : { maxWidth: z.sub }}
        className={cn(list ? "rounded-lg bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)]" : CARD, "flex flex-wrap items-center gap-3 px-4 py-3")}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13.5px] font-medium text-foreground">{panelRoot.state === "waiting" ? panelRoot.request!.title : `${panelRoot.name} failed`}</span>
          <span className="truncate text-[12.5px] text-muted-foreground">
            {panelRoot.state === "waiting" ? (panelRoot.request!.detail ?? `${panelRoot.name} is waiting for you`) : (panelRoot.error ?? "")}
          </span>
        </span>
        {panelRoot.state === "waiting" && resolve ? (
          <Button size="sm" variant="secondary" onClick={() => setAsking(panelRoot)}>
            Answer
          </Button>
        ) : panelRoot.state === "failed" && resolve ? (
          <span className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => resolve(panelRoot, "dismiss")}>
              Dismiss
            </Button>
            <Button size="sm" variant="secondary" onClick={() => resolve(panelRoot, "retry")}>
              Retry
            </Button>
          </span>
        ) : null}
      </div>
    ) : null;

  const panelHead =
    shown && (drilled || deepest > INLINE || expandAll) ? (
      <div data-fleet-plain style={list ? undefined : { maxWidth: z.sub }} className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {drilled ? (
          <nav aria-label="Sub-agent path" className="min-w-0">
            <ol className="flex min-w-0 flex-wrap items-center gap-1 text-[13px]">
              {[shown, ...trail.slice(1)].map((a, i, all) => {
                const last = i === all.length - 1;
                return (
                  <li key={a.id} className="flex min-w-0 items-center gap-1">
                    {last ? (
                      <span aria-current="page" className="truncate font-medium text-foreground">
                        {a.name}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate(trail.slice(1, i + 1).map((x) => x.id))}
                        className={cn("cursor-pointer truncate rounded-md px-1 text-muted-foreground transition-colors hover:text-foreground", focusRing)}
                      >
                        {a.name}
                      </button>
                    )}
                    {!last && (
                      <span aria-hidden className="grid text-muted-foreground/60 [&_svg]:size-3.5">
                        <ChevronRight />
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : (
          <span />
        )}
        {(deepest > INLINE || expandAll) && (
          <Toggle
            size="sm"
            pressed={expandAll}
            onClick={(e) => {
              // The flip waits for the exit animation, so skip Toggle's own pressed callback.
              e.preventDefault();
              setTaskFor(null);
              playOut("left", () => setExpandAll((v) => !v));
            }}
          >
            {expandAll ? "Collapse" : "Expand all"}
          </Toggle>
        )}
      </div>
    ) : null;

  const trunk = (n: ReactNode) => (n && list ? <div className={GUIDE_TRUNK}>{n}</div> : n);
  const treeColumn = shown && panelRoot && (
    <div
      ref={treeCol}
      id={treeId}
      // List: the guides hang from the row's mark (16px padding + half the 32px mark), reaching up past the row's own padding.
      className={cn("flex min-w-0 flex-col gap-2.5", list && "mr-2 mb-3 ml-8 [--fleet-up:28px]")}
      style={list ? undefined : { marginLeft: geo.left }}
    >
      {trunk(panelHead)}
      {trunk(notice)}
      {drilled || panelRoot.children?.length ? (
        <div ref={tree} role="tree" aria-labelledby={labelId} onKeyDown={onTreeKey} className={cn("flex flex-col", !list && "gap-2.5")}>
          <span id={labelId} className="sr-only">
            {panelRoot.name}: sub-agents
          </span>
          {drilled ? subCard(panelRoot) : panelRoot.children!.map(subCard)}
        </div>
      ) : (
        <div className={cn(list && GUIDE_ITEM)}>
          <p data-fleet-plain style={list ? undefined : { maxWidth: z.sub }} className="px-1 py-2 text-[13px] text-muted-foreground">
            {shown.name} has no sub-agents yet.
          </p>
        </div>
      )}
    </div>
  );

  /** List: one row per main agent. The numbers sit in fixed, right-aligned columns so the rows line up. */
  const mainRow = (a: FleetAgent) => {
    const isOpen = a.id === openId;
    const needs = walk(a).filter((x) => x.state === "waiting").length;
    const task = taskOf(a);
    return (
      <button
        type="button"
        data-fleet-card={a.id}
        aria-expanded={isOpen}
        aria-controls={isOpen ? treeId : undefined}
        onClick={() => toggle(a)}
        className={cn(
          "relative z-[1] grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 text-left",
          "@[520px]:grid-cols-[auto_11rem_minmax(0,1fr)_6.25rem_4.5rem] @[820px]:grid-cols-[auto_11rem_minmax(0,1fr)_6.25rem_7.5rem_4.5rem_3.5rem] @[820px]:gap-y-0",
          ROW_HOVER,
          isOpen && "bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)]",
          focusRing,
          "focus-visible:-outline-offset-2",
        )}
      >
        <span className="row-span-2 rounded-lg bg-[var(--fleet-bg)] @[520px]:row-span-1">
          <Logo agent={a} z={z} size="size-8 rounded-lg [&>*]:size-4" />
        </span>
        <span className="col-start-2 row-start-1 flex min-w-0 items-baseline gap-1.5 @[520px]:flex-col @[520px]:items-start @[520px]:gap-0">
          <span className="max-w-full truncate text-[14px] leading-5 font-semibold text-foreground">{a.name}</span>
          <span className="hidden max-w-full truncate text-[12.5px] leading-[18px] text-muted-foreground @[360px]:inline @[520px]:block">{a.model ?? "Agent"}</span>
        </span>
        <span
          title={task}
          className={cn("col-start-2 row-start-2 min-w-0 truncate text-[13px] @[520px]:col-start-3 @[520px]:row-start-1 @[520px]:text-[13.5px]", a.state === "failed" ? "text-red-700 dark:text-red-300" : "text-foreground/75")}
        >
          {task}
        </span>
        <span className="col-start-3 row-start-1 justify-self-end @[520px]:col-start-4 @[520px]:justify-self-start">
          <Pill state={a.state} z={DENSITY.compact} />
        </span>
        <span className={cn("hidden text-[12.5px] whitespace-nowrap text-amber-700 tabular-nums dark:text-amber-300", needs ? "@[520px]:col-start-3 @[520px]:row-start-2 @[520px]:block" : "@[820px]:block", "@[820px]:col-start-5 @[820px]:row-start-1")}>
          {needs ? `${needs} ${needs === 1 ? "needs" : "need"} you` : ""}
        </span>
        <span className="col-start-3 row-start-2 text-right text-[13px] font-medium text-foreground tabular-nums @[520px]:col-start-5 @[520px]:row-start-1 @[820px]:col-start-6">{formatCost(treeSpend(a))}</span>
        <span className="hidden text-right text-[12.5px] text-muted-foreground tabular-nums @[820px]:col-start-7 @[820px]:row-start-1 @[820px]:block">{formatDuration(elapsed(a, now))}</span>
      </button>
    );
  };
  /** Up / Down / Home / End move between rows; Enter or Space (the button's own) opens one. */
  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const t = e.target as HTMLElement;
    if (!t.hasAttribute("data-fleet-card")) return;
    const all = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-fleet-card]")];
    const i = all.indexOf(t);
    const j = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : -2;
    if (j === -2 || !all[j]) return;
    e.preventDefault();
    all[j].focus();
  };

  const mainCard = (a: FleetAgent) => {
    const isOpen = a.id === openId;
    const dim = openId !== null && !isOpen;
    const sum = mainSummary(a);
    const Icon = SUMMARY_ICON[sum.tone];
    return (
      <button
        type="button"
        data-fleet-card={a.id}
        aria-expanded={isOpen}
        aria-controls={isOpen ? treeId : undefined}
        onClick={() => toggle(a)}
        className={cn(
          CARD,
          "block w-full cursor-pointer text-left",
          z.pad,
          "transition-[opacity,border-color] duration-300 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none",
          "hover:[border-color:color-mix(in_srgb,var(--foreground)_16%,transparent)]",
          isOpen && "[border-color:color-mix(in_srgb,var(--foreground)_20%,transparent)]",
          dim && "opacity-45 hover:opacity-100 focus-visible:opacity-100",
          focusRing,
        )}
      >
        <CardBody
          z={z}
          agent={a}
          tools={mainTools(a)}
          footerLeft={
            <span className={cn("flex min-w-0 items-center gap-1.5 [&_svg]:size-3.5 [&_svg]:flex-none", SUMMARY_TEXT[sum.tone])}>
              <Icon />
              <span className="truncate">{sum.text}</span>
            </span>
          }
          footerRight={<CostTime cost={formatCost(treeSpend(a))} time={formatDuration(elapsed(a, now))} />}
        />
      </button>
    );
  };

  const subs = totals.agents - fleet.length;
  const shownIndex = shown ? fleet.findIndex((a) => a.id === shown.id) : -1;

  return (
    <section ref={root} aria-label={typeof title === "string" ? title : "Agent fleet"} className={cn("flex min-w-0 flex-col gap-4", WIRE, className)}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-0.5">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <span className="grid size-4 place-items-center text-[var(--fleet-head)] [&_svg]:size-full">
            <Sparkle />
          </span>
          {title}
        </h2>
        <p className="flex flex-wrap items-baseline gap-x-4 text-[13px] text-muted-foreground tabular-nums">
          <span>
            {fleet.length} {fleet.length === 1 ? "agent" : "agents"} / {subs} sub-agents
          </span>
          <span>{totals.running} running</span>
          <span>{totals.waiting} needs you</span>
          <span className="font-medium text-foreground">{formatCost(totals.cost)}</span>
        </p>
        <span aria-live="polite" aria-atomic className="sr-only">
          <span key={said.n}>{said.text}</span>
        </span>
      </header>

      {fleet.length === 0 ? (
        <p className={cn(CARD, "px-5 py-10 text-center text-[13.5px] text-muted-foreground")}>No agents yet.</p>
      ) : list ? (
        <div ref={wrap} className={cn(CARD, LIST_SURFACE, "@container overflow-hidden")}>
          <ul aria-label="Agents" onKeyDown={onListKey} className="divide-y [&>li]:[border-color:color-mix(in_srgb,var(--foreground)_7%,transparent)]">
            {fleet.map((a) => (
              <li key={a.id} className="flex min-w-0 flex-col">
                {mainRow(a)}
                {shown?.id === a.id && treeColumn}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        // Scrolls sideways only when "Expand all" goes deeper than the room there is.
        <div className="-m-2 overflow-x-auto p-2">
          <div ref={wrap} className="relative min-w-full">
            <ul aria-label="Agents" className="grid items-start" style={{ gridTemplateColumns: width ? `repeat(${cols}, minmax(0, 1fr))` : `repeat(auto-fill, minmax(min(${z.min}px, 100%), 1fr))`, gap: GAP }}>
              {fleet.map((a, i) => (
                <Fragment key={a.id}>
                  <li className="min-w-0">{mainCard(a)}</li>
                  {shownIndex >= 0 && i === rowEnd(shownIndex, cols, fleet.length) && <li className="col-span-full min-w-0 pt-2 pb-1">{treeColumn}</li>}
                </Fragment>
              ))}
            </ul>

            {/* Connectors, measured from the cards; they only cross the gaps and touch card edges. */}
            <svg ref={svg} aria-hidden className="pointer-events-none absolute inset-0 size-full overflow-visible">
              {geo.wires.map((w) => (
                <g key={`${geo.for}:${w.id}`}>
                  <path data-wire={w.id} d={w.d} pathLength={1} strokeDasharray="1 2" fill="none" stroke="var(--fleet-wire)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  {/* Bright tip while the line grows. */}
                  <path data-head={w.id} d={w.d} pathLength={1} strokeDasharray="0.06 2" strokeDashoffset={-0.94} fill="none" stroke="var(--fleet-head)" strokeWidth={2.25} strokeLinecap="round" opacity={0} />
                  {w.running && (
                    <path data-streak d={w.d} pathLength={1} strokeDasharray="0.1 2" strokeDashoffset={-0.9} fill="none" stroke="var(--fleet-head)" strokeOpacity={0.5} strokeWidth={1.75} strokeLinecap="round" opacity={0} />
                  )}
                </g>
              ))}
              {geo.dots.map((d) => (
                <circle
                  key={`${geo.for}:${d.id}`}
                  data-dot={d.id}
                  cx={d.x}
                  cy={d.y}
                  r={4}
                  fill="var(--background)"
                  stroke="var(--fleet-wire)"
                  strokeWidth={1.5}
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                />
              ))}
            </svg>
          </div>
        </div>
      )}

      {tasksAgent && taskFor && taskFor.anchor.isConnected && (
        <TasksPopover key={tasksAgent.id} agent={tasksAgent} anchor={taskFor.anchor} now={now} resolve={resolve} onClose={closeTasks} />
      )}

      {/* Small screens: tasks as a bottom sheet. */}
      <Dialog
        open={!!sheet}
        onOpenChange={(o) => !o && setSheet(null)}
        title={sheet ? `Tasks of ${sheet.name}` : ""}
        description={sheet ? `${sheet.steps?.filter((s) => s.state === "done").length ?? 0}/${sheet.steps?.length ?? 0} done` : undefined}
        sheet
        footer={
          <Button variant="secondary" onClick={() => setSheet(null)}>
            Close
          </Button>
        }
      >
        <ol className="flex flex-col gap-1 py-1">
          {sheet?.steps?.map((s) => {
            const st: FleetState = s.state === "running" ? "running" : s.state === "failed" ? "failed" : "done";
            const dur = s.startedAt !== undefined ? formatDuration((s.endedAt ?? now) - s.startedAt) : "";
            return (
              <li key={s.id} className="flex items-center gap-3 rounded-lg px-1 py-2">
                <ToolTile tool={s.tool} />
                <span className="min-w-0 flex-1 truncate text-[14px] text-foreground">{s.title}</span>
                <StatusDot state={DOT[st]} label={FLEET_LABEL[st]} className="size-1.5!" />
                {dur && <span className="flex-none text-[12.5px] text-muted-foreground tabular-nums">{dur}</span>}
              </li>
            );
          })}
        </ol>
      </Dialog>

      {/* Answer an approval. */}
      <Dialog
        open={!!asking}
        onOpenChange={(o) => !o && setAsking(null)}
        title={asking?.request?.title ?? ""}
        description={asking ? `${asking.name} is waiting for your answer` : undefined}
        footer={
          resolve && asking ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  resolve(asking, "reject");
                  setAsking(null);
                }}
              >
                Reject
              </Button>
              <Button
                onClick={() => {
                  resolve(asking, "approve");
                  setAsking(null);
                }}
              >
                Approve
              </Button>
            </>
          ) : undefined
        }
      >
        {asking?.request?.detail ? (
          <pre className="my-1 rounded-xl bg-muted/60 px-3 py-2.5 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-foreground/90">{asking.request.detail}</pre>
        ) : (
          <p className="py-1 text-[14px] text-muted-foreground">Approve to let {asking?.name} go on, or reject to stop this step.</p>
        )}
      </Dialog>
    </section>
  );
}

export default AgentFleet;
