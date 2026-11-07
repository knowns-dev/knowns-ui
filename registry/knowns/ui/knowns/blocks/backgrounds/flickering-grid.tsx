"use client";
/** @registry name="flickering-grid" type="block" title="Flickering Grid" description="Small squares that flicker toward a low ceiling, a few at a time, with an optional word glowing out of the grid. Canvas, repainting only the squares that change." */

import { useEffect, useRef } from "react";
import { useLive } from "@/registry/knowns/ui/knowns/illustrations/use-in-view";
import { BackgroundFrame } from "./background-frame";
import { fitCanvas, resolveRgba, watchTheme } from "./bg-canvas";
import { densityScale, flickerBudget, gridDims, intensityScale, speedScale, tokenColor, xorshift32, type BackgroundProps } from "./bg-utils";

export interface FlickeringGridProps extends BackgroundProps {
  /** Square size in px. Default 3. */
  size?: number;
  /** Gap between squares in px (density shrinks it). Default 5. */
  gap?: number;
  /** Highest opacity a square flickers to, 0 to 1. Default 0.3. */
  maxOpacity?: number;
  /** How often each square changes, per second. Default 0.35. */
  flicker?: number;
  /** Text (a word or a short name) whose squares glow brighter, drawn from the grid itself. */
  text?: string;
  /** Font for `text`, without the size. Default "600 1em system-ui, sans-serif" weight and family. */
  font?: string;
  /** Seed for the starting pattern. Default 3. */
  seed?: number;
}

type Profile = Record<string, number[]> | undefined;

/**
 * Small squares whose opacity flickers at random toward a ceiling. Canvas: each frame re-rolls only about
 * cells × flicker × dt squares and repaints just those (typed arrays, no allocation per frame), so a full
 * hero costs a few dozen fillRects a frame. With `text`, the squares inside the shape glow brighter.
 * Pauses offscreen; reduced motion draws one still frame.
 */
export function FlickeringGrid({
  density,
  speed,
  color,
  mask = "radial", focus,
  intensity,
  paused,
  size = 3,
  gap = 5,
  maxOpacity = 0.3,
  flicker = 0.35,
  text,
  font = "600 1em system-ui, sans-serif",
  seed = 3,
  className,
  style,
  children,
}: FlickeringGridProps) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { live, reduced } = useLive(root, paused);
  const s = speedScale(speed);
  const k = intensityScale(intensity);
  const css = tokenColor(color);
  const g = Math.max(1, gap / densityScale(density));
  const top = Math.min(1, Math.max(0.02, maxOpacity)) * k;

  const scene = useRef({
    cols: 0,
    rows: 0,
    pitch: 1,
    dpr: 1,
    op: new Float32Array(0),
    inside: new Uint8Array(0),
    rng: xorshift32(seed * 2654435761 || 1),
    carry: 0,
    ink: "rgb(128 128 128)",
    repaint: (_i: number) => {},
    full: () => {},
    roll: (_i: number) => {},
  });

  useEffect(() => {
    const el = root.current;
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!el || !cv || !ctx) return;
    const sc = scene.current;
    sc.rng = xorshift32(seed * 2654435761 || 1);
    const inTop = Math.min(1, top * 2.8 + 0.15);

    // Opacity for a cell: outside the text in [0, top], inside in [0.5, 1] of the brighter ceiling.
    sc.roll = (i: number) => {
      const r = sc.rng();
      sc.op[i] = sc.inside[i] ? inTop * (0.5 + r * 0.5) : top * r;
    };
    // Device-pixel cell rect, rounded so every square has the same crisp size.
    const sizeDev = () => Math.max(1, Math.round(size * sc.dpr));
    sc.repaint = (i: number) => {
      const x = Math.round((i % sc.cols) * sc.pitch * sc.dpr);
      const y = Math.round(Math.floor(i / sc.cols) * sc.pitch * sc.dpr);
      const d = sizeDev();
      ctx.clearRect(x, y, d, d);
      ctx.globalAlpha = sc.op[i];
      ctx.fillRect(x, y, d, d);
    };
    sc.full = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      // Resizing the canvas resets its state, so the colour is set on every full paint.
      ctx.fillStyle = sc.ink;
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (let i = 0; i < sc.op.length; i++) sc.repaint(i);
      ctx.globalAlpha = 1;
    };

    const shapeMask = () => {
      sc.inside = new Uint8Array(sc.cols * sc.rows);
      if (!text || !sc.cols || !sc.rows) return;
      const m = document.createElement("canvas");
      m.width = sc.cols;
      m.height = sc.rows;
      const mc = m.getContext("2d", { willReadFrequently: true });
      if (!mc) return;
      // Fit the text to about 80% of the width and 55% of the height, in grid cells.
      mc.font = font.replace("1em", "100px");
      const wide = mc.measureText(text).width || 1;
      const px = Math.max(4, Math.min((sc.cols * 0.8 * 100) / wide, sc.rows * 0.55));
      mc.font = font.replace("1em", `${px}px`);
      mc.textAlign = "center";
      mc.textBaseline = "middle";
      mc.fillStyle = "#000";
      mc.fillText(text, sc.cols / 2, sc.rows / 2);
      const data = mc.getImageData(0, 0, sc.cols, sc.rows).data;
      for (let i = 0; i < sc.inside.length; i++) sc.inside[i] = data[i * 4 + 3] > 110 ? 1 : 0;
    };

    const fit = () => {
      const { w, h, dpr } = fitCanvas(cv, el);
      const dims = gridDims(w, h, size, g);
      sc.cols = dims.cols;
      sc.rows = dims.rows;
      sc.pitch = dims.pitch;
      sc.dpr = dpr;
      sc.op = new Float32Array(sc.cols * sc.rows);
      shapeMask();
      for (let i = 0; i < sc.op.length; i++) sc.roll(i);
      sc.full();
    };
    const recolor = () => {
      const [r, gg, b] = resolveRgba(el, css);
      sc.ink = `rgb(${r} ${gg} ${b})`;
      sc.full();
    };

    const [r0, g0, b0] = resolveRgba(el, css);
    sc.ink = `rgb(${r0} ${g0} ${b0})`;
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    // A zoom change (CSS zoom on an ancestor) keeps the layout size, so no ResizeObserver call; the docs preview fires a window resize.
    window.addEventListener("resize", fit);
    const unwatch = watchTheme(recolor);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
      unwatch();
    };
  }, [css, size, g, top, text, font, seed]);

  // Motion: re-roll a budget of random cells each frame and repaint only those.
  useEffect(() => {
    if (!live || reduced || s === 0 || flicker <= 0) return;
    const sc = scene.current;
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      const t0 = performance.now();
      const cells = sc.op.length;
      const [n, carry] = flickerBudget(cells, flicker * s, dt, sc.carry);
      sc.carry = carry;
      for (let j = 0; j < n; j++) {
        const i = (sc.rng() * cells) | 0;
        sc.roll(i);
        sc.repaint(i);
      }
      const prof = (globalThis as { __knBgProfile?: Profile }).__knBgProfile;
      prof?.["flickering-grid"]?.push(performance.now() - t0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live, reduced, s, flicker]);

  return (
    <BackgroundFrame ref={root} name="flickering-grid" live={live} mask={mask} focus={focus} className={className} style={style} layer={<canvas ref={canvas} className="absolute inset-0" />}>
      {children}
    </BackgroundFrame>
  );
}
