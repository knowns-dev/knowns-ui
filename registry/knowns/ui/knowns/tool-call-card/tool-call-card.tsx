"use client";
/** @registry name="tool-call-card" type="ui" title="Tool call card" description="One call in detail: status and duration, input, output or error as highlighted JSON, retry." */

/**
 * ToolCallCard: one tool call. By default a single quiet row (icon, tool name, what it did, timer, status)
 * that folds open, on a muted surface, to the arguments and the result, with copy, "Show more" for long
 * results and Retry next to the error. variant="card" is the standalone view with who called whom on top.
 *
 * ToolCallGroup sums several calls up in one line ("Used 3 tools · 1 failed · 2.7s") and folds open to
 * the calls; a failure opens it, and the failed call, by itself.
 */
import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react";
import type { Actor, Span } from "@/registry/knowns/lib/knowns/types";
import { useAgentSnapshot, type AgentRun } from "@/registry/knowns/lib/knowns/run";
import { CodeBlock } from "../code-block/code-block";
import { actorColors, rootAgent } from "@/registry/knowns/lib/knowns/status";
import { actorIcon } from "@/registry/knowns/lib/knowns/icons/actor-icon";
import { toolIcon } from "@/registry/knowns/lib/knowns/icons/tool-icons";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Fold, MotionStyle, usePlay } from "@/registry/knowns/lib/knowns/motion";

/* ── Pure helpers (exported for tests) ── */

export type CallStatus = "running" | "success" | "failure";

export const callStatus = (span: Pick<Span, "outcome">): CallStatus => (span.outcome === "failure" ? "failure" : span.outcome ? "success" : "running");

/** 420 -> "420ms", 2712 -> "2.7s", 74000 -> "1m 14s". */
export function formatMs(ms: number): string {
  const v = Math.max(0, ms);
  if (v < 1000) return `${Math.round(v)}ms`;
  if (v < 60_000) return `${(v / 1000).toFixed(1)}s`;
  const m = Math.floor(v / 60_000);
  return `${m}m ${Math.round((v % 60_000) / 1000)}s`;
}

export const callMs = (span: Pick<Span, "startedAt" | "endedAt">, now: number) => (span.endedAt ?? now) - span.startedAt;

export interface GroupSummary {
  count: number;
  running: number;
  failed: number;
  /** Wall time from the first start to the last end (or now while running). */
  ms: number;
  text: string;
}

/** "Used 3 tools · 1 failed · 2.7s", or "Using tools · 2 of 3 done" while something runs. */
export function groupSummary(spans: Pick<Span, "startedAt" | "endedAt" | "outcome">[], now: number): GroupSummary {
  const count = spans.length;
  const running = spans.filter((s) => !s.outcome).length;
  const failed = spans.filter((s) => s.outcome === "failure").length;
  const start = Math.min(...spans.map((s) => s.startedAt));
  const end = Math.max(...spans.map((s) => s.endedAt ?? now));
  const ms = count ? end - start : 0;
  const tools = `${count} ${count === 1 ? "tool" : "tools"}`;
  const parts = running ? [`Using ${tools}`, `${count - running} of ${count} done`] : [`Used ${tools}`];
  if (failed) parts.push(`${failed} failed`);
  if (!running && count) parts.push(formatMs(ms));
  return { count, running, failed, ms, text: parts.join(" · ") };
}

/** Text to copy: strings as they are, everything else as pretty JSON. */
export const copyText = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v, null, 2));

/* ── Bits ── */

const S = { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const Spinner = () => (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-3.5 animate-spin [animation-duration:1s] motion-reduce:animate-none">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".25" strokeWidth="1.8" />
    <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const Check = () => (
  <svg {...S} strokeWidth={1.9} className="size-3.5">
    <path d="m3.5 8.5 3 3 6-7" pathLength={1} className="kn-m-stroke" />
  </svg>
);
const Cross = () => (
  <svg {...S} className="size-3.5">
    <circle cx="8" cy="8" r="6" />
    <path d="m6 6 4 4m0-4-4 4" pathLength={1} className="kn-m-stroke" />
  </svg>
);
const Chevron = ({ open }: { open: boolean }) => (
  <svg {...S} className={cn("size-3.5 flex-none text-muted-foreground transition-transform duration-(--kn-dur) ease-(--kn-ease-inout) motion-reduce:transition-none", open && "rotate-90")}>
    <path d="m6 4 4 4-4 4" />
  </svg>
);
const Wrench = () => (
  <svg {...S}>
    <path d="M10.2 2.6a3.2 3.2 0 0 0-3.9 4.1L2.6 10.4a1.4 1.4 0 0 0 2 2l3.7-3.7a3.2 3.2 0 0 0 4.1-3.9l-1.9 1.9-1.6-.4-.4-1.6 1.7-2.1Z" />
  </svg>
);

/**
 * The status glyph. Only a real change plays (kn-motion): a call that finishes draws its check, a call that fails
 * shakes once and draws the X. First render, the running clock and re-renders with the same status stay still.
 */
function StatusMark({ status }: { status: CallStatus }) {
  const play = usePlay(status, (_, next) => (next === "success" ? "draw" : next === "failure" ? "shake" : undefined));
  if (status === "running")
    return (
      <span key={status} className="flex flex-none text-indigo-600 dark:text-indigo-400" role="img" aria-label="Running">
        <Spinner />
      </span>
    );
  if (status === "success")
    return (
      <span key={status} data-kn-m={play} className="flex flex-none text-emerald-600 dark:text-emerald-400" role="img" aria-label="Done">
        <Check />
      </span>
    );
  return (
    <span key={status} className="flex flex-none items-center gap-1 text-[12.5px] text-muted-foreground">
      <span data-kn-m={play} className="flex text-red-600 dark:text-red-400" aria-hidden="true">
        <Cross />
      </span>
      Failed
    </span>
  );
}

/** Ticks once a second while `on` (the running time shows whole seconds); a fixed `now` wins (tests, screenshots). */
function useClock(on: boolean, fixed?: number) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    if (!on || fixed !== undefined) return;
    setT(Date.now());
    const id = setInterval(() => setT(Date.now()), 1000);
    return () => clearInterval(id);
  }, [on, fixed]);
  return fixed ?? t;
}

/** A labelled value on the detail surface: a flush Code Block (JSON colours, copy, fold past `max` px worth of lines). */
function Block({ label, value, max, waiting }: { label: string; value: unknown; max: number; waiting?: string }) {
  if (value === undefined) {
    return (
      <div className="min-w-0">
        <div className="flex h-6 items-center text-[12px] font-medium text-muted-foreground">{label}</div>
        <p className="text-[12.5px] text-muted-foreground">{waiting ?? "Nothing"}</p>
      </div>
    );
  }
  return (
    <CodeBlock
      flush
      code={copyText(value)}
      language={typeof value === "string" ? undefined : "json"}
      label={label}
      wrapToggle={false}
      collapseAfter={Math.max(4, Math.floor(max / 20))}
      className="min-w-0 [&_figcaption]:min-h-6 [&_figcaption]:border-b-0 [&_figcaption]:py-0 [&_figcaption]:pr-0 [&_figcaption]:pl-0 [&_figcaption_span]:text-[12px] [&_figcaption_button]:h-6 [&_figcaption_button]:px-1.5 [&_pre]:py-0! [&_pre]:leading-[1.6]! [&_[data-line]]:min-h-[1.6em]! [&_[data-line]]:px-0!"
    />
  );
}

/* ── ToolCallCard ── */

export interface ToolCallCardProps {
  /** The span to show. Or pass `run` + `spanId` to follow it live. */
  span?: Span;
  run?: AgentRun;
  spanId?: string;
  /** Used for names and icons when no run is given. */
  actors?: Actor[];
  /** "line" (default): one quiet row that folds open, for chat threads and lists. "card": standalone, with who called whom. */
  variant?: "line" | "card";
  /** Tool name in mono. Default: the called actor's label. */
  name?: string;
  /** 16px icon. Default: the tool's logo, else a wrench. */
  icon?: ReactNode;
  /** Open state (controlled). */
  open?: boolean;
  /** First open state. Default: open when the call failed (line), always open (card). */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Shows Retry next to the error on failed calls. */
  onRetry?: (span: Span) => void;
  /** Arguments and result taller than this (px) are capped with "Show more". Default 220. */
  maxHeight?: number;
  /** Fixes the clock (tests, screenshots). */
  now?: number;
  className?: string;
}

/** Inside a ToolCallGroup: rows run edge to edge on hairlines. */
const InGroup = createContext(false);

/**
 * Shared columns: the tool name gets a fixed width so every summary, and the open detail, starts at the same x.
 * Row: 12px padding + 16px icon + 8px gap + name + 8px gap. Phones drop the name column (the icon and title keep it).
 */
const COLS = "[--tc-name:6.5rem] sm:[--tc-name:8.5rem] [--tc-surface:color-mix(in_srgb,var(--muted)_55%,var(--card))]";
const INDENT = "pl-9 sm:pl-[calc(44px+var(--tc-name))]";

/** One tool call: a row that folds open to arguments, result and error, or a standalone card. */
export function ToolCallCard({
  span: spanProp,
  run,
  spanId,
  actors: actorsProp,
  variant = "line",
  name,
  icon,
  open: openProp,
  defaultOpen,
  onOpenChange,
  onRetry,
  maxHeight = 220,
  now: nowProp,
  className,
}: ToolCallCardProps) {
  const grouped = useContext(InGroup);
  const snap = useAgentSnapshot(run);
  const span = spanProp ?? snap?.spans.find((s) => s.id === spanId);
  const actors = snap?.actors ?? actorsProp ?? [];
  const status = span ? callStatus(span) : "running";
  const now = useClock(!!span && status === "running", nowProp);
  const card = variant === "card";
  const [own, setOwn] = useState<boolean | null>(defaultOpen ?? null);
  const panelId = useId();

  if (!span) {
    return (
      <div className={cn("rounded-xl border border-dashed bg-card px-4 py-6 text-center text-[13px] text-muted-foreground", className)}>
        Select a call to see its details.
      </div>
    );
  }

  const failed = status === "failure";
  // Uncontrolled and untouched: failures open by themselves (cards are always open).
  const open = openProp ?? own ?? (card || failed);
  const setOpen = (v: boolean) => {
    if (openProp === undefined) setOwn(v);
    onOpenChange?.(v);
  };
  const to = actors.find((a) => a.id === span.to);
  const toolName = name ?? to?.label ?? span.to;
  const mark = icon ?? (to ? actorIcon(to) : toolIcon(toolName)) ?? <Wrench />;
  const elapsed = callMs(span, now);
  // Running: whole seconds, so one render a second is enough. Finished: the exact time.
  const time = span.endedAt === undefined && elapsed >= 1000 && elapsed < 60_000 ? `${Math.floor(elapsed / 1000)}s` : formatMs(elapsed);

  const detail = (
    <div className="flex flex-col gap-3">
      {failed && (
        <p role="alert" className="text-[13px] leading-5 text-foreground">
          {span.error ?? "The call failed."}
          {onRetry && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => onRetry(span)}
                aria-label={`Retry ${toolName}`}
                className={cn("rounded-sm font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400", focusRing)}
              >
                Retry
              </button>
            </>
          )}
        </p>
      )}
      {span.input !== undefined && <Block label="Arguments" value={span.input} max={maxHeight} />}
      {(span.output !== undefined || !failed) && <Block label="Result" value={span.output} max={maxHeight} waiting={status === "running" ? "Waiting for the result…" : "No result"} />}
    </div>
  );

  if (!card) {
    return (
      <div className={cn("min-w-0", COLS, className)} data-status={status}>
        <MotionStyle />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={panelId}
          className={cn(
            "flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:bg-muted/50",
            !grouped && (open ? "rounded-t-lg" : "rounded-lg"),
            open && "bg-[var(--tc-surface)] hover:bg-[var(--tc-surface)]",
            focusRing,
          )}
        >
          <span aria-hidden="true" className="grid size-4 flex-none place-items-center text-muted-foreground [&>*]:size-full [&_svg]:size-full">
            {mark}
          </span>
          <span className="hidden w-[var(--tc-name)] flex-none truncate font-mono sm:block text-[12.5px] text-muted-foreground" title={toolName}>
            {toolName}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-foreground" title={span.summary ? `${toolName}: ${span.summary}` : toolName}>
            {span.summary ?? toolName}
          </span>
          <span className="flex-none text-[12.5px] text-muted-foreground tabular-nums">{time}</span>
          <StatusMark status={status} />
        </button>
        <Fold open={open}>
          <div id={panelId} className={cn("bg-[var(--tc-surface)] pt-1 pr-3 pb-3", INDENT, !grouped && "rounded-b-lg")}>
            {detail}
          </div>
        </Fold>
      </div>
    );
  }

  /* Standalone card: who called whom on top, then the same detail. */
  const colors = actorColors(actors);
  const root = rootAgent(actors);
  const from = actors.find((a) => a.id === span.from);
  const who = (a: Actor | undefined, id: string) => (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        aria-hidden="true"
        style={{ ["--hue" as string]: colors.get(id) ?? "var(--muted-foreground)" }}
        className="grid size-6 flex-none place-items-center rounded-md bg-muted/60 text-[11px] font-semibold text-[var(--hue)]"
      >
        <span className="grid size-[70%] place-items-center [&>svg]:size-full">{a ? actorIcon(a, a === root) : "?"}</span>
      </span>
      <span className="truncate font-medium">{a?.label ?? id}</span>
    </span>
  );
  return (
    <article
      className={cn("overflow-hidden rounded-xl border bg-card text-card-foreground", COLS, className)}
      aria-label={`Call from ${from?.label ?? span.from} to ${to?.label ?? span.to}`}
      data-status={status}
    >
      <MotionStyle />
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-3.5 pb-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-[14px]">
          {who(from, span.from)}
          <span className="flex-none text-muted-foreground" aria-label="to">
            →
          </span>
          {who(to, span.to)}
        </div>
        <span className="flex flex-none items-center gap-2 text-[12.5px] text-muted-foreground tabular-nums">
          {time}
          <StatusMark status={status} />
        </span>
        {span.summary && <p className="basis-full truncate text-[13px] text-foreground">{span.summary}</p>}
      </header>
      <div className="border-t bg-[var(--tc-surface)] px-4 pt-2 pb-4">{detail}</div>
    </article>
  );
}

/* ── ToolCallGroup ── */

export interface ToolCallGroupProps {
  /** The calls, in order. Or pass `run` (+ `spanIds`) to follow them live. */
  spans?: Span[];
  run?: AgentRun;
  /** Which spans of the run; default: all of them. */
  spanIds?: string[];
  actors?: Actor[];
  /** Header while nothing runs. Default: "Used N tools · 1 failed · 2.7s". */
  label?: ReactNode;
  open?: boolean;
  /** Default: closed, or open when a call failed. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onRetry?: (span: Span) => void;
  maxHeight?: number;
  now?: number;
  className?: string;
}

/** Several calls summed up in one line; folds open to one row per call. The only container. */
export function ToolCallGroup({ spans: spansProp, run, spanIds, actors: actorsProp, label, open: openProp, defaultOpen, onOpenChange, onRetry, maxHeight, now: nowProp, className }: ToolCallGroupProps) {
  const snap = useAgentSnapshot(run);
  const all = spansProp ?? snap?.spans ?? [];
  const spans = spanIds ? all.filter((s) => spanIds.includes(s.id)) : all;
  const actors = snap?.actors ?? actorsProp ?? [];
  const anyRunning = spans.some((s) => !s.outcome);
  const now = useClock(anyRunning, nowProp);
  const sum = groupSummary(spans, now);
  const [own, setOwn] = useState<boolean | null>(defaultOpen ?? null);
  const open = openProp ?? own ?? sum.failed > 0;
  const setOpen = (v: boolean) => {
    if (openProp === undefined) setOwn(v);
    onOpenChange?.(v);
  };
  const panelId = useId();
  if (!spans.length) return null;
  const status: CallStatus = sum.running ? "running" : sum.failed ? "failure" : "success";
  const [head, ...rest] = sum.text.split(" · ");

  return (
    <div className={cn("min-w-0 overflow-hidden rounded-xl border bg-card text-card-foreground", className)} data-status={status}>
      <MotionStyle />
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn("flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:bg-muted/50", focusRing)}
      >
        <span className="min-w-0 flex-1 truncate text-[13px]">
          {sum.running || !label ? (
            <>
              <span className="font-medium">{head}</span>
              {rest.map((part) => (
                <span key={part} className={"text-muted-foreground"}>
                  <span className="text-muted-foreground"> · </span>
                  {part}
                </span>
              ))}
            </>
          ) : (
            label
          )}
        </span>
        {sum.running > 0 && (
          <span className="flex text-indigo-600 dark:text-indigo-400" role="img" aria-label="Running">
            <Spinner />
          </span>
        )}
        <Chevron open={open} />
      </button>
      <span aria-live="polite" className="sr-only">
        {sum.running ? "" : sum.text}
      </span>
      <Fold open={open}>
        <div id={panelId} className="divide-y border-t">
          <InGroup.Provider value={true}>
            {spans.map((s) => (
              <ToolCallCard key={s.id} span={s} actors={actors} onRetry={onRetry} maxHeight={maxHeight} now={nowProp} />
            ))}
          </InGroup.Provider>
        </div>
      </Fold>
    </div>
  );
}

export default ToolCallCard;
