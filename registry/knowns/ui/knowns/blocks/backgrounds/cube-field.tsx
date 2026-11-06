"use client";
/** @registry name="cube-field" type="block" title="Cube Field" description="A field of small shaded cubes that rise and settle under the pointer, with a slow idle wave, flat isometric or tilted in perspective with glowing crests. Canvas, redrawn only while cubes move." */

import { useEffect, useRef } from "react";
import { useLive } from "@/registry/knowns/ui/knowns/illustrations/use-in-view";
import { BackgroundFrame } from "./background-frame";
import { contentRects, drawScale, fitCanvas, resolveRgba, watchContent, watchTheme, type BgClear } from "./bg-canvas";
import { cubeLayout, densityScale, holeAt, intensityScale, speedScale, springStep, tokenColor, waveLift, PERSPECTIVE_PITCH, type BackgroundProps, type CubeMode } from "./bg-utils";

export type { CubeMode } from "./bg-utils";

export interface CubeFieldProps extends BackgroundProps {
  /** "isometric": a flat field seen at 30°. "perspective": a floor running to a horizon. Default "isometric". */
  mode?: CubeMode;
  /** Grid pitch in CSS px (density nudges it). Default 52. */
  cell?: number;
  /** How far a cube rises at a crest, in CSS px. Default 26. */
  height?: number;
  /** Reach of the pointer, in CSS px. Default 170. */
  radius?: number;
  /** A slow travelling wave, so the field is alive without a pointer. Default true. */
  wave?: boolean;
  /** Strength of the tint on raised tops, 0 to 1. `color` sets its colour. Default 0.6. */
  glow?: number;
  /** Keeps the content readable: no cube under the text and controls, cleared line by line. Default true. */
  clear?: BgClear;
}

type Profile = Record<string, number[]> | undefined;

/** Lift levels in the sprite atlas: a rising cube steps by about 2.5 px, fine at 60 fps and fewer level changes to repaint. */
const LEVELS = 11;
const DEFAULT_GLOW = "oklch(0.68 0.16 255)";

/**
 * A field of small cubes that rise under the pointer on a spring and settle back, with an optional slow wave.
 * Every cube height is pre-rendered once into a sprite atlas (three shaded faces from your theme, plus a
 * tinted top for the crests), so a frame is one spring step and one drawImage per cube. It only animates
 * while something moves and only on screen; reduced motion draws one still frame.
 */
export function CubeField({
  density,
  speed,
  color,
  mask = "radial",
  intensity,
  paused,
  mode = "isometric",
  cell,
  height = 26,
  radius = 170,
  wave = true,
  glow = 0.6,
  clear = true,
  className,
  style,
  children,
}: CubeFieldProps) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { live, reduced } = useLive(root, paused);
  const s = speedScale(speed);
  const k = intensityScale(intensity);
  const glowCss = color ? tokenColor(color) : DEFAULT_GLOW;
  const pitch = (cell ?? (52)) / Math.sqrt(densityScale(density));
  const clearKey = typeof clear === "object" ? `${clear.x},${clear.y},${clear.w},${clear.h}` : String(clear);

  const scene = useRef({
    n: 0,
    // Per cube: screen anchor (device px), scale, ground position (CSS px), hole factor, alpha.
    x: new Float32Array(0) as Float32Array,
    y: new Float32Array(0) as Float32Array,
    sc: new Float32Array(0) as Float32Array,
    gx: new Float32Array(0) as Float32Array,
    gy: new Float32Array(0) as Float32Array,
    hole: new Float32Array(0) as Float32Array,
    alpha: new Float32Array(0) as Float32Array,
    lift: new Float32Array(0) as Float32Array,
    vel: new Float32Array(0) as Float32Array,
    atlas: null as HTMLCanvasElement | null,
    // Dirty redraw: each cube's extent over all lift levels (device px), the cubes whose extents overlap it,
    // and the level each cube was last drawn at (-1 = repaint everything).
    ext: new Int32Array(0),
    nbStart: new Int32Array(0),
    nbList: new Int32Array(0),
    drawn: new Int8Array(0),
    lv: new Uint8Array(0),
    mark: new Uint8Array(0),
    bodyH: 0,
    sw: 0,
    sh: 0,
    ax: 0,
    ay: 0,
    W: 0,
    H: 0,
    dpr: 1,
    // Ground-plane mapping for the pointer (perspective needs the camera).
    cam: { hy: 0, hs: 1, w: 0 },
    pointer: null as [number, number] | null,
    t: 0,
    layout: () => {},
    draw: () => {},
    kick: () => {},
  });

  useEffect(() => {
    const el = root.current;
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!el || !cv || !ctx) return;
    const sc = scene.current;
    let faces: { top: string; left: string; right: string; edge: string; glow: string } | null = null;

    // The atlas: one column per lift level, each cube with its crest tint already on the top (it depends only
    // on the level), so a frame is a single drawImage per cube.
    const buildAtlas = () => {
      if (!faces) return;
      const d = sc.dpr;
      const iso = mode === "isometric";
      const w = pitch * (iso ? 0.8 : 0.74);
      const topH = iso ? w / 2 : w * 0.46;
      const base = iso ? w * 0.34 : w * 0.18;
      const sw = Math.ceil(w * d) + 2;
      const sh = Math.ceil((topH + base + height) * d) + 2;
      const atlas = sc.atlas ?? document.createElement("canvas");
      atlas.width = sw * LEVELS;
      atlas.height = sh;
      const a = atlas.getContext("2d")!;
      a.clearRect(0, 0, atlas.width, atlas.height);
      const g = glow * k;
      for (let row = 0; row < 2; row++) {
        for (let l = 0; l < LEVELS; l++) {
          const c = l / (LEVELS - 1);
          const tint = row === 1 ? (g > 0 && c > 0.18 ? Math.min(1, g * c * c) : 0) : 1;
          if (!tint) continue;
          const lift = (l / (LEVELS - 1)) * height;
          a.save();
          a.translate(l * sw + 1, 1);
          a.scale(d, d);
          a.globalAlpha = tint;
          const side = base + lift;
          const poly = (pts: number[], fill: string) => {
            a.beginPath();
            a.moveTo(pts[0], pts[1]);
            for (let i = 2; i < pts.length; i += 2) a.lineTo(pts[i], pts[i + 1]);
            a.closePath();
            a.fillStyle = fill;
            a.fill();
          };
          if (iso) {
            const q = topH / 2;
            const hw = w / 2;
            if (row === 0) {
              poly([0, q, hw, topH, hw, topH + side, 0, q + side], faces.left);
              poly([hw, topH, w, q, w, q + side, hw, topH + side], faces.right);
              poly([hw, 0, w, q, hw, topH, 0, q], faces.top);
              a.strokeStyle = faces.edge;
              a.lineWidth = 1 / d;
              a.beginPath();
              a.moveTo(0, q);
              a.lineTo(hw, topH);
              a.lineTo(w, q);
              a.moveTo(hw, topH);
              a.lineTo(hw, topH + side);
              a.stroke();
            } else poly([hw, 0, w, q, hw, topH, 0, q], faces.glow);
          } else {
            if (row === 0) {
              poly([0, topH, w, topH, w, topH + side, 0, topH + side], faces.left);
              poly([0, 0, w, 0, w, topH, 0, topH], faces.top);
              a.fillStyle = faces.edge;
              a.fillRect(0, topH - 1 / d, w, 1 / d);
            } else poly([0, 0, w, 0, w, topH, 0, topH], faces.glow);
          }
          a.restore();
        }
      }
      sc.atlas = atlas;
      sc.sw = sw;
      sc.sh = sh;
      // Anchor: the sprite's top-centre sits at the cube's ground point minus its lift.
      sc.ax = sw / 2;
      sc.ay = (topH / 2) * d + 1;
      sc.bodyH = (topH + base) * d + 2;
      sc.drawn.fill(-1);
    };

    // Extents and overlap lists, once per layout: a uniform grid hash keeps it near linear.
    const buildOverlaps = () => {
      const { n, x, y, sw, ax, ay, bodyH } = sc;
      const iso = mode === "isometric";
      const lift = height * sc.dpr;
      const ext = new Int32Array(n * 4);
      let maxW = 1;
      let maxH = 1;
      for (let i = 0; i < n; i++) {
        const m = iso ? 1 : sc.sc[i];
        const x0 = Math.floor(x[i] - ax * m) - 1;
        const y0 = Math.floor(y[i] - (ay + lift) * m) - 1;
        const x1 = Math.ceil(x[i] - ax * m + sw * m) + 1;
        const y1 = Math.ceil(y[i] - ay * m + bodyH * m) + 1;
        ext.set([x0, y0, x1, y1], i * 4);
        maxW = Math.max(maxW, x1 - x0);
        maxH = Math.max(maxH, y1 - y0);
      }
      const gw = Math.ceil(sc.W / maxW) + 3;
      const gh = Math.ceil(sc.H / maxH) + 3;
      const buckets: number[][] = Array.from({ length: gw * gh }, () => []);
      const cellOf = (i: number) => {
        const bx = Math.max(0, Math.min(gw - 1, Math.floor(ext[i * 4] / maxW) + 1));
        const by = Math.max(0, Math.min(gh - 1, Math.floor(ext[i * 4 + 1] / maxH) + 1));
        return [bx, by];
      };
      for (let i = 0; i < n; i++) {
        const [bx, by] = cellOf(i);
        buckets[by * gw + bx].push(i);
      }
      const start = new Int32Array(n + 1);
      const list: number[] = [];
      for (let i = 0; i < n; i++) {
        start[i] = list.length;
        const [bx, by] = cellOf(i);
        const a0 = ext[i * 4];
        const b0 = ext[i * 4 + 1];
        const a1 = ext[i * 4 + 2];
        const b1 = ext[i * 4 + 3];
        for (let yy = Math.max(0, by - 1); yy <= Math.min(gh - 1, by + 1); yy++)
          for (let xx = Math.max(0, bx - 1); xx <= Math.min(gw - 1, bx + 1); xx++)
            for (const j of buckets[yy * gw + xx]) {
              if (j === i) continue;
              if (ext[j * 4] < a1 && ext[j * 4 + 2] > a0 && ext[j * 4 + 1] < b1 && ext[j * 4 + 3] > b0) list.push(j);
            }
      }
      start[n] = list.length;
      sc.ext = ext;
      sc.nbStart = start;
      sc.nbList = Int32Array.from(list);
      sc.drawn = new Int8Array(n).fill(-1);
      sc.lv = new Uint8Array(n);
      sc.mark = new Uint8Array(n);
    };

    const layout = () => {
      const { w, h, dpr, W, H } = fitCanvas(cv, el);
      sc.W = W;
      sc.H = H;
      sc.dpr = dpr;
      const L = cubeLayout(mode, w, h, pitch);
      const iso0 = mode === "isometric";
      sc.cam = L.cam;
      sc.n = L.n;
      sc.x = L.x.map((v) => v * dpr);
      sc.y = L.y.map((v) => v * dpr);
      sc.sc = L.scale;
      sc.gx = L.gx;
      sc.gy = L.gy;
      sc.alpha = L.fade;
      sc.hole = new Float32Array(L.n).fill(1);
      // Clear around each line of text and each control (not one box), so cubes still show between them.
      const rects = contentRects(el, clear, el.getBoundingClientRect(), [10, 6]);
      if (rects.length)
        for (let i = 0; i < L.n; i++) {
          let h = 1;
          for (const r of rects) h = Math.min(h, holeAt(L.x[i], L.y[i], r, 30 * (iso0 ? 1 : L.scale[i])));
          sc.hole[i] = h;
        }
      const keep = sc.lift.length === L.n;
      if (!keep) {
        sc.lift = new Float32Array(L.n);
        sc.vel = new Float32Array(L.n);
        // Start on the wave, not flat, so the first frame does not spring up.
        if (wave) for (let i = 0; i < L.n; i++) sc.lift[i] = waveLift(sc.gx[i], sc.gy[i], sc.t, height) * sc.hole[i];
      }
      buildAtlas();
      buildOverlaps();
      sc.draw();
    };
    sc.layout = layout;

    // One cube: its sprite at its level, then the tint on a raised top.
    const drawCube = (i: number, lv: number, iso: boolean) => {
      const a = sc.alpha[i] * sc.hole[i];
      if (a < 0.02) return;
      const { atlas, sw, sh, ax, ay } = sc;
      const off = (lv / (LEVELS - 1)) * height * sc.dpr;
      const m = iso ? 1 : sc.sc[i];
      const dx = iso ? Math.round(sc.x[i] - ax) : sc.x[i] - ax * m;
      const dy = iso ? Math.round(sc.y[i] - ay - off) : sc.y[i] - (ay + off) * m;
      if (ctx.globalAlpha !== a) ctx.globalAlpha = a;
      ctx.drawImage(atlas!, lv * sw, 0, sw, sh, dx, dy, sw * m, sh * m);
    };

    // Repaints only what changed: the cubes whose level moved, clipped to their extents, together with every
    // cube overlapping those extents, in back-to-front order. Pixels outside the clip are already right.
    // Falls back to a full repaint after a layout or theme change, or when much of the field moved at once.
    sc.draw = () => {
      const { atlas, n, lift, drawn, lv, mark, ext, nbStart, nbList } = sc;
      if (!atlas || !n || drawn.length !== n) return;
      const t0 = performance.now();
      const iso = mode === "isometric";
      const top = (LEVELS - 1) / height;
      let changed = 0;
      let full = false;
      for (let i = 0; i < n; i++) {
        const l = Math.max(0, Math.min(LEVELS - 1, Math.round(lift[i] * top)));
        lv[i] = l;
        if (drawn[i] !== l) {
          if (drawn[i] < 0) full = true;
          changed++;
        }
      }
      if (!changed) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (full || changed > n * 0.35) {
        ctx.globalAlpha = 1;
        ctx.clearRect(0, 0, sc.W, sc.H);
        for (let i = 0; i < n; i++) drawCube(i, lv[i], iso);
        drawn.set(lv);
      } else {
        mark.fill(0);
        ctx.save();
        ctx.beginPath();
        // The top edge of a cube's sprite at a level: everything else in its extent is fixed.
        const lift = (height * sc.dpr) / (LEVELS - 1);
        const topAt = (i: number, l: number) => Math.floor(sc.y[i] - (sc.ay + l * lift) * (iso ? 1 : sc.sc[i])) - 1;
        for (let i = 0; i < n; i++) {
          if (drawn[i] === lv[i]) continue;
          mark[i] = 1;
          const o = i * 4;
          // Dirty: the old and the new sprite of this cube.
          const x0 = ext[o];
          const x1 = ext[o + 2];
          const y0 = topAt(i, Math.max(drawn[i], lv[i]));
          const y1 = ext[o + 3];
          ctx.rect(x0, y0, x1 - x0, y1 - y0);
          // Redraw only the neighbours whose current sprite reaches into it.
          for (let k = nbStart[i]; k < nbStart[i + 1]; k++) {
            const j = nbList[k];
            if (mark[j]) continue;
            const p = j * 4;
            if (ext[p] < x1 && ext[p + 2] > x0 && topAt(j, lv[j]) < y1 && ext[p + 3] > y0) mark[j] = 1;
          }
        }
        ctx.clip();
        ctx.clearRect(0, 0, sc.W, sc.H);
        for (let i = 0; i < n; i++) if (mark[i]) drawCube(i, lv[i], iso);
        ctx.restore();
        for (let i = 0; i < n; i++) if (mark[i]) drawn[i] = lv[i];
      }
      ctx.globalAlpha = 1;
      const prof = (globalThis as { __knBgProfile?: Profile }).__knBgProfile;
      prof?.["cube-field"]?.push(performance.now() - t0);
    };

    const recolor = () => {
      const bg = resolveRgba(el, "var(--background)");
      const dark = (bg[0] * 0.2126 + bg[1] * 0.7152 + bg[2] * 0.0722) / 255 < 0.5;
      const mix = (p: number) => `color-mix(in oklab, var(--foreground) ${p}%, var(--background))`;
      const rgba = (css: string, alphaMul = 1) => {
        const [r, gg, b, a] = resolveRgba(el, css);
        return `rgba(${r}, ${gg}, ${b}, ${((a / 255) * alphaMul).toFixed(3)})`;
      };
      // Light from above: the top is the brightest face in both themes, the right side the darkest.
      faces = dark
        ? { top: rgba(mix(15)), left: rgba(mix(9)), right: rgba(mix(5)), edge: rgba(mix(24)), glow: rgba(glowCss) }
        : { top: rgba(mix(0)), left: rgba(mix(11)), right: rgba(mix(21)), edge: rgba(mix(16)), glow: rgba(glowCss, 0.9) };
      buildAtlas();
      sc.draw();
    };

    recolor();
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(el);
    // A zoom change (CSS zoom on an ancestor) keeps the layout size, so no ResizeObserver call; the docs preview fires a window resize.
    window.addEventListener("resize", layout);
    const unwatchContent = watchContent(el, layout);
    const unwatch = watchTheme(recolor);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", layout);
      unwatchContent();
      unwatch();
    };
  }, [mode, pitch, height, glow, k, glowCss, clearKey, wave]);

  // Motion: the springs step while the wave runs or anything is still moving; otherwise the loop idles.
  useEffect(() => {
    const sc = scene.current;
    const el = root.current;
    if (!el) return;
    const moving = live && !reduced && s > 0;
    let raf = 0;
    let last = 0;
    let frame = 0;
    let pointerAt = 0;
    const r2 = radius * radius;

    const step = (dt: number) => {
      const { n, gx, gy, lift, vel, hole } = sc;
      const p = sc.pointer;
      let busy = false;
      for (let i = 0; i < n; i++) {
        let target = wave ? waveLift(gx[i], gy[i], sc.t, height) : 0;
        if (p) {
          const dx = gx[i] - p[0];
          const dy = gy[i] - p[1];
          const dd = dx * dx + dy * dy;
          if (dd < r2) {
            const f = 1 - Math.sqrt(dd) / radius;
            target = Math.max(target, f * f * (3 - 2 * f) * height);
          }
        }
        target *= hole[i];
        const [l, v] = springStep(lift[i], vel[i], target, dt);
        lift[i] = l;
        vel[i] = v;
        if (!busy && (Math.abs(v) > 0.4 || Math.abs(target - l) > 0.25)) busy = true;
      }
      return busy;
    };

    const tick = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
      last = t;
      frame++;
      // Wave only, no pointer for a second: every other frame is plenty for a slow swell.
      const idle = !sc.pointer && t - pointerAt > 1000;
      if (idle && wave && frame % 2) {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (wave) sc.t += (idle ? dt * 2 : dt) * s;
      const busy = step((idle ? dt * 2 : dt) * Math.max(0.5, s));
      sc.draw();
      raf = wave || busy ? requestAnimationFrame(tick) : 0;
      if (!raf) last = 0;
    };
    sc.kick = () => {
      if (moving && !raf) raf = requestAnimationFrame(tick);
    };

    if (!moving) {
      // Still: settle every cube on its target and draw once.
      sc.pointer = null;
      for (let i = 0; i < sc.n; i++) {
        sc.lift[i] = (wave ? waveLift(sc.gx[i], sc.gy[i], sc.t, height) : 0) * sc.hole[i];
        sc.vel[i] = 0;
      }
      sc.draw();
    } else if (wave) sc.kick();

    const toGround = (e: PointerEvent): [number, number] | null => {
      const r = el.getBoundingClientRect();
      // Screen px to the field's own CSS px (the layout is in them), so the pointer is right under CSS zoom.
      const k = 1 / drawScale(el);
      const px = (e.clientX - r.left) * k;
      const py = (e.clientY - r.top) * k;
      if (mode === "isometric") return [px, py * 2];
      const { hy, hs, w } = sc.cam;
      const f = (py - hy) / hs;
      if (f <= 0.05) return null;
      return [(px - w / 2) / f, hs / PERSPECTIVE_PITCH / f];
    };
    const onMove = (e: PointerEvent) => {
      if (!moving) return;
      sc.pointer = toGround(e);
      pointerAt = performance.now();
      sc.kick();
    };
    const onLeave = () => {
      sc.pointer = null;
      sc.kick();
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      sc.kick = () => {};
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [live, reduced, s, wave, radius, height, mode, pitch]);

  return (
    <BackgroundFrame ref={root} name="cube-field" live={live} mask={mask} className={className} style={style} layer={<canvas ref={canvas} className="absolute inset-0" />}>
      {children}
    </BackgroundFrame>
  );
}
