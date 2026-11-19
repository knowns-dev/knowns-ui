"use client";
/** @registry name="carousel" type="ui" title="Carousel" description="Slides in a row that snap into place: native scroll for touch and trackpad, arrow buttons, arrow keys, dots, one to four slides per view, instant with reduced motion." */

import { Children, useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { prefersReducedMotion } from "@/registry/knowns/lib/knowns/motion";
import { activeIndex, stepIndex } from "./carousel-utils";

export interface CarouselProps {
  /** One child per slide. */
  children: ReactNode;
  /** Accessible name of the carousel. */
  label: string;
  /** Slides visible at once, 1 to 4. A fraction such as 1.2 shows part of the next slide, so a swipe is obvious. Default 1. */
  perView?: number;
  /** Slides visible at once from 640px up. Default: the same as perView. */
  perViewWide?: number;
  /** Space between slides in px. Default 16. */
  gap?: number;
  arrows?: boolean;
  dots?: boolean;
  /** Called with the index of the first slide in view. */
  onIndexChange?: (index: number) => void;
  className?: string;
}

const Chevron = ({ flip }: { flip?: boolean }) => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={flip ? "rotate-180" : undefined}>
    <path d="M6 3.5L10.5 8 6 12.5" />
  </svg>
);

const ARROW = cn("flex size-8 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:bg-accent disabled:pointer-events-none disabled:opacity-40", focusRing);

/**
 * A row of slides on native scroll-snap, so a swipe, a trackpad and the wheel all work with no script, and the
 * arrows, the arrow keys (Left, Right, Home, End) and the dots only move the scroll position. The arrows glide the
 * row; with reduced motion they jump. The state is true at once: the index follows the scroll.
 */
export function Carousel({ children, label, perView: perViewBase = 1, perViewWide, gap = 16, arrows = true, dots = true, onIndexChange, className }: CarouselProps) {
  const slides = Children.toArray(children);
  const count = slides.length;
  const scroller = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const cb = useRef(onIndexChange);
  cb.current = onIndexChange;
  const id = useId();
  // The number in view now: perView, or perViewWide once the screen is wide. Read from the CSS variable the track really uses.
  const [perView, setPerView] = useState(perViewBase);
  const last = Math.max(0, count - Math.floor(perView));

  /** Width of one slide plus its gap, read from the DOM so a resize is picked up. */
  const step = useCallback(() => {
    const el = scroller.current;
    const first = el?.children[0] as HTMLElement | undefined;
    return first ? first.getBoundingClientRect().width + gap : 0;
  }, [gap]);

  const sync = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const pv = parseFloat(getComputedStyle(el).getPropertyValue("--knc-pv")) || perViewBase;
    setPerView((p) => (p === pv ? p : pv));
    const next = activeIndex(el.scrollLeft, step(), count, Math.floor(pv));
    if (next !== indexRef.current) {
      indexRef.current = next;
      setIndex(next);
      cb.current?.(next);
    }
  }, [step, count, perViewBase]);

  useEffect(() => {
    sync();
    const el = scroller.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sync]);

  const goTo = (i: number) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: Math.min(last, Math.max(0, i)) * step(), behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget && (e.target as HTMLElement).closest("input,textarea,select,[contenteditable]")) return;
    const to = e.key === "ArrowRight" ? stepIndex(index, 1, count, Math.floor(perView)) : e.key === "ArrowLeft" ? stepIndex(index, -1, count, Math.floor(perView)) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (to === null) return;
    e.preventDefault();
    goTo(to);
  };

  const basis = `calc((100% - var(--knc-gap) * (var(--knc-pv) - 1)) / var(--knc-pv))`;
  const pages = last + 1;

  return (
    <section role="region" aria-roledescription="carousel" aria-label={label} data-slot="carousel" className={cn("flex flex-col gap-3", className)}>
      <ul
        ref={scroller}
        id={`${id}-track`}
        tabIndex={0}
        aria-label={`${label}, slides`}
        onScroll={sync}
        onKeyDown={onKeyDown}
        style={{ gap, "--knc-gap": `${gap}px`, "--knc-pv-base": perViewBase, "--knc-pv-wide": perViewWide ?? perViewBase } as CSSProperties}
        className={cn("[--knc-pv:var(--knc-pv-base)] sm:[--knc-pv:var(--knc-pv-wide)] flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", focusRing)}
      >
        {slides.map((slide, i) => (
          <li key={i} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`} style={{ flex: `0 0 ${basis}` }} className="min-w-0 snap-start">
            {slide}
          </li>
        ))}
      </ul>
      {(arrows || dots) && pages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          {dots ? (
            <div className="flex items-center gap-1.5" role="group" aria-label="Choose slide">
              {Array.from({ length: pages }, (_, i) => (
                <button key={i} type="button" aria-label={`Go to slide ${i + 1}`} aria-current={i === index ? "true" : undefined} onClick={() => goTo(i)} className={cn("group flex size-5 items-center justify-center rounded-full", focusRing)}>
                  <span className={cn("block h-1.5 rounded-full transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out)", i === index ? "w-4 bg-foreground" : "w-1.5 bg-border group-hover:bg-muted-foreground")} />
                </button>
              ))}
            </div>
          ) : (
            <span />
          )}
          {arrows ? (
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Previous slide" aria-controls={`${id}-track`} disabled={index <= 0} onClick={() => goTo(index - 1)} className={ARROW}>
                <Chevron flip />
              </button>
              <button type="button" aria-label="Next slide" aria-controls={`${id}-track`} disabled={index >= last} onClick={() => goTo(index + 1)} className={ARROW}>
                <Chevron />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default Carousel;
