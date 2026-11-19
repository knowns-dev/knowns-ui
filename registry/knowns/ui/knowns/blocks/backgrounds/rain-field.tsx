"use client";
/** @registry name="rain-field" type="block" title="Rain Field" description="Thin streaks of light falling at different speeds behind a fine dot screen, so they read as lit pixels. Canvas: the dot screen is baked once, only the lit cells are drawn each frame." */

import { useEffect, useRef } from "react";
import { useLive } from "@/registry/knowns/ui/knowns/illustrations/use-in-view";
import { BackgroundFrame } from "./background-frame";
import { fitCanvas, resolveRgba, watchTheme } from "./bg-canvas";
import { densityScale, intensityScale, makeRain, mulberry32, rainAlpha, rainCount, speedScale, stepRain, tokenColor, type BackgroundProps, type RainStreak } from "./bg-utils";

export interface RainFieldProps extends BackgroundProps {
  /** Dot pitch of the screen in CSS px. Default 7. */
  cell?: number;
  /** Size of a lit dot as a share of the pitch, 0.2 to 0.9. Default 0.6. */
  dot?: number;
  /** Shortest and longest tail in cells (dots). Default [12, 30]. */
  length?: [number, number];
  /** Bloom around each head, 0 to 1. Default 0.5. */
  glow?: number;
  /** Seed for the starting streaks. Default 17. */
  seed?: number;
}

/** The head's core: the accent pulled most of the way to white. */
const coreOf = ([r, g, b]: [number, number, number]) => `rgb(${Math.round(r + (255 - r) * 0.75)} ${Math.round(g + (255 - g) * 0.75)} ${Math.round(b + (255 - b) * 0.75)})`;

/** Cells around a head and how much of the head's light each gets: a plus and a ring, about two cells wide. */
const BLOOM: [number, number, number][] = [
  [0, -1, 0.7], [0, 1, 0.55], [-1, 0, 0.45], [1, 0, 0.45],
  [0, -2, 0.3], [0, 2, 0.22], [-1, -1, 0.2], [1, -1, 0.2], [-1, 1, 0.16], [1, 1, 0.16],
];

type Profile = Record<string, number[]> | undefined;

/**
 * Light streaks falling down a dot screen, in one accent colour. Each streak sits on one grid column and lights the
 * dots along its tail, brightest at a small head, so the picture reads as an LED wall. Canvas on the shared helpers:
 * the unlit dot screen is baked once into an offscreen canvas and blitted each frame, then only the lit cells are drawn
 * (a few hundred fillRects), so a full hero costs well under a millisecond. No backdrop filter, nothing repaints the
 * page. Frame-rate independent; pauses offscreen and in hidden tabs; reduced motion draws one still frame.
 * Dark pages are its home; on a light page the dots turn dark and the streaks keep the accent.
 */
export function RainField({
  density,
  speed,
  color,
  mask = "radial",
  focus,
  intensity,
  paused,
  cell = 7,
  dot = 0.6,
  length = [12, 30],
  glow = 0.5,
  seed = 17,
  className,
  style,
  children,
}: RainFieldProps) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { live, reduced } = useLive(root, paused);
  const s = speedScale(speed);
  const k = intensityScale(intensity);
  const d = densityScale(density);
  const css = color ? tokenColor(color) : "var(--kn-accent, var(--primary))";
  const [lo, hi] = length;

  const scene = useRef({
    w: 0,
    h: 0,
    cols: 0,
    rows: 0,
    ox: 0,
    oy: 0,
    dpr: 1,
    rain: [] as RainStreak[],
    rng: mulberry32(1),
    ink: [128, 128, 128] as [number, number, number],
    core: "rgb(255 255 255)",
    screen: null as HTMLCanvasElement | null,
    draw: () => {},
  });

  useEffect(() => {
    const el = root.current;
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!el || !cv || !ctx) return;
    const sc = scene.current;
    const pitch = Math.max(3, cell);
    const range: [number, number] = [Math.max(2, lo) * pitch, Math.max(3, hi) * pitch];
    const size = Math.min(0.9, Math.max(0.2, dot));
    const bloom = Math.min(1, Math.max(0, glow));

    // The unlit dot screen, baked once per size and colour: a faint dot in every cell.
    const bake = () => {
      const [fr, fg, fb] = resolveRgba(el, "var(--foreground)");
      const off = sc.screen ?? document.createElement("canvas");
      sc.screen = off;
      off.width = cv.width;
      off.height = cv.height;
      const c = off.getContext("2d");
      if (!c) return;
      c.clearRect(0, 0, off.width, off.height);
      c.fillStyle = `rgb(${fr} ${fg} ${fb} / ${(0.13 * k).toFixed(3)})`;
      const dd = Math.max(1, Math.round(pitch * size * 0.7 * sc.dpr));
      for (let r = 0; r < sc.rows; r++) for (let q = 0; q < sc.cols; q++) c.fillRect(Math.round((sc.ox + (q + 0.5) * pitch) * sc.dpr - dd / 2), Math.round((sc.oy + (r + 0.5) * pitch) * sc.dpr - dd / 2), dd, dd);
    };

    const lit = (q: number, r: number, a: number, grow = 0) => {
      const dd = Math.max(1, Math.round(pitch * size * sc.dpr)) + grow;
      ctx.globalAlpha = Math.min(1, a);
      ctx.fillRect(Math.round((sc.ox + (q + 0.5) * pitch) * sc.dpr - dd / 2), Math.round((sc.oy + (r + 0.5) * pitch) * sc.dpr - dd / 2), dd, dd);
    };

    sc.draw = () => {
      const t0 = performance.now();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (sc.screen) ctx.drawImage(sc.screen, 0, 0);
      ctx.fillStyle = `rgb(${sc.ink[0]} ${sc.ink[1]} ${sc.ink[2]})`;
      for (const st of sc.rain) {
        const head = st.y / pitch;
        const hr = Math.floor(head);
        const tail = Math.ceil(st.len / pitch);
        for (let j = 0; j <= tail; j++) {
          const r = hr - j;
          if (r < 0 || r >= sc.rows) continue;
          const dist = (head - r) * pitch;
          if (dist < 0 || dist > st.len) continue;
          lit(st.col, r, rainAlpha(dist / st.len) * st.glow * k * (j === 0 ? 1.25 : 1));
        }
        // The head: a near-white core tinted with the accent, and a bloom of about two cells around it.
        if (hr >= 0 && hr < sc.rows) {
          ctx.fillStyle = sc.core;
          lit(st.col, hr, Math.min(1, st.glow * 1.4 * k), 0);
          if (bloom > 0) {
            ctx.fillStyle = `rgb(${sc.ink[0]} ${sc.ink[1]} ${sc.ink[2]})`;
            const b = bloom * st.glow * k;
            for (const [dq, dr, f] of BLOOM) {
              const q = st.col + dq;
              const r2 = hr + dr;
              if (q >= 0 && q < sc.cols && r2 >= 0 && r2 < sc.rows) lit(q, r2, f * b);
            }
            ctx.fillStyle = `rgb(${sc.ink[0]} ${sc.ink[1]} ${sc.ink[2]})`;
          }
        }
      }
      ctx.globalAlpha = 1;
      (globalThis as { __knBgProfile?: Profile }).__knBgProfile?.["rain-field"]?.push(performance.now() - t0);
    };

    const fit = () => {
      const { w, h, dpr } = fitCanvas(cv, el);
      sc.w = w;
      sc.h = h;
      sc.dpr = dpr;
      sc.cols = Math.max(1, Math.floor(w / pitch));
      sc.rows = Math.max(1, Math.floor(h / pitch));
      sc.ox = (w - sc.cols * pitch) / 2;
      sc.oy = (h - sc.rows * pitch) / 2;
      sc.rng = mulberry32(seed * 7919 + 3);
      sc.rain = makeRain(rainCount(sc.cols, d), sc.cols, h, range, seed);
      bake();
      sc.draw();
    };
    const recolor = () => {
      const [r, g, b] = resolveRgba(el, css);
      sc.ink = [r, g, b];
      sc.core = coreOf(sc.ink);
      bake();
      sc.draw();
    };

    const [r0, g0, b0] = resolveRgba(el, css);
    sc.ink = [r0, g0, b0];
    sc.core = coreOf(sc.ink);
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
  }, [css, cell, dot, lo, hi, glow, seed, d, k]);

  // Motion: one loop while live. Streaks advance by speed × dt, so the pace is the same at 30, 60 or 120 Hz.
  useEffect(() => {
    if (!live || reduced || s === 0) return;
    const sc = scene.current;
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      stepRain(sc.rain, dt * s, sc.h, sc.cols, [Math.max(2, lo) * Math.max(3, cell), Math.max(3, hi) * Math.max(3, cell)], sc.rng);
      sc.draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live, reduced, s, cell, lo, hi]);

  return (
    <BackgroundFrame ref={root} name="rain-field" live={live} mask={mask} focus={focus} className={className} style={style} layer={<canvas ref={canvas} className="absolute inset-0" />}>
      {children}
    </BackgroundFrame>
  );
}
