"use client";
/** @registry name="marquee" type="ui" title="Marquee" description="Any row or column of content in an endless loop, sideways or top to bottom, at a steady speed with faded edges. A visible Pause button (WCAG 2.2.2), pause on hover and focus, offscreen and in hidden tabs; reduced motion shows a still wrapping layout. Loop copies are hidden from screen readers and Tab. Free." */

/**
 * Marquee: put any cards, logos, quotes or tiles in an endless loop. The track holds equal groups of your content;
 * it moves by one group, so the loop has no seam, and it grows its group count to the box it is in. Hover or focus
 * pauses it; offscreen and in a hidden tab it stops; with reduced motion it becomes a still, wrapping layout.
 * Motion that runs longer than 5 seconds needs a way to stop it (WCAG 2.2.2), so a Pause button is on by default.
 */
import { Children, useLayoutEffect, useEffect, useRef, useState, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { useLive } from "../illustrations/use-in-view";
import { marqueeLoopSeconds, marqueeSets, type MarqueeSpeed } from "./marquee-utils";

export type { MarqueeSpeed } from "./marquee-utils";

export interface MarqueeProps {
  /** The things to loop: cards, logos, quotes. Each child is one item. */
  children: ReactNode;
  /** Top to bottom instead of sideways. Give the marquee a height (className), it fills it. */
  vertical?: boolean;
  /** The other way: right to left becomes left to right, bottom to top becomes top to bottom. */
  reverse?: boolean;
  /** Steady speed in px per second: slow 30, normal 50, fast 80. */
  speed?: MarqueeSpeed;
  /** Seconds for one loop. Wins over `speed`. */
  duration?: number;
  /** Space between items, in px. Default 32. */
  gap?: number;
  /** Pause while the pointer is over it. Default true. Focus inside always pauses. */
  pauseOnHover?: boolean;
  /** Soft faded edges. Default true. */
  fade?: boolean;
  /** Hold the loop where it is (a controlled pause). The Pause button toggles its own state when this is not set. */
  paused?: boolean;
  /** Show the still wrapping layout instead of the loop (reduced motion does this on its own). */
  still?: boolean;
  /** The Pause button: "end" (above, right, default), "start" (above, left) or false for none. Without a button, keep the loop under 5 seconds or give people another way to stop it. */
  controls?: "start" | "end" | false;
  /** What the Pause button's screen-reader name says is paused: "Pause marquee". Default "marquee". */
  controlsLabel?: string;
  /** Render the items as a list (ul > li) so a screen reader counts them. Default false. */
  list?: boolean;
  /** Names the region for a screen reader. */
  label?: string;
  /** Extra classes for the still layout. */
  stillClassName?: string;
  className?: string;
}

const CSS = `
@keyframes knmq-x { to { transform: translate3d(calc(-100% / var(--knmq-sets)), 0, 0); } }
@keyframes knmq-y { to { transform: translate3d(0, calc(-100% / var(--knmq-sets)), 0); } }
[data-knmq] [data-knmq-track] { animation: knmq-x var(--knmq-dur) linear infinite; animation-direction: var(--knmq-dir); }
[data-knmq][data-vertical="true"] [data-knmq-track] { animation-name: knmq-y; }
[data-knmq][data-hover-pause="true"]:hover [data-knmq-track], [data-knmq]:focus-within [data-knmq-track], [data-knmq][data-live="false"] [data-knmq-track], [data-knmq][data-user-paused="true"] [data-knmq-track] { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { [data-knmq] [data-knmq-track] { animation: none; } }
`;

const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** The Pause / Play button. Exported so a layout that places its own can use the same one. */
export function MarqueeToggle({ playing, onToggle, label = "marquee", className }: { playing: boolean; onToggle: () => void; label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={!playing}
      className={cn("inline-flex h-8 items-center gap-1.5 rounded-full shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_14%,transparent)] bg-background px-3 text-[13px] font-medium text-muted-foreground transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:text-foreground", focusRing, className)}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
        {playing ? <path d="M4.5 3h2.5v10H4.5zM9 3h2.5v10H9z" /> : <path d="M5 3.2v9.6a.5.5 0 0 0 .77.42l7.2-4.8a.5.5 0 0 0 0-.84l-7.2-4.8A.5.5 0 0 0 5 3.2z" />}
      </svg>
      {playing ? "Pause" : "Play"}
      <span className="sr-only"> {label}</span>
    </button>
  );
}

export function Marquee({ children, vertical = false, reverse = false, speed = "normal", duration, gap = 32, pauseOnHover = true, fade = true, paused, still: stillProp, controls = "end", controlsLabel = "marquee", list = false, label, stillClassName, className }: MarqueeProps) {
  const root = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const group = useRef<HTMLElement>(null);
  const { live, reduced } = useLive(root, paused);
  const [userPaused, setUserPaused] = useState(false);
  const items = Children.toArray(children);
  const count = items.length;
  const [fit, setFit] = useState({ sets: 2, length: 0 });
  const still = reduced || Boolean(stillProp);

  // Measure the box and one group along the loop's axis; more groups when the box is wider than one.
  useLayout(() => {
    const v = view.current;
    const g = group.current;
    if (!v || !g || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const box = vertical ? v.clientHeight : v.clientWidth;
      const length = vertical ? g.offsetHeight : g.offsetWidth;
      const sets = marqueeSets(box, length);
      setFit((f) => (f.sets === sets && f.length === length ? f : { sets, length }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(v);
    ro.observe(g);
    return () => ro.disconnect();
  }, [vertical, count, gap, still]);

  if (count === 0) return null;

  const wrap = (node: ReactNode, key: string, hidden: boolean) =>
    list ? (
      <li key={key} aria-hidden={hidden || undefined} inert={hidden || undefined}>
        {node}
      </li>
    ) : (
      node
    );
  const Group = list ? "ul" : "div";
  const pad = vertical ? { paddingBottom: gap } : { paddingRight: gap };
  const groupCls = cn("flex flex-none", vertical ? "flex-col" : "items-center");

  const body = still ? (
    <Group className={cn("flex flex-wrap items-center justify-center", vertical && "flex-col items-stretch", stillClassName)} style={{ gap }}>
      {items.map((c, i) => wrap(c, `s${i}`, false))}
    </Group>
  ) : (
    <div
      ref={view}
      className={cn("relative min-h-0 min-w-0 overflow-hidden", vertical && "flex-1")}
      style={fade ? { maskImage: `linear-gradient(${vertical ? "180deg" : "90deg"}, transparent, #000 6%, #000 94%, transparent)` } : undefined}
    >
      {/* The first group is the content people read; every other one only completes the loop. */}
      <div data-knmq-track="" className={cn("flex", vertical ? "w-full flex-col" : "w-max")}>
        {Array.from({ length: fit.sets }, (_, s) => {
          const copy = s > 0;
          return (
            <Group key={s} ref={s === 0 ? (group as never) : undefined} aria-hidden={copy || undefined} inert={copy || undefined} className={groupCls} style={{ ...pad, gap }}>
              {items.map((c, i) => wrap(c, `${s}-${i}`, copy))}
            </Group>
          );
        })}
      </div>
    </div>
  );

  const button = !still && controls && (
    <div className={cn("mb-2 flex flex-none", controls === "start" ? "justify-start" : "justify-end")}>
      <MarqueeToggle playing={!userPaused} onToggle={() => setUserPaused((p) => !p)} label={controlsLabel} />
    </div>
  );

  return (
    <div
      ref={root}
      data-slot="marquee"
      data-knmq=""
      data-live={live}
      data-user-paused={userPaused || Boolean(paused)}
      data-hover-pause={pauseOnHover}
      data-vertical={vertical}
      role={label ? "group" : undefined}
      aria-label={label}
      className={cn("relative min-h-0 min-w-0", vertical && "flex flex-col", className)}
      style={{ ["--knmq-dur" as string]: `${marqueeLoopSeconds(fit.length, speed, count, duration)}s`, ["--knmq-dir" as string]: reverse ? "reverse" : "normal", ["--knmq-sets" as string]: fit.sets }}
    >
      <style href="knmq" precedence="default">
        {CSS}
      </style>
      {button}
      {body}
    </div>
  );
}

export default Marquee;
