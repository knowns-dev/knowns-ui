"use client";
/** @registry name="floating-dock" type="ui" title="Floating Dock" description="A floating panel pinned to one of the four corners of the screen or of a parent, with a margin and the device safe area kept clear. It holds anything: a player, a call, a chat. The corner is a prop; dragging and snapping are in the Pro media-dock." */

/**
 * FloatingDock: a small panel that floats over the page in a corner. It is a plain positioned surface, no
 * state and no motion: change `corner` and it is in the new corner. `position="fixed"` (default) pins it to the
 * viewport and keeps clear of the notch and the home bar with the safe-area insets; `position="absolute"` pins
 * it inside the nearest positioned parent, for a demo frame or a panel inside an app shell.
 *
 * Because it is anchored with top/right/bottom/left and not with measured pixels, it stays in the corner when
 * the window resizes, with nothing to recompute. The Pro `media-dock` builds on it: drag, snap to the nearest
 * corner, minimise to a pill and arrow-key corner moves.
 */
import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";

export type DockCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export const DOCK_CORNERS: readonly DockCorner[] = ["top-left", "top-right", "bottom-left", "bottom-right"];

/** The anchor of a corner: two insets, each the margin plus the safe area on that side (the safe area is 0 on a desktop). */
export function dockAnchor(corner: DockCorner, margin = 16): CSSProperties {
  const edge = (side: "top" | "right" | "bottom" | "left") => `calc(${margin}px + env(safe-area-inset-${side}, 0px))`;
  const [v, h] = corner.split("-") as ["top" | "bottom", "left" | "right"];
  return { [v]: edge(v), [h]: edge(h) };
}

export interface FloatingDockProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** Which corner it sits in. Default "bottom-right". */
  corner?: DockCorner;
  /** Space between the panel and the edge, in px, on top of the safe area. Default 16. */
  margin?: number;
  /** "fixed" pins it to the viewport, "absolute" to the nearest positioned parent. Default "fixed". */
  position?: "fixed" | "absolute";
  /** Accessible name of the panel. Default "Floating panel". */
  label?: string;
  children?: ReactNode;
}

export const FloatingDock = forwardRef<HTMLElement, FloatingDockProps>(function FloatingDock(
  { corner = "bottom-right", margin = 16, position = "fixed", label = "Floating panel", className, style, children, ...rest },
  ref,
) {
  return (
    <section
      ref={ref}
      aria-label={label}
      data-dock-corner={corner}
      {...rest}
      className={cn(position === "fixed" ? "fixed" : "absolute", "z-40 overflow-hidden rounded-[22px] border border-border bg-card text-card-foreground shadow-lg", className)}
      style={{ ...dockAnchor(corner, margin), maxWidth: `calc(${position === "fixed" ? "100vw" : "100%"} - ${margin * 2}px)`, ...style }}
    >
      {children}
    </section>
  );
});
