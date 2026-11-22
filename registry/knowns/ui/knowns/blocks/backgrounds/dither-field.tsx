"use client";
/** @registry name="dither-field" type="block" title="Dither Field" description="A soft light rendered as crisp ordered-dither dots: a glow that eases after the pointer or a held finger, a rising horizon, flowing noise, aurora curtains, diagonal waves or drifting clouds, in one colour or a low, mid and high ramp. Any picture or muted looping video redraws as colour dither cells (src). Canvas, redrawn only while the light changes." */

import { useEffect, useRef, useState } from "react";
import { useLive } from "@/registry/knowns/ui/knowns/illustrations/use-in-view";
import { BackgroundFrame } from "./background-frame";
import { addNoise, auroraAt, auroraColumns, clearKey, cloudAt, colorKey, ditherPitch, frameDue, isRamp, isVideoSrc, makeWaveTerms, packRgba, rampImage, rampLut, videoFps, waveAt, waveColumns, type DitherColor, type DitherMedia, type Lattice, type Rgba } from "./dither-field-utils";
import { contentRects, fitCanvas, resolveRgba, watchContent, watchTheme, type BgClear } from "./bg-canvas";
import { bayerMatrix, ditherImage, glowFalloff, type DitherTone, holeFieldRects, imageRect, workingSize, intensityScale, mulberry32, speedScale, tokenColor, type BackgroundProps } from "./bg-utils";

export type DitherShape = "glow" | "horizon" | "noise" | "aurora" | "waves" | "clouds";
export type { DitherColor, DitherMedia, DitherRamp } from "./dither-field-utils";

export interface DitherFieldProps extends Omit<BackgroundProps, "color"> {
  /**
   * The dot colour: one token, CSS variable or CSS colour (as on every background), or a ramp
   * [low, mid, high] where dim dots take the low colour and bright dots the high one. Re-resolved when
   * the theme changes, so a ramp of CSS variables can invert in dark mode. In image and video mode a ramp
   * maps each cell's lightness onto it; one colour is ignored there.
   */
  color?: DitherColor;
  /**
   * The light the dots render: a radial glow, a horizon rising from the bottom, soft noise, aurora
   * curtains hanging from the top, diagonal waves, or clouds drifting over the whole field. Default "glow".
   */
  shape?: DitherShape;
  /** Dot pitch in CSS px, 2 to 4 (density nudges it). Default 3. */
  dot?: number;
  /** Bayer matrix size: 4 is coarser and more patterned, 8 smoother. Default 8. */
  matrix?: 4 | 8;
  /**
   * The glow eases toward the pointer, or a held finger on touch (scrolling is never blocked). Aurora,
   * waves and clouds brighten softly under it instead. Default true.
   */
  follow?: boolean;
  /** Slow drift of the light (glow breathes, noise and clouds flow, curtains sway, waves roll). Default true. */
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
  /**
   * Image mode: dither this picture instead of drawing a light. The image is drawn small (one pixel per
   * cell), thresholded per RGB channel against the Bayer matrix so its colour is kept, and scaled back up
   * with smoothing off. Same-origin or CORS-enabled. shape, center, follow, drift and clear are ignored;
   * the mask defaults to "none". Redrawn only on resize or when the source changes.
   *
   * A video (.mp4, .webm, .mov, .m4v, .ogv, or any URL with media="video") plays muted, looping and
   * inline, re-dithered per frame at up to `fps`. It loads once the field first nears the viewport and
   * pauses offscreen, in hidden tabs and when paused; with reduced motion it shows one still frame.
   */
  src?: string;
  /** Image mode: treat `src` as an "image" or a "video" when its extension does not say (a blob: URL). */
  media?: DitherMedia;
  /** Video: frames dithered per second, 1 to 30. Default 30. */
  fps?: number;
  /** Image mode: "cover" fills the field and crops, "contain" fits inside it. Default "cover". */
  fit?: "cover" | "contain";
  /** Image mode: focal point as fractions [x, y] of the free space. Default [0.5, 0.5]. */
  position?: [number, number];
  /** Image mode: cell size in CSS px, 2 to 12 (density nudges it). Default 3. */
  cell?: number;
  /** Image mode: colour levels per channel, 2 to 8. Fewer is chunkier and more graphic; 4 or less shows hue speckle on photos. Default 6. */
  levels?: number;
  /** Image mode: blur in CSS px applied before thresholding, to calm busy photos. Default 0. */
  blur?: number;
  /** Image mode: "luma" patterns only the lightness and keeps each cell's hue, so no colour speckle; "channel" quantises R, G and B on their own, a palette look. Default "luma". */
  tone?: DitherTone;
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
export function DitherField(props: DitherFieldProps) {
  return props.src ? <DitherMedia {...props} src={props.src} /> : <DitherShapes {...props} />;
}

/** Whether this platform's Uint32 view of RGBA bytes is little-endian (it is on every browser in use). */
const LITTLE = new Uint32Array(new Uint8Array([1, 0, 0, 0]).buffer)[0] === 1;

/** The three stops of a ramp, resolved to sRGB bytes in `el`'s context (tokens, CSS variables, any colour). */
function resolveRamp(el: HTMLElement, color: DitherColor | undefined): [Rgba, Rgba, Rgba] | null {
  if (!isRamp(color)) return null;
  return [resolveRgba(el, tokenColor(color[0])), resolveRgba(el, tokenColor(color[1])), resolveRgba(el, tokenColor(color[2]))];
}

/** Longest side of the working copy of a picture. */
const MAX_SOURCE = 2560;

/** Image and video mode: one dithered picture, redrawn on resize and source change, or per video frame. */
function DitherMedia({ density, mask = "none", focus, paused, src, media, fps, color, fit = "cover", position = [0.5, 0.5], cell = 3, levels = 6, blur = 0, tone = "luma", matrix = 8, className, style, children }: DitherFieldProps & { src: string }) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { live } = useLive(root, paused);
  const pitch = ditherPitch(cell, density, 12);
  const [px, py] = position;
  const video = isVideoSrc(src, media);
  const cap = videoFps(fps);
  const rampId = isRamp(color) ? colorKey(color) : "";
  // A video draws only once its first frame has decoded.
  const [ready, setReady] = useState(false);

  // The source is fetched and decoded once per `src`, so dragging cell size, levels or blur only redraws.
  const source = useRef<{ img: CanvasImageSource; w: number; h: number } | null>(null);
  const player = useRef<HTMLVideoElement | null>(null);
  const stops = useRef<[Rgba, Rgba, Rgba] | null>(null);
  const redraw = useRef<() => void>(() => {});
  const frame = useRef(0);
  const smallRef = useRef<HTMLCanvasElement | null>(null);

  redraw.current = () => {
    const el = root.current;
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    const img = source.current;
    if (!el || !cv || !ctx || !img) return;
    const t0 = performance.now();
    const thr = bayerMatrix(matrix);
    const small = (smallRef.current ??= document.createElement("canvas"));
    const { dpr, W, H } = fitCanvas(cv, el);
    // A whole number of device pixels per cell keeps the grid aligned.
    const cs = Math.max(2, Math.round(pitch * dpr));
    const cols = Math.ceil(W / cs);
    const rows = Math.ceil(H / cs);
    if (small.width !== cols) small.width = cols;
    if (small.height !== rows) small.height = rows;
    const sctx = small.getContext("2d", { willReadFrequently: true });
    if (!sctx) return;
    const [x, y, w, h] = imageRect(img.w, img.h, cols, rows, fit, [px, py]);
    sctx.clearRect(0, 0, cols, rows);
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = "high";
    // The blur is in CSS px; the small canvas has one pixel per cell.
    sctx.filter = blur > 0 ? `blur(${(blur * dpr) / cs}px)` : "none";
    sctx.drawImage(img.img, x, y, w, h);
    sctx.filter = "none";
    const data = sctx.getImageData(0, 0, cols, rows);
    ditherImage(data.data, cols, rows, thr, matrix, levels, tone);
    if (stops.current) rampImage(data.data, stops.current);
    sctx.putImageData(data, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, cols * cs, rows * cs);
    const prof = (globalThis as { __knBgProfile?: Profile }).__knBgProfile;
    prof?.["dither-field"]?.push(performance.now() - t0);
  };

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    source.current = null;
    setReady(false);
    const run = () => redraw.current();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    window.addEventListener("resize", run);
    const stop = () => {
      ro.disconnect();
      window.removeEventListener("resize", run);
      source.current = null;
    };

    if (video) {
      const v = document.createElement("video");
      v.muted = v.defaultMuted = true;
      v.loop = true;
      v.playsInline = true;
      v.setAttribute("playsinline", "");
      v.crossOrigin = "anonymous";
      v.preload = "auto";
      player.current = v;
      const onData = () => {
        if (!v.videoWidth) return;
        source.current = { img: v, w: v.videoWidth, h: v.videoHeight };
        setReady(true);
        run();
      };
      v.addEventListener("loadeddata", onData);
      // Nothing loads or plays before the field nears the viewport.
      const load = () => {
        v.src = src;
        v.load();
      };
      let io: IntersectionObserver | null = null;
      if (typeof IntersectionObserver === "undefined") load();
      else {
        io = new IntersectionObserver(
          (entries) => {
            if (!entries.some((e) => e.isIntersecting)) return;
            io?.disconnect();
            load();
          },
          { rootMargin: "120px" },
        );
        io.observe(el);
      }
      return () => {
        stop();
        io?.disconnect();
        v.removeEventListener("loadeddata", onData);
        v.pause();
        v.removeAttribute("src");
        v.load();
        player.current = null;
      };
    }

    let img: HTMLImageElement | null = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!img?.naturalWidth) return;
      // A phone photo is 12 MP and more than the canvas ever needs: keep a copy no larger than 2560 px, so each redraw is cheap.
      const ws = workingSize(img.naturalWidth, img.naturalHeight, MAX_SOURCE);
      if (ws.scaled) {
        const c = document.createElement("canvas");
        c.width = ws.w;
        c.height = ws.h;
        const cx = c.getContext("2d");
        if (cx) {
          cx.imageSmoothingQuality = "high";
          cx.drawImage(img, 0, 0, c.width, c.height);
          source.current = { img: c, w: c.width, h: c.height };
        }
      }
      source.current ??= { img, w: img.naturalWidth, h: img.naturalHeight };
      run();
    };
    img.src = src;
    return () => {
      stop();
      if (img) img.onload = null;
      img = null;
    };
  }, [src, video]);

  // A ramp follows the theme: its stops are re-resolved when the theme changes.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const recolor = () => {
      stops.current = resolveRamp(el, color);
      redraw.current();
    };
    recolor();
    return watchTheme(recolor);
    // rampId stands for `color`, so an inline array does not re-run this.
  }, [rampId]);

  // Video: plays only while live (on screen, tab visible, not paused, no reduced motion), dithered at most `cap` times a second.
  useEffect(() => {
    const v = player.current;
    if (!video || !ready || !v) return;
    if (!live) {
      v.pause();
      redraw.current();
      return;
    }
    let raf = 0;
    let last = -Infinity;
    let shown = -1;
    const tick = (now: number) => {
      if (frameDue(now, last, cap) && v.currentTime !== shown) {
        last = now;
        shown = v.currentTime;
        redraw.current();
      }
      raf = requestAnimationFrame(tick);
    };
    v.play().catch(() => {});
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      v.pause();
    };
  }, [video, ready, live, cap]);

  // Drags change these many times a second: draw at most once per frame.
  useEffect(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => redraw.current());
    return () => cancelAnimationFrame(frame.current);
  }, [fit, px, py, pitch, levels, blur, tone, matrix]);

  return (
    <BackgroundFrame ref={root} name="dither-field" live={live} mask={mask} focus={focus} className={className} style={style} layer={<canvas ref={canvas} className="absolute inset-0" />}>
      {children}
    </BackgroundFrame>
  );
}

/** The light value a ramp's high stop is reached at: every shape peaks a little above it. */
const RAMP_PEAK = 0.8;
const CALM = new Set<DitherShape>(["aurora", "waves", "clouds"]);

function DitherShapes({
  density,
  speed,
  color,
  mask = "radial",
  focus,
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
  // A stable key, so an inline [low, mid, high] does not rebuild the field every render.
  const css = colorKey(color);
  const pitch = ditherPitch(dot, density, 4);
  const [cxf, cyf] = center;
  // A stable key, so an inline { x, y, w, h } does not rebuild the field every render.
  const clearId = clearKey(clear);
  const calm = CALM.has(shape);

  const scene = useRef({
    cols: 0,
    rows: 0,
    cell: 1,
    W: 0,
    H: 0,
    small: null as HTMLCanvasElement | null,
    img: null as ImageData | null,
    px: null as Uint32Array | null,
    noise: new Float32Array(0) as Float32Array,
    noiseW: 0,
    noiseH: 0,
    colA: new Int32Array(0),
    colB: new Int32Array(0),
    colS: new Float32Array(0),
    rowV: new Float32Array(0),
    // The calm shapes: light per dot, then thresholded in one pass.
    field: new Float32Array(0),
    band: new Float32Array(0),
    hem: new Float32Array(0),
    waves: makeWaveTerms(0, 0),
    fine: { v: new Float32Array(0), w: 1, h: 1 } as Lattice,
    coarse: { v: new Float32Array(0), w: 1, h: 1 } as Lattice,
    pattern: null as CanvasPattern | null,
    ink: 0,
    // A ramp as packed inks by light step, or null for one colour.
    lut: null as Uint32Array | null,
    target: [0, 0] as [number, number],
    cur: [0, 0] as [number, number],
    // How much the pointer brightens the calm shapes: eases to 1 while a pointer or finger is on the field.
    lift: 0,
    liftTarget: 0,
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
    const lattice = (w: number, h: number, seed: number): Lattice => {
      const rng = mulberry32(seed);
      return { v: new Float32Array(w * h).map(() => rng()), w, h };
    };
    const makeNoise = () => {
      sc.noiseW = Math.ceil(sc.cols / 14) + 3;
      sc.noiseH = Math.ceil(sc.rows / 14) + 3;
      sc.noise = lattice(sc.noiseW, sc.noiseH, 17).v;
      sc.colA = new Int32Array(sc.cols);
      sc.colB = new Int32Array(sc.cols);
      sc.colS = new Float32Array(sc.cols);
      sc.rowV = new Float32Array(sc.noiseW);
      if (!calm) return;
      sc.field = new Float32Array(sc.cols * sc.rows);
      sc.band = new Float32Array(sc.cols);
      sc.hem = new Float32Array(sc.cols);
      sc.waves = makeWaveTerms(sc.cols, sc.rows);
      // Clouds: banks about 22 dots apart, with finer billows about 8 dots apart on top.
      sc.coarse = lattice(Math.ceil(sc.cols / 22) + 3, Math.ceil(sc.rows / 22) + 3, 23);
      sc.fine = lattice(Math.ceil(sc.cols / 8) + 3, Math.ceil(sc.rows / 8) + 3, 41);
      sc.rowV = new Float32Array(Math.max(sc.noiseW, sc.fine.w, sc.coarse.w));
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

    // The calm shapes fill `field` with their light (0 to 1) for this frame.
    const fillCalm = (time: number) => {
      const { cols, rows, field } = sc;
      if (shape === "aurora") {
        const { band, hem } = sc;
        auroraColumns(cols, time, band, hem);
        for (let y = 0; y < rows; y++) {
          const yf = y / rows;
          const base = y * cols;
          for (let x = 0; x < cols; x++) field[base + x] = auroraAt(band[x] ?? 0, hem[x] ?? 0, yf) * 0.86;
        }
      } else if (shape === "waves") {
        const w = sc.waves;
        waveColumns(cols, rows, time, w);
        for (let y = 0; y < rows; y++) {
          // The swells gather toward the bottom, where a hero's copy rarely sits.
          const env = (0.5 + 0.5 * (y / rows)) * 0.84;
          const base = y * cols;
          for (let x = 0; x < cols; x++) field[base + x] = waveAt(w, x, y) * env;
        }
      } else {
        field.fill(0);
        const { colA, colB, colS, rowV } = sc;
        addNoise(field, cols, rows, sc.coarse, 1 / 22, time * 0.22, time * 0.07, 0.72, rowV, colA, colB, colS);
        addNoise(field, cols, rows, sc.fine, 1 / 8, 3.7 - time * 0.31, 1.3 + time * 0.11, 0.28, rowV, colA, colB, colS);
        for (let i = 0; i < field.length; i++) field[i] = cloudAt(field[i] ?? 0) * 0.78;
      }
      // A pointer or held finger brightens the light under it, inside a box around it only.
      if (sc.lift > 0.004) {
        const [gx, gy] = sc.cur;
        const r = Math.max(cols, rows) * 0.2;
        const lift = sc.lift * 0.42;
        const x0 = Math.max(0, Math.floor(gx - r));
        const x1 = Math.min(cols, Math.ceil(gx + r));
        for (let y = Math.max(0, Math.floor(gy - r)); y < Math.min(rows, Math.ceil(gy + r)); y++) {
          const dy = y - gy;
          const base = y * cols;
          for (let x = x0; x < x1; x++) {
            const g = glowFalloff(Math.sqrt((x - gx) * (x - gx) + dy * dy), r);
            if (g > 0) field[base + x] = Math.min(1, (field[base + x] ?? 0) + g * lift);
          }
        }
      }
    };

    sc.draw = () => {
      const { cols, rows, px, img, small } = sc;
      if (!px || !img || !small) return;
      const t0 = performance.now();
      const ink = sc.ink;
      const lut = sc.lut;
      const top = (lut?.length ?? 1) - 1;
      const toStep = (lut?.length ?? 1) / RAMP_PEAK;
      const a = k;
      const time = sc.t;
      const hole = sc.hole;
      if (calm) {
        fillCalm(time);
        const field = sc.field;
        for (let y = 0; y < rows; y++) {
          const row = (y & mask) << shift;
          const base = y * cols;
          for (let x = 0; x < cols; x++) {
            const i = base + x;
            const v = (field[i] ?? 0) * a;
            px[i] = (hole ? Math.min(v, HOLE_CAP) * (hole[i] ?? 0) : v) > (thr[row + (x & mask)] ?? 0) ? (lut ? (lut[Math.min(top, (v * toStep) | 0)] ?? ink) : ink) : 0;
          }
        }
      } else if (shape === "noise") {
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
          for (let i = 0; i < nW; i++) {
            const n0 = n[iy0 + i] ?? 0;
            rowV[i] = (n0 + ((n[iy1 + i] ?? 0) - n0) * sy) * gain;
          }
          const row = (y & mask) << shift;
          const base = y * cols;
          for (let x = 0; x < cols; x++) {
            const va = rowV[colA[x] ?? 0] ?? 0;
            const v = va + ((rowV[colB[x] ?? 0] ?? 0) - va) * (colS[x] ?? 0);
            px[base + x] = (hole ? Math.min(v, HOLE_CAP) * (hole[base + x] ?? 0) : v) > (thr[row + (x & mask)] ?? 0) ? (lut ? (lut[Math.min(top, (v * toStep) | 0)] ?? ink) : ink) : 0;
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
            px[i] = (hole ? Math.min(v, HOLE_CAP) * (hole[i] ?? 0) : v) > (thr[row + (x & mask)] ?? 0) ? (lut ? (lut[Math.min(top, (v * toStep) | 0)] ?? ink) : ink) : 0;
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
      sc.lift = sc.liftTarget = 0;
      makePattern();
      makeNoise();
      measureHole();
      sc.draw();
    };
    const recolor = () => {
      // One colour draws at about 60%: a dither at full strength fights the content. A ramp draws at 85%,
      // because its stops already carry the contrast the author picked and the high stop must read as high.
      const ramp = resolveRamp(el, color);
      const alpha = (ramp ? 0.85 : 0.6) * Math.max(0.5, k);
      sc.lut = ramp ? rampLut(ramp, alpha, LITTLE) : null;
      const [r, g, b, al0] = ramp ? ramp[2] : resolveRgba(el, tokenColor(color as string | undefined));
      sc.ink = packRgba(r, g, b, Math.min(255, Math.round(al0 * alpha)), LITTLE);
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
    // css stands for `color` (a stable key for an inline ramp array).
  }, [css, k, pitch, matrix, shape, calm, drift, cxf, cyf, clearId]);

  // Motion: runs while drifting, or while the light eases toward the pointer; idles otherwise.
  useEffect(() => {
    const sc = scene.current;
    const el = root.current;
    if (!el) return;
    const moving = live && !reduced && s > 0;
    let raf = 0;
    let last = 0;
    const settle = () => Math.abs(sc.cur[0] - sc.target[0]) + Math.abs(sc.cur[1] - sc.target[1]) < 0.25 && Math.abs(sc.lift - sc.liftTarget) < 0.004;
    const tick = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
      last = t;
      if (drift) sc.t += dt * s;
      const e = 1 - Math.exp(-dt * 5 * Math.max(0.4, s));
      sc.cur[0] += (sc.target[0] - sc.cur[0]) * e;
      sc.cur[1] += (sc.target[1] - sc.cur[1]) * e;
      // The lift comes in a little slower than the light travels, so a touch reads as a soft swell.
      sc.lift += (sc.liftTarget - sc.lift) * (1 - Math.exp(-dt * 3.5 * Math.max(0.4, s)));
      sc.draw();
      raf = drift || !settle() ? requestAnimationFrame(tick) : 0;
      if (!raf) last = 0;
    };
    sc.kick = () => {
      if (moving && !raf) raf = requestAnimationFrame(tick);
    };
    if (moving && drift) sc.kick();

    const aim = (clientX: number, clientY: number) => {
      if (!follow || shape === "noise" || !sc.cols) return;
      const r = el.getBoundingClientRect();
      sc.target = [((clientX - r.left) / r.width) * sc.cols, ((clientY - r.top) / r.height) * sc.rows];
      // A calm shape's lift starts where the pointer is, not where the last one left.
      if (calm && sc.lift < 0.02) sc.cur = [...sc.target];
      sc.liftTarget = 1;
      if (moving) sc.kick();
    };
    const home = () => {
      sc.target = [cxf * sc.cols, cyf * sc.rows];
      sc.liftTarget = 0;
      if (moving) sc.kick();
    };
    // Mouse and pen follow on hover. Touch follows a held finger only, through passive touch listeners,
    // so a swipe still scrolls the page (a pointer stream would be cancelled the moment the page scrolls).
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") aim(e.clientX, e.clientY);
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType !== "touch") home();
    };
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) aim(t.clientX, t.clientY);
    };
    const onLift = (e: TouchEvent) => {
      if (!e.touches.length) home();
    };
    const passive = { passive: true } as const;
    el.addEventListener("pointermove", onMove, passive);
    el.addEventListener("pointerleave", onLeave, passive);
    el.addEventListener("touchstart", onTouch, passive);
    el.addEventListener("touchmove", onTouch, passive);
    el.addEventListener("touchend", onLift, passive);
    el.addEventListener("touchcancel", onLift, passive);
    return () => {
      cancelAnimationFrame(raf);
      sc.kick = () => {};
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("touchstart", onTouch);
      el.removeEventListener("touchmove", onTouch);
      el.removeEventListener("touchend", onLift);
      el.removeEventListener("touchcancel", onLift);
    };
  }, [live, reduced, s, drift, follow, shape, calm, cxf, cyf]);

  return (
    <BackgroundFrame ref={root} name="dither-field" live={live} mask={mask} focus={focus} className={className} style={style} layer={<canvas ref={canvas} className="absolute inset-0" />}>
      {children}
    </BackgroundFrame>
  );
}
