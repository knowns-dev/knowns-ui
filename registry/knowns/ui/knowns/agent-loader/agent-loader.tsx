"use client";
/** @registry name="agent-loader" type="ui" title="Agent loader" description="A small inline loader for an agent run: one glyph per phase (thinking, searching, reading, writing, running a tool, waiting for you, done, failed), an optional label and an optional elapsed time." */
/**
 * The compact sibling of ThinkingState: it fits in a chat bubble, a button, a table row, a toast or a status bar.
 * Each phase has its own small loop that explains the work. A phase change crossfades the glyph, and done and failed
 * play once (a check that draws, a shake and an X). Nothing plays on first render except the loop of an active phase.
 * Reduced motion shows a still glyph for every phase. Screen readers hear the label once, on a phase change.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { MOTION, SwapText, prefersReducedMotion } from "@/registry/knowns/lib/knowns/motion";
import { ShimmerText } from "../text-animation/shimmer-text";
import { type AgentPhase, defaultLabel, elapsedSeconds, formatElapsed, isBusyPhase, playFor } from "./agent-loader-utils";

export type { AgentPhase } from "./agent-loader-utils";
export type AgentLoaderSize = "sm" | "md";
export type AgentLoaderTone = "accent" | "neutral";

export interface AgentLoaderProps {
  /** The step the run is in. */
  phase: AgentPhase;
  /** Text next to the glyph. Default: a short word for the phase ("Searching"). */
  label?: string;
  /** Show the label. false leaves just the glyph, which still announces the phase to a screen reader. Default true. */
  showLabel?: boolean;
  /** When the run started (ms since epoch or a Date). Shows the elapsed time and ticks it while the agent is busy. */
  startedAt?: number | Date;
  /** When it ended. The time stops there. Without it the time stops at the moment the phase becomes done or failed. */
  endedAt?: number | Date;
  /** Seconds spent, if you track it yourself. Wins over startedAt. */
  elapsed?: number;
  /** "sm" is 16px, "md" is 20px. Default "sm". */
  size?: AgentLoaderSize;
  /** "accent" tints a working glyph with --kn-accent, "neutral" keeps it in the text colour. Waiting, done and failed always use their status colour. Default "accent". */
  tone?: AgentLoaderTone;
  /** Sweep a light band through the label while the agent is busy. Default true. */
  shimmer?: boolean;
  className?: string;
}

/* Private keyframes (knal-): periods, not UI durations. Each moves transform, opacity or a stroke offset only. The one-shots
   use the global duration tokens. Reduced motion drops every animation and leaves a still glyph for each phase. */
const CSS = `
@keyframes knal-dot { 0%, 100% { opacity: .35; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-1.5px); } }
@keyframes knal-lens { 0%, 100% { transform: translate(-1.25px, -.75px); } 50% { transform: translate(1.5px, 1px); } }
@keyframes knal-scan { 0%, 100% { opacity: .3; } 30% { opacity: 1; } 60% { opacity: .3; } }
@keyframes knal-grow { 0% { transform: scaleX(.35); } 70%, 100% { transform: scaleX(1); } }
@keyframes knal-caret { 0% { transform: translateX(0); } 70%, 100% { transform: translateX(5.9px); } }
@keyframes knal-brl { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(1.25px); } }
@keyframes knal-brr { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-1.25px); } }
@keyframes knal-core { 0%, 100% { opacity: .45; } 50% { opacity: 1; } }
@keyframes knal-ring { 0% { opacity: .55; transform: scale(.9); } 100% { opacity: 0; transform: scale(1.35); } }
@keyframes knal-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes knal-pop { from { opacity: 0; transform: scale(.92); } to { opacity: 1; transform: scale(1); } }
@keyframes knal-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-1.25px); } 45% { transform: translateX(1.25px); } 70% { transform: translateX(-.75px); } }
@keyframes knal-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes knal-out { from { opacity: 1; } to { opacity: 0; } }
[data-knal] [data-k] { transform-box: fill-box; transform-origin: center; }
[data-knal] [data-k="grow"], [data-knal] [data-k="caret"] { transform-origin: left center; }
[data-knal] .knal-in { animation: knal-in var(--kn-dur, 180ms) var(--kn-ease-out, cubic-bezier(.22, 1, .36, 1)) both; }
[data-knal] .knal-out { animation: knal-out var(--kn-dur-fast, 120ms) var(--kn-ease-out, cubic-bezier(.22, 1, .36, 1)) both; }
[data-knal] [data-play] [data-k="check"], [data-knal] [data-play] [data-k="cross"] { animation: knal-draw var(--kn-dur-slow, 280ms) var(--kn-ease-out, cubic-bezier(.22, 1, .36, 1)) both; }
[data-knal] [data-play="done"] [data-k="disc"] { animation: knal-pop var(--kn-dur-slow, 280ms) var(--kn-ease-out, cubic-bezier(.22, 1, .36, 1)) both; }
[data-knal] [data-play="error"] { animation: knal-shake var(--kn-dur-slow, 280ms) var(--kn-ease-out, cubic-bezier(.22, 1, .36, 1)) both; }
@media (prefers-reduced-motion: reduce) {
  [data-knal] *, [data-knal] *::before, [data-knal] *::after { animation: none !important; }
  [data-knal] [data-k="dot"] { opacity: .7; }
  [data-knal] [data-k="scan"] { opacity: .7; }
  [data-knal] [data-k="caret"] { transform: translateX(5.9px); }
  [data-knal] [data-k="ring"] { opacity: .35; }
  [data-knal] .knal-out { display: none; }
}
`;

const EASE_IO = "var(--kn-ease-inout, cubic-bezier(.65,0,.35,1))";
const paused = (on: boolean) => ({ animationPlayState: on ? "running" : "paused" }) as const;

function toneClass(phase: AgentPhase, tone: AgentLoaderTone): string {
  if (phase === "done") return "text-emerald-600 dark:text-emerald-400";
  if (phase === "error") return "text-red-600 dark:text-red-400";
  if (phase === "wait") return "text-amber-600 dark:text-amber-400";
  return tone === "accent" ? "text-[color:var(--kn-accent,var(--color-indigo-500))] dark:text-[color:var(--kn-accent,var(--color-indigo-400))]" : "text-foreground/70";
}

/** One glyph on a 16px grid: 1.5 stroke, round caps, the same optical size for every phase. */
function Glyph({ phase, play }: { phase: AgentPhase; play?: "done" | "error" }) {
  const a = (name: string, period: string, delay = "", ease = EASE_IO) => ({ animation: `${name} ${period} ${ease} ${delay} infinite`.replace(/\s+/g, " ") }) as const;
  switch (phase) {
    case "think":
      return (
        <g fill="currentColor" stroke="none">
          {[3.5, 8, 12.5].map((x, i) => (
            <circle key={x} data-k="dot" cx={x} cy={8} r={1.5} style={{ ...a("knal-dot", "1.3s", `${i * 0.18}s`), opacity: 0.35 }} />
          ))}
        </g>
      );
    case "search":
      return (
        <g data-k="lens" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" style={a("knal-lens", "1.8s")}>
          <circle cx={7} cy={7} r={3.75} />
          <path d="M9.9 9.9 13 13" />
        </g>
      );
    case "read":
      return (
        <g fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          {[
            ["M3 4.5h10", 0],
            ["M3 8h8", 0.22],
            ["M3 11.5h9.5", 0.44],
          ].map(([d, delay]) => (
            <path key={d as string} data-k="scan" d={d as string} style={{ ...a("knal-scan", "1.5s", `${delay}s`), opacity: 0.3 }} />
          ))}
        </g>
      );
    case "write":
      return (
        <g fill="currentColor" stroke="none">
          <rect data-k="grow" x={2} y={9.25} width={9} height={1.5} rx={0.75} style={a("knal-grow", "1.8s")} />
          <rect data-k="caret" x={5.9} y={4.5} width={1.5} height={7} rx={0.75} style={a("knal-caret", "1.8s")} />
          <rect x={2} y={4.5} width={5} height={1.5} rx={0.75} opacity={0.3} />
        </g>
      );
    case "tool":
      return (
        <g fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path data-k="brl" d="M5.5 3.5h-2v9h2" style={a("knal-brl", "1.4s")} />
          <path data-k="brr" d="M10.5 3.5h2v9h-2" style={a("knal-brr", "1.4s")} />
          <circle data-k="core" cx={8} cy={8} r={1.25} fill="currentColor" stroke="none" style={{ ...a("knal-core", "1.4s"), opacity: 0.45 }} />
        </g>
      );
    case "wait":
      return (
        <g fill="none" stroke="currentColor" strokeWidth={1.5}>
          <circle cx={8} cy={8} r={5.25} opacity={0.22} />
          <circle data-k="ring" cx={8} cy={8} r={5.25} style={{ ...a("knal-ring", "2.2s", "", "var(--kn-ease-out, cubic-bezier(.22, 1, .36, 1))"), opacity: 0.35 }} />
          <circle cx={8} cy={8} r={2} fill="currentColor" stroke="none" />
        </g>
      );
    case "done":
      return (
        <g data-play={play === "done" ? "done" : undefined} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <circle data-k="disc" cx={8} cy={8} r={6} />
          <path data-k="check" d="M5.2 8.3 7.2 10.3 10.9 6.2" pathLength={1} strokeDasharray={1} />
        </g>
      );
    case "error":
      return (
        <g data-play={play === "error" ? "error" : undefined} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <circle cx={8} cy={8} r={6} />
          <path data-k="cross" d="M6 6l4 4M10 6l-4 4" pathLength={1} strokeDasharray={1} />
        </g>
      );
  }
}

function Svg({ phase, play, size, className, busy }: { phase: AgentPhase; play?: "done" | "error"; size: number; className?: string; busy: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" aria-hidden className={cn("absolute inset-0", className)} style={paused(busy || phase === "wait")}>
      {/* a looping phase is only ever mounted while it is the current one, so it always runs */}
      <Glyph phase={phase} play={play} />
    </svg>
  );
}

/**
 * Just the glyph, for a button, a row or a header. Decorative (aria-hidden): pair it with text. On a phase change the old glyph
 * fades out as the new one fades in.
 */
export function AgentLoaderMark({ phase, size = "sm", tone = "accent", className }: { phase: AgentPhase; size?: AgentLoaderSize; tone?: AgentLoaderTone; className?: string }) {
  const px = size === "md" ? 20 : 16;
  const last = useRef(phase);
  const [leaving, setLeaving] = useState<AgentPhase | null>(null);
  const [play, setPlay] = useState<"done" | "error" | undefined>(undefined);
  const [changed, setChanged] = useState(false);
  if (last.current !== phase) {
    const prev = last.current;
    last.current = phase;
    setPlay(playFor(prev, phase));
    setChanged(true);
    setLeaving(prefersReducedMotion() ? null : prev);
  }
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setLeaving(null), MOTION.fast + 20);
    return () => clearTimeout(t);
  }, [leaving]);
  return (
    <span aria-hidden data-knal={phase} data-phase={phase} className={cn("relative inline-block flex-none", toneClass(phase, tone), className)} style={{ width: px, height: px }}>
      <style href="knal" precedence="default">
        {CSS}
      </style>
      {leaving && <Svg key={`out-${leaving}`} phase={leaving} size={px} className={cn("knal-out", toneClass(leaving, tone))} busy />}
      <Svg key={phase} phase={phase} play={play} size={px} className={changed ? "knal-in" : undefined} busy />
    </span>
  );
}

/** Seconds for the timer: ticks once a second while the agent is busy, then holds its last value (or stops at `endedAt`). */
function useSeconds(o: { busy: boolean; elapsed?: number; startedAt?: number | Date; endedAt?: number | Date }): number | undefined {
  const live = o.busy && o.elapsed === undefined && o.endedAt === undefined && o.startedAt !== undefined;
  const [now, setNow] = useState<number | null>(null);
  const held = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!live) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);
  let value: number | undefined;
  if (o.elapsed !== undefined || o.endedAt !== undefined) value = elapsedSeconds({ elapsed: o.elapsed, startedAt: o.startedAt, endedAt: o.endedAt, now: 0 });
  else if (o.startedAt === undefined) value = undefined;
  else if (live) value = now === null ? (held.current ?? 0) : elapsedSeconds({ startedAt: o.startedAt, now });
  else value = held.current ?? 0;
  if (live && value !== undefined) held.current = value;
  return value;
}

/**
 * "[glyph] Searching 12s": an inline loader for the phase a run is in. The label changes through SwapText, the
 * timer is optional, and screen readers hear the label once per phase change (the timer is silent).
 */
export function AgentLoader({ phase, label, showLabel = true, startedAt, endedAt, elapsed, size = "sm", tone = "accent", shimmer = true, className }: AgentLoaderProps) {
  const text = label ?? defaultLabel(phase);
  const busy = isBusyPhase(phase);
  const seconds = useSeconds({ busy, elapsed, startedAt, endedAt });
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 align-middle text-[13px] text-muted-foreground", size === "md" && "text-[13.5px]", className)}>
      <AgentLoaderMark phase={phase} size={size} tone={tone} />
      {showLabel ? (
        <SwapText value={phase + text} className="inline-flex min-w-0 items-center">
          <ShimmerText text={text} active={busy && shimmer} variant="sweep" className="truncate font-medium text-foreground/85" />
        </SwapText>
      ) : (
        <span className="sr-only">{text}</span>
      )}
      {seconds !== undefined && (
        <span aria-hidden className="min-w-[3ch] tabular-nums">
          {formatElapsed(seconds)}
        </span>
      )}
    </span>
  );
}

export default AgentLoader;
