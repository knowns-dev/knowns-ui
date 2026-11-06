"use client";
/** @registry name="parallax-card" type="ui" title="Parallax Card" description="A card that leans away from the pointer: the surface shifts a few px and grows to 102% while its content and an optional edge-bleeding media move further, for depth. Plain, muted or accent ground with optional grain. Transform-only with one rAF while hovered; still on touch and with reduced motion." */

/**
 * ParallaxCard: a card that leans away from the pointer. On hover the surface shifts a few px against the
 * pointer and grows to 102%, while its content (and an optional media slot that bleeds off an edge) moves a
 * little further, so the layers read as depth. It springs back on leave.
 *
 * Transform-only, so there is no layout shift: one rAF loop runs only while the pointer is over the card or
 * the spring is settling, and it writes transforms straight to three elements (no re-renders). It stays still
 * on touch and coarse pointers and with reduced motion. An optional grain is a static SVG noise tile.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { useReducedMotion } from "./illustrations/use-in-view";

export type ParallaxTone = "plain" | "muted" | "accent";

export interface ParallaxCardProps {
  /** The ground: the card colour, a quiet muted fill, or a tint of `tint`. Default "plain". */
  tone?: ParallaxTone;
  /** The accent tint (any CSS colour or token). Only used by tone "accent". Default our indigo. */
  tint?: string;
  /** A soft film grain over the ground. true, or an opacity 0 to 0.3. Default false. */
  grain?: boolean | number;
  /** How far the content travels at the card's edge, in px. The surface moves half as much. Default 10. */
  depth?: number;
  /** Hover scale of the surface. Default 1.02. */
  scale?: number;
  /** Media (a screenshot, an illustration) placed on an edge and allowed to bleed off it. */
  media?: ReactNode;
  /** Which edge the media bleeds off. "right" moves to the bottom edge on small screens. Default "right". */
  mediaSide?: "right" | "bottom";
  className?: string;
  /** Classes for the content layer (padding, layout). Default "p-6 sm:p-8". */
  contentClassName?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const DEFAULT_TINT = "#6366f1";

/** A small feTurbulence tile as a data URI: drawn once by the browser and repeated, no filter per frame. */
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.2 -.15"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>',
)}")`;

const TONE: Record<ParallaxTone, string> = {
  plain: "border bg-card",
  muted: "border border-transparent bg-[color-mix(in_oklab,var(--foreground)_4.5%,var(--card))]",
  accent: "border border-[color-mix(in_oklab,var(--kn-pc-tint)_22%,transparent)] bg-[color-mix(in_oklab,var(--kn-pc-tint)_9%,var(--card))]",
};

/** Whether the device has a fine, hovering pointer (a mouse or trackpad). */
function useFinePointer() {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(hover: hover) and (pointer: fine)");
    const on = () => setFine(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return fine;
}

export function ParallaxCard({ tone = "plain", tint = DEFAULT_TINT, grain = false, depth = 10, scale = 1.02, media, mediaSide = "right", className, contentClassName, style, children }: ParallaxCardProps) {
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const mediaEl = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const fine = useFinePointer();
  const enabled = fine && !reduced;

  useEffect(() => {
    const el = root.current;
    if (!el || !enabled) return;
    // Pointer position in -1..1 from the centre, and the hover amount 0..1; both eased by one spring each.
    const target = { x: 0, y: 0, h: 0 };
    const cur = { x: 0, y: 0, h: 0 };
    let raf = 0;
    let last = 0;
    let box: DOMRect | null = null;

    const write = () => {
      const s = 1 + (scale - 1) * cur.h;
      el.style.transform = `translate3d(${(-cur.x * depth * 0.5).toFixed(2)}px, ${(-cur.y * depth * 0.5).toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
      if (content.current) content.current.style.transform = `translate3d(${(-cur.x * depth * 0.5).toFixed(2)}px, ${(-cur.y * depth * 0.5).toFixed(2)}px, 0)`;
      if (mediaEl.current) mediaEl.current.style.transform = `translate3d(${(-cur.x * depth * 0.9).toFixed(2)}px, ${(-cur.y * depth * 0.9).toFixed(2)}px, 0)`;
    };
    const tick = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
      last = t;
      const e = 1 - Math.exp(-dt * 12);
      cur.x += (target.x - cur.x) * e;
      cur.y += (target.y - cur.y) * e;
      cur.h += (target.h - cur.h) * e;
      write();
      const settled = Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) + Math.abs(target.h - cur.h) < 0.002;
      if (settled) {
        cur.x = target.x;
        cur.y = target.y;
        cur.h = target.h;
        write();
        raf = 0;
        last = 0;
      } else raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onEnter = () => {
      // Measured once per hover, without the hover transform, so moving the card does not move the target.
      box = el.getBoundingClientRect();
      target.h = 1;
      kick();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !box) return;
      target.x = Math.max(-1, Math.min(1, ((e.clientX - box.left) / box.width) * 2 - 1));
      target.y = Math.max(-1, Math.min(1, ((e.clientY - box.top) / box.height) * 2 - 1));
      kick();
    };
    const onLeave = () => {
      box = null;
      target.x = target.y = target.h = 0;
      kick();
    };
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.style.transform = "";
      if (content.current) content.current.style.transform = "";
      if (mediaEl.current) mediaEl.current.style.transform = "";
    };
  }, [enabled, depth, scale]);

  const grainAlpha = grain === true ? 0.12 : typeof grain === "number" ? Math.max(0, Math.min(0.3, grain)) : 0;

  return (
    <div
      ref={root}
      data-kn-parallax={tone}
      className={cn("relative isolate overflow-hidden rounded-2xl", enabled && "will-change-transform", TONE[tone], className)}
      style={{ ...(tone === "accent" ? ({ "--kn-pc-tint": tint } as CSSProperties) : null), ...style }}
    >
      {grainAlpha > 0 && <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 mix-blend-overlay dark:mix-blend-soft-light" style={{ backgroundImage: GRAIN, opacity: grainAlpha * 2.2 }} />}
      {media && (
        <div
          ref={mediaEl}
          className={cn(
            "pointer-events-none absolute -z-[5]",
            // Pushed past the edge, so it bleeds off the card and the overflow clips it.
            mediaSide === "right"
              ? "inset-x-6 bottom-0 h-[44%] translate-y-[14%] sm:inset-x-auto sm:top-8 sm:right-0 sm:h-auto sm:w-[56%] sm:translate-x-[10%] sm:translate-y-0"
              : "inset-x-6 bottom-0 h-[52%] translate-y-[10%]",
          )}
        >
          {media}
        </div>
      )}
      <div ref={content} className={cn("relative", contentClassName ?? "p-6 sm:p-8")}>
        {children}
      </div>
    </div>
  );
}

export default ParallaxCard;
