"use client";
/** @registry name="tab-overload" type="ui" title="Tab overload" description="A small stack of overlapping browser windows for a 4:3 feature or bento card. The highlight follows the window under the pointer and, when nobody is hovering, drifts on its own. Quiet, theme-aware, still under reduced motion." */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { MOTION_GATE, useLive } from "./use-in-view";

export interface TabOverloadProps {
  /** Tab titles, one per window (2 to 5). Default: Docs, Inbox, Board, Logs. */
  windows?: string[];
  /** Highlight this window (0-based) instead of following the pointer and the cycle. */
  active?: number;
  /** Called when the pointer moves onto a window (and with `null` when it leaves). */
  onActiveChange?: (index: number | null) => void;
  /** Drift the highlight from window to window while nobody hovers. Default true. */
  cycle?: boolean;
  /** Milliseconds each window stays highlighted. Default 2600. */
  interval?: number;
  /** Accent for the highlighted window: a theme token ("primary", "ring", "chart-1"), a CSS variable or any CSS colour. Default indigo. */
  color?: string;
  paused?: boolean;
  /** Accessible description. Default names the windows. */
  label?: string;
  className?: string;
}

const DEFAULT = ["Docs", "Inbox", "Board", "Logs"];
const TOKENS = new Set(["foreground", "primary", "ring", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5"]);

const accentOf = (c: string | undefined) => {
  const v = (c ?? "#6366f1").trim();
  return v.startsWith("--") ? `var(${v})` : TOKENS.has(v) ? `var(--${v})` : v;
};

/** Where window `i` of `n` sits, in % of the card: a gentle diagonal cascade that keeps every tab visible. */
export function windowBox(i: number, n: number): { left: number; top: number; width: number; height: number } {
  const t = n > 1 ? i / (n - 1) : 0;
  // The vertical step (x 0.75, the card is 4:3) is at least the 7cqw tab strip, so no tab label is covered by the next window.
  return { left: 4 + t * 30, top: 4 + t * 38, width: 62, height: 54 };
}

const LINES: number[][] = [
  [78, 52, 64],
  [60, 84, 40],
  [70, 46, 58],
  [54, 76, 48],
  [82, 58, 36],
];

const CSS = `
[data-kn-ill="tab-overload"] { container-type: inline-size; }
@media (prefers-reduced-motion: reduce) { [data-kn-ill="tab-overload"] .kn-tab-win, [data-kn-ill="tab-overload"] .kn-tab-win * { transition: none !important; } }
`;

/**
 * Windows crowd a card; the one you point at comes forward. Sizes are in container units (cqw), so the whole
 * drawing scales with its card. Decorative: it is one image to assistive tech.
 */
export function TabOverload({ windows = DEFAULT, active, onActiveChange, cycle = true, interval = 2600, color, paused, label, className }: TabOverloadProps) {
  const root = useRef<HTMLDivElement>(null);
  const { live, reduced } = useLive(root, paused);
  const titles = windows.slice(0, 5);
  const n = Math.max(2, titles.length);
  const [auto, setAuto] = useState(1);
  const [hover, setHover] = useState<number | null>(null);
  const controlled = active != null;
  const current = Math.min(n - 1, Math.max(0, controlled ? active! : (hover ?? auto)));
  const accent = accentOf(color);

  useEffect(() => {
    if (!cycle || controlled || hover !== null || !live || reduced) return;
    const id = setInterval(() => setAuto((a) => (a + 1) % n), Math.max(900, interval));
    return () => clearInterval(id);
  }, [cycle, controlled, hover, live, reduced, interval, n]);

  const enter = (i: number | null) => {
    setHover(i);
    onActiveChange?.(i);
  };

  return (
    <div
      ref={root}
      data-kn-ill="tab-overload"
      data-live={live}
      role="img"
      aria-label={label ?? `Overlapping browser windows: ${titles.join(", ")}`}
      onPointerLeave={() => enter(null)}
      className={cn("relative isolate aspect-[4/3] w-full overflow-hidden select-none", className)}
      style={{ ["--kn-accent" as string]: accent } as CSSProperties}
    >
      <style href="kn-ill-tab-overload" precedence="default">
        {`${MOTION_GATE}\n${CSS}`}
      </style>
      {Array.from({ length: n }, (_, i) => {
        const b = windowBox(i, n);
        const on = i === current;
        const lines = LINES[i % LINES.length];
        return (
          <div
            key={i}
            onPointerEnter={() => enter(i)}
            className={cn(
              "kn-tab-win absolute overflow-hidden rounded-[2.6cqw] border bg-card transition-[transform,box-shadow,opacity,border-color] duration-[420ms] ease-[cubic-bezier(.2,.7,.2,1)]",
              on ? "shadow-[0_2.4cqw_6cqw_-2cqw_color-mix(in_srgb,var(--kn-accent)_45%,transparent)]" : "shadow-[0_0.6cqw_1.6cqw_-0.8cqw_rgb(0_0_0/0.18)]",
            )}
            style={{
              left: `${b.left}%`,
              top: `${b.top}%`,
              width: `${b.width}%`,
              height: `${b.height}%`,
              zIndex: on ? n + 1 : i,
              transform: on ? "translateY(-2.4cqw) scale(1.025)" : "none",
              borderColor: on ? "color-mix(in srgb, var(--kn-accent) 55%, var(--border))" : undefined,
            }}
          >
            {/* Tab strip: three dots and the window's tab. */}
            <div className="flex h-[7cqw] items-end gap-[1.2cqw] border-b bg-muted/60 px-[3cqw]">
              <span className="mb-[2.6cqw] flex gap-[1.2cqw]" aria-hidden="true">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="size-[1.7cqw] rounded-full bg-foreground/15" />
                ))}
              </span>
              <span
                className={cn(
                  "ml-[1.5cqw] flex h-[5.2cqw] items-center rounded-t-[1.4cqw] border border-b-0 px-[2.4cqw] text-[2.6cqw] leading-none font-medium whitespace-nowrap transition-colors duration-[420ms]",
                  on ? "bg-card text-foreground" : "bg-transparent text-muted-foreground",
                )}
                style={on ? { boxShadow: "inset 0 0.5cqw 0 var(--kn-accent)" } : undefined}
              >
                {titles[i] ?? `Tab ${i + 1}`}
              </span>
            </div>
            {/* Page body: a few lines, the first in the accent when the window is up front. */}
            <div className="flex flex-col gap-[2.2cqw] px-[3.6cqw] pt-[4cqw]" aria-hidden="true">
              {lines.map((w, j) => (
                <span
                  key={j}
                  className="h-[1.9cqw] rounded-full transition-colors duration-[420ms]"
                  style={{ width: `${w}%`, background: on && j === 0 ? "color-mix(in srgb, var(--kn-accent) 70%, transparent)" : "color-mix(in srgb, var(--foreground) 11%, transparent)" }}
                />
              ))}
              <span className="mt-[1cqw] h-[9cqw] w-[44%] rounded-[1.6cqw]" style={{ background: "color-mix(in srgb, var(--foreground) 7%, transparent)" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
