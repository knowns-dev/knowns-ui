"use client";
/** @registry name="aurora" type="block" title="Aurora" description="Up to three soft colour fields drifting slowly behind your content. Transform-only CSS, no blur filter." */

import { useRef } from "react";
import { useLive } from "@/registry/knowns/ui/knowns/illustrations/use-in-view";
import { BackgroundFrame } from "./background-frame";
import { densityScale, intensityScale, speedScale, tokenColor, withAlpha, type BackgroundProps } from "./bg-utils";

export interface AuroraProps extends Omit<BackgroundProps, "color"> {
  /** One to three colours (tokens, CSS variables or CSS colours), one per field. Default indigo, sky, violet. */
  color?: string | string[];
}

const DEFAULT = ["var(--kn-accent, #6366f1)", "#0ea5e9", "#8b5cf6"];

const CSS = `
@keyframes knbg-aurora-a { 0% { transform: translate(-6%, -4%) rotate(0deg) scale(1); } 100% { transform: translate(8%, 6%) rotate(18deg) scale(1.12); } }
@keyframes knbg-aurora-b { 0% { transform: translate(6%, 4%) rotate(0deg) scale(1.05); } 100% { transform: translate(-8%, -5%) rotate(-14deg) scale(0.95); } }
@keyframes knbg-aurora-c { 0% { transform: translate(0, 6%) scale(0.95); } 100% { transform: translate(-4%, -8%) scale(1.1); } }
[data-kn-bg="aurora"] .kn-field { will-change: transform; animation: var(--kn-name) var(--knbg-dur) cubic-bezier(.45,0,.55,1) infinite alternate; }
`;

/** Where each field sits and drifts. */
const FIELDS = [
  { name: "knbg-aurora-a", left: "-10%", top: "-25%", w: "70%", h: "90%", dur: 26 },
  { name: "knbg-aurora-b", left: "40%", top: "-15%", w: "70%", h: "80%", dur: 32 },
  { name: "knbg-aurora-c", left: "10%", top: "30%", w: "80%", h: "80%", dur: 38 },
];

/**
 * A slow aurora: up to three soft colour fields drifting and turning behind the content. CSS only and
 * transform-animated (no blur filter: the softness is in the gradients), so it stays cheap on any page.
 */
export function Aurora({ density, speed, color, mask = "radial", focus, intensity, paused, className, style, children }: AuroraProps) {
  const root = useRef<HTMLDivElement>(null);
  const { live } = useLive(root, paused);
  const s = speedScale(speed);
  const k = intensityScale(intensity);
  // Density: how much of the box the colour covers.
  const spread = densityScale(density);
  const colors = (Array.isArray(color) ? color : color ? [color] : DEFAULT).slice(0, 3).map((c) => tokenColor(c));
  const fields = FIELDS.slice(0, Math.max(1, Array.isArray(color) || !color ? colors.length : 3));

  return (
    <BackgroundFrame
      ref={root}
      name="aurora"
      live={live}
      mask={mask} focus={focus}
      css={CSS}
      className={className}
      style={style}
      layer={
        <div className="absolute inset-0 opacity-[0.75] dark:opacity-100">
          {fields.map((f, i) => {
            const c = colors[i % colors.length];
            return (
              <div
                key={f.name}
                className="kn-field absolute rounded-full"
                style={{
                  left: f.left,
                  top: f.top,
                  width: `calc(${f.w} * ${spread})`,
                  height: `calc(${f.h} * ${spread})`,
                  background: `radial-gradient(closest-side, ${withAlpha(c, 0.32 * k)}, ${withAlpha(c, 0.12 * k)} 55%, transparent)`,
                  animationPlayState: s === 0 ? "paused" : undefined,
                  ["--kn-name" as string]: f.name,
                  ["--knbg-dur" as string]: `${(f.dur / Math.max(0.05, s)).toFixed(1)}s`,
                }}
              />
            );
          })}
        </div>
      }
    >
      {children}
    </BackgroundFrame>
  );
}
