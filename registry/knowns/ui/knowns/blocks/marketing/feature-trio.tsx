"use client";
/** @registry name="feature-trio" type="block" title="Feature trio" description="Three quiet feature cards, each a bold lead sentence with a muted continuation and a live product moment underneath. The first card spans both columns; they reveal once on scroll, and show whole without JavaScript or under reduced motion." */

/**
 * FeatureTrio: a hairline above each card, a small mono mark, one bold sentence that carries on in muted text, and a
 * slot for the live moment (a real component, not a picture). Two columns, the first card across both; one column
 * under 640px. The cards rise 6px and fade in once as the section scrolls into view, 40ms apart. Nothing is hidden
 * before JavaScript runs or when the reader asked for no motion.
 */
import { useRef, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { SectionHeading } from "./section-heading";
import { useReveal } from "./use-reveal";

export interface FeatureTrioCard {
  /** A small mono label above the sentence, e.g. "Collaborate". */
  mark?: ReactNode;
  /** The bold sentence. */
  lead: ReactNode;
  /** The muted continuation, on the same line of thought. */
  text?: ReactNode;
  /** The live moment. A function gets `revealed` (false until the card has scrolled in), to start a count or a grow once. */
  visual: ReactNode | ((revealed: boolean) => ReactNode);
}

export interface FeatureTrioProps {
  /** The first card spans both columns on 640px and up; the rest sit two to a row. Three is the design. */
  cards: FeatureTrioCard[];
  eyebrow?: ReactNode;
  title?: ReactNode;
  lead?: ReactNode;
  /** Heading alignment. Default "start". */
  align?: "start" | "center";
  className?: string;
}

export function FeatureTrio({ cards, eyebrow, title, lead, align = "start", className }: FeatureTrioProps) {
  const root = useRef<HTMLElement>(null);
  const phase = useReveal(root);
  return (
    <section ref={root} data-reveal={phase} className={cn("flex flex-col gap-12 py-14 sm:py-20", className)}>
      <SectionHeading eyebrow={eyebrow} title={title} lead={lead} align={align} />
      <div className="grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2">
        {cards.map((c, i) => (
          <article
            key={i}
            style={{ transitionDelay: phase === "in" ? `${Math.min(i, 3) * 40}ms` : undefined }}
            className={cn(
              "flex min-w-0 flex-col gap-5 border-t pt-5 transition-[opacity,translate] duration-(--kn-dur) ease-(--kn-ease-out) motion-reduce:transition-none",
              i === 0 && "sm:col-span-2",
              phase === "armed" && "translate-y-1.5 opacity-0",
            )}
          >
            {c.mark && <p className="font-mono text-[11px] tracking-[0.04em] text-muted-foreground uppercase">{c.mark}</p>}
            <h3 className="max-w-[44ch] text-[19px] leading-[1.35] font-semibold tracking-[-0.01em] text-pretty text-foreground">
              {c.lead}
              {c.text && <span className="font-normal text-muted-foreground"> {c.text}</span>}
            </h3>
            <div className="min-w-0 flex-1">{typeof c.visual === "function" ? c.visual(phase === "in") : c.visual}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
