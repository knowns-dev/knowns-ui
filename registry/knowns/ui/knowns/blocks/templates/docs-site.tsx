"use client";
/** @registry name="template-docs-site" type="block" title="Docs site" description="A docs site in one component: a home with search and category cards, then pages with the docs sidebar, page header, install steps, callouts, table of contents and previous/next links. Demo pages for a fictional product, replace them." */

/**
 * DocsSiteTemplate: a docs home and a docs page, switched in place so the template works in a single frame.
 * In your app each page is a route; keep the pieces (header, sidebar, article, toc) and drop the switch.
 *
 * The sidebar, the table of contents and the page header are the real blocks. The text is demo copy for a
 * fictional product, "Northwind Flow".
 */
import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { SiteHeader } from "../site/site-header";
import { DocsSidebar, type DocsSection } from "../sidebar/sidebar-docs";
import { DocsLayout, DocsPager } from "../docs/docs-layout";
import { DocsPageHeader } from "../docs/docs-page-header";
import { DocsToc } from "../docs/docs-toc";
import { CommandBlock, DocsCallout, DocsStep, DocsSteps } from "../docs/docs-install";
import type { TocItem } from "../docs/docs-utils";

type View = "home" | "install" | "flows" | "approvals" | "webhooks";

const SECTIONS: DocsSection[] = [
  {
    id: "start",
    label: "Get started",
    pages: [
      { id: "home", label: "Overview", href: "#/" },
      { id: "install", label: "Install", href: "#/install" },
    ],
  },
  {
    id: "guides",
    label: "Guides",
    categories: [
      { id: "work", label: "Work", pages: [{ id: "flows", label: "Flows", href: "#/flows" }, { id: "approvals", label: "Approvals", href: "#/approvals" }] },
      { id: "connect", label: "Connect", pages: [{ id: "webhooks", label: "Webhooks", href: "#/webhooks", isNew: true }] },
    ],
  },
];

const PAGES: Record<Exclude<View, "home">, { title: string; lead: string; category: string }> = {
  install: { title: "Install", lead: "Add the Northwind SDK to your project and send your first event.", category: "Get started" },
  flows: { title: "Flows", lead: "A flow is a list of steps with owners, due dates and reminders.", category: "Work" },
  approvals: { title: "Approvals", lead: "Send a step to the right person and keep the decision with the work.", category: "Work" },
  webhooks: { title: "Webhooks", lead: "Get a signed request when a flow changes state.", category: "Connect" },
};
const ORDER: View[] = ["install", "flows", "approvals", "webhooks"];

const CATEGORIES = [
  { id: "install", title: "Get started", text: "Install the SDK and run your first flow in five minutes." },
  { id: "flows", title: "Work", text: "Flows, steps, owners and approvals, the daily surface of the product." },
  { id: "webhooks", title: "Connect", text: "Webhooks and the API, for the tools your team already uses." },
];

const TOC: TocItem[] = [
  { id: "before", text: "Before you start", depth: 2 },
  { id: "steps", text: "Steps", depth: 2 },
  { id: "next", text: "Next steps", depth: 2 },
];

const title = (v: View) => (v === "home" ? "Overview" : PAGES[v].title);
const link = (v?: View) => (v ? { href: `#/${v}`, title: title(v) } : null);

const Mark = () => (
  <span className="flex items-center gap-2 font-semibold tracking-[-0.01em]">
    <span aria-hidden className="grid size-6 place-items-center rounded-md bg-foreground text-[12px] font-bold text-background">N</span>
    Northwind Docs
  </span>
);

const SearchIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden className="size-4 shrink-0">
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L13.5 13.5" />
  </svg>
);

export interface DocsSiteTemplateProps {
  /** The element that scrolls, when the site is shown inside a box instead of the window. */
  scrollRoot?: HTMLElement | null;
  /** The page to start on. Default "home". */
  defaultView?: View;
  className?: string;
  children?: ReactNode;
}

export function DocsSiteTemplate({ scrollRoot, defaultView = "home", className }: DocsSiteTemplateProps) {
  const [view, setView] = useState<View>(defaultView);
  const at = ORDER.indexOf(view);
  const sections = useMemo(() => SECTIONS, []);
  /** Demo links switch pages here; in your app they are real routes. */
  const onClick = (e: MouseEvent) => {
    const a = (e.target as Element).closest?.("a[href^='#/']");
    if (!a) return;
    e.preventDefault();
    const next = (a.getAttribute("href") ?? "").slice(2);
    setView(next ? (next as View) : "home");
  };
  return (
    <div onClickCapture={onClick} className={className}>
      <SiteHeader
        variant="minimal"
        solid
        brand={<Mark />}
        brandLabel="Northwind Docs"
        nav={[{ label: "Docs", href: "#/" }, { label: "API", href: "#/webhooks" }]}
        currentHref="#/"
        search={{ onOpen: () => {} }}
        cta={{ label: "Dashboard", href: "#" }}
        scrollRoot={scrollRoot}
        containerClassName="max-w-[1440px]"
      />
      {view === "home" ? (
        <main className="mx-auto w-full max-w-5xl px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-balance text-[36px] leading-[44px] font-semibold tracking-[-0.02em] sm:text-[48px] sm:leading-[56px]">How can we help?</h1>
            <p className="mt-4 text-balance text-[16px] leading-7 text-muted-foreground">Guides and references for Northwind Flow, from the first install to webhooks.</p>
            <button
              type="button"
              className="mt-8 flex h-12 w-full items-center gap-3 rounded-xl border bg-card px-4 text-left text-[14.5px] text-muted-foreground shadow-xs outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <SearchIcon />
              <span className="flex-1">Search the docs</span>
              <kbd className="rounded border px-1.5 py-0.5 text-[11.5px]">⌘K</kbd>
            </button>
          </div>
          <ul className="mt-14 grid gap-4 sm:grid-cols-3">
            {CATEGORIES.map((c) => (
              <li key={c.id}>
                <a href={`#/${c.id}`} className="flex h-full flex-col gap-2 rounded-2xl border bg-card p-5 transition-colors hover:bg-muted/40 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-ring">
                  <span className="text-[16px] font-semibold">{c.title}</span>
                  <span className="text-[14px] leading-6 text-muted-foreground">{c.text}</span>
                </a>
              </li>
            ))}
          </ul>
        </main>
      ) : (
        <DocsLayout
          sidebar={<DocsSidebar sections={sections} current={view} label="Docs" storageKey="template-docs-site" />}
          toc={<DocsToc items={TOC} />}
          footer={<DocsPager prev={link(ORDER[at - 1])} next={link(ORDER[at + 1])} />}
        >
          <DocsPageHeader
            title={PAGES[view].title}
            lead={PAGES[view].lead}
            breadcrumb={[{ label: "Docs", href: "#/" }, { label: PAGES[view].category }, { label: PAGES[view].title }]}
            prev={link(ORDER[at - 1])}
            next={link(ORDER[at + 1])}
          />
          <article className="flex flex-col gap-6 pt-8 text-[15px] leading-7">
            <h2 id="before" className="text-[22px] font-semibold tracking-[-0.01em]">Before you start</h2>
            <p>You need a Northwind workspace and an API key. Create both from the dashboard in a minute.</p>
            <DocsCallout tone="info" title="Using a test workspace?">
              Keys from a test workspace only work against test flows. Nothing reaches real people.
            </DocsCallout>
            <h2 id="steps" className="text-[22px] font-semibold tracking-[-0.01em]">Steps</h2>
            <DocsSteps>
              <DocsStep title="Install the SDK">
                <CommandBlock commands={{ npm: "npm install @northwind/flow", pnpm: "pnpm add @northwind/flow", yarn: "yarn add @northwind/flow", bun: "bun add @northwind/flow" }} />
              </DocsStep>
              <DocsStep title="Send your first event">
                <p>Create a client with your key and start a flow from a template.</p>
              </DocsStep>
              <DocsStep title="Check the result">
                <p>Open the flow in the dashboard. Each step shows its owner, state and history.</p>
              </DocsStep>
            </DocsSteps>
            <h2 id="next" className="text-[22px] font-semibold tracking-[-0.01em]">Next steps</h2>
            <p>Read about approvals to route a step to a person, or add a webhook to follow a flow from your own app.</p>
          </article>
        </DocsLayout>
      )}
    </div>
  );
}
