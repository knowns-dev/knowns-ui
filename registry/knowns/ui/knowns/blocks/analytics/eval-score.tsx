"use client";
/** @registry name="eval-score" type="block" title="Eval score" description="A score card for AI evals: one 0 to 100 score made of weighted sub-scores, drawn as a half-arc (or ring) of rounded segments that fill over a faint track, a rating from your thresholds, a stepper between eval runs and a row per sub-score. Pointing at or focusing a row or a segment dims the rest." */

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { EASE, MOTION, prefersReducedMotion, SwapText } from "@/registry/knowns/lib/knowns/motion";
import { AnimatedNumber } from "../../animated-number";
import { Button } from "../../button";
import { Card } from "../../card";
import { capAngle, partialSpan, roundedSectorPath, sectorPath } from "../../chart/chart-radial";
import { bezierOf } from "../../chart/chart-utils";
import { VIVID_COLORS } from "../../chart/chart";

export interface EvalCriterion {
  /** Name of the sub-score: "Accuracy". */
  label: string;
  /** A short note under the name: "Matches the reference answer". */
  note?: string;
  /** Points earned in this run. */
  score: number;
  /** Points available. The segment's length follows it, so weights are the maxes: 50, 30 and 20 weigh 50%, 30% and 20%. */
  max: number;
  /** Any CSS colour. Default: the card's palette, one colour per sub-score, the same in every run. */
  color?: string;
}

export interface EvalRun {
  /** Shown in the stepper: "Run 14". */
  label: string;
  /** Shown after the label: "Nov 14". */
  date?: string;
  criteria: EvalCriterion[];
}

export interface EvalRating {
  /** The lowest score (0 to 100) that earns this label. */
  min: number;
  label: string;
}

export interface EvalScoreProps {
  title: ReactNode;
  description?: ReactNode;
  /** Runs in order, oldest first. The stepper moves between them; the latest is shown first. */
  runs: EvalRun[];
  /** Controlled index into `runs`. */
  run?: number;
  defaultRun?: number;
  onRunChange?: (index: number) => void;
  /** Labels by lowest score, best first or in any order. Default: 90 Excellent, 75 Good, 50 Fair, 0 Needs work. */
  ratings?: EvalRating[];
  /** "arc" (default) is a half circle; "ring" a full one. */
  shape?: "arc" | "ring";
  /** Round the ends of the segments. Default true. */
  rounded?: boolean;
  /** Width of the gauge in px, at most. Default 320. */
  size?: number;
  /** Fired with the sub-score's index when its segment or row is pressed. */
  onSelect?: (index: number, criterion: EvalCriterion) => void;
  className?: string;
}

/** The card's own colours, the same bold set as Goal rings, plus an amber and a violet for more sub-scores. */
export const EVAL_COLORS = [...VIVID_COLORS, "oklch(0.74 0.15 75)", "oklch(0.64 0.18 295)"];

export const DEFAULT_RATINGS: EvalRating[] = [
  { min: 90, label: "Excellent" },
  { min: 75, label: "Good" },
  { min: 50, label: "Fair" },
  { min: 0, label: "Needs work" },
];

/* ── Pure helpers (exported for tests) ── */

/** The overall score, 0 to 100: points earned over points available. Zero when nothing is available. */
export function evalTotal(criteria: Pick<EvalCriterion, "score" | "max">[]): number {
  const max = criteria.reduce((a, c) => a + Math.max(0, c.max), 0);
  if (max <= 0) return 0;
  const got = criteria.reduce((a, c) => a + Math.min(Math.max(0, c.score), Math.max(0, c.max)), 0);
  return Math.round((got / max) * 100);
}

/** The label for a score: the one with the highest `min` the score reaches. Empty when none is reached. */
export function ratingFor(score: number, ratings: EvalRating[] = DEFAULT_RATINGS): string {
  let best: EvalRating | null = null;
  for (const r of ratings) if (score >= r.min && (!best || r.min > best.min)) best = r;
  return best?.label ?? "";
}

/** Angles of each segment along the gauge, from `start` over `sweep` radians, sized by weight. */
export function gaugeSpans(weights: number[], start: number, sweep: number): [number, number][] {
  const total = weights.reduce((a, w) => a + Math.max(0, w), 0);
  let a = start;
  return weights.map((w) => {
    const end = total > 0 ? a + (Math.max(0, w) / total) * sweep : a;
    const span: [number, number] = [a, end];
    a = end;
    return span;
  });
}

const EASE_INOUT = bezierOf(EASE.inOut);

/** `target`, eased over the slow motion step whenever it changes (a change mid-way continues from where it is). Instant on first render, on reduced motion and when the length changes. */
function useTweened(target: number[]): number[] {
  const [shown, setShown] = useState(target);
  const cur = useRef(target);
  const key = target.join(",");
  useEffect(() => {
    const from = cur.current;
    if (from.length !== target.length || prefersReducedMotion() || from.join(",") === key) {
      cur.current = target;
      setShown(target);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / MOTION.slow);
      const e = EASE_INOUT(p);
      const next = target.map((x, i) => from[i]! + (x - from[i]!) * e);
      cur.current = p >= 1 ? target : next;
      setShown(cur.current);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return shown;
}

const num = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 1 });
const Chevron = ({ dir }: { dir: "left" | "right" }) => (
  <svg viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-4">
    <path d={dir === "left" ? "M10 3.5 5.5 8l4.5 4.5" : "M6 3.5 10.5 8 6 12.5"} />
  </svg>
);

const HOVER = "transition-opacity duration-(--kn-dur-fast) ease-(--kn-ease-out) motion-reduce:transition-none";

/** An eval score card: a gauge of weighted sub-scores, the overall score and its rating, a run stepper, and a row per sub-score. */
export function EvalScore({ title, description, runs, run, defaultRun, onRunChange, ratings = DEFAULT_RATINGS, shape = "arc", rounded = true, size = 320, onSelect, className }: EvalScoreProps) {
  const id = useId();
  const last = Math.max(0, runs.length - 1);
  const [own, setOwn] = useState(Math.min(last, defaultRun ?? last));
  const index = Math.min(last, Math.max(0, run ?? own));
  const current = runs[index];
  const criteria = current?.criteria ?? [];
  const [focus, setFocus] = useState<number | null>(null);
  const go = (next: number) => {
    const n = Math.min(last, Math.max(0, next));
    if (n === index) return;
    if (run === undefined) setOwn(n);
    onRunChange?.(n);
  };

  const colors = criteria.map((c, i) => c.color ?? EVAL_COLORS[i % EVAL_COLORS.length]!);
  const score = evalTotal(criteria);
  const rating = ratingFor(score, ratings);

  // Maxes then scores: both ease when the run changes, so a segment can grow and fill at once.
  const t = useTweened([...criteria.map((c) => Math.max(0, c.max)), ...criteria.map((c) => Math.min(Math.max(0, c.score), Math.max(0, c.max)))]);
  const n = criteria.length;
  const maxes = t.slice(0, n);
  const scores = t.slice(n);

  const arc = shape === "arc";
  const W = arc ? 320 : 240;
  const H = arc ? 176 : 240;
  const cx = W / 2;
  const cy = arc ? 164 : 120;
  const outer = arc ? 152 : 112;
  const inner = outer - (arc ? 30 : 26);
  const mid = (outer + inner) / 2;
  const pad = 6 / mid;
  const cap = rounded ? capAngle(outer, inner) : 0;
  const spans = gaugeSpans(maxes, arc ? -Math.PI : -Math.PI / 2, arc ? Math.PI : Math.PI * 2 - 1e-3);
  const pathOf = (s: [number, number]) => (rounded ? roundedSectorPath(cx, cy, outer, inner, s, n > 1 ? pad : 0) : sectorPath(cx, cy, outer, inner, s, n > 1 ? pad : 0));

  const label = typeof title === "string" ? title : "Eval score";
  const stepLabel = current ? `${current.label}${current.date ? `, ${current.date}` : ""}` : "";

  return (
    <Card data-slice="eval-score" className={cn("@container w-full p-5", className)} aria-labelledby={`${id}-t`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 id={`${id}-t`} className="text-[15px] font-semibold tracking-tight">{title}</h3>
          {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {runs.length > 1 && (
          <div role="group" aria-label="Eval run" className="flex items-center gap-1">
            <Button size="sm" variant="ghost" aria-label="Previous run" disabled={index === 0} onClick={() => go(index - 1)} icon={<Chevron dir="left" />} />
            <span aria-live="polite" className="min-w-24 text-center text-[13px] tabular-nums">
              <span className="font-medium">{current?.label}</span>
              {current?.date && <span className="text-muted-foreground"> · {current.date}</span>}
              <span className="sr-only">, {index + 1} of {runs.length}</span>
            </span>
            <Button size="sm" variant="ghost" aria-label="Next run" disabled={index === last} onClick={() => go(index + 1)} icon={<Chevron dir="right" />} />
          </div>
        )}
      </div>

      <div className="mx-auto mt-4" style={{ maxWidth: size }}>
        <div role="img" aria-label={`${label}${stepLabel ? `, ${stepLabel}` : ""}: ${score} out of 100${rating ? `, ${rating}` : ""}`} className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
          <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="absolute inset-0 size-full">
            {criteria.map((c, i) => {
              const span = spans[i]!;
              const track = pathOf(span);
              const ratio = maxes[i]! > 0 ? Math.min(1, scores[i]! / maxes[i]!) : 0;
              const fill = ratio > 0.0005 ? pathOf(partialSpan(span, n > 1 ? pad : 0, cap, ratio)) : "";
              return (
                <g
                  key={c.label}
                  data-segment={i}
                  data-active={focus === i ? "" : undefined}
                  className={cn(HOVER, onSelect && "cursor-pointer")}
                  style={{ opacity: focus !== null && focus !== i ? 0.35 : 1 }}
                  onPointerEnter={() => setFocus(i)}
                  onPointerLeave={() => setFocus(null)}
                  onClick={onSelect ? () => onSelect(i, c) : undefined}
                >
                  {track && <path d={track} fill={colors[i]} fillOpacity={0.18} fillRule="evenodd" />}
                  {fill && <path d={fill} fill={colors[i]} fillRule="evenodd" />}
                </g>
              );
            })}
          </svg>
          <div className={cn("pointer-events-none absolute inset-x-0 flex flex-col items-center text-center", arc ? "bottom-0" : "inset-y-0 justify-center")}>
            <span className={cn("font-semibold leading-none tracking-tight tabular-nums", arc ? "text-[44px]" : "text-[40px]")}>
              <AnimatedNumber value={score} />
            </span>
            <span className="mt-1 text-[12px] text-muted-foreground">out of 100</span>
            {rating && (
              <span className="mt-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium">
                <SwapText value={rating}>{rating}</SwapText>
              </span>
            )}
          </div>
        </div>
      </div>

      <ul className="mt-5 flex flex-col gap-1" aria-label="Sub-scores">
        {criteria.map((c, i) => {
          const on = focus === i;
          const dim = focus !== null && !on;
          const ratio = maxes[i]! > 0 ? Math.min(1, scores[i]! / maxes[i]!) : 0;
          return (
            <li key={c.label}>
              <button
                type="button"
                data-row={i}
                data-active={on ? "" : undefined}
                aria-label={`${c.label}: ${num(c.score)} of ${num(c.max)}${c.note ? `. ${c.note}` : ""}`}
                onPointerEnter={() => setFocus(i)}
                onPointerLeave={() => setFocus(null)}
                onFocus={() => setFocus(i)}
                onBlur={() => setFocus(null)}
                onClick={onSelect ? () => onSelect(i, c) : undefined}
                className={cn("grid w-full gap-1.5 rounded-lg px-2.5 py-2 text-left", HOVER, dim && "opacity-45", onSelect ? "cursor-pointer" : "cursor-default", focusRing)}
              >
                <span className="flex items-center gap-3">
                  <span aria-hidden="true" className="size-2.5 flex-none rounded-full" style={{ background: colors[i] }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{c.label}</span>
                    {c.note && <span className="block truncate text-[12.5px] text-muted-foreground">{c.note}</span>}
                  </span>
                  <span className="flex-none text-[14px] tabular-nums">
                    <span className="font-semibold"><AnimatedNumber value={c.score} format={num} /></span>
                    <span className="text-muted-foreground"> / {num(c.max)}</span>
                  </span>
                </span>
                <span aria-hidden="true" className="block h-1 overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${colors[i]} 18%, transparent)` }}>
                  <span className="block h-full origin-left rounded-full" style={{ background: colors[i], transform: `scaleX(${ratio})` }} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
