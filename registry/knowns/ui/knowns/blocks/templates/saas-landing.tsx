"use client";
/** @registry name="template-saas-landing" type="block" title="SaaS landing page" description="A whole landing page from the marketing blocks: announcement bar, header, hero on a dither field, logo cloud, features, stats, pricing, testimonials, FAQ, call to action and footer. Demo brand and copy, replace them." */

/**
 * SaasLandingTemplate: one page, built only from the blocks. Everything is plain props, so the page is
 * yours to edit: swap the brand, the copy and the links, drop sections you do not need.
 *
 * It is a page, not a layout: the header sticks to the window (or to `scrollRoot` when the page lives in a
 * scrolling box), and the content is one <main> between the header and the footer.
 */
import type { ReactNode } from "react";
import { AnnouncementBar } from "../site/announcement-bar";
import { SiteHeader, type NavEntry } from "../site/site-header";
import { SiteFooter } from "../site/site-footer";
import { HeroCentered } from "../marketing/hero";
import { LogoCloud } from "../marketing/logo-cloud";
import { FeatureGrid } from "../marketing/feature-grid";
import { StatsBand } from "../marketing/stats-band";
import { Testimonials } from "../marketing/testimonials";
import { FaqSection } from "../marketing/faq-section";
import { CTASection } from "../marketing/cta-section";
import { Badge } from "../../badge";
import { buttonClass } from "../../button";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { DitherField } from "../backgrounds/dither-field";
import { GridPattern } from "../backgrounds/grid-pattern";

const NAV: NavEntry[] = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Customers", href: "#customers" },
  { label: "FAQ", href: "#faq" },
];

const LOGOS = ["Alder & Finch", "Basalt", "Kestrel", "Pinewood", "Ridgeline", "Foxglove", "Harbor Lane", "Lumen Co"].map((name) => ({ name }));

const FEATURES = [
  { title: "Flows that read like a checklist", text: "Describe a process in plain steps. Northwind turns it into a flow with owners, due dates and reminders." },
  { title: "One inbox for every request", text: "Forms, email and chat land in one queue. Triage, assign and answer without switching tabs." },
  { title: "Approvals with a paper trail", text: "Route a step to the right person, record the decision and keep the history next to the work." },
  { title: "Reports without a spreadsheet", text: "Cycle time, backlog and workload per team, updated as work moves." },
  { title: "Connects to what you use", text: "Webhooks and a small API. Start from a template and change only the steps that differ." },
  { title: "Roles and audit built in", text: "Workspaces, roles per flow and an export of who changed what and when." },
];

interface Plan {
  id: string;
  name: string;
  description: string;
  price: string;
  per?: string;
  note: string;
  cta: string;
  featured?: boolean;
  badge?: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    description: "For a small team trying its first flows.",
    price: "$0",
    per: "/ month",
    note: "Up to 3 people",
    cta: "Start free",
    features: ["5 active flows", "500 runs per month", "Shared inbox", "Email and form intake"],
  },
  {
    id: "team",
    name: "Team",
    badge: "Most popular",
    description: "For teams that run work through Northwind every day.",
    price: "$24",
    per: "/ person / month",
    note: "Billed yearly",
    cta: "Start 14-day trial",
    featured: true,
    features: ["50 active flows", "20,000 runs per month", "Approvals and reminders", "Reports", "Webhooks and API"],
  },
  {
    id: "business",
    name: "Business",
    description: "For companies with security and audit needs.",
    price: "Custom",
    note: "Talk to us for a quote",
    cta: "Contact sales",
    features: ["Unlimited flows and runs", "Single sign-on", "Audit export", "Priority support"],
  },
];

/** Plain plan cards from Free parts. Pricing Plans (Pro) is a drop-in upgrade: billing switch, highlights, tooltips. */
function PlanCards({ plans }: { plans: Plan[] }) {
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {plans.map((p) => (
        <li key={p.id} className={cn("flex flex-col gap-5 rounded-2xl border bg-card p-6", p.featured && "border-foreground/40 shadow-sm")}>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-semibold">{p.name}</h3>
              {p.badge && <Badge>{p.badge}</Badge>}
            </div>
            <p className="text-[13.5px] leading-5 text-muted-foreground">{p.description}</p>
          </div>
          <p className="flex flex-col gap-0.5">
            <span className="flex items-baseline gap-1.5">
              <span className="text-[32px] leading-10 font-semibold tracking-[-0.02em]">{p.price}</span>
              {p.per && <span className="text-[13px] text-muted-foreground">{p.per}</span>}
            </span>
            <span className="text-[12.5px] text-muted-foreground">{p.note}</span>
          </p>
          <a href="#" className={cn(buttonClass(p.featured ? "primary" : "secondary", "md"), "w-full justify-center")}>
            {p.cta}
          </a>
          <ul className="flex flex-col gap-2 border-t pt-5 text-[13.5px]">
            {p.features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <svg viewBox="0 0 16 16" aria-hidden className="mt-[3px] size-3.5 flex-none text-foreground" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3.5 8.5l3 3 6-7" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

const QUOTES = [
  { quote: "We moved onboarding from three spreadsheets to one flow. New hires know who does what on day one.", name: "Maya Okafor", role: "Head of Operations", company: "Alder & Finch" },
  { quote: "Approvals used to live in chat threads. Now every decision has an owner and a date.", name: "Tomás Rivera", role: "Finance Lead", company: "Kestrel" },
  { quote: "Setup took an afternoon. The reports answered questions we had stopped asking.", name: "Linh Tran", role: "COO", company: "Harbor Lane" },
];

const FAQ = [
  { question: "Can I try it before I pay?", answer: "Yes. Starter is free for up to three people, and every paid plan starts with a 14-day trial. No card needed." },
  { question: "How do I move my existing process in?", answer: "Start from a template or paste your checklist. Northwind turns each line into a step you can assign." },
  { question: "Where is my data stored?", answer: "In the region you pick when you create the workspace. Business adds an audit export and single sign-on." },
  { question: "Can I cancel any time?", answer: "Yes. Monthly plans stop at the end of the period, and you can export your flows and history first." },
];

export interface SaasLandingTemplateProps {
  /** The element that scrolls, when the page is shown inside a box instead of the window. */
  scrollRoot?: HTMLElement | null;
  /** Shown in the header and the footer. */
  brand?: ReactNode;
  className?: string;
}

const Mark = ({ name }: { name: ReactNode }) => (
  <span className="flex items-center gap-2 font-semibold tracking-[-0.01em]">
    <span aria-hidden className="grid size-6 place-items-center rounded-md bg-foreground text-[12px] font-bold text-background">N</span>
    {name}
  </span>
);

export function SaasLandingTemplate({ scrollRoot, brand = "Northwind", className }: SaasLandingTemplateProps) {
  return (
    <div className={className}>
      <AnnouncementBar id="northwind-launch" tone="inverted" action={{ label: "See what is new", href: "#features" }}>
        Flow reports are here: cycle time and backlog per team.
      </AnnouncementBar>
      <SiteHeader
        brand={<Mark name={brand} />}
        brandLabel={typeof brand === "string" ? brand : undefined}
        nav={NAV}
        signIn={{ label: "Sign in", href: "#" }}
        cta={{ label: "Start free", href: "#" }}
        scrollRoot={scrollRoot}
      />
      <main>
        <HeroCentered
          eyebrow={{ badge: "New", label: "Flow reports", href: "#features" }}
          title="Run the work, not the spreadsheet"
          lead="Northwind turns your checklists into flows with owners, approvals and reminders. One inbox, one history, one place to look."
          primary={{ label: "Start free", href: "#" }}
          secondary={{ label: "See pricing", href: "#pricing" }}
          facts={[
            { value: "14 days", label: "free trial" },
            { value: "5 min", label: "to first flow" },
            { value: "No card", label: "to start" },
          ]}
          background={<DitherField shape="horizon" color="var(--accent)" mask="none" intensity={1.1} center={[0.5, 0.74]} className="[mask-image:linear-gradient(to_bottom,transparent_30%,#000_58%,#000_74%,transparent)]" />}
        />
        <LogoCloud title="Trusted by operations teams" logos={LOGOS} columns={8} className="pt-4 pb-6 sm:pt-6 sm:pb-10" />
        <div id="features">
          <FeatureGrid title="Everything a process needs" lead="Steps, owners, approvals and reports in one place." features={FEATURES} />
        </div>
        <StatsBand
          stats={[
            { value: 40, suffix: "%", label: "Faster onboarding", detail: "Median across customers" },
            { value: 12, suffix: "k", label: "Flows running", detail: "Across 900 teams" },
            { value: 99.9, suffix: "%", label: "Uptime", detail: "Last 12 months", format: { minimumFractionDigits: 1, maximumFractionDigits: 1 } },
            { value: 4, label: "Hours to set up", detail: "Typical team" },
          ]}
          footnote="Demo figures for this template."
        />
        <section id="pricing" aria-labelledby="pricing-title" className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
            <h2 id="pricing-title" className="text-balance text-[32px] leading-10 font-semibold tracking-[-0.02em] sm:text-[40px] sm:leading-[48px]">
              Simple pricing for every team
            </h2>
            <p className="mt-4 text-balance text-[16px] leading-7 text-muted-foreground">Start free. Pay per person when your team grows.</p>
          </div>
          <PlanCards plans={PLANS} />
        </section>
        <div id="customers">
          <Testimonials title="Teams run smoother with Northwind" items={QUOTES} footnote="Sample customers and quotes for this template." />
        </div>
        <div id="faq">
          <FaqSection items={FAQ} search={false} categories={[]} layout="split" idPrefix="saas-faq-" contact={{ title: "Something else?", text: "Write to us, we answer within a day.", action: { label: "Contact sales", href: "#" } }} />
        </div>
        <CTASection title="Put your next process on rails" lead="Start free, invite your team and build the first flow today." primary={{ label: "Start free", href: "#" }} secondary={{ label: "Talk to sales", href: "#" }} background={<GridPattern cell={32} squares={6} intensity={0.55} />} />
      </main>
      <SiteFooter
        brand={<Mark name={brand} />}
        brandLabel={typeof brand === "string" ? brand : undefined}
        blurb="Flows, approvals and reports for operations teams."
        columns={[
          { title: "Product", links: [{ label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }, { label: "Changelog", href: "#" }] },
          { title: "Company", links: [{ label: "About", href: "#" }, { label: "Customers", href: "#customers" }, { label: "Careers", href: "#" }] },
          { title: "Resources", links: [{ label: "Docs", href: "#" }, { label: "Templates", href: "#" }, { label: "Contact", href: "#" }] },
        ]}
        status={{ state: "operational" }}
        copyright="© Northwind. Demo content."
        legal={[{ label: "Privacy", href: "#" }, { label: "Terms", href: "#" }]}
      />
    </div>
  );
}
