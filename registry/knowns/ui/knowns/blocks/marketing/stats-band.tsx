"use client";
/** @registry name="stats-band" type="block" title="Stats band" description="Three or four headline numbers that count up on view, with labels, detail lines and a source footnote. Plain or card tone; reduced motion shows final values." */

/**
 * StatsBand: 3 or 4 headline numbers that roll up (NumberTicker) as the band scrolls into view, with
 * labels and an optional footnote for sources. Reduced motion shows the final numbers at once.
 */
import type { ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { NumberTicker } from "../../text-animation/number-ticker";
import { SectionHeading } from "./section-heading";

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
}

export interface StatsBandProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  lead?: ReactNode;
  stats: Stat[];
  /** A small note under the band, e.g. where the numbers come from. */
  footnote?: ReactNode;
  /** "plain" sits on the page; "card" is a framed panel with dividers. */
  tone?: "plain" | "card";
  className?: string;
}

export function StatsBand({ eyebrow, title, lead, stats, footnote, tone = "plain", className }: StatsBandProps) {
  const card = tone === "card";
  return (
    <section data-slot="stats-band" className={cn("mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24", className)}>
      <SectionHeading eyebrow={eyebrow} title={title} lead={lead} className="mb-12 sm:mb-16" />
      <dl
        className={cn(
          "grid grid-cols-2 gap-y-10",
          stats.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
          card ? "rounded-2xl border bg-card py-8 [&>div]:px-6 lg:[&>div+div]:border-l" : "gap-x-8",
        )}
      >
        {stats.map((s) => (
          <div key={s.label} className={cn("flex flex-col gap-2", !card && "border-l pl-6")}>
            <dt className="order-2 text-[14px] text-muted-foreground">{s.label}</dt>
            <dd className="order-1 text-[36px] leading-10 font-semibold tabular-nums sm:text-[48px] sm:leading-[1.04] sm:tracking-[-0.035em]">
              <NumberTicker value={s.value} from={0} format={s.format} prefix={s.prefix} suffix={s.suffix} duration={1200} />
            </dd>
            {s.detail && <dd className="order-3 text-[13px] text-muted-foreground">{s.detail}</dd>}
          </div>
        ))}
      </dl>
      {footnote && <p className="mt-8 text-[13px] text-muted-foreground">{footnote}</p>}
    </section>
  );
}
