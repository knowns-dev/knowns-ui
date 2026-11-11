"use client";
/** @registry name="fan-stack" type="ui" title="Fan Stack" description="A stack of cards that fans out on hover or keyboard focus and restacks on leave or blur. A tap toggles it on touch. Each card rotates around a point below the stack, with a short stagger. Card content is a slot; spread angle and gap are props. Transform-only, no motion on first render, instant under reduced motion." */

/**
 * FanStack: 3 to 5 cards stacked with a slight offset and tilt. Hover or keyboard focus spreads them into a
 * fan (each card rotates around a point below the stack and shifts sideways); leaving or blurring restacks.
 * On touch, a tap toggles it. Each child is one card, so the count comes from the children.
 *
 * Motion (kn-motion): transform only, --kn-ease-out for the way out and the way back, 180ms to fan and 120ms
 * to restack, stagger 40ms per card and only the first 4 cards. Nothing plays on first render (the rest pose
 * is the initial style) and the `kn-` class lets knowns.css finish it at once under reduced motion.
 */
import { Children, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";

export interface FanStackProps {
  /** The cards: one child per card. Up to 5 are shown; the rest are ignored. */
  children?: ReactNode;
  /** Total angle of the fan in degrees, from the first card to the last. Default 36. */
  spread?: number;
  /** Sideways shift between neighbouring cards when fanned, in px. Default 48. */
  gap?: number;
  /** Controlled open state. Leave it out to let hover, focus and tap decide. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Accessible name of the group. Default "Card stack". */
  label?: string;
  /** Size the stack with classes (width and height). Default "h-56 w-40". */
  className?: string;
  /** Classes for every card wrapper (radius, shadow, surface). */
  cardClassName?: string;
}

export const FAN_MAX = 5;
export const FAN_STAGGER_MS = 40;
export const FAN_STAGGER_CARDS = 4;

export interface FanPose {
  x: number;
  y: number;
  rotate: number;
}

/** Position of card i of n in -1..1 (0 for a single card). */
export function fanSlot(i: number, n: number): number {
  return n > 1 ? (i / (n - 1)) * 2 - 1 : 0;
}

/** Rest pose: a slight offset and tilt, the middle card straight and on top. */
export function restPose(i: number, n: number): FanPose {
  const t = fanSlot(i, n);
  return { x: t * 6, y: Math.abs(t) * 4, rotate: t * 4 };
}

/** Fanned pose: rotate about a point below the stack and shift sideways by the gap. */
export function fanPose(i: number, n: number, spread = 36, gap = 48): FanPose {
  const t = fanSlot(i, n);
  return { x: t * gap * ((n - 1) / 2), y: 0, rotate: t * (spread / 2) };
}

/** Delay before card i starts moving: 40ms steps, flat after the 4th card. */
export function fanDelay(i: number): number {
  return Math.min(i, FAN_STAGGER_CARDS - 1) * FAN_STAGGER_MS;
}

const toTransform = (p: FanPose) => `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rotate}deg)`;

export function FanStack({ children, spread = 36, gap = 48, open, onOpenChange, label = "Card stack", className, cardClassName }: FanStackProps) {
  const cards = Children.toArray(children).slice(0, FAN_MAX);
  const n = cards.length;
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [tapped, setTapped] = useState(false);
  const touch = useRef(false);
  const auto = hover || focus || tapped;
  const isOpen = open ?? auto;
  const last = useRef(isOpen);

  const sync = (next: { hover?: boolean; focus?: boolean; tapped?: boolean }) => {
    const h = next.hover ?? hover;
    const f = next.focus ?? focus;
    const t = next.tapped ?? tapped;
    if (next.hover !== undefined) setHover(h);
    if (next.focus !== undefined) setFocus(f);
    if (next.tapped !== undefined) setTapped(t);
    const now = h || f || t;
    if (now !== last.current) {
      last.current = now;
      onOpenChange?.(now);
    }
  };

  return (
    <div
      role="group"
      aria-label={label}
      tabIndex={0}
      data-open={isOpen ? "true" : "false"}
      className={cn("kn-fan-stack relative h-56 w-40 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background", className)}
      onPointerDown={(e) => {
        touch.current = e.pointerType === "touch";
      }}
      onPointerEnter={(e) => {
        if (e.pointerType !== "touch") sync({ hover: true });
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "touch") sync({ hover: false });
      }}
      onClick={() => {
        if (touch.current) sync({ tapped: !tapped });
      }}
      onFocus={() => {
        if (!touch.current) sync({ focus: true });
      }}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        sync({ focus: false, tapped: false });
      }}
    >
      {cards.map((card, i) => {
        const pose = isOpen ? fanPose(i, n, spread, gap) : restPose(i, n);
        const style: CSSProperties = {
          transform: toTransform(pose),
          // Fan out from a point below the stack, so the cards swing like a hand of playing cards.
          transformOrigin: "50% 160%",
          zIndex: i + 1,
          transitionProperty: "transform",
          transitionTimingFunction: "var(--kn-ease-out, cubic-bezier(.22, 1, .36, 1))",
          // Out: 180ms with a stagger. Back: 120ms, no stagger, so leaving never feels late.
          transitionDuration: isOpen ? "var(--kn-dur, 180ms)" : "var(--kn-dur-fast, 120ms)",
          transitionDelay: isOpen ? `${fanDelay(i)}ms` : "0ms",
          willChange: "transform",
        };
        return (
          <div key={(card as { key?: string | number | null }).key ?? i} data-fan-card={i} className={cn("kn-fan-card absolute inset-0 overflow-hidden rounded-xl border bg-card shadow-md", cardClassName)} style={style}>
            {card}
          </div>
        );
      })}
    </div>
  );
}
