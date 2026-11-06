"use client";
/** @registry name="dither-field" type="block" title="Dither Field" description="A soft light rendered as crisp ordered-dither dots: a glow that eases after the pointer, a rising horizon or flowing noise. Canvas, redrawn only while the light changes." */

import { useEffect, useRef } from "react";
import { useLive } from "@/registry/knowns/ui/knowns/illustrations/use-in-view";
import { BackgroundFrame } from "./background-frame";
import { contentRects, fitCanvas, resolveRgba, watchContent, watchTheme, type BgClear } from "./bg-canvas";
import { bayerMatrix, densityScale, glowFalloff, holeFieldRects, intensityScale, mulberry32, speedScale, tokenColor, type BackgroundProps } from "./bg-utils";

export type DitherShape = "glow" | "horizon" | "noise";

export interface DitherFieldProps extends BackgroundProps {
  /** The light the dots render: a radial glow, a horizon rising from the bottom, or soft noise. Default "glow". */
  shape?: DitherShape;
  /** Dot pitch in CSS px, 2 to 4 (density nudges it). Default 3. */
  dot?: number;
  /** Bayer matrix size: 4 is coarser and more patterned, 8 smoother. Default 8. */
  matrix?: 4 | 8;
  /** The glow eases toward the pointer. Default true. */
  follow?: boolean;
  /** Slow drift of the light (glow breathes, noise flows). Default true. */
  drift?: boolean;
  /** Glow centre as fractions of the box, [x, y]. Default [0.5, 0.86]: below centred copy, so the text stays clear. */
  center?: [number, number];
  /**
   * Keeps the dots off your content. true (default): a soft-edged hole around the content's text and
   * buttons, measured and kept in sync with its size. With no children (a section's background prop) it
   * clears the content beside it. A box { x, y, w, h } in fractions of the field for a
   * fixed hole, or false for none.
   */
  clear?: BgClear;
}

/**
 * Light is capped here before the content hole scales it. Without the cap, light above the dither's top
 * threshold stays "on" until the hole is almost closed, so the feather reads as a hard stencil edge.
 */
const HOLE_CAP = 0.9;

/** Frame time hook for profiling: set window.__knBgProfile = { "dither-field": [] } and frames push their ms. */
type Profile = Record<string, number[]> | undefined;

/**
 * An ordered-dither (Bayer) dot field. The light is computed once per dot into a small ImageData (one
 * pixel per dot), scaled up with nearest-neighbour and cut into dots by a pattern composite, so a frame is
 * one pass over the dots plus two GPU draws. The dot pitch is a whole number of device pixels, so nothing
 * shimmers. It only redraws while the light changes (drift, or easing toward the pointer), only on screen;
 * reduced motion draws one still frame.
 */
export function DitherField({
  density,
  speed,
  color,
  mask = "radial",
  intensity,
  paused,
  shape = "glow",
  dot = 3,
  matrix = 8,
  follow = true,
  drift = true,
  center = [0.5, 0.86],
  clear = true,
  className,
  style,
  children,
}: DitherFieldProps) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { live, reduced } = useLive(root, paused);
  const s = speedScale(speed);
  const k = intensityScale(intensity);
  const css = tokenColor(color);
  const pitch = Math.min(4, Math.max(2, dot / Math.sqrt(densityScale(density))));
  const [cxf, cyf] = center;
  // A stable key, so an inline { x, y, w, h } does not rebuild the field every render.
  const clearKey = typeof clear === "object" ? `${clear.x},${clear.y},${clear.w},${clear.h}` : String(clear);

  const scene = useRef({
    cols: 0,
    rows: 0,
    cell: 1,
    W: 0,
    H: 0,
    small: null as HTMLCanvasElement | null,
    img: null as ImageData | null,
    px: null as Uint32Array | null,
    noise: new Float32Array(0),
    noiseW: 0,
    noiseH: 0,
    colA: new Int32Array(0),
    colB: new Int32Array(0),
    colS: new Float32Array(0),
    rowV: new Float32Array(0),
    pattern: null as CanvasPattern | null,
    ink: 0,
    target: [0, 0] as [number, number],
    cur: [0, 0] as [number, number],
    t: 0,
    // Per-dot factor that clears the content box (0 inside, 1 outside), or null for no hole.
    hole: null as Float32Array | null,
    draw: () => {},
    kick: () => {},
  });

  useEffect(() => {
    const el = root.current;
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!el || !cv || !ctx) return;
    const sc = scene.current;
    const thr = bayerMatrix(matrix);
    const mask = matrix - 1;
    const shift = matrix === 8 ? 3 : 2;
    const little = new Uint32Array(new Uint8Array([1, 0, 0, 0]).buffer)[0] === 1;

    const makePattern = () => {
      const tile = document.createElement("canvas");
      tile.width = tile.height = sc.cell;
      const t = tile.getContext("2d")!;
      const gap = Math.max(1, Math.round(sc.cell * 0.3));
      t.fillStyle = "#000";
      t.fillRect(0, 0, sc.cell - gap, sc.cell - gap);
      sc.pattern = ctx.createPattern(tile, "repeat");
    };

    // Soft value noise on a coarse lattice, sampled bilinearly per dot.
    const makeNoise = () => {
      sc.noiseW = Math.ceil(sc.cols / 14) + 3;
      sc.noiseH = Math.ceil(sc.rows / 14) + 3;
      const rng = mulberry32(17);
      sc.noise = new Float32Array(sc.noiseW * sc.noiseH).map(() => rng());
      sc.colA = new Int32Array(sc.cols);
      sc.colB = new Int32Array(sc.cols);
      sc.colS = new Float32Array(sc.cols);
      sc.rowV = new Float32Array(sc.noiseW);
    };

    // Bakes the hole into one factor per dot: 0 inside any line of text or control (tight glyph boxes,
    // bg-canvas measures them), easing to 1 across a feather (96 px on wide fields), so no dot ever lands on a glyph, the light
    // still shows between and around the copy, and the draw loop stays one multiply.
    const measureHole = () => {
      sc.hole = null;
      if (!clear || !sc.cols) return;
      const box = el.getBoundingClientRect();
      // The field's own CSS px (contentRects works in them), not screen px: right under CSS zoom.
      const bw = el.clientWidth;
      if (!bw || !el.clientHeight) return;
      // Padding and feather shrink on narrow fields (phones), where the copy fills most of the width:
      // 20/16 px and a 96 px feather from 1024 px up, down to about 9/7 and 43 px at 390.
      const s = Math.max(0.45, Math.min(1, bw / 1024));
      const rects = contentRects(el, clear, box, [20 * s, 16 * s]);
      if (!rects.length) return;
      const toDots = sc.cols / bw;
      const inDots = rects.map((b) => [b[0] * toDots, b[1] * toDots, b[2] * toDots, b[3] * toDots] as [number, number, number, number]);
      const feather = Math.max(4, 96 * s * toDots);
      // One soft contour around the copy block: rounded boxes melted together (see holeFieldRects).
      sc.hole = holeFieldRects(sc.cols, sc.rows, inDots, feather, { round: feather * 0.5, smooth: feather * 1.5 });
    };

    sc.draw = () => {
      const { cols, rows, px, img, small } = sc;
      if (!px || !img || !small) return;
      const t0 = performance.now();
      const ink = sc.ink;
      const a = k;
      const time = sc.t;
      const hole = sc.hole;
      if (shape === "noise") {
        // A periodic lattice: neighbours wrap, so the flow has no seam.
        const nW = sc.noiseW;
        const nH = sc.noiseH;
        const n = sc.noise;
        const ox = time * 0.6;
        const oy = time * 0.25;
        const scale = 1 / 14;
        // Hoisted out of the dot loop: each column's lattice cell and blend once per frame, and the
        // vertical blend once per row, so the inner loop is one lerp and one compare per dot.
        const { colA, colB, colS, rowV } = sc;
        for (let x = 0; x < cols; x++) {
          const nx = x * scale + ox;
          const fl = Math.floor(nx);
          const ix = fl % nW;
          colA[x] = ix;
          colB[x] = (ix + 1) % nW;
          const fx = nx - fl;
          colS[x] = fx * fx * (3 - 2 * fx);
        }
        for (let y = 0; y < rows; y++) {
          const ny = y * scale + oy;
          const fl = Math.floor(ny);
          const iy0 = (fl % nH) * nW;
          const iy1 = (((fl % nH) + 1) % nH) * nW;
          const fy = ny - fl;
          const sy = fy * fy * (3 - 2 * fy);
          const gain = (1 - Math.abs(y / rows - 0.5) * 0.9) * 0.72 * a;
          for (let i = 0; i < nW; i++) rowV[i] = (n[iy0 + i] + (n[iy1 + i] - n[iy0 + i]) * sy) * gain;
          const row = (y & mask) << shift;
          const base = y * cols;
          for (let x = 0; x < cols; x++) {
            const va = rowV[colA[x]];
            const v = va + (rowV[colB[x]] - va) * colS[x];
            px[base + x] = (hole ? Math.min(v, HOLE_CAP) * hole[base + x] : v) > thr[row + (x & mask)] ? ink : 0;
          }
        }
      } else {
        const [gx, gy] = sc.cur;
        const breathe = drift ? 1 + Math.sin(time * 0.8) * 0.06 : 1;
        const r = Math.max(cols * 0.32, rows * 0.6) * breathe;
        const horizon = shape === "horizon";
        for (let y = 0; y < rows; y++) {
          const dy = y - gy;
          const dy2 = dy * dy * 1.6;
          const row = (y & mask) << shift;
          // Horizon: light rises from the bottom third.
          const hv = horizon ? Math.max(0, Math.min(1, (y / rows - 0.38) / 0.62)) : 0;
          const hv2 = hv * hv * (3 - 2 * hv) * 0.7;
          for (let x = 0; x < cols; x++) {
            const dx = x - gx;
            const g = glowFalloff(Math.sqrt(dx * dx + dy2), horizon ? r * 0.7 : r);
            // Peaks stay below full; the content hole keeps dots off the copy itself.
            const v = (horizon ? Math.max(hv2, g * 0.7) : g * 0.82) * a;
            const i = y * cols + x;
            px[i] = (hole ? Math.min(v, HOLE_CAP) * hole[i] : v) > thr[row + (x & mask)] ? ink : 0;
          }
        }
      }
      const sctx = small.getContext("2d")!;
      sctx.putImageData(img, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, sc.W, sc.H);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, cols * sc.cell, rows * sc.cell);
      if (sc.pattern) {
        ctx.globalCompositeOperation = "destination-in";
        ctx.fillStyle = sc.pattern;
        ctx.fillRect(0, 0, sc.W, sc.H);
        ctx.globalCompositeOperation = "source-over";
      }
      const prof = (globalThis as { __knBgProfile?: Profile }).__knBgProfile;
      prof?.["dither-field"]?.push(performance.now() - t0);
    };

    const fit = () => {
      const { dpr, W, H } = fitCanvas(cv, el);
      sc.W = W;
      sc.H = H;
      // A whole number of device pixels per dot keeps the grid aligned: no moiré, no shimmer.
      sc.cell = Math.max(2, Math.round(pitch * dpr));
      sc.cols = Math.ceil(W / sc.cell);
      sc.rows = Math.ceil(H / sc.cell);
      sc.small = sc.small ?? document.createElement("canvas");
      sc.small.width = sc.cols;
      sc.small.height = sc.rows;
      sc.img = new ImageData(sc.cols, sc.rows);
      sc.px = new Uint32Array(sc.img.data.buffer);
      const home: [number, number] = [cxf * sc.cols, cyf * sc.rows];
      sc.target = home;
      sc.cur = [...home];
      makePattern();
      makeNoise();
      measureHole();
      sc.draw();
    };
    const recolor = () => {
      const [r, g, b, al0] = resolveRgba(el, css);
      // Dots draw at about 60% of the colour: a dither at full strength fights the content.
      const al = Math.min(255, Math.round(al0 * 0.6 * Math.max(0.5, k)));
      // ImageData is RGBA bytes; a Uint32 view reads them in the platform's byte order.
      sc.ink = little ? ((al << 24) | (b << 16) | (g << 8) | r) >>> 0 : ((r << 24) | (g << 16) | (b << 8) | al) >>> 0;
      sc.draw();
    };

    recolor();
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    // A zoom change (CSS zoom on an ancestor) keeps the layout size, so no ResizeObserver call; the docs preview fires a window resize.
    window.addEventListener("resize", fit);
    // Content that changes size (text wrapping, fonts loading) moves the hole.
    const unwatchContent = watchContent(el, () => {
      measureHole();
      sc.draw();
    });
    const unwatch = watchTheme(recolor);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
      unwatchContent();
      unwatch();
    };
  }, [css, k, pitch, matrix, shape, drift, cxf, cyf, clearKey]);

  // Motion: runs while drifting, or while the glow eases toward the pointer; idles otherwise.
  useEffect(() => {
    const sc = scene.current;
    const el = root.current;
    if (!el) return;
    const moving = live && !reduced && s > 0;
    let raf = 0;
    let last = 0;
    const settle = () => Math.abs(sc.cur[0] - sc.target[0]) + Math.abs(sc.cur[1] - sc.target[1]) < 0.25;
    const tick = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
      last = t;
      if (drift) sc.t += dt * s;
      const e = 1 - Math.exp(-dt * 5 * Math.max(0.4, s));
      sc.cur[0] += (sc.target[0] - sc.cur[0]) * e;
      sc.cur[1] += (sc.target[1] - sc.cur[1]) * e;
      sc.draw();
      raf = drift || !settle() ? requestAnimationFrame(tick) : 0;
      if (!raf) last = 0;
    };
    sc.kick = () => {
      if (moving && !raf) raf = requestAnimationFrame(tick);
    };
    if (moving && drift) sc.kick();

    const onMove = (e: PointerEvent) => {
      if (!follow || shape === "noise" || !sc.cols) return;
      const r = el.getBoundingClientRect();
      sc.target = [((e.clientX - r.left) / r.width) * sc.cols, ((e.clientY - r.top) / r.height) * sc.rows];
      if (moving) sc.kick();
    };
    const onLeave = () => {
      sc.target = [cxf * sc.cols, cyf * sc.rows];
      if (moving) sc.kick();
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      sc.kick = () => {};
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [live, reduced, s, drift, follow, shape, cxf, cyf]);

  return (
    <BackgroundFrame ref={root} name="dither-field" live={live} mask={mask} className={className} style={style} layer={<canvas ref={canvas} className="absolute inset-0" />}>
      {children}
    </BackgroundFrame>
  );
}
