"use client";
/** @registry name="theme-toggle" type="ui" title="Theme toggle" description="Light/dark (or light/dark/system) toggle that reveals the new theme with a View Transition: a circle from the click point (the button centre for keyboard), a wipe, or a fade. Sun-to-moon icon morph. Instant without View Transitions or under reduced motion. Controlled or uncontrolled (localStorage + .dark on html), SSR-safe, with themeScript() for no flash and transitionTheme() for menus." */

/**
 * Theme Toggle: a button that switches light and dark (optionally through "system") and reveals the new
 * theme with the View Transitions API: a circle growing from the click point (from the button's centre
 * when used with the keyboard), a wipe, or a fade. Browsers without View Transitions, and anyone who
 * prefers reduced motion, get the new theme at once.
 *
 * Controlled with `theme` + `onThemeChange`, or uncontrolled: it then keeps the choice in localStorage
 * (`storageKey`) and sets the `dark` class on <html>. To avoid a flash on load, run `themeScript()` in an
 * inline <script> in <head>, before the page paints.
 */
import { useEffect, useId, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { buttonClass, type ButtonSize } from "./button";

export type Theme = "light" | "dark" | "system";
export type RevealVariant = "circle" | "wipe" | "fade";
export interface Point {
  x: number;
  y: number;
}

/* ── Pure helpers ── */

/** Distance from a point to the farthest corner of a w×h viewport: the radius that covers it all. */
export function revealRadius(x: number, y: number, w: number, h: number): number {
  return Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
}

/** Where a click happened, or the centre of the button for keyboard clicks (which report 0,0). */
export function originFromEvent(e: { clientX: number; clientY: number; detail?: number; currentTarget: Element }): Point {
  if (e.detail !== 0 && (e.clientX !== 0 || e.clientY !== 0)) return { x: e.clientX, y: e.clientY };
  return originFromElement(e.currentTarget);
}

/** The centre of an element, or null without one. */
export function originFromElement(el: Element | null | undefined): Point {
  if (!el) return { x: 0, y: 0 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Keyframes for ::view-transition-new(root). The circle grows from the origin; the wipe runs away from the origin's side. */
export function revealKeyframes(variant: RevealVariant, o: Point, w: number, h: number): Keyframe[] {
  const x = Math.round(o.x);
  const y = Math.round(o.y);
  if (variant === "fade") return [{ opacity: 0 }, { opacity: 1 }];
  if (variant === "wipe") {
    const fromLeft = x <= w / 2;
    return [{ clipPath: fromLeft ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)" }, { clipPath: "inset(0 0 0 0)" }];
  }
  const r = Math.ceil(revealRadius(x, y, w, h));
  return [{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${r}px at ${x}px ${y}px)` }];
}

/** The theme after a click: light ↔ dark, or light → dark → system with `cycle`. */
export function nextTheme(t: Theme, cycle = false, systemDark = false): Theme {
  if (cycle) return t === "light" ? "dark" : t === "dark" ? "system" : "light";
  const dark = t === "dark" || (t === "system" && systemDark);
  return dark ? "light" : "dark";
}

export const resolveTheme = (t: Theme, systemDark: boolean) => (t === "dark" || (t === "system" && systemDark) ? "dark" : "light");

export function themeLabel(next: Theme) {
  return next === "system" ? "Use system theme" : `Switch to ${next} theme`;
}

/**
 * An inline script for <head> that sets the class before first paint, so a saved dark theme never flashes light.
 * `<script dangerouslySetInnerHTML={{ __html: themeScript() }} />`
 */
export function themeScript(storageKey = "theme", darkClass = "dark") {
  const k = JSON.stringify(storageKey);
  const c = JSON.stringify(darkClass);
  return `try{var t=localStorage.getItem(${k});if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add(${c})}catch(e){}`;
}

/* ── The transition ── */

const STYLE_ID = "kn-theme-vt";
const CSS = `html[data-kn-theme-vt]::view-transition-old(root),html[data-kn-theme-vt]::view-transition-new(root){animation:none;mix-blend-mode:normal}html[data-kn-theme-vt]::view-transition-new(root){z-index:2}`;

type VTDocument = Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> } };

const prefersReduced = (doc: Document) => {
  const mm = doc.defaultView?.matchMedia;
  return typeof mm === "function" && mm.call(doc.defaultView, "(prefers-reduced-motion: reduce)").matches;
};

export interface TransitionOptions {
  variant?: RevealVariant;
  /** Where the circle starts, in viewport pixels. Default: the centre of the viewport. */
  origin?: Point;
  /** Default 450ms. */
  duration?: number;
  easing?: string;
  doc?: Document;
}

/**
 * Runs `apply` (which must change the theme synchronously) inside a view transition and animates the reveal.
 * Resolves "instant" when it applied without animation (no View Transitions, or reduced motion), else "animated".
 */
export async function transitionTheme(apply: () => void, o: TransitionOptions = {}): Promise<"instant" | "animated"> {
  const doc = (o.doc ?? (typeof document !== "undefined" ? document : undefined)) as VTDocument | undefined;
  if (!doc) return "instant";
  if (typeof doc.startViewTransition !== "function" || prefersReduced(doc)) {
    apply();
    return "instant";
  }
  if (!doc.getElementById(STYLE_ID)) {
    const s = doc.createElement("style");
    s.id = STYLE_ID;
    s.textContent = CSS;
    doc.head.append(s);
  }
  const root = doc.documentElement;
  const variant = o.variant ?? "circle";
  root.dataset.knThemeVt = variant;
  const t = doc.startViewTransition.call(doc, apply);
  try {
    await t.ready;
    const win = doc.defaultView!;
    const w = win.innerWidth;
    const h = win.innerHeight;
    root.animate(revealKeyframes(variant, o.origin ?? { x: w / 2, y: h / 2 }, w, h), {
      duration: o.duration ?? 450,
      easing: o.easing ?? "cubic-bezier(.22,1,.36,1)",
      pseudoElement: "::view-transition-new(root)",
    });
    await t.finished;
  } catch {
    /* skipped by a newer transition; the theme is already applied */
  } finally {
    delete root.dataset.knThemeVt;
  }
  return "animated";
}

/* ── Icon ── */

/** Sun when light, moon when dark: the rays turn away and shrink, the core grows, and a mask slides in for the crescent. */
export function SunMoonIcon({ dark, className }: { dark: boolean; className?: string }) {
  const id = `kn-sm-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ease = "transition-transform duration-300 ease-out motion-reduce:transition-none";
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" data-dark={dark || undefined}>
      <mask id={id}>
        <rect width="24" height="24" fill="#fff" />
        <circle cx="17" cy="7" r="5.5" fill="#000" className={ease} style={{ transform: dark ? "translate(0,0)" : "translate(9px,-9px)" }} />
      </mask>
      <circle cx="12" cy="12" r="4.5" fill="currentColor" mask={`url(#${id})`} className={ease} style={{ transformBox: "fill-box", transformOrigin: "center", transform: dark ? "scale(1.55)" : "scale(1)" }} />
      <g
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className={cn("transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none", dark && "opacity-0")}
        style={{ transformBox: "view-box", transformOrigin: "12px 12px", transform: dark ? "rotate(-60deg) scale(.4)" : "none" }}
      >
        <path d="M12 2.5v1.5M12 20v1.5M2.5 12H4M20 12h1.5M5.3 5.3l1 1M17.7 17.7l1 1M5.3 18.7l1-1M17.7 6.3l1-1" />
      </g>
    </svg>
  );
}

/* ── Component ── */

export interface ThemeToggleProps {
  /** Controlled theme. */
  theme?: Theme;
  /** Called with the next theme, inside the transition: change the theme synchronously here. */
  onThemeChange?: (theme: Theme) => void;
  /** Uncontrolled: the theme before anything is saved. Default "system". */
  defaultTheme?: Theme;
  /** Uncontrolled: localStorage key. Default "theme". */
  storageKey?: string;
  /** Uncontrolled: the class set on <html> for dark. Default "dark". */
  darkClass?: string;
  /** Reveal style. Default "circle". */
  variant?: RevealVariant;
  /** Reveal length in ms. Default 450. */
  duration?: number;
  /** Cycle light → dark → system instead of flipping light ↔ dark. */
  cycle?: boolean;
  size?: Extract<ButtonSize, "sm" | "md" | "lg">;
  className?: string;
}

function useSystemDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const m = matchMedia("(prefers-color-scheme: dark)");
    setDark(m.matches);
    const on = () => setDark(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return dark;
}

const readStored = (key: string, fallback: Theme): Theme => {
  try {
    const v = localStorage.getItem(key);
    return v === "light" || v === "dark" || v === "system" ? v : fallback;
  } catch {
    return fallback;
  }
};

export function ThemeToggle({ theme, onThemeChange, defaultTheme = "system", storageKey = "theme", darkClass = "dark", variant = "circle", duration = 450, cycle = false, size = "md", className }: ThemeToggleProps) {
  const controlled = theme !== undefined;
  const [own, setOwn] = useState<Theme>(defaultTheme);
  const [mounted, setMounted] = useState(false);
  const systemDark = useSystemDark();
  useEffect(() => {
    setMounted(true);
    if (!controlled) setOwn(readStored(storageKey, defaultTheme));
  }, [controlled, storageKey, defaultTheme]);

  const current = controlled ? theme : own;
  const dark = resolveTheme(current, systemDark) === "dark";

  // Uncontrolled: keep <html> in step with the theme, including OS changes while on "system".
  useEffect(() => {
    if (controlled || !mounted) return;
    document.documentElement.classList.toggle(darkClass, dark);
  }, [controlled, mounted, dark, darkClass]);

  const next = nextTheme(current, cycle, systemDark);

  const apply = () => {
    if (controlled) {
      flushSync(() => onThemeChange?.(next));
      return;
    }
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* private mode */
    }
    document.documentElement.classList.toggle(darkClass, resolveTheme(next, systemDark) === "dark");
    flushSync(() => setOwn(next));
    onThemeChange?.(next);
  };

  const click = (e: MouseEvent<HTMLButtonElement>) => {
    void transitionTheme(apply, { variant, duration, origin: originFromEvent(e) });
  };

  return (
    <button
      type="button"
      onClick={click}
      aria-label={mounted ? themeLabel(next) : "Toggle theme"}
      data-theme={mounted ? current : undefined}
      className={buttonClass("ghost", size, true, cn("relative", className))}
    >
      <SunMoonIcon dark={mounted && dark} />
      {mounted && current === "system" && <span aria-hidden="true" className="absolute right-1 bottom-1 size-1 rounded-full bg-current opacity-70" />}
    </button>
  );
}

export default ThemeToggle;
