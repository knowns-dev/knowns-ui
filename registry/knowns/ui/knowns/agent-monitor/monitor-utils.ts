/** @registry part-of="agent-monitor" */
import type { AgentSnapshot, Span, Task } from "@/registry/knowns/lib/knowns/types";

/** running · paused · waiting (needs you) · finished · failed · idle (nothing to do yet). */
export type MonitorState = "idle" | "running" | "paused" | "waiting" | "finished" | "failed";
export type StepState = "queued" | "running" | "done" | "failed";

/** A step as the utils see it (the component adds `icon`). */
export interface StepLike {
  id: string;
  label: string;
  /** Tool name, e.g. "GitHub"; picks the logo. */
  tool?: string;
  kind?: string;
  state: StepState;
  /** Epoch ms the step started. */
  since?: number;
  /** How long it took, ms (finished steps). */
  took?: number;
  detail?: string;
  output?: string;
}

export const STATE_LABEL: Record<MonitorState, string> = {
  idle: "Idle",
  running: "Running",
  paused: "Paused",
  waiting: "Needs you",
  finished: "Finished",
  failed: "Failed",
};

/** The clock keeps ticking in these states. */
export const isLive = (s: MonitorState) => s === "running" || s === "waiting";

/** "0:05", "12:40", "1:02:03". */
export function formatClock(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** "0.4s", "2.3s", "41s", "1m 5s", "1h 2m". */
export function formatTook(ms: number) {
  const s = Math.max(0, ms) / 1000;
  if (s < 10) return `${(Math.round(s * 10) / 10).toFixed(1)}s`;
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${Math.round(s % 60)}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** How long a step has taken so far: `took` when finished, else now − since. */
export function stepDuration(step: StepLike, now: number) {
  if (step.took !== undefined) return Math.max(0, step.took);
  if (step.state === "running" && step.since !== undefined) return Math.max(0, now - step.since);
  return 0;
}

/** Time on the clock: (until ?? now) − since − pausedFor. */
export function elapsed(since: number | undefined, now: number, until?: number, pausedFor = 0) {
  if (since === undefined) return 0;
  return Math.max(0, (until ?? now) - since - pausedFor);
}

/** "4/6": steps started (done, failed or running) out of all steps. */
export function stepCount(steps: StepLike[]) {
  const started = steps.filter((s) => s.state !== "queued").length;
  return steps.length ? `${started}/${steps.length}` : "";
}

/** Finished steps, newest first (what the rows list). */
export const finishedSteps = <T extends StepLike>(steps: T[]) => steps.filter((s) => s.state === "done" || s.state === "failed").reverse();

export type BarTone = "done" | "failed" | "running" | "waiting" | "paused";
export interface StripBar {
  id: string;
  /** Step this bar belongs to; undefined for the wait bar. */
  step?: string;
  tone: BarTone;
  ms: number;
  /** Left edge and width as fractions of the strip (gaps already taken out). */
  left: number;
  width: number;
}

/**
 * The time strip: one bar per finished step (width ∝ duration), then the running step, then a wait bar
 * while the agent waits on you (or the open step turns amber, when there is one). Bars fill the whole strip; each gets at least `minShare` of it so short
 * steps stay visible. `gap` is the space between bars as a fraction of the strip.
 */
export function stripBars(
  steps: StepLike[],
  now: number,
  opts: { state?: MonitorState; waitSince?: number; gap?: number; minShare?: number } = {},
): StripBar[] {
  const { state = "running", waitSince, gap = 0, minShare = 0.03 } = opts;
  const raw: Omit<StripBar, "left" | "width">[] = [];
  for (const s of steps) {
    if (s.state === "queued") continue;
    // A step left open while the agent waits on you is the wait itself: it turns amber.
    const tone: BarTone = s.state === "running" ? (state === "paused" ? "paused" : state === "waiting" ? "waiting" : "running") : s.state === "failed" ? "failed" : "done";
    raw.push({ id: s.id, step: s.id, tone, ms: stepDuration(s, now) });
  }
  if (state === "waiting" && waitSince !== undefined && !raw.some((b) => b.tone === "waiting")) raw.push({ id: "__wait", tone: "waiting", ms: Math.max(0, now - waitSince) });
  if (!raw.length) return [];

  const total = raw.reduce((t, b) => t + b.ms, 0);
  // Equal shares until any time has passed; then ∝ duration with a floor.
  const shares = raw.map((b) => (total > 0 ? Math.max(minShare, b.ms / total) : 1 / raw.length));
  const sum = shares.reduce((a, b) => a + b, 0);
  const room = Math.max(0, 1 - gap * (raw.length - 1));
  let left = 0;
  return raw.map((b, i) => {
    const width = (shares[i] / sum) * room;
    const bar = { ...b, left, width };
    left += width + gap;
    return bar;
  });
}

/** "+128 −14 · 6 files · Tagged v3.2.0" */
export function outcomeText(o: { added?: number; removed?: number; files?: number; note?: string }) {
  const parts: string[] = [];
  const lines = [o.added !== undefined && `+${o.added}`, o.removed !== undefined && `−${o.removed}`].filter(Boolean).join(" ");
  if (lines) parts.push(lines);
  if (o.files !== undefined) parts.push(`${o.files} ${o.files === 1 ? "file" : "files"}`);
  if (o.note) parts.push(o.note);
  return parts.join(" · ");
}

/** Whether Enter/Escape on this element should act as Allow/Decline (not on other controls). */
export function shortcutFor(key: string, targetTag: string, onCard: boolean): "allow" | "decline" | null {
  if (key === "Escape") return "decline";
  if (key !== "Enter") return null;
  if (onCard) return "allow";
  return /^(BUTTON|A|INPUT|TEXTAREA|SELECT|SUMMARY)$/.test(targetTag) ? null : "allow";
}

/* ---------- Live: derive the card from a run ---------- */

export interface RunMonitor {
  found: boolean;
  state: MonitorState;
  name: string;
  model?: string;
  role?: string;
  steps: StepLike[];
  /** The live line in the well: latest open tool call, else the running task. */
  current?: { label: string; tool?: string; since: number };
  since?: number;
  until?: number;
  spend?: number;
  ask?: { id: string; title: string; command?: string; since: number };
  /** Tools this actor called, first use first. */
  tools: string[];
}

const str = (v: unknown) => (v === undefined ? undefined : typeof v === "string" ? v : JSON.stringify(v, null, 2));

/**
 * One agent's card from a run: its tasks become steps (the tool it called most in each gives the logo),
 * its open tool call is the current line, a pending approval is the ask, spend is the cost.
 */
export function monitorFromRun(snap: AgentSnapshot, actorId: string, maxSteps = 8): RunMonitor {
  const actor = snap.actors.find((a) => a.id === actorId);
  const toolLabel = new Map(snap.actors.filter((a) => a.type === "tool").map((a) => [a.id, a.label]));
  const calls: Span[] = snap.spans.filter((s) => s.from === actorId && toolLabel.has(s.to));
  const tasks: Task[] = snap.tasks.filter((t) => t.actor === actorId).slice(-maxSteps);

  const callsIn = (t: Task) => calls.filter((s) => s.startedAt >= t.startedAt && (t.endedAt === undefined || s.startedAt <= t.endedAt));
  const steps: StepLike[] = tasks.map((t) => {
    const cs = callsIn(t);
    const count = new Map<string, number>();
    for (const c of cs) count.set(c.to, (count.get(c.to) ?? 0) + 1);
    const top = [...count].sort((a, b) => b[1] - a[1])[0]?.[0];
    const summaries = [...new Set(cs.map((c) => `${toolLabel.get(c.to)}: ${c.summary ?? "call"}`))];
    return {
      id: t.id,
      label: t.title,
      tool: top ? toolLabel.get(top) : undefined,
      state: !t.outcome ? "running" : t.outcome === "failure" ? "failed" : "done",
      since: t.startedAt,
      took: t.endedAt !== undefined ? t.endedAt - t.startedAt : undefined,
      detail: summaries.length ? summaries.slice(-4).join("\n") + (summaries.length > 4 ? `\n+${summaries.length - 4} more` : "") : undefined,
      output: t.summary ?? str(cs.at(-1)?.output),
    };
  });

  const pending = snap.approvals.filter((a) => a.actor === actorId && !a.decision).at(-1);
  const openCall = calls.filter((s) => !s.outcome).at(-1);
  const runningTask = tasks.filter((t) => !t.outcome).at(-1);
  const lastTask = tasks.at(-1);

  let state: MonitorState;
  if (pending || actor?.state === "blocked") state = "waiting";
  else if (actor?.state === "failed") state = "failed";
  else if (runningTask || actor?.state === "busy") state = "running";
  else if (actor?.state === "finished" || lastTask) state = lastTask?.outcome === "failure" ? "failed" : "finished";
  else state = "idle";

  const tools: string[] = [];
  for (const c of calls) {
    const l = toolLabel.get(c.to)!;
    if (!tools.includes(l)) tools.push(l);
  }

  return {
    found: !!actor,
    state,
    name: actor?.label ?? actorId,
    model: actor?.model,
    role: actor?.activity ?? actor?.description,
    steps,
    current: openCall
      ? { label: openCall.summary ?? toolLabel.get(openCall.to)!, tool: toolLabel.get(openCall.to), since: openCall.startedAt }
      : runningTask
        ? { label: runningTask.title, since: runningTask.startedAt }
        : undefined,
    since: tasks[0]?.startedAt,
    until: !runningTask && lastTask?.endedAt !== undefined ? lastTask.endedAt : undefined,
    spend: actor?.spend,
    ask: pending ? { id: pending.id, title: pending.title, command: pending.detail, since: pending.requestedAt } : undefined,
    tools,
  };
}
