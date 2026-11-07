"use client";
/** @registry name="grid-pattern" type="block" title="Grid Pattern" description="A crisp hairline grid with a few lit cells that trade places now and then. One SVG pattern on whole pixels, with dashes, tilt and a fade mask." */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLive } from "@/registry/knowns/ui/knowns/illustrations/use-in-view";
import { BackgroundFrame } from "./background-frame";
import { densityScale, gridCell, gridSquares, intensityScale, mulberry32, rotateSquares, speedScale, tokenColor, withAlpha, type BackgroundProps, type GridCell } from "./bg-utils";

export interface GridPatternProps extends BackgroundProps {
  /** Cell size in px before density. Default 40. */
  cell?: number;
  /** Line width in px. Default 1. */
  strokeWidth?: number;
  /** Dashed lines: true for "4 4", or any stroke-dasharray. Default false. */
  dashed?: boolean | string;
  /** Shift of the grid in px, [x, y]. Default [0, 0]. */
  offset?: [number, number];
  /** Lit squares: a list of [column, row], or how many to pick at random. Default 9. */
  squares?: GridCell[] | number;
  /** Move about a third of the lit squares every few seconds. true = every 4 s (divided by speed), or a number of seconds. Default false. */
  rotate?: boolean | number;
  /** Tilt in degrees (skewY), e.g. -8. Default 0. */
  skew?: number;
  /** Seed for the random squares. Default 5. */
  seed?: number;
}

const CSS = `
[data-kn-bg="grid-pattern"] .knbg-gp-sq { transition: opacity 0.7s cubic-bezier(.4,0,.2,1); }
[data-kn-bg="grid-pattern"] .knbg-gp-sq[data-off="true"] { opacity: 0; }
@media (prefers-reduced-motion: reduce) { [data-kn-bg="grid-pattern"] .knbg-gp-sq { transition: none; } }
`;

/**
 * A crisp SVG grid with a few lit squares. One <pattern> draws every line; lines sit on whole pixels so they
 * stay sharp at any DPR. Lit squares can rotate slowly (a CSS opacity fade, nothing else moves). No JS
 * animation loop; the only timer runs while it is on screen, rotating and allowed to move.
 */
export function GridPattern({
  density,
  speed,
  color,
  mask = "radial", focus,
  intensity,
  paused,
  cell = 40,
  strokeWidth = 1,
  dashed = false,
  offset = [0, 0],
  squares = 9,
  rotate = false,
  skew = 0,
  seed = 5,
  className,
  style,
  children,
}: GridPatternProps) {
  const root = useRef<HTMLDivElement>(null);
  const { live } = useLive(root, paused);
  const size = gridCell(cell, densityScale(density));
  const s = speedScale(speed);
  const k = intensityScale(intensity);
  const ink = tokenColor(color);
  const sw = Math.max(0.5, strokeWidth);
  const id = `knbg-gp-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // How many cells are visible, for placing random squares (a skewed grid gets a margin).
  const [dims, setDims] = useState({ cols: 36, rows: 18 });
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const cols = Math.max(1, Math.floor(e.contentRect.width / size));
      const rows = Math.max(1, Math.floor(e.contentRect.height / size));
      setDims((d) => (d.cols === cols && d.rows === rows ? d : { cols, rows }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [size]);

  const initial = useMemo(() => (Array.isArray(squares) ? squares : gridSquares(dims.cols, dims.rows, squares, seed)), [squares, dims.cols, dims.rows, seed]);
  const [lit, setLit] = useState(initial);
  const [off, setOff] = useState<ReadonlySet<number>>(new Set());
  useEffect(() => {
    setLit(initial);
    setOff(new Set());
  }, [initial]);

  // Rotation: fade the moving squares out, move them, fade them back in.
  const every = rotate === true ? 4 : typeof rotate === "number" ? rotate : 0;
  useEffect(() => {
    if (!every || !live || s === 0 || Array.isArray(squares)) return;
    const rng = mulberry32(seed * 31 + 7);
    let fade = 0;
    const timer = window.setInterval(() => {
      setLit((cur) => {
        const next = rotateSquares(cur, dims.cols, dims.rows, rng);
        const moving = new Set(next.flatMap((c, i) => (c !== cur[i] ? [i] : [])));
        setOff(moving);
        fade = window.setTimeout(() => {
          setLit(next);
          setOff(new Set());
        }, 700);
        return cur;
      });
    }, (every * 1000) / s);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(fade);
    };
  }, [every, live, s, squares, dims.cols, dims.rows, seed]);

  const [ox, oy] = offset;
  const dash = dashed === true ? "4 4" : dashed || undefined;
  const half = sw / 2;
  return (
    <BackgroundFrame
      ref={root}
      name="grid-pattern"
      live={live}
      mask={mask} focus={focus}
      css={CSS}
      className={className}
      style={style}
      layer={
        <svg className="absolute inset-0 size-full" aria-hidden="true">
          <defs>
            <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse" x={ox} y={oy}>
              {/* Top and left edge of each cell, offset by half a line so a 1px line covers exactly one pixel row. */}
              <path d={`M${size} ${half}H${half}V${size}`} fill="none" stroke={withAlpha(ink, 0.17 * k)} strokeWidth={sw} strokeDasharray={dash} shapeRendering="crispEdges" />
            </pattern>
          </defs>
          <g style={skew ? { transform: `skewY(${skew}deg)`, transformOrigin: "50% 50%", transformBox: "view-box" } : undefined}>
            <rect x="-50%" y="-50%" width="200%" height="200%" fill={`url(#${id})`} />
            {lit.map(([c, r], i) => (
              <rect
                key={i}
                className="knbg-gp-sq"
                data-off={off.has(i)}
                x={c * size + ox + sw}
                y={r * size + oy + sw}
                width={Math.max(0, size - sw)}
                height={Math.max(0, size - sw)}
                fill={withAlpha(ink, 0.075 * k)}
                shapeRendering="crispEdges"
              />
            ))}
          </g>
        </svg>
      }
    >
      {children}
    </BackgroundFrame>
  );
}
