"use client";
/** @registry name="announcement-pill" type="block" title="Announcement pill" description="A New pill above a hero headline that grows in place into a small changelog card: title, two lines, an image or a short list and a link. Hover or focus previews it, click or Enter keeps it open, Esc closes it, and the page below never moves." */

/**
 * AnnouncementPill: the "New: ..." line above a headline, with the story behind it one hover away. The pill stays
 * where it is and becomes the header of a card that rises from it, so it reads as one surface growing, not a
 * popover swapping in. The card overlays the page: the hero under it never moves.
 *
 * Hover (after a short pause) or keyboard focus shows a preview; it goes when the pointer or focus leaves.
 * Click or Enter keeps it open, with a close button; Esc, a click outside or the button closes it and puts focus
 * back on the pill. Pass the card's content, or a changelog entry through `fromChangelogEntry`.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Fold, MOTION, MotionStyle, prefersReducedMotion } from "@/registry/knowns/lib/knowns/motion";
import { Cover } from "../content/prose";
import { formatDate } from "../content/content-utils";
import type { ChangelogEntry } from "../content/changelog-feed";
import { FLOAT_SURFACE } from "../../use-floating";

/* ── State ── */

/** closed: the pill only. preview: the card, while hover or focus lasts. open: the card, kept until closed. */
export type PillState = "closed" | "preview" | "open";
export type PillEvent = "hover" | "leave" | "focus" | "blur" | "toggle" | "close";

/** The next state for an event. A preview never closes a card the reader opened on purpose. */
export function nextPillState(s: PillState, e: PillEvent): PillState {
  switch (e) {
    case "hover":
    case "focus":
      return s === "closed" ? "preview" : s;
    case "leave":
      return s === "preview" ? "closed" : s;
    case "blur":
      return "closed";
    case "toggle":
      return s === "open" ? "closed" : "open";
    case "close":
      return "closed";
  }
}

/* ── Content ── */

export interface AnnouncementCard {
  /** The card's heading. Defaults to the pill's text. */
  title?: ReactNode;
  /** Two lines at most; longer text is cut with an ellipsis. */
  description?: ReactNode;
  date?: string | number | Date;
  /** An image (or a placeholder hue when there is no src). */
  media?: { src?: string; alt: string; hue?: number };
  /** Up to three short points instead of (or under) the image. */
  items?: ReactNode[];
  /** Where to read the whole story. */
  link?: { label: string; href: string };
}

/** Card content from a changelog-feed entry: title, summary, date, media and its first link or own page. */
export function fromChangelogEntry(entry: ChangelogEntry, linkLabel = "Read the changelog"): AnnouncementCard {
  const href = entry.href ?? entry.links?.[0]?.href;
  return {
    title: entry.title,
    description: entry.summary,
    date: entry.date,
    media: entry.media ? { src: entry.media.src, alt: entry.media.alt, hue: entry.media.hue } : undefined,
    link: href ? { label: entry.links?.[0]?.label ?? linkLabel, href } : undefined,
  };
}

/* ── Component ── */

export interface AnnouncementPillProps {
  /** The word in the accent at the start of the pill. Default "New". */
  label?: string;
  /** The pill's text, e.g. "Run replays are here". */
  text: ReactNode;
  card: AnnouncementCard;
  /** Where the card grows from: the pill's left edge (start) or its centre (center). Default "center". */
  align?: "start" | "center";
  /** Kept open (controlled). */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hover pause before the preview shows, in ms. Default 200. 0 turns hover preview off for touch-first pages. */
  hoverDelay?: number;
  /** Turn the hover and focus preview off: the card opens on click or Enter only. */
  preview?: boolean;
  /** Card width in px; the card never gets wider than the screen less 48px. Default 360. */
  width?: number;
  className?: string;
}

/** The card surface fades in while its body folds open; opacity only, so the fold is the one thing that moves. */
const PILL_CSS = "@keyframes kn-pill-in { from { opacity: 0; } }";

/** Space kept between the card and the edge of whatever shows it, in px. */
const EDGE = 8;

/** The visible box for an element: the viewport, narrowed by every ancestor that clips horizontally. */
function clipBox(el: HTMLElement): { left: number; right: number } {
  let left = 0;
  let right = document.documentElement.clientWidth || window.innerWidth;
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const ox = getComputedStyle(p).overflowX;
    if (ox === "visible") continue;
    const r = p.getBoundingClientRect();
    left = Math.max(left, r.left);
    right = Math.min(right, r.right);
  }
  return { left, right };
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function AnnouncementPill({ label = "New", text, card, align = "center", open: openProp, defaultOpen = false, onOpenChange, hoverDelay = 200, preview = true, width = 360, className }: AnnouncementPillProps) {
  const [inner, setInner] = useState<PillState>(defaultOpen ? "open" : "closed");
  const state: PillState = openProp === undefined ? inner : openProp ? "open" : inner === "preview" ? "preview" : "closed";
  const stateRef = useRef(state);
  stateRef.current = state;

  const send = useCallback(
    (e: PillEvent) => {
      const prev = stateRef.current;
      const next = nextPillState(prev, e);
      if (next === prev) return;
      if ((next === "open") !== (prev === "open")) onOpenChange?.(next === "open");
      // Controlled: the pinned part follows `open`; previews stay local.
      setInner(openProp === undefined ? next : next === "preview" ? "preview" : "closed");
      stateRef.current = next;
    },
    [onOpenChange, openProp],
  );

  const shown = state !== "closed";
  // Stays mounted for the exit, then goes. Nothing plays on first render.
  const [mounted, setMounted] = useState(shown);
  const [leaving, setLeaving] = useState(false);
  const [changed, setChanged] = useState(false);
  const [lastShown, setLastShown] = useState(shown);
  if (lastShown !== shown) {
    setLastShown(shown);
    setChanged(true);
    if (shown) {
      setMounted(true);
      setLeaving(false);
    } else setLeaving(true);
  }
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => {
      setMounted(false);
      setLeaving(false);
    }, prefersReducedMotion() ? 0 : MOTION.fast + 20);
    return () => clearTimeout(t);
  }, [leaving]);

  // The body folds open a frame after the card mounts, so the surface grows down from the pill row.
  const [unfold, setUnfold] = useState(shown);
  useEffect(() => setUnfold(shown), [shown]);

  const root = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLButtonElement>(null);
  /** Focus handed back to the pill after a close must not open a preview again. */
  const quiet = useRef(false);
  const refocus = () => {
    quiet.current = true;
    pill.current?.focus();
    quiet.current = false;
  };
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clear = () => clearTimeout(timer.current);
  useEffect(() => clear, []);

  // A click outside closes a card that is kept open.
  useEffect(() => {
    if (state !== "open") return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) send("close");
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [state, send]);

  const id = useId();
  const cardId = `${id}-card`;
  const headId = `${id}-title`;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Escape" || state === "closed") return;
    e.preventDefault();
    send("close");
    refocus();
  };
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (root.current && e.relatedTarget instanceof Node && root.current.contains(e.relatedTarget)) return;
    // Focus left the pill and the card (Tab past the end, or a click elsewhere): close a preview and a kept card alike.
    if (e.relatedTarget) send("blur");
    else if (stateRef.current === "preview") send("leave");
  };

  // Keep the card inside what can show it: the screen and any ancestor that clips (a hero with overflow hidden).
  // The card narrows to fit and shifts inward, so a pill near an edge never pushes it out of view.
  const place = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ shift: number; max?: number }>({ shift: 0 });
  useLayoutEffect(() => {
    const el = place.current;
    if (!mounted || !el || typeof window === "undefined") {
      if (!mounted && (fit.shift || fit.max !== undefined)) setFit({ shift: 0 });
      return;
    }
    const box = clipBox(el);
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const natural = Math.min(width, vw - 48);
    const w = Math.min(natural, box.right - box.left - 2 * EDGE);
    // The anchor: the pill's centre, or its left edge less the 6px the card reaches past the pill.
    const pr = pill.current?.getBoundingClientRect();
    if (!pr) return;
    const left0 = align === "center" ? pr.left + pr.width / 2 - w / 2 : pr.left - 6;
    const lo = box.left + EDGE;
    const hi = box.right - EDGE - w;
    const shift = Math.round(left0 < lo ? lo - left0 : left0 > hi ? hi - left0 : 0);
    const max = w < natural ? Math.floor(w) : undefined;
    if (shift !== fit.shift || max !== fit.max) setFit({ shift, max });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, align, width]);

  const title = card.title ?? text;
  const w = `min(${width}px, calc(100vw - 48px))`;

  return (
    <div
      ref={root}
      data-state={state}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      onPointerEnter={(e) => {
        if (!preview || !hoverDelay || e.pointerType === "touch") return;
        clear();
        timer.current = setTimeout(() => send("hover"), hoverDelay);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "touch") return;
        clear();
        if (stateRef.current === "preview" && !root.current?.contains(document.activeElement)) timer.current = setTimeout(() => send("leave"), MOTION.fast);
      }}
      className={cn("relative inline-flex", shown && "z-30", className)}
    >
      <MotionStyle />
      <style href="kn-announcement-pill" precedence="default">{PILL_CSS}</style>
      <button
        ref={pill}
        type="button"
        aria-expanded={shown}
        aria-controls={mounted ? cardId : undefined}
        onFocus={(e) => {
          if (preview && !quiet.current && e.currentTarget.matches(":focus-visible")) send("focus");
        }}
        onClick={() => {
          clear();
          send("toggle");
        }}
        className={cn(
          "relative z-10 inline-flex h-8 max-w-[calc(100vw-32px)] items-center gap-2 rounded-full pr-3 pl-1 text-[13px] font-medium text-foreground transition-[background-color,box-shadow] duration-(--kn-dur-fast) ease-(--kn-ease-out) pointer-coarse:h-9",
          shown ? "bg-transparent shadow-none" : "bg-card shadow-[0_0_0_1px_var(--border)] hover:bg-muted",
          focusRing,
        )}
      >
        <span className="rounded-full bg-[color-mix(in_srgb,var(--kn-accent,var(--primary))_12%,transparent)] px-2 py-0.5 text-[12px] font-semibold text-[color:var(--kn-accent,var(--primary))]">{label}</span>
        <span className="min-w-0 truncate">{text}</span>
        <svg viewBox="0 0 16 16" aria-hidden="true" className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform duration-(--kn-dur) ease-(--kn-ease-out) motion-reduce:transition-none", shown && "rotate-90")}>
          <path d="M6 4l4 4-4 4" {...stroke} />
        </svg>
      </button>

      {mounted && (
        <div ref={place} className={cn("absolute top-[-6px]", align === "center" ? "left-1/2 -translate-x-1/2" : "left-[-6px]")} style={{ width: fit.max !== undefined ? `min(${w}, ${fit.max}px)` : w, marginLeft: fit.shift || undefined }}>
          <div
            id={cardId}
            role="region"
            aria-labelledby={headId}
            data-leaving={leaving || undefined}
            className={cn(
              FLOAT_SURFACE,
              "origin-top rounded-2xl pt-11",
              align === "start" && "origin-top-left",
              changed && !leaving && "animate-[kn-pill-in_var(--kn-dur-fast)_var(--kn-ease-out)_backwards]",
              leaving && "pointer-events-none animate-[kn-fade-out_var(--kn-dur-fast)_var(--kn-ease-out)_both]",
            )}
          >
            {state === "open" && (
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  send("close");
                  refocus();
                }}
                className={cn("absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-[8px] text-muted-foreground transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:bg-muted hover:text-foreground pointer-coarse:size-9", focusRing)}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
                  <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" {...stroke} />
                </svg>
              </button>
            )}
            <Fold open={unfold}>
              <div className="flex flex-col gap-3 px-4 pt-1 pb-4 text-left">
                {card.media && (
                  <div className="overflow-hidden rounded-xl">
                    <Cover src={card.media.src} alt={card.media.alt} hue={card.media.hue} ratio={16 / 9} />
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  {card.date !== undefined && <p className="text-[11.5px] text-muted-foreground">{formatDate(card.date)}</p>}
                  <h3 id={headId} className="text-[15px] font-semibold text-foreground">
                    {title}
                  </h3>
                  {card.description && <p className="line-clamp-2 text-[13px] text-muted-foreground">{card.description}</p>}
                </div>
                {card.items && card.items.length > 0 && (
                  <ul className="flex flex-col gap-1.5">
                    {card.items.slice(0, 3).map((it, i) => (
                      <li key={i} className="flex items-start gap-2 text-[13px] text-foreground">
                        <svg viewBox="0 0 16 16" aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-[color:var(--kn-accent,var(--primary))]">
                          <path d="M3.5 8.5l3 3 6-7" {...stroke} strokeWidth={1.8} />
                        </svg>
                        <span className="min-w-0">{it}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {card.link && (
                  <a href={card.link.href} className={cn("group/link inline-flex items-center gap-1 self-start rounded-md text-[13px] font-medium text-foreground", focusRing)}>
                    {card.link.label}
                    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5 text-muted-foreground transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) group-hover/link:text-foreground">
                      <path d="M3 8h10M9.5 4.5L13 8l-3.5 3.5" {...stroke} />
                    </svg>
                  </a>
                )}
              </div>
            </Fold>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnnouncementPill;
