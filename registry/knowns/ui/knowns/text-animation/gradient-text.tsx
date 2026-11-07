"use client";
/** @registry name="gradient-text" type="ui" title="Gradient text" description="Text filled with a slowly flowing gradient, with an optional matching gradient-border pill." dependencies="text-animation-core" */

import { useRef, type CSSProperties, type ElementType, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { TEXT_GATE, useLive } from "./text-core";

export interface GradientTextProps {
  children: ReactNode;
  /** Stops of the gradient, any CSS colours. Default a quiet ramp from the foreground to a softer tone and back. */
  colors?: string[];
  /** Seconds for the gradient to flow one full cycle. Default 8. */
  speed?: number;
  /**
   * When it moves. "enter" flows once when it appears (default), "hover" flows while pointed at,
   * "loop" flows forever, "none" holds still.
   */
  motion?: "enter" | "hover" | "loop" | "none";
  /** Wrap the text in a chip with a matching gradient border, like a "New: ..." badge. */
  pill?: boolean;
  /** Element to render. Default span (or a div-less inline-flex chip when pill). */
  as?: ElementType;
  paused?: boolean;
  className?: string;
}

/** The default ramp: theme tokens only, so it follows light and dark and keeps text contrast. */
export const DEFAULT_COLORS = ["var(--foreground)", "color-mix(in oklch, var(--foreground) 58%, var(--background))", "var(--foreground)"];

/** A seamless gradient: the first colour closes the loop, so a one-tile shift looks the same as none. */
export function gradientImage(colors: string[]): string {
  const list = colors.length ? colors : DEFAULT_COLORS;
  const stops = list.length === 1 ? [list[0], list[0]] : list;
  return `linear-gradient(90deg, ${[...stops, stops[0]].join(", ")})`;
}

const CSS = `
@keyframes kntx-gradient { from { background-position: 0% 0 } to { background-position: 200% 0 } }
@keyframes kntx-gradient-ring { from { background-position: 0 0, 0% 0 } to { background-position: 0 0, 200% 0 } }
[data-kn-text="gradient"] [data-gt] { background-size: 200% 100%; background-repeat: repeat-x; }
[data-kn-text="gradient"][data-live="false"] { animation-play-state: paused !important; }
@media (prefers-reduced-motion: reduce) { [data-kn-text="gradient"] { animation: none !important; } }
`;

/**
 * Text filled with a gradient that flows slowly. Use it on one phrase per view (a headline word or a
 * "New" chip), with theme colours so contrast holds in light and dark. The text stays real text:
 * screen readers read it as written. Reduced motion shows the gradient still; it pauses offscreen.
 */
export function GradientText({ children, colors, speed = 8, motion = "enter", pill, as, paused, className }: GradientTextProps) {
  const root = useRef<HTMLSpanElement>(null);
  const { live } = useLive(root, paused || motion === "none");
  const Tag = (as ?? "span") as ElementType;
  const image = gradientImage(colors ?? DEFAULT_COLORS);
  const flowOf = (count: string) => `kntx-gradient ${speed}s linear ${count}`;
  const flow = flowOf(motion === "loop" ? "infinite" : "1");
  // The chip's ring: a card-coloured fill inside the padding box, the gradient behind it showing through the border.
  const ring: CSSProperties = {
    border: "1px solid transparent",
    backgroundImage: `linear-gradient(var(--card), var(--card)), ${image}`,
    backgroundOrigin: "border-box",
    backgroundClip: "padding-box, border-box",
    backgroundSize: "100% 100%, 200% 100%",
    backgroundRepeat: "no-repeat, repeat-x",
    animation: motion === "loop" || motion === "enter" ? `kntx-gradient-ring ${speed}s linear ${motion === "loop" ? "infinite" : "1"}` : undefined,
  };
  const text: CSSProperties = {
    backgroundImage: image,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
    animation: motion === "loop" || motion === "enter" ? flow : undefined,
  };
  const hover = motion === "hover";
  return (
    <Tag
      ref={root}
      data-kn-text="gradient"
      data-motion={motion}
      data-live={live}
      className={cn(
        "relative",
        pill ? "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium" : "inline",
        hover && "group/gt",
        className,
      )}
      style={pill ? ring : undefined}
    >
      <style href="kn-text-core" precedence="default">
        {TEXT_GATE}
      </style>
      <style href="kn-text-gradient" precedence="default">
        {CSS + (hover ? `[data-kn-text="gradient"][data-motion="hover"]:hover [data-gt] { animation: ${flowOf("infinite")} !important } [data-kn-text="gradient"][data-motion="hover"]:hover { animation: kntx-gradient-ring ${speed}s linear infinite }` : "")}
      </style>
      <span data-gt style={hover ? { ...text, animation: undefined } : text}>
        {children}
      </span>
    </Tag>
  );
}

export default GradientText;
