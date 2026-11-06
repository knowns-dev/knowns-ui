import type { AgentSnapshot, Task, TaskItem } from "@/registry/knowns/lib/knowns/types";

/** Something passed along with a handoff (the run's TaskItem). `lost` means it didn't make it. */
export type HandoffItem = TaskItem;
export type HandoffItemKind = NonNullable<TaskItem["kind"]>;

/** Work handed from one agent to the next. */
export interface Handoff {
  id: string;
  from: string;
  to: string;
  /** What was handed over, usually the task that just ended. */
  title: string;
  /** Why, or what came out of it. */
  summary?: string;
  /** Epoch ms. */
  at: number;
  items: HandoffItem[];
  /** Task the handoff came from. */
  task?: string;
}

/** What an agent column shows: nothing yet, busy, done, or something needs a look. */
export type RelayStatus = "todo" | "working" | "done" | "warning";

/**
 * Agents in relay order: `order` first (unknown ids dropped), then the rest in the order they
 * first show up in the run (as a task's actor or a handoff target), then agents with no tasks.
 */
export function relayOrder(snap: Pick<AgentSnapshot, "actors" | "tasks">, order: string[] = []): string[] {
  const agents = new Set(snap.actors.filter((a) => a.type === "agent").map((a) => a.id));
  const out: string[] = [];
  const add = (id: string | undefined) => {
    if (id && agents.has(id) && !out.includes(id)) out.push(id);
  };
  order.forEach(add);
  for (const t of [...snap.tasks].sort((a, b) => a.startedAt - b.startedAt)) {
    add(t.actor);
    add(t.handoffTo);
  }
  agents.forEach(add);
  return out;
}

/**
 * Handoffs from the run: every ended task with a `handoffTo`, newest first. Items come from the
 * task's `handoffItems`, unless `itemsFor` returns a list for that task.
 */
export function handoffsFromRun(tasks: Task[], itemsFor?: (task: Task) => HandoffItem[] | undefined): Handoff[] {
  return tasks
    .filter((t) => t.handoffTo && t.outcome)
    .map((t) => ({
      id: t.id,
      from: t.actor,
      to: t.handoffTo!,
      title: t.title,
      summary: t.summary,
      at: t.endedAt ?? t.startedAt,
      items: itemsFor?.(t) ?? t.handoffItems ?? [],
      task: t.id,
    }))
    .sort((a, b) => b.at - a.at);
}

/** Applies local reassignments and restored items on top of the source handoffs. */
export function applyEdits(list: Handoff[], assigned: Record<string, string>, restored: Set<string>): Handoff[] {
  return list.map((h) => {
    const to = assigned[h.id] ?? h.to;
    const items = h.items.some((i) => i.lost && restored.has(itemKey(h.id, i.id)))
      ? h.items.map((i) => (i.lost && restored.has(itemKey(h.id, i.id)) ? { ...i, lost: undefined } : i))
      : h.items;
    return to === h.to && items === h.items ? h : { ...h, to, items };
  });
}

export const itemKey = (handoff: string, item: string) => `${handoff}\u0000${item}`;

/** Status of an agent's column from its tasks and state. */
export function relayStatus(snap: Pick<AgentSnapshot, "actors" | "tasks" | "approvals">, agent: string): RelayStatus {
  const actor = snap.actors.find((a) => a.id === agent);
  if (actor?.state === "blocked" || actor?.state === "failed") return "warning";
  if (snap.approvals.some((a) => a.actor === agent && !a.decision)) return "warning";
  const mine = snap.tasks.filter((t) => t.actor === agent);
  if (mine.some((t) => !t.outcome)) return "working";
  if (!mine.length) return actor?.state === "busy" ? "working" : "todo";
  const last = mine.reduce((a, b) => ((b.endedAt ?? b.startedAt) > (a.endedAt ?? a.startedAt) ? b : a));
  return last.outcome === "failure" ? "warning" : "done";
}

/** The agent that gets "Up next": the first one still to do after the last one that has started. */
export function upNext(order: string[], status: Record<string, RelayStatus>): string | undefined {
  let lastStarted = -1;
  order.forEach((id, i) => {
    if (status[id] !== "todo") lastStarted = i;
  });
  return order.slice(lastStarted + 1).find((id) => status[id] === "todo");
}

/** Agents a handoff can be moved to: only later in the relay than its current target. */
export function forwardTargets(order: string[], to: string): string[] {
  const i = order.indexOf(to);
  return i < 0 ? [] : order.slice(i + 1);
}

/**
 * Keyboard pick-up: the next target from `current` in direction `dir`, over [to, ...forward].
 * Index 0 is "stay where it is". Stops at the ends.
 */
export function stepTarget(order: string[], to: string, current: string, dir: 1 | -1): string {
  const options = [to, ...forwardTargets(order, to)];
  const i = Math.max(0, options.indexOf(current));
  return options[Math.min(options.length - 1, Math.max(0, i + dir))];
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Which column the pointer is over (works side by side and stacked). -1 when over none. */
export function columnAt(rects: Box[], x: number, y: number): number {
  return rects.findIndex((r) => x >= r.left && x < r.left + r.width && y >= r.top && y < r.top + r.height);
}

/** Ids in `next` that weren't in `seen`: handoffs that just arrived. */
export function arrivals(seen: Set<string>, next: Handoff[]): string[] {
  return next.filter((h) => !seen.has(h.id)).map((h) => h.id);
}

/** "just now", "45s ago", "3m ago", "2h ago". */
export function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

/* ── Lanes, per-handoff state and connectors ── */

/**
 * Lane a handoff sits in. Lanes join neighbours in the relay (lane i = order[i] → order[i+1]);
 * a handoff goes in the lane that ends at its receiver, or lane 0 if it goes to the first agent.
 * -1 when the receiver isn't in the relay or there's no lane at all.
 */
export function laneIndex(order: string[], h: Pick<Handoff, "to">): number {
  if (order.length < 2) return -1;
  const i = order.indexOf(h.to);
  return i < 0 ? -1 : Math.max(0, i - 1);
}

export type HandoffState = "queued" | "working" | "done" | "warning";

/** The receiver's first task started at or after the handoff: the work it led to. */
export function followUp(h: Pick<Handoff, "to" | "at">, tasks: Task[]): Task | undefined {
  return tasks.filter((t) => t.actor === h.to && t.startedAt >= h.at).sort((a, b) => a.startedAt - b.startedAt)[0];
}

/**
 * Where a handoff stands: being worked on by its receiver, finished ("Looks good"), something to
 * check (the follow-up failed, or context was lost), or still waiting to be picked up.
 */
export function handoffState(h: Handoff, tasks: Task[]): HandoffState {
  const t = followUp(h, tasks);
  if (t && !t.outcome) return "working";
  if (t?.outcome === "failure" || h.items.some((i) => i.lost)) return "warning";
  if (t) return "done";
  return "queued";
}

/** Handoffs an agent hasn't picked up yet, oldest first. */
export function queued(agent: string, list: Handoff[], tasks: Task[]): Handoff[] {
  return list.filter((h) => h.to === agent && !followUp(h, tasks)).sort((a, b) => a.at - b.at);
}

/**
 * Connector from an agent's dot (a) down to a lane's dot (b): down to `midY`, across, down.
 * Corners are rounded with radius r (smaller when the turn is tight). Straight when aligned.
 */
export function connectorPath(a: Pt, b: Pt, midY: number, r = 10): string {
  if (Math.abs(a.x - b.x) < 0.5) return `M${a.x},${a.y} L${b.x},${b.y}`;
  const dir = Math.sign(b.x - a.x);
  const rr = Math.max(0, Math.min(r, Math.abs(b.x - a.x) / 2, midY - a.y, b.y - midY));
  return [
    `M${a.x},${a.y}`,
    `L${a.x},${midY - rr}`,
    `Q${a.x},${midY} ${a.x + dir * rr},${midY}`,
    `L${b.x - dir * rr},${midY}`,
    `Q${b.x},${midY} ${b.x},${midY + rr}`,
    `L${b.x},${b.y}`,
  ].join(" ");
}

export type Pt = { x: number; y: number };

/** The tool an agent used most during a time window (from its spans), for the card's logo. */
export function toolFor(snap: Pick<AgentSnapshot, "actors" | "spans">, agent: string, from: number, to = Infinity): string | undefined {
  const tools = new Set(snap.actors.filter((a) => a.type === "tool").map((a) => a.id));
  const count = new Map<string, number>();
  for (const s of snap.spans) if (s.from === agent && tools.has(s.to) && s.startedAt >= from && s.startedAt <= to) count.set(s.to, (count.get(s.to) ?? 0) + 1);
  let best: string | undefined;
  let n = 0;
  for (const [id, c] of count) if (c > n) [best, n] = [id, c];
  return best;
}
