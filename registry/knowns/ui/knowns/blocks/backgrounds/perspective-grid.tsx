"use client";
/** @registry name="perspective-grid" type="block" title="Perspective Grid" description="A grid floor running toward the viewer and fading into a soft horizon. One looping CSS 3D transform." */

import { useRef, type CSSProperties } from "react";
import { useLive } from "@/registry/knowns/ui/knowns/illustrations/use-in-view";
import { BackgroundFrame } from "./background-frame";
import { densityScale, intensityScale, speedScale, tokenColor, withAlpha, type BackgroundProps } from "./bg-utils";

export interface PerspectiveGridProps extends BackgroundProps {
  /** Tilt of the floor in degrees (more is flatter). Default 64. */
  angle?: number;
  /** Horizon height as % from the top. Default 40. */
  horizon?: number;
}

/** Cell size (px) for a density: one loop moves the floor exactly this far, so it is seamless. */
export function gridCell(density?: PerspectiveGridProps["density"]): number {
  return Math.round(40 / densityScale(density));
}

/** Seconds per one-cell loop at a speed (0: still). The base is 1.6s at 1x. */
export function gridDuration(speed?: number): number {
  const s = speedScale(speed);
  return s === 0 ? 0 : Math.round((1.6 / s) * 100) / 100;
}

const CSS = `
@keyframes knbg-grid-run { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(0, var(--kn-cell), 0); } }
[data-kn-bg="perspective-grid"] .kn-floor { animation: knbg-grid-run var(--kn-dur) linear infinite; will-change: transform; }
`;

/**
 * A grid floor running toward the viewer from a soft horizon.
 *
 * The floor hangs from the horizon and tilts toward the viewer (a static rotateX), so its far edge IS the
 * horizon and nothing ever reaches the camera. The perspective depth follows the floor's height (container
 * query units), so the near cells reach the bottom at any size. Only an inner layer moves: it carries the
 * lines and translates by exactly one cell per loop, linear and infinite, so the first and last frames are
 * the same and there is no snap. The horizon fade is a mask on the static parent.
 */
export function PerspectiveGrid({ density, speed, color, mask = "none", focus, intensity, paused, angle = 64, horizon = 40, className, style, children }: PerspectiveGridProps) {
  const root = useRef<HTMLDivElement>(null);
  const { live } = useLive(root, paused);
  const cell = gridCell(density);
  const dur = gridDuration(speed);
  const k = intensityScale(intensity);
  const c = tokenColor(color);
  const line = withAlpha(c, 0.28 * k);
  const tilt = Math.min(80, Math.max(45, angle));
  const h = Math.min(80, Math.max(15, horizon));
  // Fully transparent at the horizon, then the floor fades in: no hard far edge.
  const fade = "linear-gradient(to bottom, transparent 0%, color-mix(in srgb, #000 30%, transparent) 22%, #000 62%, #000 100%)";
  // 1px lines on both axes, repeating every cell.
  const lines = `repeating-linear-gradient(to right, ${line} 0 1px, transparent 1px ${cell}px), repeating-linear-gradient(to bottom, ${line} 0 1px, transparent 1px ${cell}px)`;

  return (
    <BackgroundFrame
      ref={root}
      name="perspective-grid"
      live={live}
      mask={mask} focus={focus}
      css={CSS}
      className={className}
      style={style}
      layer={
        <>
          {/* A soft glow along the horizon. */}
          <div className="absolute inset-x-0 h-24 -translate-y-1/2" style={{ top: `${h}%`, background: `radial-gradient(50% 50% at 50% 50%, ${withAlpha(c, 0.06 * k)}, transparent 75%)` }} />
          {/* The floor region: a size container, masked, static. */}
          <div className="absolute inset-x-0 bottom-0 overflow-hidden" style={{ top: `${h}%`, containerType: "size", maskImage: fade, WebkitMaskImage: fade } as CSSProperties}>
            {/* Perspective from the horizon; the depth follows the floor's height. */}
            <div className="absolute inset-0" style={{ perspective: "200cqh", perspectiveOrigin: "50% 0" }}>
              {/* The plane: hinged at the horizon, tilted toward the viewer. With a depth of 2x the floor height it
                  reaches the bottom at about 1.15x the floor height and never nears the camera (that would take 2.2x). */}
              <div className="absolute inset-x-[-100%] top-0 origin-top" style={{ height: `calc(150% + ${cell}px)`, transform: `rotateX(${tilt}deg)` }}>
                {/* The only moving part: one cell taller than the plane, moved by exactly one cell. */}
                <div
                  className="kn-floor absolute inset-x-0 bottom-0"
                  style={
                    {
                      top: `-${cell}px`,
                      backgroundImage: lines,
                      backgroundPosition: "center 0",
                      animationPlayState: dur === 0 ? "paused" : undefined,
                      "--kn-cell": `${cell}px`,
                      "--kn-dur": `${dur || 1}s`,
                    } as CSSProperties
                  }
                />
              </div>
            </div>
          </div>
        </>
      }
    >
      {children}
    </BackgroundFrame>
  );
}
