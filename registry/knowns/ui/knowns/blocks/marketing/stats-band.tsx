"use client";
/** @registry name="stats-band" type="block" title="Stats band" description="Three or four headline numbers that count up on view, with labels, detail lines, an optional proof visual per number (trend, daily bars, distribution), a context line on hover or focus and a source footnote. Plain, card or divided tone; reduced motion shows final values." */

/**
 * StatsBand: 3 or 4 headline numbers that roll up (NumberTicker) as the band scrolls into view, with
 * labels and an optional footnote for sources. Each number can carry a tiny proof visual in one ink colour
 * and a context line that shows on hover or focus (always on touch screens). Reduced motion shows the final
 * numbers at once.
 */
import type { ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { NumberTicker } from "../../text-animation/number-ticker";
import { SectionHeading } from "./section-heading";

/** A tiny chart under a number. One ink colour (the text colour at different strengths), no axes. */
export type StatVisual =
  /** A line over time, e.g. runs per day. */
  | { kind: "trend"; values: number[] }
  /** One bar per period, e.g. 30 days of uptime. The bars are scaled between the lowest and highest value. */
  | { kind: "bars"; values: number[] }
  /** A histogram; `marker` (0 to 1) is where this number sits along it, e.g. the median. */
  | { kind: "distribution"; bins: number[]; marker?: number };

export interface Stat {
  value: number;
  label: string;
  /** Text before / after the number, e.g. "$" or "%". */
  prefix?: string;
  suffix?: string;
  /** Intl.NumberFormat options, e.g. { notation: "compact" } or { maximumFractionDigits: 1 }. */
  format?: Intl.NumberFormatOptions;
  /** A short line under the label. */
  detail?: ReactNode;
  /** A proof visual under the number. */
  visual?: StatVisual;
  /** A line that shows on hover or focus where a mouse is present, and always on touch screens. */
  context?: ReactNode;
}

export interface StatsBandProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  lead?: ReactNode;
  stats: Stat[];
  /** A small note under the band, e.g. where the numbers come from. */
  footnote?: ReactNode;
  /** "plain" sits on the page with a hairline beside each number; "card" is a framed panel with dividers; "divided" is a hairline grid. */
  tone?: "plain" | "card" | "divided";
  className?: string;
}

/** SVG points (0..100 x 0..40) of a trend line; flat input gives a flat line in the middle. */
export function trendPoints(values: number[], w = 100, h = 40, pad = 3): [number, number][] {
  if (values.length < 2) return [];
  const min = Math.min(...values);
  const span = Math.max(...values) - min;
  return values.map((v, i) => [+((i / (values.length - 1)) * w).toFixed(2), +(span === 0 ? h / 2 : pad + (1 - (v - min) / span) * (h - pad * 2)).toFixed(2)]);
}

/** Bar heights in percent, scaled between the lowest and highest value (never below `floor`, so every day shows). */
export function barHeights(values: number[], floor = 28): number[] {
  if (!values.length) return [];
  const min = Math.min(...values);
  const span = Math.max(...values) - min;
  return values.map((v) => (span === 0 ? 100 : Math.round(floor + ((v - min) / span) * (100 - floor))));
}

/** Histogram heights in percent of the tallest bin. */
export function binHeights(bins: number[]): number[] {
  const max = Math.max(0, ...bins);
  return bins.map((b) => (max === 0 ? 0 : Math.round((b / max) * 100)));
}

function Visual({ visual }: { visual: StatVisual }) {
  if (visual.kind === "trend") {
    const pts = trendPoints(visual.values);
    if (!pts.length) return null;
    const line = pts.map(([x, y]) => `${x},${y}`).join(" ");
    return (
      <svg aria-hidden="true" viewBox="0 0 100 40" preserveAspectRatio="none" className="h-10 w-full overflow-visible text-foreground" data-visual="trend">
        <polygon points={`0,40 ${line} 100,40`} fill="currentColor" opacity={0.07} />
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={0.75} />
      </svg>
    );
  }
  const heights = visual.kind === "bars" ? barHeights(visual.values) : binHeights(visual.bins);
  const marker = visual.kind === "distribution" ? visual.marker : undefined;
  const at = marker === undefined ? -1 : Math.min(heights.length - 1, Math.max(0, Math.round(marker * (heights.length - 1))));
  return (
    <div aria-hidden="true" data-visual={visual.kind} className="flex h-10 w-full items-end gap-[2px] text-foreground">
      {heights.map((h, i) => (
        <span
          key={i}
          className={cn("min-w-0 flex-1 rounded-[1.5px] bg-current", visual.kind === "distribution" && (i === at ? "opacity-90" : "opacity-20"), visual.kind === "bars" && "opacity-50")}
          style={{ height: `${Math.max(4, h)}%` }}
        />
      ))}
    </div>
  );
}

export function StatsBand({ eyebrow, title, lead, stats, footnote, tone = "plain", className }: StatsBandProps) {
  const card = tone === "card";
  const divided = tone === "divided";
  const cols = stats.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";
  const cell = (s: Stat) => (
    <div
      key={s.label}
      // A cell with a context line takes focus, so keyboard users reach it too.
      tabIndex={s.context ? 0 : undefined}
      className={cn("group flex flex-col gap-2", s.context && cn(!divided && "rounded-lg", focusRing, divided && "focus-visible:-outline-offset-2"), !card && !divided && "border-l pl-6", divided && "bg-background p-6")}
    >
      <dt className="order-2 text-[14px] text-muted-foreground">{s.label}</dt>
      <dd className="order-1 text-[36px] leading-10 font-semibold tabular-nums sm:text-[48px] sm:leading-[1.04] sm:tracking-[-0.035em]">
        <NumberTicker value={s.value} from={0} format={s.format} prefix={s.prefix} suffix={s.suffix} duration={1200} />
      </dd>
      {s.detail && <dd className="order-3 text-[13px] text-muted-foreground">{s.detail}</dd>}
      {s.visual && (
        <dd className="order-4 mt-2" aria-hidden="true">
          <Visual visual={s.visual} />
        </dd>
      )}
      {s.context && (
        // The space is always reserved, so showing it never moves the page. Where a mouse is present it fades in
        // on hover or focus; on touch screens it is simply there.
        <dd className="order-5 text-[13px] leading-5 text-foreground transition-opacity duration-200 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
          {s.context}
        </dd>
      )}
    </div>
  );
  return (
    <section data-slot="stats-band" data-tone={tone} className={cn("mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24", className)}>
      <SectionHeading eyebrow={eyebrow} title={title} lead={lead} className="mb-12 sm:mb-16" />
      {divided ? (
        // A hairline grid: every cell draws its right and bottom edge, the grid is pulled out by 1px and clipped.
        <div className="overflow-hidden rounded-2xl border">
          <dl className={cn("-mr-px -mb-px grid grid-cols-2", cols, "[&>div]:border-r [&>div]:border-b")}>{stats.map(cell)}</dl>
        </div>
      ) : (
        <dl className={cn("grid grid-cols-2 gap-y-10", cols, card ? "rounded-2xl border bg-card py-8 [&>div]:px-6 lg:[&>div+div]:border-l" : "gap-x-8")}>{stats.map(cell)}</dl>
      )}
      {footnote && <p className="mt-8 text-[13px] text-muted-foreground">{footnote}</p>}
    </section>
  );
}
