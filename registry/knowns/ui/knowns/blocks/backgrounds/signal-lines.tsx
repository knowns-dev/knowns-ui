"use client";
/** @registry name="signal-lines" type="block" title="Signal Lines" description="Faint routed traces with pulses travelling along them, like agent traffic. Seeded SVG with dashoffset pulses." */

import { useMemo, useRef } from "react";
import { useLive } from "@/registry/knowns/ui/knowns/illustrations/use-in-view";
import { BackgroundFrame } from "./background-frame";
import { densityScale, intensityScale, signalTraces, speedScale, tokenColor, withAlpha, type BackgroundProps } from "./bg-utils";

export interface SignalLinesProps extends BackgroundProps {
  /** Seed for the trace layout; change it for a different board. Default 7. */
  seed?: number;
  /** Pulse colour; defaults to `color`. */
  pulseColor?: string;
}

const W = 1200;
const H = 640;

const CSS = `
@keyframes knbg-signal { from { stroke-dashoffset: var(--kn-len); } to { stroke-dashoffset: -1; } }
[data-kn-bg="signal-lines"] .kn-pulse { animation: knbg-signal var(--knbg-dur) linear var(--kn-delay) infinite; }
@media (prefers-reduced-motion: reduce) { [data-kn-bg="signal-lines"] .kn-pulse { stroke-dashoffset: -0.45; } }
`;

/**
 * Faint routed traces across the box with pulses travelling along them, like traffic between agents and
 * tools. SVG + CSS (stroke-dashoffset only); the layout is seeded, so server and client draw the same board.
 */
export function SignalLines({ density, speed, color, pulseColor, mask = "radial", focus, intensity, paused, seed = 7, className, style, children }: SignalLinesProps) {
  const root = useRef<HTMLDivElement>(null);
  const { live } = useLive(root, paused);
  const d = densityScale(density);
  const s = speedScale(speed);
  const k = intensityScale(intensity);
  const traces = useMemo(() => signalTraces(W, H, Math.round(9 * d), seed), [d, seed]);
  const line = tokenColor(color);
  const pulse = tokenColor(pulseColor ?? color);
  // speed 0: no pulses at all, just the board.
  const moving = s > 0;

  return (
    <BackgroundFrame
      ref={root}
      name="signal-lines"
      live={live}
      mask={mask} focus={focus}
      css={CSS}
      className={className}
      style={style}
      layer={
        <svg className="absolute inset-0 size-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" fill="none">
          <g stroke={withAlpha(line, 0.1 * k)} strokeWidth={1} strokeLinejoin="round" vectorEffect="non-scaling-stroke">
            {traces.map((t, i) => (
              <path key={i} d={t.d} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
          <g fill={withAlpha(line, 0.22 * k)}>
            {traces.map((t, i) => (
              <circle key={i} cx={t.from[0]} cy={t.from[1]} r={2.5} />
            ))}
          </g>
          {moving && (
            <g stroke={withAlpha(pulse, 0.7 * k)} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              {traces.map((t, i) => (
                <path
                  key={i}
                  className="kn-pulse"
                  d={t.d}
                  pathLength={1}
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray="0.06 1.06"
                  style={{
                    ["--kn-len" as string]: "0.06",
                    ["--knbg-dur" as string]: `${(t.duration / s).toFixed(2)}s`,
                    ["--kn-delay" as string]: `${(t.delay / s).toFixed(2)}s`,
                  }}
                />
              ))}
            </g>
          )}
        </svg>
      }
    >
      {children}
    </BackgroundFrame>
  );
}
