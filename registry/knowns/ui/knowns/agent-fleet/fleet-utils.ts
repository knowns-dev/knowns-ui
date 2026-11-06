/** @registry part-of="agent-fleet" */
import type { ReactNode } from "react";
import type { Actor, AgentSnapshot } from "@/registry/knowns/lib/knowns/types";
import type { AgentRun } from "@/registry/knowns/lib/knowns/run";
import { rootAgent } from "@/registry/knowns/lib/knowns/status";

/** Where an agent is in its life. "waiting" is shown as "Needs you". */
export type FleetState = "queued" | "running" | "waiting" | "done" | "failed" | "stopped";

export const FLEET_STATES: FleetState[] = ["running", "waiting", "failed", "queued", "done", "stopped"];

export const FLEET_LABEL: Record<FleetState, string> = {
  queued: "Queued",
  running: "Running",
  waiting: "Needs you",
  done: "Done",
  failed: "Failed",
  stopped: "Stopped",
};

export interface FleetStep {
  id: string;
  title: string;
  state?: "running" | "done" | "failed";
  summary?: string;
  /** Tool the task mostly used, for its logo (e.g. "Notion"). */
  tool?: string;
  /** Epoch ms. */
  startedAt?: number;
  endedAt?: number;
}

export interface FleetAgent {
  id: string;
  name: string;
  /** Model name; the provider logo comes from modelIcon(model). */
  model?: string;
  icon?: ReactNode;
  state: FleetState;
  /** What it's working on now (or last worked on). */
  task?: string;
  /** Tool names it has used, e.g. ["Slack", "GitHub"]; logos come from toolIcon(name). */
  tools?: string[];
  /** Its own spend (sub-agents are added up for the card). */
  spend?: number;
  /** Epoch ms, for the clock. */
  startedAt?: number;
  endedAt?: number;
  /** A waiting agent's question. */
  request?: { id: string; title: string; detail?: string };
  /** A failed agent's reason. */
  error?: string;
  /** Its tasks; a "steps" button opens them in a dialog. */
  steps?: FleetStep[];
  children?: FleetAgent[];
  /** Set for agents derived from a run: the run and the actor (and approval) they came from. */
  source?: { run: AgentRun; actor: string; approval?: string };
}

export type FleetAction = "approve" | "reject" | "retry" | "dismiss";

/* ── From a run ── */

/**
 * One fleet card from a run snapshot: the root agent, with the other agents nested under the agent
 * that first called (or links to) them. `prefix` keeps ids unique across several runs.
 */
export function fleetFromSnapshot(snap: AgentSnapshot, run?: AgentRun, prefix = ""): FleetAgent | null {
  const root = rootAgent(snap.actors);
  if (!root) return null;
  const byId = new Map(snap.actors.map((a) => [a.id, a]));
  const agents = snap.actors.filter((a) => a.type === "agent");

  // Parent: first agent that called it, else a linked agent, else the root.
  const parent = new Map<string, string>();
  for (const a of agents) {
    if (a.id === root.id) continue;
    const call = snap.spans.find((s) => s.to === a.id && byId.get(s.from)?.type === "agent" && s.from !== a.id);
    const link = snap.links.find(([x, y]) => y === a.id && x !== a.id && byId.get(x)?.type === "agent");
    parent.set(a.id, call?.from ?? (link ? link[0] : root.id));
  }
  // Break cycles: walk up; anything that loops hangs off the root.
  for (const a of agents) {
    const seen = new Set<string>([a.id]);
    let p = parent.get(a.id);
    while (p && p !== root.id) {
      if (seen.has(p)) {
        parent.set(a.id, root.id);
        break;
      }
      seen.add(p);
      p = parent.get(p);
    }
  }

  const build = (actor: Actor): FleetAgent => {
    const tasks = snap.tasks.filter((t) => t.actor === actor.id);
    const spans = snap.spans.filter((s) => s.from === actor.id || s.to === actor.id);
    const pending = snap.approvals.find((x) => x.actor === actor.id && !x.decision);
    const tools: string[] = [];
    for (const s of snap.spans) {
      if (s.from !== actor.id) continue;
      const t = byId.get(s.to);
      if (t?.type === "tool" && !tools.includes(t.label)) tools.push(t.label);
    }
    const running = tasks.find((t) => !t.outcome);
    const last = tasks[tasks.length - 1];
    const starts = [...tasks.map((t) => t.startedAt), ...spans.map((s) => s.startedAt)];
    const ends = [...tasks.map((t) => t.endedAt ?? 0), ...spans.map((s) => s.endedAt ?? 0)];
    // An open call into or out of the agent counts as work in progress.
    const openCall = spans.some((s) => !s.outcome);
    const state = stateOf(actor, !!running || openCall, tasks.length > 0 || spans.length > 0, last?.outcome, !!pending);
    const failedSpan = [...spans].reverse().find((s) => s.outcome === "failure" && s.from === actor.id);
    return {
      id: prefix + actor.id,
      name: actor.label,
      model: actor.model,
      icon: actor.icon,
      state,
      // Fall back to what the caller asked for ("Compare pricing") before the agent reports anything.
      task: pending?.title ?? actor.activity ?? running?.title ?? [...snap.spans].reverse().find((s) => s.to === actor.id && s.summary)?.summary ?? last?.title,
      tools,
      spend: actor.spend,
      startedAt: starts.length ? Math.min(...starts) : undefined,
      endedAt: state === "running" || state === "waiting" || state === "queued" ? undefined : Math.max(0, ...ends) || undefined,
      request: pending ? { id: pending.id, title: pending.title, detail: pending.detail } : undefined,
      error: state === "failed" ? (failedSpan?.error ?? (last?.outcome === "failure" ? last.summary : undefined)) : undefined,
      steps: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        state: !t.outcome ? "running" : t.outcome === "success" ? "done" : "failed",
        summary: t.summary,
        startedAt: t.startedAt,
        endedAt: t.endedAt,
        // First tool the agent called while this task ran.
        tool: snap.spans
          .filter((s) => s.from === actor.id && byId.get(s.to)?.type === "tool" && s.startedAt >= t.startedAt && (t.endedAt === undefined || s.startedAt <= t.endedAt))
          .map((s) => byId.get(s.to)!.label)[0],
      })),
      children: agents.filter((a) => parent.get(a.id) === actor.id).map(build),
      source: run ? { run, actor: actor.id, approval: pending?.id } : undefined,
    };
  };
  return build(root);
}

/** Fleet state from a run actor. A pending approval wins; idle reads from its work so far. */
export function stateOf(actor: Pick<Actor, "state">, hasRunningTask: boolean, started: boolean, lastOutcome: "success" | "failure" | undefined, pendingApproval: boolean): FleetState {
  if (pendingApproval || actor.state === "blocked") return "waiting";
  if (actor.state === "busy" || hasRunningTask) return "running";
  if (actor.state === "failed") return "failed";
  if (actor.state === "finished") return "done";
  if (!started) return "queued";
  // Idle after some work: done, unless the last task failed. ("stopped" is for callers that cancel agents.)
  return lastOutcome === "failure" ? "failed" : "done";
}

/* ── Tree maths ── */

/** Every agent in the tree, depth first (root first). */
export function walk(agent: FleetAgent): FleetAgent[] {
  return [agent, ...(agent.children ?? []).flatMap(walk)];
}

/** Spend of an agent and everything under it. */
export function treeSpend(agent: FleetAgent): number {
  return walk(agent).reduce((n, a) => n + (a.spend ?? 0), 0);
}

/** Sub-agents (not the agent itself) per state. */
export function countByState(agent: FleetAgent): Partial<Record<FleetState, number>> {
  const out: Partial<Record<FleetState, number>> = {};
  for (const a of walk(agent).slice(1)) out[a.state] = (out[a.state] ?? 0) + 1;
  return out;
}

/** "2 running, 1 needs you" (in FLEET_STATES order); "No sub-agents" when empty. */
export function countsText(counts: Partial<Record<FleetState, number>>): string {
  const parts = FLEET_STATES.filter((s) => counts[s]).map((s) => `${counts[s]} ${FLEET_LABEL[s].toLowerCase()}`);
  return parts.length ? parts.join(", ") : "No sub-agents";
}

export interface FleetTotals {
  agents: number;
  running: number;
  waiting: number;
  cost: number;
}

/** Totals over every agent of every card. */
export function fleetTotals(fleet: FleetAgent[]): FleetTotals {
  const all = fleet.flatMap(walk);
  return {
    agents: all.length,
    running: all.filter((a) => a.state === "running").length,
    waiting: all.filter((a) => a.state === "waiting").length,
    cost: all.reduce((n, a) => n + (a.spend ?? 0), 0),
  };
}

/** Clock text: "42s", "3:05", "1:02:09". Empty without a start. */
export function formatClock(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return "";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Elapsed time for an agent: until now while live, start → end once it's over. */
export function elapsed(agent: Pick<FleetAgent, "startedAt" | "endedAt" | "state">, now: number): number | undefined {
  if (agent.startedAt === undefined) return undefined;
  const live = agent.state === "running" || agent.state === "waiting";
  return Math.max(0, (live || agent.endedAt === undefined ? now : agent.endedAt) - agent.startedAt);
}

export interface TreeRow {
  agent: FleetAgent;
  level: number;
  parent: string | null;
  hasChildren: boolean;
}

/** Rows a keyboard can reach: an agent's children only when it's expanded. */
export function visibleRows(root: FleetAgent, expanded: Set<string>): TreeRow[] {
  const rows: TreeRow[] = [];
  const add = (a: FleetAgent, level: number, parent: string | null) => {
    const kids = a.children ?? [];
    rows.push({ agent: a, level, parent, hasChildren: kids.length > 0 });
    if (kids.length && expanded.has(a.id)) kids.forEach((k) => add(k, level + 1, a.id));
  };
  add(root, 1, null);
  return rows;
}

export type TreeKeyResult = { focus: number } | { expand: string } | { collapse: string } | { activate: number } | { close: true } | null;

/** What a key does in the tree (WAI-ARIA tree pattern). */
export function treeKey(rows: TreeRow[], i: number, key: string, expanded: Set<string>): TreeKeyResult {
  const row = rows[i];
  if (!row) return null;
  switch (key) {
    case "ArrowDown":
      return i < rows.length - 1 ? { focus: i + 1 } : null;
    case "ArrowUp":
      return i > 0 ? { focus: i - 1 } : null;
    case "Home":
      return { focus: 0 };
    case "End":
      return { focus: rows.length - 1 };
    case "ArrowRight":
      if (!row.hasChildren) return null;
      return expanded.has(row.agent.id) ? { focus: i + 1 } : { expand: row.agent.id };
    case "ArrowLeft":
      if (row.hasChildren && expanded.has(row.agent.id)) return { collapse: row.agent.id };
      if (row.parent) return { focus: rows.findIndex((r) => r.agent.id === row.parent) };
      return null;
    case "Enter":
    case " ":
      return { activate: i };
    case "Escape":
      return { close: true };
  }
  return null;
}

/* ── Card text ── */

/** Duration text for cards: "42s", "7m 00s", "1h 02m". Empty without a value. */
export function formatDuration(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return "";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

export type SummaryTone = "waiting" | "failed" | "running" | "done" | "none";

/**
 * One line about a main agent's sub-agents, most urgent first:
 * "1 needs you", "1 failed", "2/4 running", "All 3 done", "No sub-agents".
 */
export function mainSummary(agent: FleetAgent): { text: string; tone: SummaryTone } {
  const subs = walk(agent).slice(1);
  if (!subs.length) return { text: "No sub-agents", tone: "none" };
  const n = (s: FleetState) => subs.filter((a) => a.state === s).length;
  if (n("waiting")) return { text: `${n("waiting")} ${n("waiting") === 1 ? "needs" : "need"} you`, tone: "waiting" };
  if (n("failed")) return { text: `${n("failed")} failed`, tone: "failed" };
  if (n("running")) return { text: `${n("running")}/${subs.length} running`, tone: "running" };
  if (n("done") === subs.length) return { text: subs.length === 1 ? "Done" : `All ${subs.length} done`, tone: "done" };
  return { text: `${n("done")}/${subs.length} done`, tone: "none" };
}

/* ── Connectors ── */

export interface Pt {
  x: number;
  y: number;
}

/** Parent beside its children: out to a shared vertical trunk at `trunkX`, then an elbow into the child. */
export function sidePoints(from: Pt, trunkX: number, to: Pt): Pt[] {
  if (Math.abs(from.y - to.y) < 1) return [from, to];
  return [from, { x: trunkX, y: from.y }, { x: trunkX, y: to.y }, to];
}

/** Children below the parent: straight down from the parent's edge, then right into the child. */
export function belowPoints(from: Pt, to: Pt): Pt[] {
  return [from, { x: from.x, y: to.y }, to];
}

/**
 * Children in a row below the parent card. When the child starts right of the parent's dot: down, then
 * right (belowPoints). When it sits further left (the tree is pulled in from the edge): down into the gap
 * at `gapY`, left to a trunk just before the child, down, then right into it.
 */
export function dropPoints(from: Pt, to: Pt, gapY: number, trunkGap = 20): Pt[] {
  if (to.x - from.x >= 24) return belowPoints(from, to);
  const trunk = to.x - trunkGap;
  return [from, { x: from.x, y: gapY }, { x: trunk, y: gapY }, { x: trunk, y: to.y }, to];
}

/** Grid columns that repeat(auto-fill, minmax(min, 1fr)) makes in `width` with `gap`. */
export function gridColumns(width: number, min: number, gap: number): number {
  return Math.max(1, Math.floor((width + gap) / (min + gap)));
}

/**
 * Columns for `count` cards in `width`: as many as fit at `min` px, but no more than there are cards, so a
 * short fleet fills the row instead of leaving empty tracks. Cards stop growing at `max` px: past that the
 * grid keeps extra (empty) columns rather than stretching one or two cards across a wide screen.
 */
export function fleetColumns(width: number, count: number, min: number, max: number, gap: number): number {
  const fit = gridColumns(width, min, gap);
  const enough = Math.max(1, Math.min(fit, count));
  const notTooWide = Math.ceil((width + gap) / (max + gap));
  return Math.min(fit, Math.max(enough, notTooWide));
}

/** Index of the last card in the open card's row: the tree row goes right after it. */
export function rowEnd(index: number, cols: number, count: number): number {
  return Math.min(count - 1, Math.floor(index / cols) * cols + cols - 1);
}

/** Left offset of the tree under the open card: indented from the card, pulled in so `treeW` fits. */
export function treeLeft(cardLeft: number, width: number, treeW: number, indent: number, min = 24): number {
  return Math.round(Math.max(min, Math.min(cardLeft + indent, width - treeW)));
}

/** SVG path through orthogonal points with rounded corners (radius clamped to half of each leg). */
export function roundedPath(pts: Pt[], r: number): string {
  if (pts.length < 2) return "";
  const f = (n: number) => Math.round(n * 10) / 10;
  let d = `M${f(pts[0].x)},${f(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1];
    const c = pts[i];
    const n = pts[i + 1];
    const d1 = Math.hypot(c.x - p.x, c.y - p.y) || 1;
    const d2 = Math.hypot(n.x - c.x, n.y - c.y) || 1;
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const a = { x: c.x - ((c.x - p.x) / d1) * rr, y: c.y - ((c.y - p.y) / d1) * rr };
    const b = { x: c.x + ((n.x - c.x) / d2) * rr, y: c.y + ((n.y - c.y) / d2) * rr };
    d += ` L${f(a.x)},${f(a.y)} Q${f(c.x)},${f(c.y)} ${f(b.x)},${f(b.y)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${f(last.x)},${f(last.y)}`;
}

/* ── Depth ── */

/** Depth of every agent under `root` (root 0, its children 1…). */
export function depthMap(root: FleetAgent): Map<string, number> {
  const m = new Map<string, number>();
  const go = (a: FleetAgent, d: number) => {
    m.set(a.id, d);
    (a.children ?? []).forEach((k) => go(k, d + 1));
  };
  go(root, 0);
  return m;
}

/** Agents from `root` down to `id` (inclusive), or [] when it isn't in the tree. */
export function findPath(root: FleetAgent, id: string): FleetAgent[] {
  if (root.id === id) return [root];
  for (const k of root.children ?? []) {
    const p = findPath(k, id);
    if (p.length) return [root, ...p];
  }
  return [];
}

/** Ids shown inline under `panelRoot`: those less than `limit` levels below it have their children shown. */
export function inlineExpanded(panelRoot: FleetAgent, limit: number): Set<string> {
  const out = new Set<string>();
  const go = (a: FleetAgent, d: number) => {
    if (d < limit) {
      out.add(a.id);
      (a.children ?? []).forEach((k) => go(k, d + 1));
    }
  };
  go(panelRoot, 0);
  return out;
}

/** What hides under a collapsed agent: how many, and the states that matter. */
export function hiddenStats(agent: FleetAgent): { count: number; running: number; waiting: number; failed: number } {
  const below = walk(agent).slice(1);
  return {
    count: below.length,
    running: below.filter((a) => a.state === "running").length,
    waiting: below.filter((a) => a.state === "waiting").length,
    failed: below.filter((a) => a.state === "failed").length,
  };
}

/**
 * Top offset of the tree beside the main column: centred on the open card's dot (`dotY`), but never above
 * the column's top and kept inside its height when it fits. A tree taller than the column sits at the top.
 */
export function treeOffset(dotY: number, treeH: number, colH: number): number {
  if (treeH >= colH) return 0;
  return Math.round(Math.min(Math.max(dotY - treeH / 2, 0), colH - treeH));
}
