"use client";
/** @registry name="docs-layout" type="block" title="Docs layout" description="Docs layout composing the docs blocks: optional sidebar, a reading or wide content column, a right rail, previous / next cards and a Need help card." deps="docs-preview,docs-install,docs-toc" */
/**
 * Docs layout: the composition of the docs blocks. An optional sidebar (from lg), the content column
 * (about 880px for reading pages, full width for block pages so previews show whole), and a right
 * rail (from xl) for DocsToc. Plus DocsPager (previous / next cards) and DocsHelpCard ("Need help?").
 */
import type { ElementType, ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import type { DocsPageLink } from "./docs-page-header";

export interface DocsLayoutProps {
  children: ReactNode;
  /** Left navigation, sticky from lg. Leave out when the app shell already has one. */
  sidebar?: ReactNode;
  /** Right rail, usually <DocsToc>. Shown from xl. */
  toc?: ReactNode;
  /** Where the right rail starts. Default "xl"; "2xl" leaves wide pages their full width at 1280-1535px. */
  tocFrom?: "xl" | "2xl";
  /** "prose": a reading column of about 880px. "wide": the full content width (block pages). */
  width?: "prose" | "wide";
  /** After the content, e.g. <DocsPager> and <DocsHelpCard>. */
  footer?: ReactNode;
  className?: string;
}

const RAIL = {
  xl: { side: "xl:grid-cols-[240px_minmax(0,1fr)_200px]", plain: "xl:grid-cols-[minmax(0,1fr)_200px]" },
  "2xl": { side: "2xl:grid-cols-[240px_minmax(0,1fr)_200px]", plain: "2xl:grid-cols-[minmax(0,1fr)_200px]" },
};
/** Prose pages without a sidebar: the column (at most 880px) and the rail as one group, centered. */
const PROSE_RAIL = { xl: "xl:grid-cols-[minmax(0,880px)_200px] xl:justify-center", "2xl": "2xl:grid-cols-[minmax(0,880px)_200px] 2xl:justify-center" };

export function DocsLayout({ children, sidebar, toc, tocFrom = "xl", width = "prose", footer, className }: DocsLayoutProps) {
  return (
    <div className={cn("mx-auto grid w-full max-w-[1440px] gap-x-12 px-5 py-8 lg:px-10", sidebar && "lg:grid-cols-[240px_minmax(0,1fr)]", toc && (width === "prose" && !sidebar ? PROSE_RAIL[tocFrom] : RAIL[tocFrom][sidebar ? "side" : "plain"]), className)}>
      {sidebar && <aside className="sticky top-22 hidden h-[calc(100dvh-7rem)] overflow-y-auto lg:block">{sidebar}</aside>}
      <div data-docs-width={width} className={cn("min-w-0", width === "prose" && "mx-auto w-full max-w-[880px] xl:mx-0")}>
        {children}
        {footer && <div className="mt-16 grid gap-6">{footer}</div>}
      </div>
      {toc}
    </div>
  );
}

/** Previous / next page cards. */
export function DocsPager({ prev, next, linkAs: L = "a", className }: { prev?: DocsPageLink | null; next?: DocsPageLink | null; linkAs?: ElementType; className?: string }) {
  if (!prev && !next) return null;
  const card = "group rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  return (
    <nav aria-label="Previous and next page" className={cn("grid gap-3 border-t pt-6 sm:grid-cols-2", className)}>
      {prev ? (
        <L href={prev.href} rel="prev" className={card}>
          <div className="text-[12px] text-muted-foreground">Previous</div>
          <div className="mt-0.5 font-medium">
            <span aria-hidden="true" className="mr-1 inline-block transition-transform group-hover:-translate-x-0.5">
              ←
            </span>
            {prev.title}
          </div>
        </L>
      ) : (
        <span className="hidden sm:block" />
      )}
      {next && (
        <L href={next.href} rel="next" className={cn(card, "text-right")}>
          <div className="text-[12px] text-muted-foreground">Next</div>
          <div className="mt-0.5 font-medium">
            {next.title}
            <span aria-hidden="true" className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </div>
        </L>
      )}
    </nav>
  );
}

export interface DocsHelpAction {
  label: string;
  href: string;
  icon?: ReactNode;
}

/** "Need help?" at the end of a page: a line and a few ways to reach you. */
export function DocsHelpCard({ title = "Need help?", children, actions, className }: { title?: ReactNode; children?: ReactNode; actions: DocsHelpAction[]; className?: string }) {
  return (
    <section aria-label={typeof title === "string" ? title : "Help"} className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border bg-muted/30 px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 data-toc="false" className="text-[14px] font-semibold tracking-tight">
          {title}
        </h2>
        {children && <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{children}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <a
            key={a.href}
            href={a.href}
            target={/^https?:/.test(a.href) ? "_blank" : undefined}
            rel={/^https?:/.test(a.href) ? "noopener noreferrer" : undefined}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-3 text-[13px] font-medium transition-colors hover:bg-muted focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring [&_svg]:size-3.5"
          >
            {a.icon}
            {a.label}
          </a>
        ))}
      </div>
    </section>
  );
}
