/** @registry name="priority-bars" type="ui" title="Priority bars" description="Priority as three rising bars: low fills one, medium two, high three; urgent is an orange exclamation square and none is three faint bars. A real image role with a spoken label, or decorative beside a word." */
import { cn } from "@/registry/knowns/lib/knowns/utils";

export type Priority = "none" | "low" | "medium" | "high" | "urgent";

export const PRIORITIES: Priority[] = ["none", "low", "medium", "high", "urgent"];

/** How many of the three bars are filled. Urgent has no bars (it is the square), none fills none. */
export function priorityLevel(priority: Priority): 0 | 1 | 2 | 3 {
  return priority === "low" ? 1 : priority === "medium" ? 2 : priority === "high" ? 3 : 0;
}

export const PRIORITY_LABEL: Record<Priority, string> = { none: "No priority", low: "Low priority", medium: "Medium priority", high: "High priority", urgent: "Urgent" };

/**
 * Bar colour by level, each overridable with one token (`--kn-priority-low`, `-medium`, `-high`) and tuned for 3:1 on a card:
 * light #64748b #c76a00 #dc2626, dark #94a3b8 #fbbf24 #f87171. Bars not reached stay as 25% ghosts of the same colour.
 */
const COLOR: Record<1 | 2 | 3, string> = {
  1: "text-(--kn-priority-low,#64748b) dark:text-(--kn-priority-low,#94a3b8)",
  2: "text-(--kn-priority-medium,#c76a00) dark:text-(--kn-priority-medium,#fbbf24)",
  3: "text-(--kn-priority-high,#dc2626) dark:text-(--kn-priority-high,#f87171)",
};
/** Bars left to right on a 16px grid. */
const BARS = [
  { x: 2, y: 9.5, h: 4.5 },
  { x: 6.5, y: 6, h: 8 },
  { x: 11, y: 2, h: 12 },
];

export interface PriorityBarsProps {
  priority: Priority;
  /** The spoken label. Default "Medium priority" and so on; pass false when a word sits beside it, so it is not read twice. */
  label?: string | false;
  className?: string;
}

/** Three rising bars for low, medium and high; an orange exclamation square for urgent; three ghost bars for none. 16px, a little under on rows via className. */
export function PriorityBars({ priority, label, className }: PriorityBarsProps) {
  const text = label === false ? undefined : (label ?? PRIORITY_LABEL[priority]);
  const aria = text ? ({ role: "img", "aria-label": text } as const) : ({ "aria-hidden": true } as const);
  if (priority === "urgent") {
    return (
      <span {...aria} data-priority="urgent" className={cn("inline-flex size-[14px] shrink-0 items-center justify-center rounded-[3px] bg-orange-500 text-[10px] font-bold leading-none text-white", className)}>
        !
      </span>
    );
  }
  const level = priorityLevel(priority);
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" data-priority={priority} {...aria} className={cn("inline-block shrink-0 align-middle", level ? COLOR[level as 1 | 2 | 3] : "text-muted-foreground", className)}>
      {BARS.map((b, i) => (
        <rect key={b.x} x={b.x} y={b.y} width="3" height={b.h} rx="1" fill="currentColor" opacity={i < level ? 1 : 0.25} />
      ))}
    </svg>
  );
}
