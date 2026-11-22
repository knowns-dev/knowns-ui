/** @registry part-of="dither-field" */
/**
 * Pure parts of the dither field: the dot pitch for a size and density, a stable key for the clear box,
 * the colour ramp, the video helpers and the light of the calm shapes (aurora, waves, clouds). Every light
 * function writes values in [0, 1] and hoists what it can per column and per row, so the dot loop stays a
 * few multiplies.
 */
import type { BgClear } from "./bg-canvas";
import { densityScale, type BgDensity } from "./bg-utils";

/** Dot pitch in CSS px: the cell size shrunk by density (more density, finer dots), kept between 2 and `max`. */
export function ditherPitch(size: number, density: BgDensity | undefined, max: number): number {
  return Math.min(max, Math.max(2, size / Math.sqrt(densityScale(density))));
}

/** A stable key for the `clear` prop, so an inline { x, y, w, h } does not rebuild the field every render. */
export function clearKey(clear: BgClear): string {
  return typeof clear === "object" ? `${clear.x},${clear.y},${clear.w},${clear.h}` : String(clear);
}

/* ── Colour ramp ── */

/** Three colours from dim to bright: [low, mid, high]. Each is a token, a CSS variable or any CSS colour. */
export type DitherRamp = readonly [string, string, string];

/** One colour (as on every background) or a three-stop ramp. */
export type DitherColor = string | DitherRamp;

export type Rgba = readonly [number, number, number, number];

export function isRamp(color: DitherColor | undefined): color is DitherRamp {
  return Array.isArray(color) && color.length === 3;
}

/** A stable key for `color`, so an inline [low, mid, high] array does not rebuild the field every render. */
export function colorKey(color: DitherColor | undefined): string {
  return isRamp(color) ? color.join("|") : (color ?? "");
}

/** The ramp at `v` (0 to 1): low at 0, mid at 0.5, high at 1, mixed linearly in sRGB between them. */
export function mixRamp(stops: readonly [Rgba, Rgba, Rgba], v: number): [number, number, number, number] {
  const t = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
  const [a, b, f] = t < 0.5 ? [stops[0], stops[1], t * 2] : [stops[1], stops[2], (t - 0.5) * 2];
  return [0, 1, 2, 3].map((i) => Math.round((a[i] ?? 0) + ((b[i] ?? 0) - (a[i] ?? 0)) * f)) as [number, number, number, number];
}

/** RGBA bytes as one Uint32 in the byte order an ImageData's Uint32 view reads them. */
export function packRgba(r: number, g: number, b: number, a: number, little: boolean): number {
  return little ? ((a << 24) | (b << 16) | (g << 8) | r) >>> 0 : ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
}

/** Entries in a ramp lookup table. The dither shows far fewer steps than this, so 64 is smooth. */
export const RAMP_STEPS = 64;

/**
 * The ramp as a lookup table of packed inks, one per light step: index `min(63, v * 64 | 0)`. `alpha`
 * scales every stop's own alpha (the dots draw at about 60% so they never fight the content).
 */
export function rampLut(stops: readonly [Rgba, Rgba, Rgba], alpha: number, little: boolean): Uint32Array {
  const lut = new Uint32Array(RAMP_STEPS);
  for (let i = 0; i < RAMP_STEPS; i++) {
    const [r, g, b, a] = mixRamp(stops, i / (RAMP_STEPS - 1));
    lut[i] = packRgba(r, g, b, Math.min(255, Math.round(a * alpha)), little);
  }
  return lut;
}

/**
 * Gradient map for image and video mode: each pixel's luminance (Rec. 709) picks its colour from the ramp,
 * after the dither, so the cells keep their pattern and take the ramp's colours. Alpha is the pixel's
 * alpha times the stop's. In place.
 */
export function rampImage(data: Uint8ClampedArray, stops: readonly [Rgba, Rgba, Rgba]): void {
  // A table per luminance byte: one lookup per pixel.
  const table = new Uint8ClampedArray(256 * 4);
  for (let l = 0; l < 256; l++) table.set(mixRamp(stops, l / 255), l * 4);
  for (let i = 0; i < data.length; i += 4) {
    const l = Math.round(0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0)) * 4;
    data[i] = table[l] ?? 0;
    data[i + 1] = table[l + 1] ?? 0;
    data[i + 2] = table[l + 2] ?? 0;
    data[i + 3] = ((data[i + 3] ?? 0) * (table[l + 3] ?? 0)) / 255;
  }
}

/* ── Video ── */

export type DitherMedia = "image" | "video";

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(?:[?#]|$)/i;

/** Whether `src` is played as a video: `media` when set, otherwise by its file extension. */
export function isVideoSrc(src: string, media?: DitherMedia): boolean {
  return media ? media === "video" : VIDEO_EXT.test(src.trim());
}

/** The video frame rate cap: 1 to 30, default 30. A larger field never re-dithers more often than this. */
export function videoFps(fps: number | undefined): number {
  return Number.isFinite(fps) ? Math.min(30, Math.max(1, Math.round(fps as number))) : 30;
}

/**
 * Whether a new video frame should be dithered at `now` (ms) when the last one was at `last`. A frame is
 * due one interval after the last, less a 4 ms slack so a 60 Hz display still lands every second frame
 * at 30 fps instead of every third.
 */
export function frameDue(now: number, last: number, fps: number): boolean {
  return now - last >= 1000 / fps - 4;
}

/* ── The calm shapes ── */

const smooth = (t: number) => t * t * (3 - 2 * t);
const TAU = Math.PI * 2;

/**
 * Aurora, per column: how bright the curtain is (`band`, 0 to 1) and how far down it hangs (`hem`, a
 * fraction of the height). Two slow sines with a sine bend on their phase give folds that drift and
 * sway without repeating, and a fine ripple across them draws the vertical rays a curtain is made of;
 * the hem wanders on a slower sine of its own.
 */
export function auroraColumns(cols: number, t: number, band: Float32Array, hem: Float32Array): void {
  for (let x = 0; x < cols; x++) {
    const u = x / Math.max(1, cols);
    const a = 0.5 + 0.5 * Math.sin(u * 7.3 + t * 0.32 + 1.4 * Math.sin(u * 2.2 - t * 0.17));
    const b = 0.5 + 0.5 * Math.sin(u * 15.1 - t * 0.47 + 0.9 * Math.sin(u * 4.6 + t * 0.26));
    const rays = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(u * 71 + 2.4 * Math.sin(u * 11 + t * 0.38) + t * 0.5));
    band[x] = Math.min(1, (a * a * 0.75 + b * b * b * 0.4) * rays);
    hem[x] = 0.36 + 0.2 * (0.5 + 0.5 * Math.sin(u * 4.9 + t * 0.12 + 2));
  }
}

/**
 * Aurora, one dot: a curtain hanging from the top. It starts faint at the top edge, brightens toward its
 * hem (where real curtains glow most), then falls off quickly below it. `y` is the row as a fraction.
 */
export function auroraAt(band: number, hem: number, y: number): number {
  if (y <= hem) {
    const r = hem > 0 ? y / hem : 1;
    return band * (0.3 + 0.7 * r * r);
  }
  const fall = 1 - (y - hem) / 0.14;
  return fall > 0 ? band * fall * fall : 0;
}

/** The sine and cosine of a phase per column and per row, for a sum of two phases without a sine per dot. */
export interface WaveTerms {
  sx: Float32Array;
  cx: Float32Array;
  sy: Float32Array;
  cy: Float32Array;
}

export function makeWaveTerms(cols: number, rows: number): WaveTerms {
  return { sx: new Float32Array(cols), cx: new Float32Array(cols), sy: new Float32Array(rows), cy: new Float32Array(rows) };
}

/**
 * Waves: diagonal swells. The phase is a column part plus a row part, each a ramp along its axis bent by
 * a slow sine, so sin(px + py) = sin px cos py + cos px sin py needs no sine per dot. About `count` swells
 * cross the longer side; they roll toward the bottom right as `t` grows.
 */
export function waveColumns(cols: number, rows: number, t: number, w: WaveTerms, count = 5): void {
  const span = Math.max(cols, rows, 1);
  const k = (count * TAU) / span;
  for (let x = 0; x < cols; x++) {
    const p = x * k * 0.82 + 0.9 * Math.sin((x / span) * 5.1 + t * 0.21) - t * 0.55;
    w.sx[x] = Math.sin(p);
    w.cx[x] = Math.cos(p);
  }
  for (let y = 0; y < rows; y++) {
    const p = y * k * 0.57 + 0.7 * Math.sin((y / span) * 6.3 - t * 0.16);
    w.sy[y] = Math.sin(p);
    w.cy[y] = Math.cos(p);
  }
}

/** Waves, one dot: a soft crest from the summed phase, sharpened so the troughs stay dark. */
export function waveAt(w: WaveTerms, x: number, y: number): number {
  const s = (w.sx[x] ?? 0) * (w.cy[y] ?? 0) + (w.cx[x] ?? 0) * (w.sy[y] ?? 0);
  const v = 0.5 + 0.5 * s;
  return smooth(v) * v;
}

/** A periodic value-noise lattice: `w` by `h` seeded values in [0, 1). Neighbours wrap, so it has no seam. */
export interface Lattice {
  v: Float32Array;
  w: number;
  h: number;
}

/**
 * Adds `gain` times smooth value noise, sampled at `scale` lattice cells per dot and offset by (ox, oy)
 * lattice cells, into `out` (cols by rows). Each column's lattice cell and blend is found once, and the
 * vertical blend once per row, so the inner loop is one lerp per dot.
 */
export function addNoise(out: Float32Array, cols: number, rows: number, lat: Lattice, scale: number, ox: number, oy: number, gain: number, rowV: Float32Array, colA: Int32Array, colB: Int32Array, colS: Float32Array): void {
  const { v: n, w: nW, h: nH } = lat;
  for (let x = 0; x < cols; x++) {
    const nx = x * scale + ox;
    const fl = Math.floor(nx);
    const ix = ((fl % nW) + nW) % nW;
    colA[x] = ix;
    colB[x] = (ix + 1) % nW;
    colS[x] = smooth(nx - fl);
  }
  for (let y = 0; y < rows; y++) {
    const ny = y * scale + oy;
    const fl = Math.floor(ny);
    const iy = ((fl % nH) + nH) % nH;
    const r0 = iy * nW;
    const r1 = ((iy + 1) % nH) * nW;
    const sy = smooth(ny - fl);
    for (let i = 0; i < nW; i++) {
      const a = n[r0 + i] ?? 0;
      rowV[i] = (a + ((n[r1 + i] ?? 0) - a) * sy) * gain;
    }
    const base = y * cols;
    for (let x = 0; x < cols; x++) {
      const a = rowV[colA[x] ?? 0] ?? 0;
      out[base + x] = (out[base + x] ?? 0) + a + ((rowV[colB[x] ?? 0] ?? 0) - a) * (colS[x] ?? 0);
    }
  }
}

/**
 * Clouds, one dot, from two octaves of noise summed to `n` (0 to 1): even cover over the whole field, with
 * the contrast pulled up so there are clear gaps of sky between soft banks.
 */
export function cloudAt(n: number): number {
  const t = Math.min(1, Math.max(0, (n - 0.26) / 0.62));
  return smooth(t);
}
