"use client";
/** @registry name="feature-grid" type="block" title="Feature grid" description="Features in 3 or 4 columns with icon, title, text and an optional link, plus a bento variant with wide, tall and large cards that can hold a picture or a live component." */

/**
 * FeatureGrid: 3 or 4 columns of title and text on hairline rules, led by a small muted icon or a number,
 * with an optional link aligned at the bottom. The bento variant mixes cell sizes (wide, tall, large); a
 * cell's visual sits on a muted inset, with no box inside the box.
 */
import type { ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { ArrowLink, SectionHeading } from "./section-heading";
import { bentoSpan, type BentoSize, type MarketingAction } from "./marketing-utils";

export type { BentoSize, MarketingAction } from "./marketing-utils";

export interface Feature {
  title: string;
  text: ReactNode;
  /** A 16px line icon, shown muted beside the title (no tile). */
  icon?: ReactNode;
  /** Aligned to the bottom of the item. Give every item a link, or none, so rows stay even. */
  link?: MarketingAction;
  /** Bento only: the cell size. Default "sm". */
  size?: BentoSize;
  /** A small mark after the title, e.g. a "Pro" badge. Decorative text is fine; it is read with the title. */
  badge?: ReactNode;
  /** Bento only: a picture, chart or live component, on a muted inset above the text. */
  visual?: ReactNode;
}

export interface FeatureGridProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  lead?: ReactNode;
  features: Feature[];
  /** "grid": even columns on hairline rules. "bento": cards with mixed sizes. */
  variant?: "grid" | "bento";
  /** Columns from 1024px (grid). Default 3. */
  columns?: 3 | 4;
  /** Grid only: what leads each title. "icon" (default when items have icons), "number" (01, 02...) or "none". */
  marker?: "icon" | "number" | "none";
  /** Heading alignment. Default "center". */
  align?: "start" | "center";
  /** Section padding: "default" 56/80px (phone/desktop), "tight" 40/56px for a block inside a page or a frame. */
  spacing?: "default" | "tight";
  /**
   * Bento only, opt-in: a card with a link is clickable as a whole (the link stretches over it), and its surface
   * shifts a step on hover (colour only, 120ms). Keep visuals inert when you turn it on, so a click lands on the link.
   */
  cardLinks?: boolean;
  className?: string;
}

/** Minimum visual height per cell size, so large and tall visuals keep their room when cells stack on phones. */
const VISUAL_H: Record<BentoSize, string> = { sm: "h-32", wide: "h-32", tall: "min-h-60 flex-1", lg: "min-h-72 flex-1" };

function Mark({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className="grid size-4 flex-none place-items-center text-muted-foreground [&>svg]:size-4">
      {children}
    </span>
  );
}

export function FeatureGrid({ eyebrow, title, lead, features, variant = "grid", columns = 3, marker, align = "center", spacing = "default", cardLinks = false, className }: FeatureGridProps) {
  const bento = variant === "bento";
  const lead_ = marker ?? (features.some((f) => f.icon) ? "icon" : "none");
  return (
    <section data-slot="feature-grid" className={cn("@container mx-auto w-full max-w-6xl px-4 sm:px-6", spacing === "tight" ? "py-10 sm:py-14" : "py-14 sm:py-20", className)}>
      <SectionHeading eyebrow={eyebrow} title={title} lead={lead} align={align} className="mb-10 sm:mb-12" />
      {bento ? (
        <ul className="grid auto-rows-[minmax(200px,auto)] grid-flow-row-dense grid-cols-1 gap-3 @xl:grid-cols-2 @xl:gap-4 @5xl:grid-cols-4">
          {features.map((f) => (
            <li
              key={f.title}
              data-card-link={cardLinks && f.link ? "" : undefined}
              className={cn(
                "flex flex-col overflow-hidden rounded-2xl border bg-card",
                cardLinks && f.link && "relative transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:bg-[color-mix(in_srgb,var(--foreground)_3%,var(--card))]",
                bentoSpan(f.size),
              )}
            >
              {f.visual && <div className={cn("relative mx-2 mt-2 flex-none overflow-hidden rounded-lg bg-muted/60", VISUAL_H[f.size ?? "sm"])}>{f.visual}</div>}
              <div className={cn("flex flex-col gap-1.5 px-6 pt-5 pb-6", !f.visual ? "flex-1 justify-end" : f.size === "lg" || f.size === "tall" ? "" : "flex-1")}>
                <h3 className="flex items-center gap-2 text-[16px] leading-6 font-semibold">
                  {f.icon && <Mark>{f.icon}</Mark>}
                  {f.title}
                  {f.badge}
                </h3>
                <p className="text-[14px] leading-[22px] text-muted-foreground">{f.text}</p>
                {f.link && (
                  // mt-auto: the link sits at the bottom, so links line up across a row whatever the text length.
                  <div className="mt-auto pt-2">
                    <ArrowLink action={f.link} className={cn(cardLinks && "after:absolute after:inset-0 after:rounded-2xl after:content-['']")} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ol className={cn("grid grid-cols-1 gap-x-8 @xl:grid-cols-2 @4xl:gap-x-10", columns === 4 ? "@5xl:grid-cols-4" : "@4xl:grid-cols-3")}>
          {features.map((f, i) => (
            <li key={f.title} className="flex flex-col border-t pt-5 pb-8 sm:pb-10">
              <h3 className="flex items-center gap-2.5 text-[16px] leading-6 font-semibold">
                {lead_ === "number" && (
                  <span aria-hidden="true" className="font-mono text-[12.5px] font-normal text-muted-foreground tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                )}
                {lead_ === "icon" && f.icon && <Mark>{f.icon}</Mark>}
                {f.title}
                {f.badge}
              </h3>
              <p className="mt-2 text-[15px] leading-6 text-muted-foreground">{f.text}</p>
              {f.link && (
                <div className="mt-auto pt-4">
                  <ArrowLink action={f.link} />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
