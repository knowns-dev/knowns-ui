"use client";
/** @registry name="area-trend-card" type="block" title="Area trend card" description="A card for a total that is made of parts over time: a label, a headline total with a change badge, a period dropdown, a soft-gradient area chart (stacked, overlaid or 100% share) and a legend with each series' total. Pointing at a band, a line or a legend entry swaps the headline to that series' total, which rolls with the number; leaving restores the grand total." */

import { useId, useMemo, useState, type ReactNode } from "react";
import { AnimatedNumber } from "../../animated-number";
import { Chart, type ChartDatum, type ChartSeries } from "../../chart/chart";
import { SERIES_COLORS, seriesColor, valueAt } from "../../chart/chart-utils";
import { Dropdown, DropdownButton } from "../../dropdown";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";

export interface AreaTrendPeriod {
  /** Stable id, e.g. "week". */
  id: string;
  /** The text in the dropdown, e.g. "This week". */
  label: string;
}

export type AreaTrendMode = "stacked" | "overlap" | "percent";

export interface AreaTrendCardProps {
  /** The label above the headline: "Runs by agent". */
  title: string;
  /** A small mark before the title (an icon, 16px). */
  icon?: ReactNode;
  /** One row per point on the x axis. */
  data: ChartDatum[];
  /** Key of the category field (x axis). */
  x: string;
  series: ChartSeries[];
  /** "stacked" adds the series up, "overlap" draws each from the baseline, "percent" shows each one's share of the whole. Default "stacked". */
  mode?: AreaTrendMode;
  /** "smooth" (monotone, never dips below the baseline) or "linear". Default "smooth". */
  curve?: "smooth" | "linear";
  /** The ranges in the dropdown. Leave it out for no dropdown. The card does not own the data: swap `data` when a period is picked. */
  periods?: AreaTrendPeriod[];
  /** Controlled period id. Leave it out to let the card keep it. */
  period?: string;
  defaultPeriod?: string;
  onPeriodChange?: (id: string) => void;
  /** The change against the period before, as a fraction: 0.082 is +8.2%. Leave it out for no badge. */
  delta?: number;
  /** "down" when a fall is good news (cost, errors): the change turns green when it drops. Default "up". */
  goodWhen?: "up" | "down";
  /** The thing counted, after the headline number: "runs". */
  unit?: string;
  /** A value as text for the headline, the axis, the tooltip and the legend. Default: compact numbers. */
  format?: (n: number) => string;
  /** The headline as a number format for the rolling digits. Default: grouped integers. */
  headlineFormat?: Intl.NumberFormatOptions | ((n: number) => string);
  /** Format a category for the axis and the tooltip header. */
  formatX?: (x: string) => string;
  /** Plot height in px. Default 200. */
  height?: number;
  /** Names the chart for assistive tech. Default: the title. */
  chartLabel?: string;
  className?: string;
}

const PERCENT: Intl.NumberFormatOptions = { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "exceptZero" };
const GROUPED: Intl.NumberFormatOptions = { maximumFractionDigits: 0 };
/** The card skips the neutral slot of the chart palette: accent, green, amber, red. A series' own `color` wins. */
const CARD_COLORS = [SERIES_COLORS[0], SERIES_COLORS[2], SERIES_COLORS[3], SERIES_COLORS[4]];

const compact = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

const Arrow = ({ up }: { up: boolean }) => (
  <svg aria-hidden="true" viewBox="0 0 12 12" className={cn("size-3 flex-none", !up && "rotate-180")}>
    <path d="M6 9.5V2.5M3 5.5l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** The sum of one series over every row (missing values count as 0). */
export function seriesTotal(data: readonly ChartDatum[], key: string): number {
  let sum = 0;
  for (const d of data) {
    const v = valueAt(d, key);
    if (v !== null) sum += v;
  }
  return sum;
}

export function AreaTrendCard({
  title,
  icon,
  data,
  x,
  series,
  mode = "stacked",
  curve = "smooth",
  periods,
  period: periodProp,
  defaultPeriod,
  onPeriodChange,
  delta,
  goodWhen = "up",
  unit = "",
  format = compact,
  headlineFormat = GROUPED,
  formatX,
  height = 200,
  chartLabel,
  className,
}: AreaTrendCardProps) {
  const uid = useId();
  const [kept, setKept] = useState(defaultPeriod ?? periods?.[0]?.id ?? "");
  const periodId = periodProp ?? kept;
  const current = periods?.find((p) => p.id === periodId) ?? periods?.[0];
  /** The series the pointer is on (in the chart or the legend), or null for the grand total. */
  const [focus, setFocus] = useState<string | null>(null);

  const coloured = useMemo(() => series.map((s, i) => (s.color ? s : { ...s, color: CARD_COLORS[i % CARD_COLORS.length] })), [series]);
  const totals = useMemo(() => coloured.map((s) => ({ s, total: seriesTotal(data, s.key) })), [data, coloured]);
  const grand = totals.reduce((a, t) => a + t.total, 0);
  const picked = focus === null ? null : totals.find((t) => t.s.key === focus);
  const headline = picked ? picked.total : grand;
  const shown = delta === undefined || Math.abs(delta) < 0.0005 ? 0 : delta;
  const good = shown === 0 ? null : goodWhen === "up" ? shown > 0 : shown < 0;
  const asText = typeof headlineFormat === "function" ? headlineFormat : (n: number) => new Intl.NumberFormat("en-US", headlineFormat).format(n);
  const text = `${picked ? `${picked.s.label}: ` : ""}${asText(headline)}${unit ? ` ${unit}` : ""}`;

  return (
    <section aria-labelledby={`${uid}-title`} className={cn("w-full rounded-2xl border bg-card p-5 text-card-foreground shadow-xs", className)}>
      <div className="flex items-center gap-2.5">
        {icon && (
          <span aria-hidden="true" className="grid size-8 flex-none place-items-center rounded-[9px] bg-muted text-foreground/80 [&_svg]:size-4">
            {icon}
          </span>
        )}
        <h3 id={`${uid}-title`} className="min-w-0 flex-1 truncate text-[14px] leading-tight font-medium">
          {title}
        </h3>
        {periods && periods.length > 0 && current && (
          <Dropdown
            aria-label="Period"
            align="end"
            width={176}
            trigger={<DropdownButton size="sm" label={current.label} />}
            items={periods.map((p) => ({ id: p.id, label: p.label, kind: "radio" as const, checked: p.id === current.id }))}
            onSelect={(item) => {
              if (periodProp === undefined) setKept(item.id);
              onPeriodChange?.(item.id);
            }}
          />
        )}
      </div>

      <div className="mt-5 flex items-end gap-2.5">
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {text}
        </span>
        <span aria-hidden="true" className="inline-flex items-baseline gap-2">
          <AnimatedNumber value={headline} format={headlineFormat} className="text-[36px] leading-none font-semibold tracking-tight" />
          {unit && <span className="text-[13px] text-muted-foreground">{unit}</span>}
        </span>
        {delta !== undefined && (
          <span
            className={cn(
              "mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12.5px] font-medium transition-opacity duration-(--kn-dur-fast) ease-(--kn-ease-out)",
              good === null ? "bg-muted text-muted-foreground" : good ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400" : "bg-red-500/12 text-red-700 dark:text-red-400",
              picked && "opacity-0",
            )}
            aria-hidden={picked ? true : undefined}
          >
            {good !== null && <Arrow up={shown > 0} />}
            <AnimatedNumber value={shown} format={PERCENT} />
          </span>
        )}
      </div>
      <p className="mt-1.5 min-h-[18px] text-[12.5px] leading-snug text-muted-foreground">{picked ? `${picked.s.label}${grand > 0 ? `, ${Math.round((picked.total / grand) * 100)}% of the total` : ""}` : "All series"}</p>

      <div className="mt-4">
        <Chart
          type="area"
          label={chartLabel ?? title}
          data={data}
          x={x}
          series={coloured}
          stacked={mode === "stacked" ? true : mode === "percent" ? "percent" : false}
          curve={curve}
          fadeArea={mode === "overlap" ? 0.3 : 0.55}
          height={height}
          legend={false}
          format={format}
          formatX={formatX}
          focusSeries
          hoverSeries
          focusedSeries={focus}
          onFocusSeries={setFocus}
        />
      </div>

      <ul aria-label="Series" className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px]">
        {totals.map(({ s, total }, i) => (
          <li key={s.key}>
            <button
              type="button"
              onPointerEnter={() => setFocus(s.key)}
              onPointerLeave={() => setFocus(null)}
              onFocus={() => setFocus(s.key)}
              onBlur={() => setFocus(null)}
              className={cn("inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-muted-foreground transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:bg-muted hover:text-foreground", focus === s.key && "text-foreground", focusRing)}
            >
              <span className="size-2 flex-none rounded-[3px]" style={{ background: seriesColor(s, i) }} />
              {s.label}
              <span className="font-medium text-foreground tabular-nums">{format(total)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default AreaTrendCard;
