"use client";
/** @registry name="custom-cursor" type="ui" title="Custom Cursor" description="Draws the pointer inside an area as an arrow with a name pill, a dot that grows into a label over data-cursor-label targets, or a crosshair with coordinates. It follows with a light spring. It stays off on touch and coarse pointers and under reduced motion, and keeps the native cursor over inputs and data-cursor=\"native\"|\"hidden\"." */

/**
 * Custom Cursor: inside an area, your pointer is drawn as the Agent Cursors arrow with a name pill, a dot
 * that grows into a label over targets, or a crosshair with coordinates. It follows with a light spring.
 *
 * Mark targets with `data-cursor-label="View"`. The native cursor stays (and the custom one hides) over
 * inputs, text areas, selects, editable text and anything with `data-cursor="native"` or `"hidden"`; on touch and other
 * coarse pointers; and when reduced motion is on, where the area is left exactly as it was.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";

/* ── Pure helpers (exported for tests) ── */

export interface SpringState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** One frame of a damped spring toward (tx, ty). stiffness 0..1, damping 0..1 (velocity kept per frame). */
export function springStep(s: SpringState, tx: number, ty: number, stiffness = 0.28, damping = 0.62): SpringState {
  const vx = (s.vx + (tx - s.x) * stiffness) * damping;
  const vy = (s.vy + (ty - s.y) * stiffness) * damping;
  return { x: s.x + vx, y: s.y + vy, vx, vy };
}

/** Close enough to stop animating. */
export const springSettled = (s: SpringState, tx: number, ty: number) => Math.abs(tx - s.x) < 0.1 && Math.abs(ty - s.y) < 0.1 && Math.abs(s.vx) < 0.1 && Math.abs(s.vy) < 0.1;

/** Always native: opted out by the page. */
export const OPT_OUT_SELECTOR = "[data-cursor='native'], [data-cursor='hidden']";
/** Native while nativeOverInputs is on: places you type. */
export const NATIVE_SELECTOR = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

/** What the pointer is over: native (show the system cursor) and the nearest target label, inside `root`. */
export function cursorTarget(el: Element | null, root: Element, keepNative = true): { native: boolean; label: string | null } {
  if (!el || !root.contains(el)) return { native: false, label: null };
  if (el.closest(OPT_OUT_SELECTOR) || (keepNative && el.closest(NATIVE_SELECTOR))) return { native: true, label: null };
  const t = el.closest("[data-cursor-label]");
  return { native: false, label: t && root.contains(t) ? t.getAttribute("data-cursor-label") : null };
}

/** The custom cursor only runs for a fine pointer (mouse, pen) without reduced motion. */
export const cursorEnabled = (o: { finePointer: boolean; reducedMotion: boolean }) => o.finePointer && !o.reducedMotion;

/* ── Component ── */

export interface CustomCursorProps {
  children: ReactNode;
  /** "arrow": the Agent Cursors arrow and a name pill. "dot": a dot that grows into a label over targets. "crosshair": hairlines and coordinates. */
  variant?: "arrow" | "dot" | "crosshair";
  /** The pill text for the arrow (a name). Targets' data-cursor-label replaces it. */
  label?: string;
  /** Cursor colour. Default the theme accent (--primary). */
  color?: string;
  /** Follow stiffness 0..1. 1 = no smoothing. Default 0.28. */
  stiffness?: number;
  /** Keep the system cursor over inputs and editable text. Default true. */
  nativeOverInputs?: boolean;
  className?: string;
  style?: CSSProperties;
}

function useEnabled() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const fine = matchMedia("(pointer: fine)");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setOn(cursorEnabled({ finePointer: fine.matches, reducedMotion: reduce.matches }));
    sync();
    fine.addEventListener("change", sync);
    reduce.addEventListener("change", sync);
    return () => {
      fine.removeEventListener("change", sync);
      reduce.removeEventListener("change", sync);
    };
  }, []);
  return on;
}

const ARROW = "M2.5 2 17.5 10.4l-6.6 1.7-3.3 6.9z";
const PILL = "flex items-center gap-2 whitespace-nowrap rounded-lg border bg-popover px-2 py-1 text-[12px] leading-4 font-medium text-popover-foreground shadow-[0_4px_12px_-4px_rgb(0_0_0/0.18)] [border-color:color-mix(in_srgb,var(--foreground)_9%,transparent)]";

export function CustomCursor({ children, variant = "arrow", label = "You", color = "var(--primary)", stiffness = 0.28, nativeOverInputs = true, className, style }: CustomCursorProps) {
  const enabled = useEnabled();
  const root = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const coords = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!enabled || !el) return;
    let s: SpringState | null = null;
    let tx = 0;
    let ty = 0;
    let raf = 0;
    const paint = () => {
      if (!s) return;
      if (layer.current) layer.current.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`;
      if (coords.current) coords.current.textContent = `x ${Math.round(tx)} · y ${Math.round(ty)}`;
    };
    const tick = () => {
      if (!s) return;
      s = stiffness >= 1 ? { x: tx, y: ty, vx: 0, vy: 0 } : springStep(s, tx, ty, stiffness);
      paint();
      raf = springSettled(s, tx, ty) ? 0 : requestAnimationFrame(tick);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return setVisible(false);
      const r = el.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
      // The first move places the cursor without a fly-in from the corner.
      if (!s) s = { x: tx, y: ty, vx: 0, vy: 0 };
      const t = cursorTarget(e.target as Element, el, nativeOverInputs);
      setVisible(!t.native);
      setTarget(t.label);
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const leave = () => {
      setVisible(false);
      setPressed(false);
      s = null;
    };
    const down = () => setPressed(true);
    const up = () => setPressed(false);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
    };
  }, [enabled, stiffness, nativeOverInputs]);

  const text = target ?? (variant === "arrow" ? label : null);

  return (
    <div
      ref={root}
      data-custom-cursor={enabled ? variant : undefined}
      className={cn(
        "relative",
        enabled && "cursor-none [&_*]:cursor-none",
        enabled && "[&_:is([data-cursor='native'],[data-cursor='hidden'])]:cursor-auto [&_:is([data-cursor='native'],[data-cursor='hidden'])_*]:cursor-auto",
        enabled && nativeOverInputs && "[&_:is(input,textarea,select,[contenteditable=''],[contenteditable='true'])]:cursor-auto",
        className,
      )}
      style={style}
    >
      {children}
      {enabled && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
          {variant === "crosshair" && visible && <Crosshair layer={layer} />}
          <div ref={layer} className={cn("absolute top-0 left-0 transition-opacity duration-150", visible ? "opacity-100" : "opacity-0")} style={{ willChange: "transform" }}>
            {variant === "arrow" && (
              <div className={cn("transition-transform duration-150 ease-out", pressed && "scale-90")} style={{ transformOrigin: "2px 2px" }}>
                <svg width="20" height="22" viewBox="0 0 20 22" className="-translate-x-[2px] -translate-y-[2px] drop-shadow-[0_1px_2px_rgb(0_0_0/0.2)]">
                  <path d={ARROW} fill={color} stroke="white" strokeWidth="1" strokeLinejoin="round" />
                </svg>
                {text && (
                  <span className={cn(PILL, "absolute top-5 left-4")}>
                    <span className="size-2 flex-none rounded-full" style={{ background: color }} />
                    {text}
                  </span>
                )}
              </div>
            )}
            {variant === "dot" && (
              <div className="-translate-x-1/2 -translate-y-1/2">
                <span
                  className={cn(
                    "grid place-items-center overflow-hidden rounded-full transition-[width,height,background-color,scale] duration-200 ease-out",
                    text ? "h-8 min-w-8 px-3 bg-popover text-popover-foreground shadow-[0_4px_12px_-4px_rgb(0_0_0/0.18)] border [border-color:color-mix(in_srgb,var(--foreground)_9%,transparent)]" : "size-3",
                    pressed && "scale-90",
                  )}
                  style={text ? undefined : { background: color, boxShadow: "0 0 0 2px var(--background)" }}
                >
                  {text && (
                    <span className="flex items-center gap-2 whitespace-nowrap text-[12px] leading-4 font-medium">
                      <span className="size-2 flex-none rounded-full" style={{ background: color }} />
                      {text}
                    </span>
                  )}
                </span>
              </div>
            )}
            {variant === "crosshair" && (
              <span ref={coords} className={cn(PILL, "absolute top-3 left-3 tabular-nums")}>
                x 0 · y 0
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Two hairlines that follow the layer's transform: they read it each frame from the same element. */
function Crosshair({ layer }: { layer: React.RefObject<HTMLDivElement | null> }) {
  const h = useRef<HTMLSpanElement>(null);
  const v = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const m = layer.current?.style.transform.match(/translate3d\(([-\d.]+)px, ([-\d.]+)px/);
      if (m) {
        if (h.current) h.current.style.transform = `translateY(${m[2]}px)`;
        if (v.current) v.current.style.transform = `translateX(${m[1]}px)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [layer]);
  return (
    <>
      <span ref={h} className="absolute top-0 left-0 h-px w-full bg-[color-mix(in_srgb,var(--foreground)_35%,transparent)]" />
      <span ref={v} className="absolute top-0 left-0 h-full w-px bg-[color-mix(in_srgb,var(--foreground)_35%,transparent)]" />
    </>
  );
}

export default CustomCursor;
