"use client";
/** @registry name="goal-rings" type="block" title="Goal rings" description="A compact card of progress rings with a stat for each ring: label, value, goal and percent. Pointing at or focusing a ring or its stat brings that ring forward and dims the others; a ring past its goal laps the start." */

import { useId, useState, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { AnimatedNumber } from "../../animated-number";
import { Card } from "../../card";
import { Chart, VIVID_COLORS } from "../../chart/chart";

export interface GoalRing {
  /** Name of the measure, in the stat list and for screen readers. */
  label: string;
  value: number;
  goal: number;
  /** Written after the numbers, such as "min" or "runs". */
  unit?: string;
  /** Any CSS colour. Default: the card's palette, one colour per ring. */
  color?: string;
}

export interface GoalRingsProps {
  title: ReactNode;
  /** A line under the title, such as the period. */
  description?: ReactNode;
  goals: GoalRing[];
  /** Beside the title: a period switch, say. */
  action?: ReactNode;
  /** The overall figure in the hole: "total" (the mean progress, each ring capped at 100%), a node, or false for none. Default "total". */
  center?: "total" | ReactNode | false;
  /** Caption under the overall figure. Default "Overall". */
  centerLabel?: string;
  /** Diameter of the rings in px. Default 184. */
  size?: number;
  /** Fired with the ring's index when its ring or stat is pressed. */
  onSelect?: (index: number, goal: GoalRing) => void;
  className?: string;
}

/** The card's own colours: bold, one per ring. Pass `color` per goal to change one. */
export const GOAL_RING_COLORS = [...VIVID_COLORS, "oklch(0.74 0.15 75)"];

const num = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 1 });
const pct = (g: GoalRing) => `${Math.round((g.goal > 0 ? g.value / g.goal : 0) * 100)}%`;

/** A card of goal rings: the rings on the left, a stat for each on the right, stacked when the card is narrow. */
export function GoalRings({ title, description, goals, action, center = "total", centerLabel = "Overall", size = 184, onSelect, className }: GoalRingsProps) {
  const id = useId();
  const [focus, setFocus] = useState<number | null>(null);
  const colors = goals.map((g, i) => g.color ?? GOAL_RING_COLORS[i % GOAL_RING_COLORS.length]!);
  const data = goals.map((g) => ({ name: g.label, value: g.value, goal: g.goal }));

  return (
    <Card data-slot="goal-rings" className={cn("@container w-full p-5", className)} aria-labelledby={`${id}-t`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`${id}-t`} className="text-[15px] font-semibold tracking-tight">{title}</h3>
          {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>

      <div className="mt-4 flex flex-col items-center gap-5 @sm:flex-row @sm:items-center @sm:gap-8">
        <div className="flex-none" style={{ width: size }}>
          <Chart
            type="rings"
            label={typeof title === "string" ? title : "Goals"}
            data={data}
            x="name"
            goalKey="goal"
            series={[{ key: "value", label: "Value" }]}
            barColors={colors}
            height={size}
            legend={false}
            tooltip={false}
            center={center === false ? undefined : center}
            centerLabel={centerLabel}
            focused={focus}
            onFocusChange={setFocus}
            onSelect={onSelect ? (i) => onSelect(i, goals[i]!) : undefined}
          />
        </div>

        <ul className="flex w-full min-w-0 flex-1 flex-col gap-1" aria-label="Goals">
          {goals.map((g, i) => {
            const on = focus === i;
            const dim = focus !== null && !on;
            return (
              <li key={g.label}>
                <button
                  type="button"
                  data-stat={i}
                  data-active={on ? "" : undefined}
                  aria-label={`${g.label}: ${num(g.value)} of ${num(g.goal)}${g.unit ? ` ${g.unit}` : ""}, ${pct(g)}`}
                  onPointerEnter={() => setFocus(i)}
                  onPointerLeave={() => setFocus(null)}
                  onFocus={() => setFocus(i)}
                  onBlur={() => setFocus(null)}
                  onClick={onSelect ? () => onSelect(i, g) : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-[opacity,background-color] duration-(--kn-dur-fast) ease-(--kn-ease-out)",
                    on ? "bg-muted" : "bg-transparent",
                    dim && "opacity-45",
                    onSelect ? "cursor-pointer" : "cursor-default",
                    focusRing,
                  )}
                >
                  <span aria-hidden="true" className="size-2.5 flex-none rounded-full" style={{ background: colors[i] }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-muted-foreground">{g.label}</span>
                    <span className="block text-[14px] font-medium tabular-nums">
                      <AnimatedNumber value={g.value} format={num} />
                      <span className="font-normal text-muted-foreground"> / {num(g.goal)}{g.unit ? ` ${g.unit}` : ""}</span>
                    </span>
                  </span>
                  <span className="flex-none text-[14px] font-semibold tabular-nums">{pct(g)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}
