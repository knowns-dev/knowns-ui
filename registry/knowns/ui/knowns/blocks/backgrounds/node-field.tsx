"use client";
/** @registry name="node-field" type="block" title="Node Field" description="Drifting nodes that link with hairlines when close; the pointer joins as a node. Canvas, drawn only while visible." */

import { useEffect, useRef } from "react";
import { useLive } from "@/registry/knowns/ui/knowns/illustrations/use-in-view";
import { BackgroundFrame } from "./background-frame";
import { drawScale, fitCanvas } from "./bg-canvas";
import { densityScale, intensityScale, linkAlpha, linkDistance, makeNodes, nodeCount, speedScale, stepNodes, tokenColor, type BackgroundProps, type FieldNode } from "./bg-utils";

export interface NodeFieldProps extends BackgroundProps {
  /** The pointer joins the field as a node and links to its neighbours. Default true. */
  interactive?: boolean;
  /** Seed for the starting layout. Default 11. */
  seed?: number;
}

/** Resolves a CSS colour (tokens, color-mix, oklch…) to something a canvas accepts, read from `el`'s context. */
function resolveColor(el: HTMLElement, css: string): string {
  const probe = document.createElement("span");
  probe.style.color = css;
  probe.style.display = "none";
  el.appendChild(probe);
  const out = getComputedStyle(probe).color;
  probe.remove();
  return out || "rgb(128 128 128)";
}

/**
 * Drifting nodes that link with hairlines when they come close, like a team finding each other. Canvas,
 * one frame loop that only runs while the field is on screen and allowed to move; reduced motion draws
 * a single still frame. Re-reads the colour when the theme class changes.
 */
export function NodeField({ density, speed, color, mask = "radial", intensity, paused, interactive = true, seed = 11, className, style, children }: NodeFieldProps) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { live } = useLive(root, paused);
  const d = densityScale(density);
  const s = speedScale(speed);
  const k = intensityScale(intensity);
  const css = tokenColor(color);

  // Mutable scene shared by the effects below.
  const scene = useRef<{ nodes: FieldNode[]; w: number; h: number; ink: string; pointer: { x: number; y: number } | null; draw: () => void }>({
    nodes: [],
    w: 0,
    h: 0,
    ink: "",
    pointer: null,
    draw: () => {},
  });

  // Size, colour, drawing.
  useEffect(() => {
    const el = root.current;
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!el || !cv || !ctx) return;
    const sc = scene.current;
    const max = linkDistance(d);

    sc.draw = () => {
      const { w, h, nodes, ink, pointer } = sc;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = ink;
      ctx.fillStyle = ink;
      ctx.lineWidth = 1;
      const pts = pointer && interactive ? [...nodes, { ...pointer, vx: 0, vy: 0 }] : nodes;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          const dx = a.x - b.x;
          if (dx > max || dx < -max) continue;
          const dy = a.y - b.y;
          const al = linkAlpha(Math.hypot(dx, dy), max);
          if (al <= 0.01) continue;
          ctx.globalAlpha = al * 0.32 * k;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 0.55 * k;
      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const fit = () => {
      // Layout size and a crisp backing store, right under CSS zoom (see fitCanvas).
      const { w, h, dpr } = fitCanvas(cv, el);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = nodeCount(w, h, d);
      if (!sc.nodes.length || Math.abs(sc.nodes.length - n) > n * 0.25) sc.nodes = makeNodes(n, w, h, seed);
      else if (sc.w && sc.h) {
        for (const p of sc.nodes) {
          p.x *= w / sc.w;
          p.y *= h / sc.h;
        }
      }
      sc.w = w;
      sc.h = h;
      sc.draw();
    };
    const recolor = () => {
      sc.ink = resolveColor(el, css);
      sc.draw();
    };

    recolor();
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    // A zoom change (CSS zoom on an ancestor) keeps the layout size, so no ResizeObserver call; the docs preview fires a window resize.
    window.addEventListener("resize", fit);
    // Theme switches flip a class or data attribute on <html>.
    const mo = new MutationObserver(recolor);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", recolor);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
      mo.disconnect();
      scheme.removeEventListener("change", recolor);
    };
  }, [d, k, css, seed, interactive]);

  // Pointer.
  useEffect(() => {
    const el = root.current;
    if (!el || !interactive) return;
    const sc = scene.current;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const k = 1 / drawScale(el);
      sc.pointer = { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
      if (!live || s === 0) sc.draw();
    };
    const onLeave = () => {
      sc.pointer = null;
      sc.draw();
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [interactive, live, s]);

  // Motion: one rAF loop, only while live and moving.
  useEffect(() => {
    if (!live || s === 0) return;
    const sc = scene.current;
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      stepNodes(sc.nodes, dt * s, sc.w, sc.h);
      sc.draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live, s]);

  return (
    <BackgroundFrame ref={root} name="node-field" live={live} mask={mask} className={className} style={style} layer={<canvas ref={canvas} className="absolute inset-0" />}>
      {children}
    </BackgroundFrame>
  );
}
