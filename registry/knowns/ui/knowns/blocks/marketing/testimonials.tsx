"use client";
/** @registry name="testimonials" type="block" title="Testimonials" description="Customer quotes as a masonry grid with highlighted quotes: name, role, company, avatar or initials and an optional star rating. The carousel and large-quote layouts are Pro variants that build on it." */

/**
 * Testimonials: a masonry grid with highlighted quotes (Free), plus the parts the Pro layouts build on:
 * Stars, Person, TestimonialCard and TestimonialsSection. The carousel lives in ./testimonials-carousel and
 * the single large quote in ./testimonials-quote.
 */
import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Avatar } from "../../avatar";
import { SectionHeading } from "./section-heading";
import { masonry, quoteWeight, ratingLabel } from "./marketing-2b-utils";

export interface Testimonial {
  id?: string;
  quote: string;
  name: string;
  role?: string;
  company?: string;
  /** Photo URL. Without it the avatar shows initials on a tint. */
  avatar?: string;
  /** 0–5, halves allowed. */
  rating?: number;
  /** Where the quote comes from (a review page, a post). */
  href?: string;
  /** Bigger type and an accent edge in the grid. */
  highlight?: boolean;
}

/** The section around the quotes: heading, then the quotes, then small print. Shared by every layout. */
export interface TestimonialsSectionProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  lead?: ReactNode;
  align?: "start" | "center";
  /** Section padding: "default" 64 / 96px (phone / desktop), "tight" 40 / 56px for use inside a page or a frame. */
  spacing?: "default" | "tight";
  /** Shown under the section, e.g. "Sample data" or a source note. */
  footnote?: ReactNode;
  className?: string;
}

export interface TestimonialsProps extends TestimonialsSectionProps {
  items: Testimonial[];
  /** Grid columns at the widest size. Default 3. */
  columns?: 2 | 3;
}

const byline = (t: Testimonial) => [t.role, t.company].filter(Boolean).join(", ");

export function Stars({ value }: { value: number }) {
  const v = Math.round(Math.min(5, Math.max(0, value)) * 2) / 2;
  return (
    <span className="inline-flex items-center gap-1 text-foreground" role="img" aria-label={ratingLabel(v)}>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = v >= i + 1 ? 1 : v >= i + 0.5 ? 0.5 : 0;
        return (
          <svg key={i} viewBox="0 0 16 16" className="size-4" aria-hidden>
            <defs>
              <linearGradient id={`kn-star-${i}-${fill}`}>
                <stop offset={`${fill * 100}%`} stopColor="currentColor" />
                <stop offset={`${fill * 100}%`} stopColor="currentColor" stopOpacity={0.18} />
              </linearGradient>
            </defs>
            <path fill={`url(#kn-star-${i}-${fill})`} d="M8 1.6l1.9 4 4.3.5-3.2 3 .9 4.3L8 11.3l-3.9 2.1.9-4.3-3.2-3 4.3-.5z" />
          </svg>
        );
      })}
    </span>
  );
}

export function Person({ t, size = "md" }: { t: Testimonial; size?: "md" | "lg" }) {
  return (
    <figcaption className="flex min-w-0 items-center gap-3">
      <Avatar label={t.name} src={t.avatar} size={size === "lg" ? "lg" : "md"} shape="circle" decorative />
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-medium">
          {t.href ? (
            <a href={t.href} target="_blank" rel="noreferrer" className={cn("rounded-sm hover:underline", focusRing)}>
              {t.name}
            </a>
          ) : (
            t.name
          )}
        </span>
        {byline(t) && <span className="block truncate text-[13px] text-muted-foreground">{byline(t)}</span>}
      </span>
    </figcaption>
  );
}

export function TestimonialCard({ t, className }: { t: Testimonial; className?: string }) {
  return (
    <figure
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-card p-5",
        t.highlight && "border-[color-mix(in_srgb,var(--accent-color,var(--primary))_35%,var(--border))] bg-[color-mix(in_srgb,var(--accent-color,var(--primary))_4%,var(--card))]",
        className,
      )}
    >
      {t.rating !== undefined && <Stars value={t.rating} />}
      <blockquote className={cn("text-pretty", t.highlight ? "text-[16px] leading-relaxed font-medium" : "text-[15px] leading-relaxed")}>
        <p>“{t.quote}”</p>
      </blockquote>
      <Person t={t} />
    </figure>
  );
}

/* ── Grid ── */

function useColumns(max: 2 | 3) {
  const subscribe = (cb: () => void) => {
    if (typeof matchMedia !== "function") return () => {};
    const a = matchMedia("(min-width: 640px)");
    const b = matchMedia("(min-width: 1024px)");
    a.addEventListener("change", cb);
    b.addEventListener("change", cb);
    return () => {
      a.removeEventListener("change", cb);
      b.removeEventListener("change", cb);
    };
  };
  const get = () => (typeof matchMedia !== "function" ? max : matchMedia("(min-width: 1024px)").matches ? max : matchMedia("(min-width: 640px)").matches ? 2 : 1);
  return useSyncExternalStore(subscribe, get, () => max);
}

function Grid({ items, columns }: { items: Testimonial[]; columns: 2 | 3 }) {
  const cols = useColumns(columns);
  const plan = useMemo(() => masonry(items, cols, quoteWeight), [items, cols]);
  return (
    <div className={cn("grid items-start gap-4", cols === 3 ? "grid-cols-3" : cols === 2 ? "grid-cols-2" : "grid-cols-1")}>
      {plan.map((col, c) => (
        <div key={c} className="flex min-w-0 flex-col gap-4">
          {col.map((i) => (
            <TestimonialCard key={items[i].id ?? i} t={items[i]} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Section ── */

/** The section shell every testimonials layout shares. `layout` lands on data-variant for styling hooks. */
export function TestimonialsSection({ eyebrow, title, lead, align = "center", spacing = "default", footnote, className, layout = "grid", children }: TestimonialsSectionProps & { layout?: string; children?: ReactNode }) {
  return (
    <section data-slot="testimonials" data-variant={layout} className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", spacing === "tight" ? "py-10 sm:py-14" : "py-16 sm:py-24", className)}>
      <SectionHeading eyebrow={eyebrow} title={title} lead={lead} align={align} className={cn(layout === "quote" ? "mb-8" : "mb-10", align === "start" && "max-w-2xl")} />
      {children}
      {footnote && <p className="mt-6 text-center text-[13px] text-muted-foreground">{footnote}</p>}
    </section>
  );
}

/** Customer quotes as a masonry grid. */
export function Testimonials({ items, columns = 3, ...section }: TestimonialsProps) {
  return <TestimonialsSection {...section}>{items.length > 0 && <Grid items={items} columns={columns} />}</TestimonialsSection>;
}

export default Testimonials;
