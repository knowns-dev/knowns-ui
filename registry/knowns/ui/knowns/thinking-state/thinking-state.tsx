"use client";
/** @registry name="thinking-state" type="ui" title="Thinking state" description="What an agent is doing before it answers: live steps, searched sources, tool calls, streaming reasoning and a 'Thought for 12s' summary." */

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { toolIcon } from "@/registry/knowns/lib/knowns/icons/tool-icons";
import { BadgeGroup } from "../badge";
import { Button } from "../button";
import { Spinner } from "../spinner";
import { Tooltip } from "../tooltip";
import {
  announceDelay,
  domainOf,
  elapsedSeconds,
  endedLabel,
  formatDuration,
  initialOf,
  stepStatus,
  toMs,
  type ResolvedStepStatus,
  type ThinkingStatus,
  type ThinkingStepStatus,
  type TimeLike,
} from "./thinking-utils";

export type { ThinkingStatus, ThinkingStepStatus } from "./thinking-utils";
export { formatDuration } from "./thinking-utils";

export type ThinkingStepKind = "think" | "search" | "read" | "tool" | "step";

export interface ThinkingSource {
  title: string;
  url?: string;
  /** Favicon URL. */
  favicon?: string;
  /** Any logo node instead of a favicon. */
  icon?: ReactNode;
}

export interface ThinkingStep {
  id: string;
  kind: ThinkingStepKind;
  /** Plain text is best: it is also announced to screen readers and shown in the header while running. */
  title: string;
  detail?: ReactNode;
  /** Omit to derive it: the last step follows the run, earlier steps are done. */
  status?: ThinkingStepStatus;
  sources?: ThinkingSource[];
  /** Tool name for kind "tool"; its logo comes from toolIcon (e.g. "Postgres", "Slack"). */
  tool?: string;
  startedAt?: TimeLike;
  endedAt?: TimeLike;
}

export interface ThinkingStateProps {
  /** Streamed by you: append and update steps as the agent works. */
  steps: ThinkingStep[];
  /** Default "thinking". */
  status?: ThinkingStatus;
  /** When the run started / ended. Without them (and without `elapsed`) the component times the run itself. */
  startedAt?: TimeLike;
  endedAt?: TimeLike;
  /** Seconds spent, if you track it yourself. Wins over startedAt / endedAt. */
  elapsed?: number;
  /** Streaming reasoning text, shown muted under the steps. */
  reasoning?: string;
  /** Lines of reasoning shown before "Show more". Default 3. */
  reasoningLines?: number;
  /** Header text while running when no step title fits. Default "Thinking…". */
  label?: string;
  /** Header text once ended. Default "Thought for 12s" / "Stopped after 8s" / "Failed after 8s". */
  endedLabel?: (status: Exclude<ThinkingStatus, "thinking">, seconds: number | null) => ReactNode;
  open?: boolean;
  /** Default: open while thinking. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Collapse when the status turns done. Default true. */
  collapseOnDone?: boolean;
  /** Fires once each time the status turns done, with the seconds spent. */
  onDone?: (seconds: number) => void;
  /** Sources shown per step before "+N". Default 4. */
  maxSources?: number;
  /** "panel" (default): a quiet framed panel. "compact": no frame, smaller, to sit above or inside an answer. */
  variant?: "panel" | "compact";
  className?: string;
}

/* ── Glyphs (16px grid) ── */

const g = { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const KIND: Record<ThinkingStepKind, ReactNode> = {
  think: (
    <svg {...g}>
      <path d="M8 2.25v1.5M8 12.25v1.5M2.25 8h1.5M12.25 8h1.5" />
      <path d="M8 5.25 8.9 7.1l1.85.9-1.85.9L8 10.75 7.1 8.9 5.25 8l1.85-.9L8 5.25Z" />
    </svg>
  ),
  search: (
    <svg {...g}>
      <circle cx="7" cy="7" r="4.25" />
      <path d="m10.25 10.25 3 3" />
    </svg>
  ),
  read: (
    <svg {...g}>
      <path d="M2.25 3.75c1.9-.55 3.8-.35 5.75.75v8.25c-1.95-1.1-3.85-1.3-5.75-.75V3.75ZM13.75 3.75c-1.9-.55-3.8-.35-5.75.75v8.25c1.95-1.1 3.85-1.3 5.75-.75V3.75Z" />
    </svg>
  ),
  tool: (
    <svg {...g}>
      <path d="M9.75 2.5a3.25 3.25 0 0 0-3 4.5L2.6 11.15a1.25 1.25 0 0 0 0 1.75l.5.5a1.25 1.25 0 0 0 1.75 0L9 9.25a3.25 3.25 0 0 0 4.4-3.7l-1.9 1.9-1.95-.5-.5-1.95 1.9-1.9a3.3 3.3 0 0 0-1.2-.6Z" />
    </svg>
  ),
  step: (
    <svg {...g}>
      <circle cx="8" cy="8" r="2" />
    </svg>
  ),
};
const Check = () => (
  <svg {...g} strokeWidth={1.8}>
    <path d="M3.75 8.5 6.5 11.25l5.75-6.5" />
  </svg>
);
const Cross = () => (
  <svg {...g} strokeWidth={1.8}>
    <path d="m5 5 6 6m0-6-6 6" />
  </svg>
);
const Chevron = ({ open }: { open: boolean }) => (
  <svg {...g} strokeWidth={1.7} className={cn("size-3 flex-none transition-[rotate] duration-300 ease-[var(--kn-ease-out,cubic-bezier(.22,1,.36,1))] motion-reduce:transition-none", open && "rotate-90")}>
    <path d="M6 4l4 4-4 4" />
  </svg>
);

/* ── Hooks ── */

/** Re-render every `ms` while `on`. */
function useTick(on: boolean, ms = 250) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [on, ms]);
}

/** Times the run when the caller gives no timestamps: starts when status turns thinking, stops when it leaves. */
function useOwnClock(status: ThinkingStatus) {
  const clock = useRef<{ start: number; end?: number }>({ start: Date.now() });
  const prev = useRef(status);
  if (prev.current !== status) {
    if (status === "thinking") clock.current = { start: Date.now() };
    else if (prev.current === "thinking") clock.current = { ...clock.current, end: Date.now() };
    prev.current = status;
  }
  return clock.current;
}

/* ── Pieces ── */

/** Text with a soft light band sweeping across it (kn-shimmer). */
function Shimmer({ children, on }: { children: ReactNode; on: boolean }) {
  return (
    <span className="relative inline-block min-w-0 truncate align-bottom">
      {children}
      {on && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-linear-to-r from-transparent via-[color-mix(in_srgb,var(--card)_70%,transparent)] to-transparent animate-[kn-shimmer_1.8s_ease-in-out_infinite] motion-reduce:hidden"
        />
      )}
    </span>
  );
}

function SourceIcon({ source }: { source: ThinkingSource }) {
  const [broken, setBroken] = useState(false);
  const box = "grid size-3.5 flex-none place-items-center overflow-hidden rounded-[4px] [&>*]:size-full [&>svg]:size-full";
  if (source.icon) return <span aria-hidden className={box}>{source.icon}</span>;
  if (source.favicon && !broken)
    return (
      <span aria-hidden className={box}>
        <img src={source.favicon} alt="" loading="lazy" draggable={false} onError={() => setBroken(true)} />
      </span>
    );
  return (
    <span aria-hidden className={cn(box, "bg-muted text-[8.5px] font-semibold text-muted-foreground")}>
      {initialOf(domainOf(source.url) || source.title)}
    </span>
  );
}

/** A source chip: a real link (when it has a url) with the full title in a tooltip. `children` is its short name. */
function SourceChip({ source, children }: { source: ThinkingSource; children: string }) {
  const cls = cn(
    "inline-flex h-5.5 max-w-44 items-center gap-1.5 rounded-md px-1.5 text-[11.5px] text-muted-foreground",
    "bg-card shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_10%,transparent)]",
    "transition-[color,background-color] duration-150 ease-[var(--kn-ease-out,cubic-bezier(.22,1,.36,1))]",
  );
  const body = (
    <>
      <SourceIcon source={source} />
      <span className="truncate">{children}</span>
    </>
  );
  return (
    <Tooltip content={source.title} description={source.url ? domainOf(source.url) : undefined}>
      {source.url ? (
        <a href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`${source.title} (${children}, opens in a new tab)`} className={cn(cls, "hover:bg-muted/60 hover:text-foreground", focusRing)}>
          {body}
        </a>
      ) : (
        <span tabIndex={0} aria-label={source.title} className={cn(cls, focusRing)}>
          {body}
        </span>
      )}
    </Tooltip>
  );
}

function StatusMark({ s }: { s: ResolvedStepStatus }) {
  if (s === "running") return <Spinner className="size-3 text-muted-foreground" label="" />;
  if (s === "done") return <span className="grid size-3.5 place-items-center text-emerald-600/80 dark:text-emerald-400/80 [&>svg]:size-full"><Check /></span>;
  if (s === "failed") return <span className="grid size-3.5 place-items-center text-red-600 dark:text-red-400 [&>svg]:size-full"><Cross /></span>;
  return <span className="size-1.5 rounded-full bg-muted-foreground/40" />;
}

const STATUS_TEXT: Record<ResolvedStepStatus, string> = { running: "in progress", done: "done", failed: "failed", stopped: "stopped" };

/* ── Component ── */

/**
 * The "agent is working" panel: a header with a live timer, a rail of steps (think, search, read,
 * tool) with sources, and optional streaming reasoning. Everything comes from your stream; nothing is
 * faked on a timer. Opens while thinking and folds to "Thought for 12s" when done.
 */
export function ThinkingState({
  steps,
  status = "thinking",
  startedAt,
  endedAt,
  elapsed,
  reasoning,
  reasoningLines = 3,
  label = "Thinking…",
  endedLabel: endedLabelProp,
  open: openProp,
  defaultOpen,
  onOpenChange,
  collapseOnDone = true,
  onDone,
  maxSources = 4,
  variant = "panel",
  className,
}: ThinkingStateProps) {
  const running = status === "thinking";
  const compact = variant === "compact";
  const bodyId = useId();

  /* Time */
  const own = useOwnClock(status);
  const timed = elapsed === undefined && startedAt === undefined;
  useTick(running && elapsed === undefined);
  const seconds = timed
    ? elapsedSeconds({ startedAt: own.start, endedAt: own.end, now: Date.now() })
    : elapsedSeconds({ elapsed, startedAt, endedAt: running ? undefined : endedAt ?? Date.now(), now: Date.now() });

  const endText = !running ? endedLabel(status as Exclude<ThinkingStatus, "thinking">, seconds) : "";

  /* Open state: auto-open while thinking, auto-collapse on done; a click overrides until the next change. */
  const [ownOpen, setOwnOpen] = useState(defaultOpen ?? running);
  const open = openProp ?? ownOpen;
  const setOpen = (v: boolean) => {
    if (openProp === undefined) setOwnOpen(v);
    onOpenChange?.(v);
  };
  const prevStatus = useRef(status);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const secondsRef = useRef(seconds);
  secondsRef.current = seconds;
  const [announce, setAnnounce] = useState("");
  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = status;
    if (prev === status) return;
    if (status === "thinking") setOpen(true);
    else setAnnounce(endText);
    if (status === "done") {
      if (collapseOnDone) setOpen(false);
      onDoneRef.current?.(Math.round((secondsRef.current ?? 0) * 10) / 10);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  /* Steps that arrive after mount rise in; the first render's steps don't. */
  const seen = useRef<Set<string> | null>(null);
  if (seen.current === null) seen.current = new Set(steps.map((s) => s.id));
  const fresh = steps.filter((s) => !seen.current!.has(s.id)).map((s) => s.id);
  useEffect(() => {
    for (const s of steps) seen.current!.add(s.id);
  });

  /* Live region: announce new step titles, at most one message every 1.5s. */
  const announced = useRef<Set<string>>(new Set(steps.map((s) => s.id)));
  const pending = useRef<string[]>([]);
  const lastAt = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    for (const s of steps)
      if (!announced.current.has(s.id)) {
        announced.current.add(s.id);
        pending.current.push(s.title);
      }
    if (!pending.current.length || timer.current) return;
    const flush = () => {
      timer.current = undefined;
      if (!pending.current.length) return;
      setAnnounce(pending.current.join(". "));
      pending.current = [];
      lastAt.current = Date.now();
    };
    const wait = announceDelay(lastAt.current, Date.now(), 1500);
    if (wait === 0) flush();
    else timer.current = setTimeout(flush, wait);
  }, [steps]);
  useEffect(() => () => clearTimeout(timer.current), []);

  /* Header */
  const current = [...steps].reverse().find((s, i) => stepStatus(s, steps.length - 1 - i, steps.length, status) === "running");
  /* Open, the list already shows the running step, so the header says what the whole thing is; closed, it is the only place the step shows. */
  const headline = running ? (open ? label : current?.title ?? label) : endedLabelProp ? endedLabelProp(status as Exclude<ThinkingStatus, "thinking">, seconds) : endText;
  /* A page searched and then read is one source, not two: count each url (or title) once. */
  const sourceCount = new Set(steps.flatMap((s) => (s.sources ?? []).map((x) => x.url ?? x.title))).size;
  const summary = !running && steps.length > 0 ? [`${steps.length} ${steps.length === 1 ? "step" : "steps"}`, sourceCount > 0 && `${sourceCount} ${sourceCount === 1 ? "source" : "sources"}`].filter(Boolean).join(" · ") : "";

  return (
    <div
      className={cn(
        "text-foreground",
        compact ? "text-[12.5px]" : "rounded-xl bg-card px-3.5 py-2.5 text-[13px] shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_9%,transparent)]",
        className,
      )}
    >
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>

      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(!open)}
        className={cn(
          "group -mx-1 flex max-w-[calc(100%+0.5rem)] items-center gap-2 rounded-md px-1 py-0.5 text-left",
          "text-muted-foreground transition-colors duration-150 hover:text-foreground",
          focusRing,
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-1.5 flex-none rounded-full",
            running ? "bg-indigo-500 [--hue:var(--color-indigo-500)] motion-safe:animate-[kn-breathe_1.8s_ease-in-out_infinite]" : status === "failed" ? "bg-red-500" : status === "stopped" ? "bg-muted-foreground/50" : "bg-emerald-500/80",
          )}
        />
        <span className={cn("min-w-0 flex-none truncate font-medium max-w-[70%]", running && "text-foreground/85", status === "failed" && "text-red-600 dark:text-red-400")}>
          <Shimmer on={running}>{headline}</Shimmer>
        </span>
        {running && seconds !== null && <span className="flex-none text-muted-foreground tabular-nums">{formatDuration(seconds)}</span>}
        {summary && <span className="min-w-0 truncate text-muted-foreground">· {summary}</span>}
        <Chevron open={open} />
      </button>

      {/* Body: animated with grid rows; inert while closed so links aren't tab stops. */}
      <div
        id={bodyId}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-[var(--kn-ease-out,cubic-bezier(.22,1,.36,1))] motion-reduce:transition-none",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          {steps.length > 0 && (
            <ol aria-label="Steps" className={cn("flex flex-col", compact ? "pt-2 pl-0.5" : "pt-3 pb-1")}>
              {steps.map((step, i) => {
                const s = stepStatus(step, i, steps.length, status);
                const last = i === steps.length - 1;
                const logo = step.kind === "tool" ? toolIcon(step.tool ?? step.title) : null;
                const took = step.startedAt !== undefined && step.endedAt !== undefined ? ((toMs(step.endedAt) ?? 0) - (toMs(step.startedAt) ?? 0)) / 1000 : null;
                return (
                  <li
                    key={step.id}
                    className={cn(
                      "relative grid grid-cols-[20px_minmax(0,1fr)] gap-x-2.5",
                      !last && (compact ? "pb-2.5" : "pb-3"),
                      fresh.includes(step.id) && "animate-[kn-rise_320ms_var(--kn-ease-out,cubic-bezier(.22,1,.36,1))_both] motion-reduce:animate-none",
                    )}
                  >
                    {/* Rail */}
                    {!last && <span aria-hidden className="absolute top-6 bottom-0.5 left-[9.5px] w-px bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)]" />}
                    <span
                      aria-hidden
                      style={s === "running" ? ({ "--hue": "var(--color-indigo-500)" } as CSSProperties) : undefined}
                      className={cn(
                        "relative mt-px grid size-5 place-items-center rounded-full bg-card",
                        "shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_11%,transparent)]",
                        s === "running" ? "text-indigo-600 dark:text-indigo-300" : s === "failed" ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
                        logo ? "p-[3px] [&>*]:size-full" : "[&>svg]:size-3",
                      )}
                    >
                      {/* The breathing halo sits on its own layer so the hairline ring stays. */}
                      {s === "running" && <span className="absolute inset-0 rounded-full motion-safe:animate-[kn-breathe_1.8s_ease-in-out_infinite]" />}
                      {logo ?? KIND[step.kind]}
                    </span>
                    <div className="min-w-0">
                      <div className="flex min-h-5.5 items-center gap-2">
                        <span className={cn("min-w-0 flex-1 leading-snug", s === "running" ? "text-foreground" : s === "failed" ? "text-red-700 dark:text-red-300" : "text-foreground/80")}>
                          {step.title}
                          <span className="sr-only">, {STATUS_TEXT[s]}</span>
                        </span>
                        {took !== null && s !== "running" && <span className="flex-none text-[11.5px] text-muted-foreground tabular-nums">{formatDuration(took)}</span>}
                        <span aria-hidden className="grid w-3.5 flex-none place-items-center">
                          <StatusMark s={s} />
                        </span>
                      </div>
                      {step.detail && <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{step.detail}</div>}
                      {step.sources && step.sources.length > 0 && (
                        <BadgeGroup max={maxSources} aria-label={`Sources for ${step.title}`} className="mt-1.5 gap-1.5">
                          {step.sources.map((src, k) => (
                            <SourceChip key={`${src.url ?? src.title}-${k}`} source={src}>
                              {domainOf(src.url) || src.title}
                            </SourceChip>
                          ))}
                        </BadgeGroup>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {reasoning && <Reasoning text={reasoning} lines={reasoningLines} live={running} indent={steps.length > 0} compact={compact} />}
        </div>
      </div>
    </div>
  );
}

/** Muted reasoning text. While live it shows the newest lines (the tail); when done, the start. "Show more" opens it all. */
function Reasoning({ text, lines, live, indent, compact }: { text: string; lines: number; live: boolean; indent: boolean; compact: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // Fade in only what arrived since the last render.
  const prev = useRef("");
  const stable = text.startsWith(prev.current) ? prev.current : "";
  const added = text.slice(stable.length);
  useEffect(() => {
    prev.current = text;
  });

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1 || expanded);
    if (!expanded) el.scrollTop = live ? el.scrollHeight : 0;
  }, [text, expanded, live]);

  const mask = !expanded && overflows ? (live ? "linear-gradient(to bottom, transparent, #000 1.4em)" : "linear-gradient(to top, transparent, #000 1.4em)") : undefined;
  return (
    <div className={cn(indent && "pl-[30px]", compact ? "pt-2" : "pt-2.5 pb-1")}>
      <div
        ref={box}
        style={{ maxHeight: expanded ? undefined : `${lines * 1.6}em`, maskImage: mask, WebkitMaskImage: mask }}
        className="overflow-hidden text-[12.5px] leading-[1.6] whitespace-pre-wrap text-muted-foreground"
      >
        {stable}
        {added && (
          <span key={text.length} className="animate-[kn-word_420ms_var(--kn-ease-out,cubic-bezier(.22,1,.36,1))_both] motion-reduce:animate-none">
            {added}
          </span>
        )}
      </div>
      {overflows && (
        <Button size="xs" variant="quiet" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)} className="mt-1 -ml-0.5">
          {expanded ? "Show less" : "Show more"}
        </Button>
      )}
    </div>
  );
}

export default ThinkingState;
