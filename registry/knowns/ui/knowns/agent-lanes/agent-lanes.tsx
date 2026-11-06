"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Actor, Approval, ApprovalDecision, Span, Task } from "@/registry/knowns/lib/knowns/types";
import { useAgentSnapshot, type AgentRun } from "@/registry/knowns/lib/knowns/run";
import { actorColors, rootAgent } from "@/registry/knowns/lib/knowns/status";
import { actorIcon } from "@/registry/knowns/lib/knowns/icons/actor-icon";
import { Button } from "../button";

export interface AgentLanesProps {
  /** Read actors, tasks, spans and approvals from a run; decisions are emitted back to it. */
  run?: AgentRun;
  actors?: Actor[];
  tasks?: Task[];
  /** Used to show which tools a task touched. */
  spans?: Span[];
  approvals?: Approval[];
  /** Visible time range in ms, ending now. Default 10 minutes. */
  window?: number;
  selectedTaskId?: string | null;
  onTaskSelect?: (task: Task) => void;
  /** Called when a waiting task is approved or denied from its popover. */
  onDecision?: (approval: Approval, decision: ApprovalDecision) => void;
  /** Header title, or false to hide the header. */
  header?: string | false;
  className?: string;
}

const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const BLOCK_H = 30;
const GAP = 6;
const PAD = 7;
const AXIS_H = 30;
const END_PAD = 16;

type Status = "running" | "waiting" | "done" | "failed";

function fmtDur(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 && m < 10 ? `${m}m ${s % 60}s` : `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Tick label: whole minutes when the step allows it, seconds otherwise (never two "−1m"). */
const fmtBack = (ms: number, step: number) => (step % 60000 === 0 ? `−${ms / 60000}m` : `−${Math.round(ms / 1000)}s`);
const fmtRange = (ms: number) => (ms % 60000 === 0 ? `${ms / 60000}m` : `${Math.round(ms / 1000)}s`);

/** Overlapping tasks of one lane go to separate rows (greedy interval packing). */
function pack(tasks: Task[], now: number) {
  const ends: number[] = [];
  const at = new Map<string, number>();
  for (const t of [...tasks].sort((a, b) => a.startedAt - b.startedAt)) {
    const end = t.endedAt ?? now;
    let i = ends.findIndex((e) => e <= t.startedAt);
    if (i === -1) i = ends.push(end) - 1;
    else ends[i] = end;
    at.set(t.id, i);
  }
  return { at, rows: Math.max(1, ends.length) };
}

/** Orthogonal dotted hand-off line from the end of one task to the start of another. */
function handoffPath(x1: number, y1: number, x2: number, y2: number) {
  const xm = x2 - x1 > 20 ? x2 - 10 : x1 + 10;
  const r = Math.min(6, Math.abs(y2 - y1) / 2, Math.abs(xm - x1));
  const dy = Math.sign(y2 - y1);
  return `M${x1},${y1} H${xm - r} Q${xm},${y1} ${xm},${y1 + dy * r} V${y2 - dy * r} Q${xm},${y2} ${xm + (x2 >= xm ? r : -r)},${y2} H${x2}`;
}

/**
 * Where every agent is right now: one lane per agent, one block per task, running tasks
 * growing into "now", hand-offs drawn between lanes and approvals right on the block.
 */
export function AgentLanes({
  run,
  actors: actorsProp,
  tasks: tasksProp,
  spans: spansProp,
  approvals: approvalsProp,
  window: range = 600000,
  selectedTaskId,
  onTaskSelect,
  onDecision,
  header = "Agents",
  className,
}: AgentLanesProps) {
  const snap = useAgentSnapshot(run);
  const actors = snap?.actors ?? actorsProp ?? [];
  const tasks = snap?.tasks ?? tasksProp ?? [];
  const spans = snap?.spans ?? spansProp ?? [];
  const approvals = snap?.approvals ?? approvalsProp ?? [];

  /* Track width */
  const axisRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(0);
  useLayoutEffect(() => {
    const el = axisRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTrackW(Math.max(0, e.contentRect.width - END_PAD)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /*
   * Motion: blocks sit on one strip laid out against a fixed origin; each frame the strip
   * slides left with a GPU transform (no React render). Running blocks reach past "now" and
   * are clipped there, so they grow smoothly. React re-renders on new data and once a second.
   * Time stands still while the pointer or focus is inside, or a popover is open.
   */
  const origin = useRef(Date.now());
  const frozenAt = useRef<number | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);
  const pxPerMs = trackW > 0 ? trackW / range : 0;
  const shiftAt = (t: number) => trackW - (t - origin.current) * pxPerMs;

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (frozenAt.current === null && stripRef.current) {
        stripRef.current.style.transform = `translate3d(${trackW - (Date.now() - origin.current) * pxPerMs}px,0,0)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const iv = setInterval(() => frozenAt.current === null && setTick((x) => (x + 1) % 1e9), 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(iv);
    };
  }, [trackW, pxPerMs]);

  const [open, setOpen] = useState<{ id: string; x: number; y: number; below: boolean } | null>(null);
  const hovering = useRef(false);
  const freeze = () => {
    if (frozenAt.current === null) frozenAt.current = Date.now();
  };
  const thaw = () => {
    if (open) return;
    frozenAt.current = null;
    setTick((x) => (x + 1) % 1e9);
  };

  const now = frozenAt.current ?? Date.now();
  const t0 = now - range;

  const colors = useMemo(() => actorColors(actors), [actors]);
  const root = rootAgent(actors);
  const byId = useMemo(() => new Map(actors.map((a) => [a.id, a])), [actors]);
  const pendingByTask = useMemo(() => {
    const m = new Map<string, Approval>();
    for (const a of approvals) if (!a.decision && a.task) m.set(a.task, a);
    return m;
  }, [approvals]);
  const statusOf = (t: Task): Status =>
    t.outcome === "failure" ? "failed" : t.outcome ? "done" : pendingByTask.has(t.id) ? "waiting" : "running";

  /* Lanes: every agent, root first. */
  const lanes = useMemo(() => {
    const agents = [root, ...actors.filter((a) => a !== root)].filter((a): a is Actor => !!a && a.type === "agent");
    let top = 0;
    return agents.map((a) => {
      const mine = tasks.filter((t) => t.actor === a.id && (t.endedAt ?? now) >= t0);
      const { at, rows } = pack(mine, now);
      const h = rows * (BLOCK_H + GAP) - GAP + PAD * 2;
      const lane = { actor: a, tasks: mine, at, top, h };
      top += h;
      return lane;
    });
  }, [actors, tasks, root, now, t0]);
  const bodyH = lanes.reduce((n, l) => n + l.h, 0);

  const where = new Map<string, { y: number }>();
  for (const l of lanes) for (const t of l.tasks) where.set(t.id, { y: l.top + PAD + (l.at.get(t.id) ?? 0) * (BLOCK_H + GAP) });

  const all = lanes.flatMap((l) => l.tasks);
  const running = all.filter((t) => statusOf(t) === "running").length;
  const waiting = all.filter((t) => statusOf(t) === "waiting").length;

  // Ticks counted back from now, round values, at most ~6.
  const maxTicks = trackW < 360 ? 3 : 6;
  const step =
    [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600].map((s) => s * 1000).find((s) => range / s <= maxTicks) ?? range;
  const ticks: number[] = [];
  for (let back = step; back < range; back += step) ticks.push(back);

  const toolsOf = (t: Task) => {
    const end = t.endedAt ?? now;
    const ids: string[] = [];
    for (const s of spans) {
      if (s.from !== t.actor || s.startedAt < t.startedAt || s.startedAt > end) continue;
      if (byId.get(s.to)?.type === "tool" && !ids.includes(s.to)) ids.push(s.to);
    }
    return ids;
  };
  const callsIn = (t: Task) =>
    spans.filter((s) => s.from === t.actor && s.startedAt >= t.startedAt && s.startedAt <= (t.endedAt ?? now)).length;

  /* Popover */
  const openTask = (t: Task, el: HTMLElement) => {
    const body = bodyRef.current?.getBoundingClientRect();
    const clip = el.parentElement?.parentElement?.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    if (!body) return;
    const left = Math.max(box.left, clip?.left ?? box.left);
    const right = Math.min(box.right, clip?.right ?? box.right);
    const half = 150;
    const x = Math.min(Math.max((left + right) / 2 - body.left, half + 8), body.width - half - 8);
    const below = box.top - body.top < 220;
    freeze();
    setOpen({ id: t.id, x, y: below ? box.bottom - body.top + 8 : box.top - body.top - 8, below });
    onTaskSelect?.(t);
  };
  const close = () => {
    setOpen(null);
    if (!hovering.current) {
      frozenAt.current = null;
      setTick((x) => (x + 1) % 1e9);
    }
  };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.("[data-lanes-popover],[data-lanes-block]")) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        document.querySelector<HTMLElement>(`[data-lanes-block="${open.id}"]`)?.focus();
        close();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const decide = (a: Approval, d: ApprovalDecision) => {
    run?.emit({ type: "approval.resolve", id: a.id, decision: d });
    onDecision?.(a, d);
    close();
  };

  const openT = open ? tasks.find((t) => t.id === open.id) : undefined;

  const avatar = (a: Actor, size: string) => (
    <span
      aria-hidden="true"
      style={{ ["--hue" as string]: colors.get(a.id) ?? "var(--muted-foreground)" }}
      className={cn("grid flex-none place-items-center rounded-lg border bg-muted/40 text-[11px] font-semibold text-[var(--hue)]", size)}
    >
      <span className="grid size-[62%] place-items-center [&>svg]:size-full">{actorIcon(a, a === root)}</span>
    </span>
  );

  return (
    <section
      aria-label={typeof header === "string" ? header : "Agent lanes"}
      onPointerEnter={() => {
        hovering.current = true;
        freeze();
      }}
      onPointerLeave={() => {
        hovering.current = false;
        thaw();
      }}
      onFocus={freeze}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node) && !hovering.current) thaw();
      }}
      // Not overflow-hidden: the task popover may extend past the card. The strip clips itself.
      className={cn("@container rounded-2xl border bg-card text-[13px] text-card-foreground shadow-xs", className)}
    >
      {header !== false && (
        <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
          <div className="font-semibold">{header}</div>
          <div aria-live="polite" className="flex items-center gap-3 text-xs text-muted-foreground">
            {running > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-indigo-500" />
                {running} running
              </span>
            )}
            {waiting > 0 && (
              <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <span className="size-1.5 rounded-full bg-amber-500" />
                {waiting} {waiting === 1 ? "needs" : "need"} you
              </span>
            )}
          </div>
          <div className="ml-auto rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
            Last {fmtRange(range)}
          </div>
        </div>
      )}

      <div ref={bodyRef} className="relative px-1 pb-2 [--label-w:3.5rem] @[520px]:[--label-w:12.5rem]">
        {/* Axis */}
        <div className="flex" style={{ height: AXIS_H }}>
          <div className="w-(--label-w) flex-none" />
          <div ref={axisRef} className="relative flex-1">
            {ticks.map((back) => {
              const left = trackW - back * pxPerMs;
              return left > 24 ? (
                <span key={back} style={{ left }} className="absolute top-2 -translate-x-1/2 text-[11px] tabular-nums text-muted-foreground">
                  {fmtBack(back, step)}
                </span>
              ) : null;
            })}
            <span
              style={{ left: trackW }}
              className="absolute top-1.5 -translate-x-1/2 rounded bg-indigo-500/12 px-1.5 py-px text-[10.5px] font-medium text-indigo-600 dark:text-indigo-300"
            >
              now
            </span>
          </div>
        </div>

        <div className="relative" style={{ height: bodyH }}>
          {/* Static: lane labels, faint tick lines, the "now" line */}
          {lanes.map(({ actor, tasks: mine, top, h }) => {
            const busy = mine.some((t) => statusOf(t) === "running");
            const blocked = mine.some((t) => statusOf(t) === "waiting");
            // Last finished task (not only the visible window): Done / Failed after work, Idle before any.
            const last = tasks.filter((t) => t.actor === actor.id && t.outcome).reduce<Task | undefined>((m, t) => (!m || (t.endedAt ?? 0) >= (m.endedAt ?? 0) ? t : m), undefined);
            return (
              <div key={actor.id} style={{ top, height: h }} className="absolute left-0 flex w-(--label-w) items-center gap-2.5 px-3">
                {avatar(actor, "size-7")}
                <div className="hidden min-w-0 flex-1 @[520px]:block">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium leading-tight">{actor.label}</span>
                    {blocked ? (
                      <span className="flex-none rounded bg-amber-500/12 px-1.5 text-[10.5px] font-medium leading-[18px] text-amber-700 dark:text-amber-300">
                        Needs you
                      </span>
                    ) : (
                      !busy &&
                      (last?.outcome === "success" ? (
                        <span className="inline-flex flex-none items-center gap-0.5 rounded bg-emerald-500/10 pr-1.5 pl-1 text-[10.5px] font-medium leading-[18px] text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300">
                          <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 8.5l2.5 2.5L12 5.5" />
                          </svg>
                          Done
                        </span>
                      ) : last?.outcome === "failure" ? (
                        <span className="flex-none rounded bg-red-500/10 px-1.5 text-[10.5px] font-medium leading-[18px] text-red-700 dark:bg-red-400/15 dark:text-red-300">Failed</span>
                      ) : (
                        <span className="flex-none rounded bg-muted px-1.5 text-[10.5px] leading-[18px] text-muted-foreground">Idle</span>
                      ))
                    )}
                  </div>
                  {actor.model && <div className="truncate text-[11.5px] leading-tight text-muted-foreground">{actor.model}</div>}
                </div>
              </div>
            );
          })}
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-(--label-w) right-0">
            {ticks.map((back) => (
              <span
                key={back}
                style={{ left: trackW - back * pxPerMs }}
                className="absolute inset-y-0 w-px bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)]"
              />
            ))}
            <span style={{ left: trackW }} className="absolute inset-y-0 w-px bg-indigo-500/35" />
          </div>

          {/* Moving: blocks and hand-offs, clipped at "now" */}
          <div className="absolute inset-y-0 left-(--label-w) overflow-hidden" style={{ width: trackW }}>
            <div
              ref={stripRef}
              className="absolute inset-y-0 left-0 will-change-transform"
              style={{ transform: `translate3d(${shiftAt(now)}px,0,0)` }}
            >
              <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height={bodyH}>
                {all.map((t) => {
                  if (!t.handoffTo || !t.endedAt) return null;
                  const end = t.endedAt;
                  const next = tasks
                    .filter((n) => n.actor === t.handoffTo && n.startedAt >= end - 1500)
                    .sort((a, b) => a.startedAt - b.startedAt)[0];
                  const a = where.get(t.id);
                  const b = next && where.get(next.id);
                  if (!a || !b || !next) return null;
                  const x1 = (end - origin.current) * pxPerMs;
                  const x2 = (next.startedAt - origin.current) * pxPerMs;
                  return (
                    <path
                      key={t.id}
                      d={handoffPath(x1, a.y + BLOCK_H / 2, Math.max(x2, x1 + 2), b.y + BLOCK_H / 2)}
                      fill="none"
                      strokeWidth={1.25}
                      strokeDasharray="2 3"
                      strokeLinecap="round"
                      style={{ stroke: `color-mix(in srgb, ${colors.get(t.actor) ?? "currentColor"} 70%, transparent)` }}
                    />
                  );
                })}
              </svg>

              {lanes.map(({ actor, tasks: mine }) =>
                mine.map((t) => {
                  const st = statusOf(t);
                  const live = st === "running" || st === "waiting";
                  const left = (t.startedAt - origin.current) * pxPerMs;
                  const shown = (Math.min(t.endedAt ?? now, now) - Math.max(t.startedAt, t0)) * pxPerMs;
                  // Live blocks reach 2.5s past "now" (React re-renders every second, so the end never
                  // shows before the line) and are clipped there; their centre stays clickable.
                  const width = live ? Math.max(6, (now - t.startedAt + 2500) * pxPerMs) : Math.max(6, ((t.endedAt ?? now) - t.startedAt) * pxPerMs);
                  const tools = toolsOf(t);
                  const selected = selectedTaskId === t.id || open?.id === t.id;
                  const dur = fmtDur((t.endedAt ?? now) - t.startedAt);
                  const label = `${actor.label}: ${t.title} – ${
                    st === "done" ? `Done, took ${dur}` : st === "failed" ? `Failed after ${dur}` : st === "waiting" ? `Needs you, ${dur}` : `Running, ${dur}`
                  }`;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      data-lanes-block={t.id}
                      aria-label={label}
                      aria-haspopup="dialog"
                      aria-expanded={open?.id === t.id}
                      onClick={(e) => (open?.id === t.id ? close() : openTask(t, e.currentTarget))}
                      style={{ left, width, top: where.get(t.id)!.y, height: BLOCK_H, ["--hue" as string]: colors.get(actor.id) ?? "#6366f1" }}
                      className={cn(
                        "absolute flex cursor-pointer items-center gap-1.5 overflow-hidden rounded-[9px] border px-2 text-left text-[12.5px] font-medium whitespace-nowrap transition-[filter,box-shadow] hover:brightness-[1.04] dark:hover:brightness-125",
                        "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--hue)]",
                        st === "done" && "border-transparent bg-[color-mix(in_srgb,var(--foreground)_6%,var(--card))] text-muted-foreground",
                        st === "running" && "[border-color:color-mix(in_srgb,var(--hue)_40%,transparent)] bg-[color-mix(in_srgb,var(--hue)_13%,var(--card))] text-foreground",
                        st === "waiting" && "border-amber-500/40 bg-[color-mix(in_srgb,#f59e0b_11%,var(--card))] text-foreground",
                        st === "failed" && "border-red-500/25 bg-[color-mix(in_srgb,#ef4444_9%,var(--card))] text-red-700 dark:text-red-300",
                        selected && "shadow-[0_0_0_2px_var(--card),0_0_0_3.5px_var(--hue)]",
                      )}
                    >
                      {/* A waiting block keeps its icons clear of the "Needs you" tag drawn over its live end. */}
                      {shown > (st === "waiting" ? 140 : 34) && (
                        <span aria-hidden="true" className="flex flex-none items-center">
                          {st === "failed" ? (
                            <svg viewBox="0 0 16 16" className="size-3.5">
                              <circle cx="8" cy="8" r="7" fill="currentColor" opacity=".18" />
                              <path d="M8 4.5v4.2M8 11.2v.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                          ) : (
                            tools.slice(0, shown > 140 ? 3 : 1).map((id) => (
                              <span key={id} className="-mr-0.5 grid size-4 place-items-center rounded-[4px] bg-card text-[9px] ring-1 ring-card [&>svg]:size-3">
                                {byId.get(id) ? actorIcon(byId.get(id)!) : null}
                              </span>
                            ))
                          )}
                        </span>
                      )}
                      {shown > 56 && (
                        <span
                          className="min-w-0 flex-1 truncate"
                          style={live ? { maxWidth: Math.max(0, shown - (st === "waiting" ? 118 : 22) - (shown > 34 ? 22 : 0)), flex: "none" } : undefined}
                        >
                          {t.title}
                        </span>
                      )}
                    </button>
                  );
                }),
              )}
            </div>
          </div>

          {/* Static, at "now": a bright head on running blocks, "Needs you" on waiting ones */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-(--label-w) right-0">
            {all.map((t) => {
              const st = statusOf(t);
              if (st !== "running" && st !== "waiting") return null;
              const y = where.get(t.id)!.y;
              const hue = colors.get(t.actor) ?? "#6366f1";
              return st === "running" ? (
                <span
                  key={t.id}
                  style={{ left: trackW - 3, top: y + 6, height: BLOCK_H - 12, background: hue, boxShadow: `0 0 10px ${hue}` }}
                  className="absolute w-[3px] rounded-full"
                />
              ) : (
                <span
                  key={t.id}
                  style={{ left: trackW - 6, top: y + 5, height: BLOCK_H - 10 }}
                  className="absolute inline-flex -translate-x-full items-center gap-1 whitespace-nowrap rounded-md bg-amber-500/15 px-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"
                >
                  <svg viewBox="0 0 16 16" className="size-3">
                    <path d="M8 2l6.5 11.5h-13z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                    <path d="M8 6.5v3M8 11.6v.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  Needs you
                </span>
              );
            })}
          </div>
        </div>

        {lanes.length === 0 && <div className="px-4 py-8 text-center text-muted-foreground">No agents yet.</div>}

        {/* Task popover */}
        {open &&
          openT &&
          (() => {
            const st = statusOf(openT);
            const actor = byId.get(openT.actor);
            const approval = pendingByTask.get(openT.id);
            const tools = toolsOf(openT);
            const handoff = openT.handoffTo ? byId.get(openT.handoffTo) : undefined;
            return (
              <div
                data-lanes-popover
                role="dialog"
                aria-label={openT.title}
                style={{ left: open.x, top: open.y }}
                className={cn(
                  "absolute z-30 w-[300px] -translate-x-1/2 rounded-xl border bg-popover p-3.5 text-popover-foreground shadow-xl",
                  !open.below && "-translate-y-full",
                )}
              >
                <div className="flex items-start gap-2.5">
                  {actor && avatar(actor, "size-8")}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold">{openT.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {actor?.label} ·{" "}
                      <span
                        className={cn(
                          st === "running" && "text-indigo-600 dark:text-indigo-400",
                          st === "waiting" && "text-amber-700 dark:text-amber-400",
                          st === "failed" && "text-red-600 dark:text-red-400",
                          st === "done" && "text-emerald-700 dark:text-emerald-400",
                        )}
                      >
                        {st === "running" ? "Running" : st === "waiting" ? "Needs you" : st === "failed" ? "Failed" : "Done"}
                      </span>{" "}
                      · {fmtDur((openT.endedAt ?? now) - openT.startedAt)}
                    </div>
                  </div>
                </div>

                {approval ? (
                  <>
                    <p className="mt-3 text-[13px] font-medium">{approval.title}</p>
                    {approval.detail && (
                      <pre className="mt-2 max-h-32 overflow-auto rounded-lg border bg-muted/40 px-2.5 py-2 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap">
                        {approval.detail}
                      </pre>
                    )}
                    <div className="mt-3 flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => decide(approval, "denied")}>
                        Deny
                      </Button>
                      <Button size="sm" autoFocus onClick={() => decide(approval, "approved")}>
                        Approve
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    {openT.summary && <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{openT.summary}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-2.5 text-xs text-muted-foreground">
                      <span className="tabular-nums">{callsIn(openT)} tool calls</span>
                      {tools.length > 0 && (
                        <span className="flex items-center gap-1">
                          {tools.slice(0, 5).map((id) => (
                            <span key={id} title={byId.get(id)?.label} className="grid size-4 place-items-center [&>svg]:size-full">
                              {byId.get(id) ? actorIcon(byId.get(id)!) : null}
                            </span>
                          ))}
                        </span>
                      )}
                      {handoff && (
                        <span className="ml-auto">
                          Handed to <span className="font-medium text-foreground">{handoff.label}</span>
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
      </div>
    </section>
  );
}

export default AgentLanes;
