"use client";
/** @registry name="footer-wordmark" type="block" title="Footer wordmark" description="Marketing footer that ends in the brand word set as wide as the page and cropped at the bottom edge, fading out. A quiet row of links, text-only socials and the legal line sit above it. No JavaScript." */

/**
 * FooterWordmark: links and the legal line, then the brand word at the full width of the container, cropped
 * by the page bottom. The size comes from the container width and the length of the word (CSS only), so it
 * fits at 390px and at 1440px without a resize listener.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { FooterLegal, FooterLink, FooterSocials, wordmarkSize, type FooterLinkItem, type FooterNavigate } from "./footer-parts";

export interface FooterWordmarkProps {
  /** The word set huge. Short brand words work best; three to eight letters. */
  word: string;
  /** A short line left of the links, e.g. "Build the part nobody else will." */
  tagline?: ReactNode;
  links?: FooterLinkItem[];
  /** Text links to your profiles; no marks. */
  socials?: FooterLinkItem[];
  copyright?: ReactNode;
  legal?: FooterLinkItem[];
  /** How much of the width the word takes. 1 spans it. Default 1. */
  fill?: number;
  /** How far below the clip edge the baseline sits, in em. The crop is measured from the real baseline, so a baseline stroke is cut cleanly in any font. Default 0.14. */
  crop?: number;
  onNavigate?: FooterNavigate;
  className?: string;
}

export function FooterWordmark({ word, tagline, links = [], socials = [], copyright, legal = [], fill = 1, crop = 0.14, onNavigate, className }: FooterWordmarkProps) {
  const cut = Math.min(0.4, Math.max(0, crop));
  const clip = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLParagraphElement>(null);
  const mark = useRef<HTMLSpanElement>(null);
  // Before the first measure (server, first paint) the clip is a close guess in em; then it is the real baseline minus `cut`.
  const [px, setPx] = useState<number | null>(null);
  useLayoutEffect(() => {
    const box = clip.current;
    const m = mark.current;
    if (!box || !m) return;
    const measure = () => {
      const base = m.getBoundingClientRect().bottom - box.getBoundingClientRect().top;
      const fs = parseFloat(getComputedStyle(box).fontSize);
      if (base > 0 && fs > 0) setPx(Math.round((base - cut * fs) * 100) / 100);
    };
    measure();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (line.current) ro?.observe(line.current);
    void document.fonts?.ready.then(measure);
    return () => ro?.disconnect();
  }, [word, fill, cut]);
  return (
    <footer data-slot="footer-wordmark" className={cn("overflow-hidden border-t bg-background", className)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-10 sm:px-6 sm:pt-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          {tagline && <p className="max-w-xs text-[15px] leading-snug font-medium text-balance">{tagline}</p>}
          {links.length > 0 && (
            <nav aria-label="Footer">
              <ul className="grid grid-cols-2 gap-x-10 gap-y-2.5 sm:flex sm:flex-wrap sm:justify-end sm:gap-x-6">
                {links.map((l) => (
                  <li key={l.href + l.label}>
                    <FooterLink link={l} onNavigate={onNavigate} />
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
        <div className="flex flex-col gap-4 border-t pt-5">
          <FooterSocials socials={socials} onNavigate={onNavigate} />
          <FooterLegal copyright={copyright} legal={legal} onNavigate={onNavigate} />
        </div>
      </div>
      {/* The container is what the word measures itself against. */}
      <div aria-hidden className="@container mx-auto w-full max-w-6xl px-4 pt-6 select-none sm:px-6">
        <div ref={clip} className="overflow-hidden" style={{ fontSize: wordmarkSize(word, fill), height: px === null ? "0.76em" : `${px}px` }}>
          <p
            ref={line}
            className="text-center leading-[0.9] font-semibold tracking-[-0.045em] whitespace-nowrap text-transparent [-webkit-background-clip:text] bg-clip-text"
            style={{ backgroundImage: "linear-gradient(to bottom, color-mix(in srgb, var(--foreground) 88%, transparent) 20%, color-mix(in srgb, var(--foreground) 6%, transparent) 100%)" }}
          >
            {word}
            <span ref={mark} className="inline-block h-0 w-0 align-baseline" />
          </p>
        </div>
      </div>
    </footer>
  );
}

export default FooterWordmark;
