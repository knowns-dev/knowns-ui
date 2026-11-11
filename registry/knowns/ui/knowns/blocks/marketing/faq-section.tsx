"use client";
/** @registry name="faq-section" type="block" title="FAQ section" description="Questions in an accordion with topic chips, accent-insensitive search, copyable #question-id deep links that open on load and hash change, and a Still have questions card. Stacked or split layout." */

/**
 * A site FAQ: heading and lead, category chips, search, the Knowns Accordion, a "Still have questions?"
 * card, and deep links: #question-id opens that question (on load and when the hash changes), and each
 * question has a copy-link button.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn, focusRing, writeClipboard } from "@/registry/knowns/lib/knowns/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../accordion";
import { Input } from "../../input";
import { ActionButton, SectionHeading } from "./section-heading";
import type { MarketingAction } from "./marketing-utils";
import { faqCategories, faqFromHash, faqId, filterFaq } from "./marketing-2b-utils";

export interface FaqItem {
  /** Anchor for deep links. Default: a slug of the question. */
  id?: string;
  question: string;
  answer: ReactNode;
  /** Plain text of the answer, for search when `answer` is not a string. */
  answerText?: string;
  category?: string;
}

export interface FaqSectionProps {
  items: FaqItem[];
  eyebrow?: ReactNode;
  title?: ReactNode;
  lead?: ReactNode;
  /** Category chips, in order. Default: the categories found in `items`. Pass [] to hide them. */
  categories?: string[];
  /** Search box above the questions. Default true. */
  search?: boolean;
  /** Prefix for question anchors, e.g. "faq-" makes #faq-refunds. Default none. */
  idPrefix?: string;
  /** Questions open at first (ids). */
  defaultOpen?: string[];
  /** The "Still have questions?" card. `false` hides it. */
  contact?: { title?: ReactNode; text?: ReactNode; action?: MarketingAction } | false;
  /**
   * "stacked": one column of collapsible questions (default). "split": heading and contact card on the left,
   * questions on the right from 820px. "columns": every answer visible in two columns, for short FAQs; no search or chips.
   */
  layout?: "stacked" | "split" | "columns";
  className?: string;
}

const textOf = (it: FaqItem) => it.answerText ?? (typeof it.answer === "string" ? it.answer : "");

export function FaqSection({ items, eyebrow, title = "Frequently asked questions", lead, categories, search = true, idPrefix = "", defaultOpen = [], contact = {}, layout = "stacked", className }: FaqSectionProps) {
  const cats = categories ?? faqCategories(items);
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string[]>(defaultOpen);
  const [copied, setCopied] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchable = useMemo(() => items.map((it) => ({ ...it, answerText: textOf(it) })), [items]);
  const shown = filterFaq(searchable, { category: cat, query: q });

  // Deep link: #id opens the question, clears filters so it is visible, and scrolls to it.
  useEffect(() => {
    const apply = () => {
      const id = faqFromHash(location.hash, items, idPrefix);
      if (!id) return;
      setCat("all");
      setQ("");
      setOpen((o) => (o.includes(id) ? o : [...o, id]));
      requestAnimationFrame(() => document.getElementById(`${idPrefix}${id}`)?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
    };
    apply();
    addEventListener("hashchange", apply);
    return () => removeEventListener("hashchange", apply);
  }, [items, idPrefix]);

  const copyLink = async (id: string) => {
    try {
      const url = new URL(location.href);
      url.hash = `${idPrefix}${id}`;
      await writeClipboard(url.toString());
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  const heading = <SectionHeading eyebrow={eyebrow} title={title} lead={lead} align={layout === "split" ? "start" : "center"} />;
  const card =
    contact !== false ? (
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[15px] font-medium">{contact.title ?? "Still have questions?"}</p>
          <p className="mt-1 text-[14px] text-muted-foreground">{contact.text ?? "Can't find the answer? We reply within one business day."}</p>
        </div>
        <ActionButton action={contact.action ?? { label: "Contact us", href: "#contact" }} variant="secondary" size="md" className="flex-none" />
      </div>
    ) : null;

  const list = (
    <div className="flex min-w-0 flex-col gap-4">
      {(search || cats.length > 0) && (
        <div className="flex flex-col gap-3">
          {search && (
            <Input
              type="search"
              aria-label="Search questions"
              placeholder="Search questions"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              icon={
                <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="m10.5 10.5 3 3" />
                </svg>
              }
            />
          )}
          {cats.length > 0 && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="group" aria-label="Filter by topic">
              {["all", ...cats].map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={cat === c}
                  onClick={() => setCat(c)}
                  className={cn("h-8 flex-none rounded-full border px-3 text-[13px] transition-colors", cat === c ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground", focusRing)}
                >
                  {c === "all" ? "All" : c}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {q || cat !== "all" ? `${shown.length} question${shown.length === 1 ? "" : "s"} shown` : ""}
      </p>
      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-8 text-center text-[14px] text-muted-foreground">
          No questions match{q ? ` "${q}"` : ""}.{" "}
          <button type="button" className={cn("rounded-sm font-medium text-foreground underline-offset-2 hover:underline", focusRing)} onClick={() => (setQ(""), setCat("all"))}>
            Show all
          </button>
        </div>
      ) : (
        <div ref={listRef}>
          <Accordion type="multiple" value={open} onValueChange={(v) => setOpen(v as string[])} className="border-t [border-color:color-mix(in_srgb,var(--foreground)_8%,transparent)]">
            {shown.map((it) => {
              const id = faqId(it);
              return (
                <div key={id} id={`${idPrefix}${id}`} className="group/faq relative scroll-mt-24">
                  <AccordionItem value={id} className="[border-color:color-mix(in_srgb,var(--foreground)_8%,transparent)]">
                    <AccordionTrigger className="pr-9">{it.question}</AccordionTrigger>
                    <AccordionContent>{it.answer}</AccordionContent>
                  </AccordionItem>
                  <button
                    type="button"
                    onClick={() => copyLink(id)}
                    aria-label={copied === id ? "Link copied" : `Copy link to "${it.question}"`}
                    className={cn(
                      "absolute top-4 right-8 grid size-6 place-items-center rounded-lg text-muted-foreground opacity-0 transition-opacity ease-(--kn-ease-out) group-hover/faq:opacity-100 hover:text-foreground focus-visible:opacity-100 pointer-coarse:opacity-60",
                      focusRing,
                    )}
                  >
                    {copied === id ? (
                      <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="m3.5 8.5 3 3 6-7" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                        <path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2.2-2.2a2.6 2.6 0 0 0-3.7-3.7l-.8.8M9.2 6.8a2.6 2.6 0 0 0-3.7 0L3.3 9a2.6 2.6 0 0 0 3.7 3.7l.8-.8" />
                      </svg>
                    )}
                  </button>
                </div>
              );
            })}
          </Accordion>
        </div>
      )}
    </div>
  );

  return (
    <section data-slot="faq-section" className={cn("@container mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24", className)}>
      {layout === "columns" ? (
        <div className="flex flex-col gap-12">
          {heading}
          <dl className="grid gap-x-12 gap-y-8 @[720px]:grid-cols-2">
            {items.map((it) => {
              const id = faqId(it);
              return (
                <div key={id} id={`${idPrefix}${id}`} className="flex scroll-mt-24 flex-col gap-2">
                  <dt className="text-[16px] font-medium">{it.question}</dt>
                  <dd className="text-[15px] leading-relaxed text-muted-foreground">{it.answer}</dd>
                </div>
              );
            })}
          </dl>
          {card}
        </div>
      ) : layout === "split" ? (
        <div className="grid gap-x-12 gap-y-8 @[820px]:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)]">
          <div className="flex flex-col gap-6">
            {heading}
            <div className="hidden @[820px]:block">{card}</div>
          </div>
          {list}
          <div className="@[820px]:hidden">{card}</div>
        </div>
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col gap-8">
          {heading}
          {list}
          {card}
        </div>
      )}
    </section>
  );
}

export default FaqSection;
