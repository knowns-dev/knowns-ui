"use client";
/** @registry name="backgrounds-core" type="ui" title="Backgrounds core" description="Shared shell and helpers for the backgrounds: fade masks, theme-token colours, density and speed, seeded layouts, and the motion gate." */

import type { CSSProperties, ReactNode, Ref } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { MOTION_GATE } from "@/registry/knowns/ui/knowns/illustrations/use-in-view";
import { bgMaskImage, maskComposite, type BgFocus, type BgMask } from "./bg-utils";

/**
 * The shell every background shares: a relative, isolated box; the drawing sits in an aria-hidden,
 * pointer-transparent layer behind the children, faded by the mask. `data-live` pauses CSS motion through
 * the illustrations' motion gate (offscreen, hidden tab, paused, prefers-reduced-motion).
 */
export function BackgroundFrame({
  name,
  live,
  mask = "radial",
  focus = "none",
  css,
  layer,
  className,
  style,
  children,
  ref,
}: {
  name: string;
  live: boolean;
  mask?: BgMask;
  focus?: BgFocus;
  /** Component CSS, hoisted once per page by React. */
  css?: string;
  layer: ReactNode;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}) {
  const image = bgMaskImage(mask, focus);
  const composite = maskComposite(mask, focus);
  return (
    <div ref={ref} data-kn-ill={name} data-kn-bg={name} data-live={live} className={cn("relative isolate overflow-hidden", className)} style={style}>
      <style href={`kn-bg-${name}`} precedence="default">
        {`${MOTION_GATE}\n${css ?? ""}`}
      </style>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 select-none"
        style={image ? { maskImage: image, WebkitMaskImage: image, maskComposite: composite, WebkitMaskComposite: composite === "intersect" ? "source-in" : undefined } : undefined}
      >
        {layer}
      </div>
      {children}
    </div>
  );
}
