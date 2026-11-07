"use client";
/** @registry name="template-app-dashboard" type="block" title="App dashboard" description="A signed-in dashboard on the App Shell: sidebar with workspaces, topbar with search and notifications, page header, stat band, a fleet of agents that need you, recent activity and a usage card. Demo data, replace it with yours." */

/**
 * AppDashboardTemplate: the home screen of a product, on the App Shell. The data is plain arrays at the top
 * of the file; replace them with your own, or pass the same shapes in as props.
 *
 * The window scrolls and the sidebar and topbar stick (layout "page"). Put it in a box with layout="fill".
 */
import { useState, type MouseEvent, type ReactNode } from "react";
import { AppShell, type SidebarNode } from "../app-shell/app-shell";
import { Button } from "../../button";
import { AgentFleet, type FleetAgent } from "../../agent-fleet/agent-fleet";
import { Badge } from "../../badge";
import { Progress } from "../../progress";
import { UserMenu } from "../../user-menu";

const glyph = (d: string) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const NAV: SidebarNode[] = [
  { id: "home", label: "Dashboard", href: "#/dashboard", icon: glyph("M2.5 7.5 8 3l5.5 4.5V13H2.5z") },
  { id: "approvals", label: "Approvals", href: "#/approvals", icon: glyph("M2.5 9.5 4 3.5h8l1.5 6v3h-11zM2.5 9.5H6l.5 1.5h3l.5-1.5h3.5"), count: 3 },
  { id: "runs", label: "Runs", href: "#/runs", icon: glyph("M3 3.5v9l9-4.5z") },
  { id: "agents", label: "Agents", href: "#/agents", icon: glyph("M8 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM3.5 14c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5") },
  { id: "tools", label: "Tools", href: "#/tools", icon: glyph("M10 3.5a2.5 2.5 0 0 0-2.4 3.2L3 11.3V13h1.7l4.6-4.6A2.5 2.5 0 1 0 10 3.5z") },
  { id: "settings", label: "Settings", href: "#/settings", icon: glyph("M3 4.5h6M11.5 4.5H13M3 11.5h1.5M7 11.5h6M9 3v3M5 10v3") },
];

const WORKSPACES = [
  { id: "northwind", name: "Northwind", description: "Team · 12 members" },
  { id: "northwind-labs", name: "Northwind Labs", description: "Free · 3 members" },
];

/** A fixed clock keeps the first render the same on the server and the client. */
const NOW = Date.parse("2026-11-06T12:00:00Z");
const MIN = 60_000;

const AGENTS: FleetAgent[] = [
  { id: "pricing", name: "Pricing research", model: "Opus 5.5", state: "running", task: "Compare three trackers", tools: ["Web search", "Notion"], spend: 0.42, startedAt: NOW - 6 * MIN },
  { id: "support", name: "Support triage", model: "Haiku 5.5", state: "waiting", task: "Refund a double charge", tools: ["Helpdesk", "Billing"], spend: 0.08, startedAt: NOW - 4 * MIN, request: { id: "r1", title: "Refund $49.00?" } },
  { id: "release", name: "Release captain", model: "Sonnet 5.5", state: "failed", task: "End-to-end suite", tools: ["Repo", "Deploys"], spend: 0.21, startedAt: NOW - 9 * MIN, error: "3 of 41 checks failed" },
];

const STATS: [string, string][] = [
  ["Runs today", "148"],
  ["Waiting on you", "3"],
  ["Spend today", "$12.40"],
];

const ACTIVITY = [
  { id: "a1", text: "Pricing research finished a comparison of three trackers", at: "4m ago", dot: "bg-emerald-500" },
  { id: "a2", text: "Support triage is waiting for a refund approval", at: "4m ago", dot: "bg-amber-500" },
  { id: "a3", text: "Release captain stopped: 3 of 41 checks failed", at: "9m ago", dot: "bg-red-500" },
  { id: "a4", text: "Weekly digest sent to 12 people", at: "1h ago", dot: "bg-emerald-500" },
];

const Bell = () => (
  <button
    type="button"
    aria-label="Notifications, 2 unread"
    className="relative grid size-8 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
  >
    <span className="grid size-4 [&_svg]:size-4">{glyph("M4 11V7.5a4 4 0 0 1 8 0V11l1 1.5H3L4 11zM6.5 14h3")}</span>
    <span aria-hidden="true" className="absolute top-1.5 right-1.5 size-2 rounded-full bg-sky-500 ring-2 ring-background" />
  </button>
);

export interface AppDashboardTemplateProps {
  /** "page": the window scrolls. "fill": the dashboard fills its parent and the main column scrolls. Default "page". */
  layout?: "page" | "fill";
  /** For a dashboard shown inside another page: no second main or aside landmark. */
  embedded?: boolean;
  labelPrefix?: string;
  className?: string;
  children?: ReactNode;
}

export function AppDashboardTemplate({ layout = "page", embedded, labelPrefix, className }: AppDashboardTemplateProps) {
  const [ws, setWs] = useState("northwind");
  const [active, setActive] = useState("home");
  const keepHere = (e: MouseEvent) => {
    if ((e.target as Element).closest?.("a[href]")) e.preventDefault();
  };
  const node = NAV.find((n) => n.id === active);
  return (
    <div onClickCapture={keepHere} className={className}>
      <AppShell
        layout={layout}
        embedded={embedded}
        labelPrefix={labelPrefix}
        hotkey={false}
        workspaces={WORKSPACES}
        workspace={ws}
        onWorkspaceChange={setWs}
        onCreateWorkspace={() => {}}
        nav={NAV}
        active={active}
        onSelect={(n) => n.href && setActive(n.id)}
        sidebarFooter={
          <div className="flex flex-col gap-2 rounded-lg bg-muted/60 px-3 py-2.5">
            <Progress label="Runs this month" value={7_420} max={10_000} format={(v) => `${v.toLocaleString("en-US")} / 10,000`} valueLabel="bottom" size="sm" />
            <a href="#/billing" className="text-[12.5px] font-medium underline decoration-border underline-offset-4 hover:decoration-foreground/40">
              Upgrade for more
            </a>
          </div>
        }
        breadcrumb={[{ label: "Northwind", href: "#/dashboard" }, { label: node?.label ?? "Dashboard" }]}
        search={{ onOpen: () => {} }}
        notifications={<Bell />}
        user={<UserMenu user={{ name: "Ada Lovelace", email: "ada@northwind.dev" }} items={[{ id: "profile", label: "Profile" }, { id: "billing", label: "Billing" }]} onSignOut={() => {}} sheet="never" />}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-5 sm:p-6">
          <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[24px] leading-8 font-semibold tracking-[-0.01em]">Good afternoon, Ada</h1>
                <Badge tone="success" dot>
                  Live
                </Badge>
              </div>
              <p className="max-w-prose text-[14px] leading-6 text-muted-foreground">Three agents are working. One needs your answer and one stopped.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary">Invite</Button>
              <Button variant="primary" icon={glyph("M8 3v10M3 8h10")}>
                New run
              </Button>
            </div>
          </header>
          <dl className="grid grid-cols-1 divide-y border-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {STATS.map(([t, v]) => (
              <div key={t} className="flex min-w-0 flex-col gap-1 px-0 py-4 sm:px-5 sm:first:pl-0">
                <dt className="truncate text-[12.5px] text-muted-foreground">{t}</dt>
                <dd className="text-[24px] font-semibold tabular-nums tracking-[-0.01em]">{v}</dd>
              </div>
            ))}
          </dl>
          <section aria-labelledby="dash-agents" className="flex flex-col gap-3">
            <h2 id="dash-agents" className="text-[15px] font-semibold">
              Agents
            </h2>
            <AgentFleet agents={AGENTS} now={NOW} title={null} aria-label="Agents on this workspace" />
          </section>
          <section aria-labelledby="dash-activity" className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <h2 id="dash-activity" className="text-[15px] font-semibold">
                Recent activity
              </h2>
              <Badge>Today</Badge>
            </div>
            <ul className="divide-y">
              {ACTIVITY.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-3 text-[13.5px]">
                  <span aria-hidden className={`size-2 shrink-0 rounded-full ${a.dot}`} />
                  <span className="min-w-0 flex-1 truncate">{a.text}</span>
                  <span className="shrink-0 text-[12.5px] text-muted-foreground">{a.at}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </AppShell>
    </div>
  );
}
