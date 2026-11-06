"use client";
/** @registry name="dot-spotlight" type="block" title="Dot Spotlight" description="A quiet dot grid with a soft light that follows the pointer and lifts the dots under it. CSS only." */

import { useEffect, useRef } from "react";
import { useLive } from "@/registry/knowns/ui/knowns/illustrations/use-in-view";
import { BackgroundFrame } from "./background-frame";
import { densityScale, intensityScale, speedScale, tokenColor, withAlpha, type BackgroundProps } from "./bg-utils";

export interface DotSpotlightProps extends BackgroundProps {
  /** Spotlight radius in px. Default 260. */
  radius?: number;
  /** Where the light rests without a pointer, as % of the box. Default { x: 50, y: 30 }. */
  rest?: { x: number; y: number };
}

/**
 * A quiet dot grid; a soft light follows the pointer and lifts the dots under it. CSS only: the light is a
 * mask whose centre eases toward the pointer through two CSS variables, so nothing re-renders on move.
 */
export function DotSpotlight({
  density,
  speed,
  color,
  mask = "radial",
  intensity,
  paused,
  radius = 260,
  rest = { x: 50, y: 30 },
  className,
  style,
  children,
}: DotSpotlightProps) {
  const root = useRef<HTMLDivElement>(null);
  const { live, reduced } = useLive(root, paused);
  const gap = Math.round(22 / densityScale(density));
  const k = intensityScale(intensity);
  const ease = speedScale(speed);
  const c = tokenColor(color);

  // Pointer → eased CSS variables. Runs a frame loop only while the light is catching up.
  const live$ = useRef(live);
  live$.current = live;
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const pos = { x: rest.x, y: rest.y };
    const target = { x: rest.x, y: rest.y };
    let raf = 0;
    let last = 0;
    const write = () => {
      el.style.setProperty("--kn-sx", `${pos.x.toFixed(2)}%`);
      el.style.setProperty("--kn-sy", `${pos.y.toFixed(2)}%`);
    };
    const tick = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60;
      last = t;
      const a = 1 - Math.exp(-dt * 9 * Math.max(0.25, ease));
      pos.x += (target.x - pos.x) * a;
      pos.y += (target.y - pos.y) * a;
      write();
      if (Math.abs(target.x - pos.x) + Math.abs(target.y - pos.y) > 0.05) raf = requestAnimationFrame(tick);
      else {
        raf = 0;
        last = 0;
      }
    };
    const go = (x: number, y: number) => {
      target.x = x;
      target.y = y;
      // Still (reduced motion, speed 0 or paused): jump, don't glide.
      if (reduced || ease === 0 || !live$.current) {
        pos.x = x;
        pos.y = y;
        write();
        return;
      }
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      go(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
    };
    const onLeave = () => go(rest.x, rest.y);
    write();
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [rest.x, rest.y, reduced, ease]);

  const dots = (alpha: number) => `radial-gradient(circle at center, ${withAlpha(c, alpha)} 1px, transparent 1.5px)`;
  const light = `radial-gradient(${radius}px circle at var(--kn-sx, 50%) var(--kn-sy, 30%), #000 0%, transparent 100%)`;

  return (
    <BackgroundFrame
      ref={root}
      name="dot-spotlight"
      live={live}
      mask={mask}
      className={className}
      style={style}
      layer={
        <>
          <div className="absolute inset-0" style={{ backgroundImage: dots(0.16 * k), backgroundSize: `${gap}px ${gap}px`, backgroundPosition: "center" }} />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `${dots(0.55 * k)}, radial-gradient(${radius}px circle at var(--kn-sx, 50%) var(--kn-sy, 30%), ${withAlpha(c, 0.06 * k)}, transparent 70%)`,
              backgroundSize: `${gap}px ${gap}px, 100% 100%`,
              backgroundPosition: "center, 0 0",
              maskImage: light,
              WebkitMaskImage: light,
            }}
          />
        </>
      }
    >
      {children}
    </BackgroundFrame>
  );
}
