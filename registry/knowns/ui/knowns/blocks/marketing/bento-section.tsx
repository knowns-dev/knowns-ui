"use client";
/** @registry name="bento-section" type="block" title="Bento section" description="A heading and a wall of tiles of mixed sizes, each tile holding any component. Spans clamp to the space the section is given (one, two or four columns), and the tiles rise in once on scroll, or show at once under reduced motion." */

/**
 * BentoSection: an optional heading above a grid of tiles. A tile is a quiet surface with an optional small caption and
 * any content inside it, a live component, a chart or a picture. A tile spans 1 to 4 columns and 1 to 3 rows. The grid
 * answers to the width of its own box (container queries): one column under 576px, two to 896px, four above, and a wide
 * tile never leaves a hole because its span clamps to the columns there are. Row height follows the content, so nothing
 * is cut off.
 *
 * Motion: each tile rises 6px and fades in once as the section scrolls into view, 40ms apart (the fourth tile and every
 * later one share the last step). Nothing is hidden before JavaScript runs, when the section is already on screen, or
 * when the reader asked for no motion.
 */
import { useRef, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { SectionHeading } from "./section-heading";
import { useReveal } from "./use-reveal";
import { revealDelay, tileSpan } from "./bento-section-utils";

export interface BentoTile {
  /** A stable key. Falls back to the position. */
  id?: string;
  /** A small caption on top of the tile, 12px and muted. Leave it out when the content says enough. */
  label?: ReactNode;
  /** Columns the tile takes, 1 to 4 (from 576px: 2 columns; from 896px: 4). Default 1. */
  cols?: number;
  /** Rows the tile takes, 1 to 3. Default 1. */
  rows?: number;
  /** Padding inside the tile. Default true; turn it off for a picture or a chart that runs to the edge. */
  pad?: boolean;
  /** The tile's content. A function gets `revealed` (false until the section has scrolled in), to start a count or a grow once. */
  children: ReactNode | ((revealed: boolean) => ReactNode);
  className?: string;
}

export interface BentoSectionProps {
  tiles: BentoTile[];
  eyebrow?: ReactNode;
  title?: ReactNode;
  lead?: ReactNode;
  /** Heading alignment. Default "center". */
  align?: "start" | "center";
  /** Play the one-time rise on scroll. Default true. */
  reveal?: boolean;
  /** Section padding: "default" 56/80px (phone/desktop), "tight" 40/56px for a block inside a page or a frame. */
  spacing?: "default" | "tight";
  /** Accessible name of the tile list when there is no heading. */
  label?: string;
  className?: string;
}

export function BentoSection({ tiles, eyebrow, title, lead, align = "center", reveal = true, spacing = "default", label, className }: BentoSectionProps) {
  const root = useRef<HTMLElement>(null);
  const seen = useReveal(root);
  const phase = reveal ? seen : "in";
  return (
    <section
      ref={root}
      data-slot="bento-section"
      data-reveal={phase}
      aria-label={!title && label ? label : undefined}
      className={cn("@container mx-auto w-full max-w-6xl px-4 sm:px-6", spacing === "tight" ? "py-10 sm:py-14" : "py-14 sm:py-20", className)}
    >
      <SectionHeading eyebrow={eyebrow} title={title} lead={lead} align={align} className="mb-10 sm:mb-12" />
      <ul className="grid auto-rows-auto @xl:auto-rows-[minmax(9rem,auto)] grid-flow-row-dense grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-4">
        {tiles.map((t, i) => (
          <li
            key={t.id ?? i}
            data-slot="bento-tile"
            style={{ transitionDelay: phase === "in" && reveal ? `${revealDelay(i)}ms` : undefined }}
            className={cn(
              "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl bg-muted/60 ring-1 ring-inset ring-foreground/[0.06] transition-[opacity,translate] duration-(--kn-dur) ease-(--kn-ease-out) motion-reduce:transition-none",
              t.pad !== false && "p-4",
              tileSpan(t.cols, t.rows),
              phase === "armed" && "translate-y-1.5 opacity-0",
              t.className,
            )}
          >
            {t.label && <div className={cn("mb-2 truncate text-[12px] leading-4 font-medium text-muted-foreground", t.pad === false && "px-4 pt-4")}>{t.label}</div>}
            {/* A lone child fills the tile, so a component with its own surface is as tall as the row. */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col [&>:only-child]:flex-1">{typeof t.children === "function" ? t.children(phase === "in") : t.children}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
