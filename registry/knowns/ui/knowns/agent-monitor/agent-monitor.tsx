"use client";
/** @registry name="agent-monitor" type="ui" title="Agent monitor" description="One agent at work as a card: current step with a clock and cost, a time strip, finished steps with tool logos, the exact command when it needs your OK, and a folded bar." */

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { formatUsd } from "@/registry/knowns/lib/knowns/status";
import { useAgentSnapshot, type AgentRun } from "@/registry/knowns/lib/knowns/run";
import { modelIcon } from "@/registry/knowns/lib/knowns/icons/model-icons";
import { toolIcon } from "@/registry/knowns/lib/knowns/icons/tool-icons";
import { BotGlyph } from "@/registry/knowns/lib/knowns/icons/actor-icon";
import { Button } from "../button";
import { Kbd } from "../kbd";
import { Popover } from "../popover";
import {
  STATE_LABEL,
  elapsed,
  finishedSteps,
  formatClock,
  formatTook,
  isLive,
  monitorFromRun,
  outcomeText,
  shortcutFor,
  stepCount,
  stepDuration,
  stripBars,
  type BarTone,
  type MonitorState,
  type StepState,
} from "./monitor-utils";

export type { MonitorState, StepState } from "./monitor-utils";

export interface MonitorStep {
  id: string;
  label: string;
  /** Free-form kind ("shell", "search", "file"…); picks a glyph when there is no tool logo. */
  kind?: string;
  /** Tool name, e.g. "GitHub"; picks the brand logo. */
  tool?: string;
  /** Overrides the logo. */
  icon?: ReactNode;
  state: StepState;
  /** Epoch ms the step started (the running step's clock and bar grow from it). */
  since?: number;
  /** How long it took, ms. */
  took?: number;
  /** Shown in the info card: arguments, a query, a command… */
  detail?: string;
  /** Shown in the info card: what came back. */
  output?: string;
}

export interface MonitorAgent {
  name: string;
  /** Line under the name, e.g. "Release agent · web-app v3.2". */
  role?: string;
  /** Model name; picks the provider logo. */
  model?: string;
  icon?: ReactNode;
}

export interface MonitorAsk {
  /** What it wants to do, e.g. "Ready to ship". */
  title: string;
  /** The exact command or action, shown as inline code. */
  command?: string;
  tool?: string;
  /** Epoch ms the question was asked (the wait bar grows from it). */
  since?: number;
}

export interface MonitorOutcome {
  added?: number;
  removed?: number;
  files?: number;
  note?: string;
}

export interface AgentMonitorProps {
  state?: MonitorState;
  agent?: MonitorAgent;
  steps?: MonitorStep[];
  /** The line in the well. Default: the running step. */
  current?: { label: string; tool?: string; icon?: ReactNode; since?: number };
  /** Run clock: (until ?? now) − since − pausedFor. While paused the clock holds. */
  since?: number;
  until?: number;
  pausedFor?: number;
  /** Money so far; a number is formatted with formatUsd. Shimmers while the agent works. */
  cost?: number | string;
  ask?: MonitorAsk;
  outcome?: MonitorOutcome;
  error?: ReactNode;
  /** Live: derive everything from this actor in the run. Explicit props still win. */
  run?: AgentRun;
  actor?: string;
  onAllow?: () => void;
  onDecline?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onLog?: () => void;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Clock override for tests and stills. */
  now?: number;
  className?: string;
}

const EASE = "ease-[cubic-bezier(.22,1,.36,1)]";
const HAIR = "[border-color:color-mix(in_srgb,var(--foreground)_8%,transparent)]";

/* Quiet surface: hairline, a thin inner top light, a deeper card in dark mode. */
const SURFACE = cn(
  "rounded-2xl border bg-card text-[13px] text-card-foreground",
  HAIR,
  "shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_5%,transparent),0_1px_2px_rgb(0_0_0/0.04),0_12px_28px_-18px_rgb(0_0_0/0.25)]",
  "dark:[background:color-mix(in_srgb,var(--card)_70%,#000)] dark:shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_7%,transparent),0_12px_28px_-16px_rgb(0_0_0/0.6)]",
);

const TAG: Record<MonitorState, string> = {
  idle: "bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] text-muted-foreground",
  paused: "bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] text-muted-foreground",
  running: "bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
  waiting: "bg-amber-500/12 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  finished: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300",
  failed: "bg-red-500/10 text-red-700 dark:bg-red-400/15 dark:text-red-300",
};
const DOT: Record<MonitorState, string> = {
  idle: "bg-foreground/30",
  paused: "bg-foreground/40",
  running: "bg-blue-500 dark:bg-blue-400",
  waiting: "bg-amber-500 dark:bg-amber-400",
  finished: "bg-emerald-500 dark:bg-emerald-400",
  failed: "bg-red-500 dark:bg-red-400",
};
const BAR: Record<BarTone, string> = {
  done: "bg-[color-mix(in_srgb,var(--foreground)_20%,transparent)]",
  failed: "bg-[color-mix(in_srgb,var(--foreground)_40%,transparent)]",
  running: "bg-blue-500 dark:bg-blue-400",
  paused: "bg-[color-mix(in_srgb,var(--foreground)_40%,transparent)]",
  waiting: "bg-amber-500 dark:bg-amber-400",
};
const WELL: Record<MonitorState, string> = {
  idle: "",
  paused: "",
  running: "",
  waiting: "bg-amber-500/[0.07] shadow-[inset_0_0_0_1px_rgb(245_158_11/0.22)] dark:bg-amber-400/[0.07] dark:shadow-[inset_0_0_0_1px_rgb(251_191_36/0.18)]",
  finished: "",
  failed: "",
};

/** Ticks once a second while `on` (the strip's 1s linear transition fills the gaps). */
function useNow(on: boolean, fixed?: number) {
  const [now, setNow] = useState(() => fixed ?? Date.now());
  useEffect(() => {
    if (fixed !== undefined) return setNow(fixed);
    setNow(Date.now());
    if (!on) return;
    const iv = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [on, fixed]);
  return now;
}

/* ---------- Small glyphs ---------- */

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const Chevron = ({ up }: { up: boolean }) => (
  <svg viewBox="0 0 16 16" {...stroke} aria-hidden className={cn("size-3.5 transition-transform duration-300 motion-reduce:transition-none", EASE, up && "rotate-180")}>
    <path d="M4.5 6.5 8 10l3.5-3.5" />
  </svg>
);
const PauseGlyph = () => (
  <svg viewBox="0 0 16 16" aria-hidden className="size-3">
    <rect x="4" y="3.5" width="2.6" height="9" rx="0.8" fill="currentColor" />
    <rect x="9.4" y="3.5" width="2.6" height="9" rx="0.8" fill="currentColor" />
  </svg>
);
const PlayGlyph = () => (
  <svg viewBox="0 0 16 16" aria-hidden className="size-3">
    <path d="M5 3.5v9l7-4.5z" fill="currentColor" />
  </svg>
);
const XGlyph = () => (
  <svg viewBox="0 0 16 16" {...stroke} aria-hidden className="size-3">
    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
  </svg>
);
const ArrowUpRight = () => (
  <svg viewBox="0 0 16 16" {...stroke} aria-hidden className="size-3">
    <path d="M5.5 10.5l5-5M6.5 5.5h4v4" />
  </svg>
);
const Check = () => (
  <svg viewBox="0 0 16 16" {...stroke} strokeWidth={1.9} aria-hidden className="size-3.5">
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);
const Alert = () => (
  <svg viewBox="0 0 16 16" {...stroke} aria-hidden className="size-3.5">
    <circle cx="8" cy="8" r="5.75" />
    <path d="M8 5v3.5M8 11v.01" />
  </svg>
);
const HandGlyph = () => (
  <svg viewBox="0 0 16 16" {...stroke} aria-hidden className="size-3.5">
    <path d="M8 2.75v6M5.5 4.25v5.5M10.5 4.25v4.5M3 7.25v3a5 5 0 0 0 10 0v-3.5" />
  </svg>
);
const StepDot = () => <span className="size-1.5 rounded-full bg-current opacity-60" />;

/** A logo box: tool logo, a glyph, else a dot. */
function Logo({ icon, size = "md", className }: { icon: ReactNode; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid flex-none place-items-center text-foreground [&>*]:size-full [&_svg]:size-full",
        size === "md" ? "size-3.5" : "size-3",
        className,
      )}
    >
      {icon ?? <StepDot />}
    </span>
  );
}

const stepIcon = (s: { icon?: ReactNode; tool?: string; kind?: string }) => s.icon ?? toolIcon(s.tool) ?? toolIcon(s.kind) ?? null;

/** Text with a soft light band sweeping across it while the agent works. */
function Shimmer({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <span className="relative inline-block overflow-hidden">
      {children}
      {on && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-linear-to-r from-transparent via-[color-mix(in_srgb,var(--card)_75%,transparent)] to-transparent animate-[kn-shimmer_2s_cubic-bezier(.65,0,.35,1)_infinite] motion-reduce:hidden"
        />
      )}
    </span>
  );
}

/* ---------- Info card ---------- */

function StepInfo({ step, now }: { step: MonitorStep; now: number }) {
  const icon = stepIcon(step);
  return (
    <div className="flex w-64 flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="grid size-6 flex-none place-items-center rounded-[7px] bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)]">
          <Logo icon={icon} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{step.label}</div>
          <div className="truncate text-[11.5px] text-muted-foreground">
            {[step.tool, step.state === "failed" ? "Failed" : step.state === "running" ? "Running" : "Done", formatTook(stepDuration(step, now))].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>
      {step.detail && <Block label="Detail">{step.detail}</Block>}
      {step.output && <Block label="Output">{step.output}</Block>}
      {!step.detail && !step.output && <div className="text-[12px] text-muted-foreground">No details recorded.</div>}
    </div>
  );
}

function Block({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <pre className="max-h-32 overflow-auto rounded-[8px] bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] px-2 py-1.5 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap break-words">
        {children}
      </pre>
    </div>
  );
}

/* ---------- Time strip ---------- */

function TimeStrip({
  steps,
  now,
  state,
  waitSince,
  openKey,
  setOpenKey,
}: {
  steps: MonitorStep[];
  now: number;
  state: MonitorState;
  waitSince?: number;
  openKey: string | null;
  setOpenKey: (k: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || 300);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 300));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const bars = stripBars(steps, now, { state, waitSince, gap: 3 / width });
  const byId = new Map(steps.map((s) => [s.id, s]));
  // Ticking: 1s linear so the running bar grows smoothly between renders; otherwise settle with the house ease.
  const motion = isLive(state) ? "duration-1000 ease-linear" : `duration-500 ${EASE}`;

  return (
    <div ref={ref} role="presentation" className="relative h-3 w-full">
      {bars.map((b) => {
        const style: CSSProperties = { transform: `translateX(${b.left * 100}%) scaleX(${b.width})`, transformOrigin: "0 50%" };
        const visual = <span aria-hidden className={cn("absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-[1px]", BAR[b.tone])} />;
        const step = b.step ? byId.get(b.step) : undefined;
        const cls = cn("absolute inset-0 transition-transform will-change-transform motion-reduce:transition-none", motion);
        if (!step) return <span key={b.id} style={style} className={cls}>{visual}</span>;
        const key = `bar:${step.id}`;
        return (
          <Popover
            key={b.id}
            open={openKey === key}
            onOpenChange={(o) => setOpenKey(o ? key : null)}
            aria-label={step.label}
            side="bottom"
            trigger={
              // Mouse shortcut to the same info as the rows (which are the keyboard path).
              <button type="button" tabIndex={-1} aria-label={`${step.label}, ${formatTook(b.ms)}`} style={style} className={cn(cls, "cursor-pointer outline-none hover:brightness-125")}>
                {visual}
              </button>
            }
          >
            <StepInfo step={step} now={now} />
          </Popover>
        );
      })}
      {!bars.length && <span aria-hidden className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-[1px] bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)]" />}
    </div>
  );
}

/* ---------- The card ---------- */

/**
 * One agent at a glance: what it is doing now and for how long, where its time went, what it costs, and
 * - when it needs you - the exact command, with Allow (⏎) / Decline (Esc) from the keyboard while the card
 * has focus. Folds into a 40px bar. Pass `run` + `actor` to drive it live from a Knowns run.
 */
export function AgentMonitor(props: AgentMonitorProps) {
  const { run, actor, onLog, onCancel, className } = props;
  const snap = useAgentSnapshot(run);
  const live = useMemo(() => (snap && actor ? monitorFromRun(snap, actor) : undefined), [snap, actor]);

  /* Explicit props win; the run fills the rest. */
  const state: MonitorState = props.state ?? live?.state ?? "idle";
  const agent: MonitorAgent = props.agent ?? { name: live?.name ?? "Agent", model: live?.model, role: live?.role };
  const steps: MonitorStep[] = props.steps ?? live?.steps ?? [];
  const since = props.since ?? live?.since;
  const until = props.until ?? (state === "finished" || state === "failed" ? live?.until : undefined);
  const costValue = props.cost ?? live?.spend;
  const cost = typeof costValue === "number" ? formatUsd(costValue) : costValue;
  const ask: MonitorAsk | undefined = props.ask ?? (live?.ask ? { title: live.ask.title, command: live.ask.command, since: live.ask.since } : undefined);
  const tools = useMemo(() => {
    if (live && !props.steps) return live.tools;
    const t: string[] = [];
    for (const s of steps) if (s.tool && s.state !== "queued" && !t.includes(s.tool)) t.push(s.tool);
    return t;
  }, [live, props.steps, steps]);

  const onAllow =
    props.onAllow || live?.ask
      ? () => {
          if (live?.ask && run && !props.ask) run.emit({ type: "approval.resolve", id: live.ask.id, decision: "approved" });
          props.onAllow?.();
        }
      : undefined;
  const onDecline =
    props.onDecline || live?.ask
      ? () => {
          if (live?.ask && run && !props.ask) run.emit({ type: "approval.resolve", id: live.ask.id, decision: "denied" });
          props.onDecline?.();
        }
      : undefined;

  /* Clock: ticks while live; holds where it was while paused. */
  const tickNow = useNow(isLive(state), props.now);
  const heldAt = useRef<number | null>(null);
  if (state === "paused") heldAt.current ??= tickNow;
  else heldAt.current = null;
  const now = state === "paused" ? heldAt.current! : tickNow;

  /* Collapse. */
  const [ownCollapsed, setOwnCollapsed] = useState(props.defaultCollapsed ?? false);
  const collapsed = props.collapsed ?? ownCollapsed;
  const toggle = () => {
    if (props.collapsed === undefined) setOwnCollapsed(!collapsed);
    props.onCollapsedChange?.(!collapsed);
  };

  const [openKey, setOpenKey] = useState<string | null>(null);
  const id = useId();
  const bodyId = `${id}-body`;
  const nameId = `${id}-name`;

  const running = steps.find((s) => s.state === "running");
  const current: AgentMonitorProps["current"] = props.current ?? (live?.current && !props.steps ? live.current : running ? { label: running.label, tool: running.tool, icon: running.icon, since: running.since } : undefined);
  const rows = finishedSteps(steps);
  const count = stepCount(steps);
  const total = elapsed(since, now, until, props.pausedFor);
  const busy = state === "running";

  /* Enter / Esc while the card (not a popover) has focus and it is waiting. */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (state !== "waiting" || collapsed || e.defaultPrevented || e.nativeEvent.isComposing) return;
    const t = e.target as HTMLElement;
    if (!e.currentTarget.contains(t)) return; // keys from the info card's portal bubble here through React
    const act = shortcutFor(e.key, t.tagName, t === e.currentTarget);
    if (act === "allow" && onAllow) {
      e.preventDefault();
      onAllow();
    } else if (act === "decline" && onDecline) {
      e.preventDefault();
      onDecline();
    }
  };

  /* The well: the line that matters right now. */
  let wellIcon: ReactNode = null;
  let wellLabel: ReactNode = null;
  let wellExtra: ReactNode = null;
  let clock: number | undefined;
  if (state === "waiting") {
    wellIcon = ask?.tool ? toolIcon(ask.tool) : <HandGlyph />;
    wellLabel = ask?.title ?? "Needs your input";
    if (ask?.command)
      wellExtra = (
        <code title={ask.command} className="min-w-16 flex-1 truncate rounded-[6px] bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] px-1.5 py-0.5 font-mono text-[11.5px] text-foreground">
          {ask.command.replace(/\s*\n\s*/g, " ⏎ ")}
        </code>
      );
    clock = ask?.since !== undefined ? now - ask.since : total;
  } else if (state === "finished") {
    wellIcon = <span className="text-emerald-600 dark:text-emerald-400"><Check /></span>;
    wellLabel = `Finished in ${formatTook(total)}`;
    const o = props.outcome && outcomeText(props.outcome);
    if (o) wellExtra = <span className="min-w-0 flex-1 truncate text-muted-foreground tabular-nums">{o}</span>;
  } else if (state === "failed") {
    wellIcon = <span className="text-red-600 dark:text-red-400"><Alert /></span>;
    wellLabel = <span className="text-red-700 dark:text-red-300">{props.error ?? "Failed"}</span>;
    clock = total;
  } else if (current) {
    wellIcon = current.icon ?? toolIcon(current.tool) ?? null;
    wellLabel = current.label;
    clock = current.since !== undefined ? now - current.since : total;
  } else {
    // Running with nothing open (between calls) reads as working, not idle.
    wellLabel = <span className="text-muted-foreground">{state === "paused" ? "Paused" : state === "running" ? <Shimmer on>Working…</Shimmer> : "Waiting for work"}</span>;
  }

  const announce = `${agent.name}: ${STATE_LABEL[state]}${state === "waiting" && ask ? `. ${ask.title}${ask.command ? `: ${ask.command}` : ""}` : current && busy ? `. ${current.label}` : ""}`;
  const agentIcon = agent.icon ?? modelIcon(agent.model) ?? <BotGlyph />;

  const footer =
    state === "waiting" ? (
      <>
        {onDecline && (
          <Button size="sm" variant="ghost" onClick={onDecline} aria-keyshortcuts="Escape" iconRight={<Kbd size="sm">Esc</Kbd>}>
            Decline
          </Button>
        )}
        {onAllow && (
          <Button size="sm" onClick={onAllow} aria-keyshortcuts="Enter" iconRight={<Kbd size="sm" tone="inverse">⏎</Kbd>}>
            Allow
          </Button>
        )}
      </>
    ) : state === "running" || state === "paused" ? (
      <>
        {state === "running" && props.onPause && (
          <Button size="sm" variant="ghost" icon={<PauseGlyph />} onClick={props.onPause}>
            Pause
          </Button>
        )}
        {state === "paused" && props.onResume && (
          <Button size="sm" variant="ghost" icon={<PlayGlyph />} onClick={props.onResume}>
            Resume
          </Button>
        )}
        {onCancel && (
          <Button size="sm" variant="ghost" icon={<XGlyph />} onClick={onCancel}>
            Cancel
          </Button>
        )}
      </>
    ) : null;

  return (
    <div
      role="group"
      aria-labelledby={nameId}
      aria-describedby={`${id}-status`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={cn(SURFACE, "flex w-[340px] max-w-full flex-col outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", className)}
    >
      <span id={`${id}-status`} aria-live="polite" className="sr-only">
        {announce}
      </span>

      {/* Header - the same row folds into the 40px bar. */}
      <div className={cn("flex items-center gap-2.5 px-3 transition-[height] duration-300 motion-reduce:transition-none", EASE, collapsed ? "h-10" : "h-14")}>
        <span className="grid size-7 flex-none place-items-center rounded-[8px] bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_7%,transparent)]">
          <span aria-hidden className="grid size-4 place-items-center text-foreground [&>*]:size-full [&_svg]:size-full">
            {agentIcon}
          </span>
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 items-center gap-1.5">
            <span id={nameId} className="truncate text-[13.5px] leading-tight font-medium tracking-tight">
              {agent.name}
            </span>
            {collapsed && <span aria-hidden className={cn("size-1.5 flex-none rounded-full", DOT[state], state === "waiting" && "animate-pulse motion-reduce:animate-none")} />}
            {collapsed && <span className="sr-only">{STATE_LABEL[state]}</span>}
          </div>
          {!collapsed && agent.role && <span className="truncate text-[11.5px] leading-tight text-muted-foreground">{agent.role}</span>}
        </div>

        {collapsed && tools.length > 0 && (
          <span className="flex flex-none items-center" aria-label={`Tools used: ${tools.join(", ")}`} role="img">
            {tools.slice(0, 4).map((t, i) => (
              <span
                key={t}
                className={cn(
                  "grid size-5 place-items-center rounded-full bg-card shadow-[0_0_0_1.5px_var(--card),inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_10%,transparent)] dark:[background:color-mix(in_srgb,var(--card)_70%,#000)]",
                  i > 0 && "-ml-1",
                )}
              >
                <Logo icon={toolIcon(t) ?? <span className="text-[9px] font-semibold">{t.charAt(0)}</span>} size="sm" />
              </span>
            ))}
            {tools.length > 4 && <span className="ml-1 text-[11px] text-muted-foreground tabular-nums">+{tools.length - 4}</span>}
          </span>
        )}

        {cost !== undefined && (
          <span className="flex-none text-[12.5px] font-medium tabular-nums" aria-label={`Cost ${cost}`}>
            <Shimmer on={busy}>{cost}</Shimmer>
          </span>
        )}
        {!collapsed && (
          <span className={cn("inline-flex h-5 flex-none items-center gap-1 rounded-[6px] px-1.5 text-[11.5px] font-medium", TAG[state])}>
            <span aria-hidden className={cn("size-1.5 rounded-[2px]", DOT[state])} />
            {STATE_LABEL[state]}
          </span>
        )}
        <Button
          size="xs"
          variant="ghost"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          aria-label={collapsed ? `Expand ${agent.name}` : `Collapse ${agent.name}`}
          icon={<Chevron up={!collapsed} />}
        />
      </div>

      {/* Body folds by grid rows. */}
      <div
        id={bodyId}
        inert={collapsed}
        className={cn("grid transition-[grid-template-rows,opacity] duration-300 motion-reduce:transition-none", EASE, collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100")}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-3 px-3 pb-3">
            {/* Well */}
            <div
              className={cn(
                "flex h-10 min-w-0 items-center gap-2.5 rounded-[10px] px-2.5",
                "bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] shadow-[inset_0_1px_2px_rgb(0_0_0/0.05)] dark:bg-[color-mix(in_srgb,#000_30%,transparent)]",
                WELL[state],
                "transition-[background-color,box-shadow] duration-300",
                EASE,
              )}
            >
              {wellIcon && (
                <span className="grid size-6 flex-none place-items-center rounded-[7px] bg-card shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_9%,transparent)] dark:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]">
                  <Logo icon={wellIcon} />
                </span>
              )}
              <span className={cn("min-w-0 truncate font-medium", !wellExtra && "flex-1")}>
                {wellLabel}
              </span>
              {wellExtra}
              {clock !== undefined && (
                <span className="flex-none text-[12px] text-muted-foreground tabular-nums" aria-hidden>
                  {formatClock(clock)}
                </span>
              )}
            </div>

            <TimeStrip steps={steps} now={now} state={state} waitSince={ask?.since} openKey={openKey} setOpenKey={setOpenKey} />

            {/* Finished steps: three rows tall, then it scrolls. */}
            {rows.length > 0 && (
              <ul aria-label="Finished steps" className="-mx-1 -mt-1 flex max-h-[84px] flex-col overflow-y-auto overscroll-contain [scrollbar-width:thin]">
                {rows.map((s) => {
                  const key = `row:${s.id}`;
                  const took = formatTook(stepDuration(s, now));
                  return (
                    <li key={s.id} className="flex-none">
                      <Popover
                        open={openKey === key}
                        onOpenChange={(o) => setOpenKey(o ? key : null)}
                        aria-label={s.label}
                        side="bottom"
                        trigger={
                          <button
                            type="button"
                            aria-label={`${s.label}${s.tool ? `, ${s.tool}` : ""}, ${s.state === "failed" ? "failed after" : "took"} ${took}`}
                            className={cn(
                              "flex h-7 w-full min-w-0 items-center gap-2.5 rounded-[8px] px-2 text-left text-[12.5px] transition-colors duration-150",
                              "hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] aria-expanded:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)]",
                              "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                            )}
                          >
                            <Logo icon={stepIcon(s)} className="text-muted-foreground" />
                            <span className={cn("min-w-0 flex-1 truncate", "text-foreground/85")}>{s.label}</span>
                            <span className="flex-none text-[11.5px] text-muted-foreground tabular-nums">{took}</span>
                          </button>
                        }
                      >
                        <StepInfo step={s} now={now} />
                      </Popover>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Footer */}
            {(footer || count || onLog) && (
              <div className="-mb-0.5 flex min-h-7 items-center gap-1">
                {footer}
                <span className="flex-1" />
                {count && <span className="px-1 text-[11.5px] text-muted-foreground tabular-nums" aria-label={`Step ${count.replace("/", " of ")}`}>{count}</span>}
                {onLog && (
                  <Button size="sm" variant="ghost" iconRight={<ArrowUpRight />} onClick={onLog}>
                    Log
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgentMonitor;
