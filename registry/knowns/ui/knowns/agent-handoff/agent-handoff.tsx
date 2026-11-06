"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import type { AgentRun } from "@/registry/knowns/lib/knowns/run";
import { createPortal } from "react-dom";
import { useAgentSnapshot } from "@/registry/knowns/lib/knowns/run";
import type { Actor, Approval, Span, Task } from "@/registry/knowns/lib/knowns/types";
import { formatUsd } from "@/registry/knowns/lib/knowns/status";
import { actorIcon } from "@/registry/knowns/lib/knowns/icons/actor-icon";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Button } from "../button";
import { Spinner } from "../spinner";
import { Tooltip } from "../tooltip";
import {
  applyEdits,
  columnAt,
  connectorPath,
  forwardTargets,
  handoffState,
  handoffsFromRun,
  itemKey,
  laneIndex,
  queued,
  relayOrder,
  relayStatus,
  stepTarget,
  toolFor,
  type Box,
  type Handoff,
  type HandoffItem,
  type HandoffItemKind,
  type HandoffState,
  type RelayStatus,
} from "./handoff-map";

export type { Handoff, HandoffItem, HandoffItemKind, HandoffState, RelayStatus } from "./handoff-map";

export interface AgentHandoffProps {
  /** Read agents, tasks and tool calls from a run; ended tasks with `handoffTo` become handoffs. */
  run?: AgentRun;
  /** Plain data instead of a run. */
  actors?: Actor[];
  tasks?: Task[];
  approvals?: Approval[];
  spans?: Span[];
  /** Handoffs to show instead of the ones derived from tasks. You then own reassigning and restoring. */
  handoffs?: Handoff[];
  /** Context items for a task's handoff; overrides the task's own `handoffItems`. */
  items?: (task: Task) => HandoffItem[] | undefined;
  /** Relay order of agents; the rest follow in order of first appearance. */
  order?: string[];
  /** A handoff was dragged (or moved with the keyboard) onto a later agent. */
  onAssign?: (handoff: Handoff, agent: string) => void;
  /** "Add back" on a lost item. With a run, task.item.restore is emitted to it as well. */
  onRestore?: (handoff: Handoff, item: HandoffItem) => void;
  /** Enter on a handoff card. */
  onOpen?: (handoff: Handoff) => void;
  /** Short verb next to an agent's current task, e.g. "Drafting". Default "Working". */
  verb?: (agent: string, task: Task) => string | undefined;
  /** Max height of a lane before it scrolls (px). Default 300. */
  laneHeight?: number;
  /** Header title, or false (default) for none. */
  title?: ReactNode | false;
  className?: string;
  "aria-label"?: string;
}

const EASE = "ease-[cubic-bezier(.22,1,.36,1)]";
const HAIRLINE = "[border-color:color-mix(in_srgb,var(--foreground)_8%,transparent)]";

const PILL: Record<RelayStatus, { text: string; className: string }> = {
  working: { text: "Working", className: "bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300" },
  warning: { text: "Needs a look", className: "bg-amber-500/12 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300" },
  done: { text: "Done", className: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300" },
  todo: { text: "Idle", className: "bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] text-muted-foreground" },
};

const svg = { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const KIND: Record<HandoffItemKind, ReactNode> = {
  file: (
    <svg {...svg}>
      <path d="M9 2H4.75A1.25 1.25 0 0 0 3.5 3.25v9.5A1.25 1.25 0 0 0 4.75 14h6.5a1.25 1.25 0 0 0 1.25-1.25V5.5L9 2Z" />
      <path d="M9 2v3.5h3.5" />
    </svg>
  ),
  note: (
    <svg {...svg}>
      <path d="M3 3.5h10M3 6.5h10M3 9.5h6.5M3 12.5h4" />
    </svg>
  ),
  data: (
    <svg {...svg}>
      <ellipse cx="8" cy="4" rx="4.75" ry="1.75" />
      <path d="M3.25 4v8c0 .97 2.13 1.75 4.75 1.75s4.75-.78 4.75-1.75V4M3.25 8c0 .97 2.13 1.75 4.75 1.75s4.75-.78 4.75-1.75" />
    </svg>
  ),
  link: (
    <svg {...svg}>
      <path d="M6.75 9.25a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.6.6M9.25 6.75a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.6-.6" />
    </svg>
  ),
};
const Info = () => (
  <svg {...svg} className="size-3.5">
    <circle cx="8" cy="8" r="6" />
    <path d="M8 7.25V11M8 5v.01" />
  </svg>
);
const Arrow = () => (
  <svg {...svg} className="size-3.5 flex-none text-muted-foreground/70">
    <path d="M3 8h9.5M9 4.5 12.5 8 9 11.5" />
  </svg>
);
const Chevron = ({ open }: { open: boolean }) => (
  <svg {...svg} className={cn("size-3 flex-none transition-transform duration-200", EASE, open && "rotate-180")}>
    <path d="m4.5 6 3.5 3.5L11.5 6" />
  </svg>
);

const EMPTY_ACTORS: Actor[] = [];
const EMPTY_TASKS: Task[] = [];
const EMPTY_APPROVALS: Approval[] = [];
const EMPTY_SPANS: Span[] = [];

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** A logo in a small tile: agents and tools alike. */
function Logo({ actor, size = "md" }: { actor?: Actor; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid flex-none place-items-center bg-card shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_9%,transparent)] dark:[background:color-mix(in_srgb,var(--card)_70%,#000)] [&_svg]:size-full",
        size === "md" ? "size-9 rounded-[10px] [&>*]:size-[18px]" : "size-5 rounded-[6px] [&>*]:size-3",
      )}
    >
      {actor ? actorIcon(actor) : null}
    </span>
  );
}

/* ── Connectors ── */

type Wire = { key: string; d: string; agent: string; lane: number; side: "from" | "to" };

/** One connector. Draws itself in from the agent's dot (once, on mount) with a bright head. */
function WirePath({ d, delay, opacity, bright }: { d: string; delay: number; opacity: number; bright: boolean }) {
  const line = useRef<SVGPathElement>(null);
  const head = useRef<SVGPathElement>(null);
  useLayoutEffect(() => {
    const l = line.current;
    const h = head.current;
    if (!l || !h || reducedMotion() || typeof l.animate !== "function") return;
    const timing = { duration: 760, delay, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" as const };
    const a = l.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], timing);
    // The head is a short dash that rides the tip of the line as it draws.
    const b = h.animate(
      [
        { strokeDashoffset: 0.06, opacity: 1 },
        { strokeDashoffset: -0.88, opacity: 1, offset: 0.9 },
        { strokeDashoffset: -0.94, opacity: 0 },
      ],
      timing,
    );
    return () => {
      a.cancel();
      b.cancel();
    };
    // Only on mount: a resize changes `d`, not the drawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <g style={{ opacity }} className={cn("transition-opacity duration-300", EASE)}>
      <path
        ref={line}
        d={d}
        pathLength={1}
        strokeDasharray="1 1"
        className={cn("fill-none stroke-[var(--kn-line)] transition-[stroke-width] duration-300", bright ? "[stroke-width:2]" : "[stroke-width:1.5]")}
      />
      <path ref={head} d={d} pathLength={1} strokeDasharray="0.06 2" strokeDashoffset={2} className="fill-none stroke-[var(--kn-line-hot)] opacity-0 [stroke-linecap:round] [stroke-width:2.5]" />
    </g>
  );
}

/** A light that runs once along a connector, then removes itself. */
function StreakPath({ d, onDone }: { d: string; onDone: () => void }) {
  const ref = useRef<SVGPathElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== "function") return onDone();
    // Movement eases out; the fade runs on linear time so the light stays visible all the way.
    const duration = 1300;
    const move = el.animate([{ strokeDashoffset: 0.16 }, { strokeDashoffset: -1 }], { duration, easing: "cubic-bezier(.33,.9,.4,1)", fill: "forwards" });
    const fade = el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.82 }, { opacity: 0 }], { duration, easing: "linear", fill: "forwards" });
    move.onfinish = onDone;
    return () => {
      move.cancel();
      fade.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <path
      ref={ref}
      d={d}
      pathLength={1}
      strokeDasharray="0.16 2"
      strokeDashoffset={0.16}
      className="fill-none stroke-[var(--kn-line-hot)] opacity-0 [filter:drop-shadow(0_0_4px_var(--kn-line))] [stroke-linecap:round] [stroke-width:3]"
    />
  );
}

/* ── Lane ── */

/** Fades the bottom of a scrolling lane while there's more below. */
function useFade(dep: unknown) {
  const ref = useRef<HTMLUListElement>(null);
  const [fade, setFade] = useState(false);
  const check = useCallback(() => {
    const el = ref.current;
    setFade(!!el && el.scrollHeight - el.scrollTop - el.clientHeight > 2);
  }, []);
  useLayoutEffect(check, [check, dep]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [check]);
  return { ref, fade, onScroll: check };
}

function Lane({
  index,
  from,
  to,
  count,
  dim,
  maxHeight,
  dotRef,
  children,
}: {
  index: number;
  from: { name: string; actor?: Actor };
  to: { name: string; actor?: Actor };
  count: number;
  dim: boolean;
  maxHeight: number;
  dotRef: (side: "from" | "to", el: HTMLElement | null) => void;
  children: ReactNode;
}) {
  const fade = useFade(count);
  return (
    <div
      role="region"
      aria-label={`${from.name} to ${to.name}, ${count} ${count === 1 ? "handoff" : "handoffs"}`}
      style={{ "--c": `${2 * index + 2} / span 2` } as CSSProperties}
      className={cn(
        "relative flex min-w-0 flex-col self-start rounded-[16px] bg-[color-mix(in_srgb,var(--foreground)_3.5%,transparent)] p-1.5 [grid-column:var(--c)] [grid-row:2]",
        "@max-[759px]/relay:mb-3 @max-[759px]/relay:[grid-column:auto] @max-[759px]/relay:[grid-row:auto]",
        "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_5%,transparent)] dark:bg-[color-mix(in_srgb,#000_30%,transparent)]",
        "transition-opacity duration-300",
        EASE,
        dim && "opacity-60",
      )}
    >
      {(["from", "to"] as const).map((side) => (
        <span
          key={side}
          ref={(el) => dotRef(side, el)}
          aria-hidden="true"
          className={cn(
            "absolute -top-[5px] z-[2] size-2.5 -translate-x-1/2 rounded-full border-[1.5px] border-[var(--kn-line)] bg-card @max-[759px]/relay:hidden",
            side === "from" ? "left-[calc(50%-28px)]" : "left-[calc(50%+28px)]",
          )}
        />
      ))}
      <div className="flex min-w-0 items-center gap-2 px-2.5 pb-2 pt-1.5 text-[13px] text-muted-foreground">
        <Logo actor={from.actor} size="sm" />
        <span className="truncate">{from.name}</span>
        <Arrow />
        <Logo actor={to.actor} size="sm" />
        <span className="truncate">{to.name}</span>
        <span key={count} className="ml-auto pl-2 tabular-nums text-foreground/80 motion-safe:animate-[kn-rise_320ms_cubic-bezier(.22,1,.36,1)_both]">
          {count}
        </span>
      </div>
      {count ? (
        <ul
          ref={fade.ref}
          onScroll={fade.onScroll}
          style={{ maxHeight }}
          className={cn(
            "flex flex-col gap-1.5 overflow-y-auto overscroll-contain [scrollbar-width:thin]",
            fade.fade && "[mask-image:linear-gradient(to_bottom,#000_calc(100%-56px),transparent)]",
          )}
        >
          {children}
        </ul>
      ) : (
        <p className={cn("rounded-[12px] border border-dashed px-3 py-5 text-center text-[12.5px] text-muted-foreground", HAIRLINE)}>Nothing handed over yet</p>
      )}
    </div>
  );
}

type Drag = { id: string; x0: number; y0: number; dx: number; dy: number; active: boolean; over: number; rects: Box[]; box?: Box };

/**
 * A relay of agents: a card per agent (who, model, spend, status, what it's on), and between
 * each pair a lane of the handoffs that went from one to the next: what, the context passed
 * along (lost items struck through, with the reason and "Add back"), and where it stands.
 * Connectors run from each agent into its lanes; new handoffs send a light down them.
 * Drag a handoff onto a later agent to reassign it, or pick it up with Space.
 */
export function AgentHandoff({
  run,
  actors: actorsProp,
  tasks: tasksProp,
  approvals: approvalsProp,
  spans: spansProp,
  handoffs: handoffsProp,
  items,
  order: orderProp,
  onAssign,
  onRestore,
  onOpen,
  verb,
  laneHeight = 300,
  title = false,
  className,
  "aria-label": ariaLabel,
}: AgentHandoffProps) {
  const snap = useAgentSnapshot(run);
  const actors = snap?.actors ?? actorsProp ?? EMPTY_ACTORS;
  const tasks = snap?.tasks ?? tasksProp ?? EMPTY_TASKS;
  const approvals = snap?.approvals ?? approvalsProp ?? EMPTY_APPROVALS;
  const spans = snap?.spans ?? spansProp ?? EMPTY_SPANS;

  const order = useMemo(() => relayOrder({ actors, tasks }, orderProp), [actors, tasks, orderProp]);
  const byId = useMemo(() => new Map(actors.map((a) => [a.id, a])), [actors]);
  const name = (id: string) => byId.get(id)?.label ?? id;

  // Local edits apply only when the handoffs come from the run; with `handoffs` you own them.
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  const [restored, setRestored] = useState<Set<string>>(() => new Set());
  const source = useMemo(() => handoffsProp ?? handoffsFromRun(tasks, items), [handoffsProp, tasks, items]);
  const list = useMemo(() => (handoffsProp ? source : applyEdits(source, assigned, restored)), [handoffsProp, source, assigned, restored]);

  const status = useMemo(
    () => Object.fromEntries(order.map((id) => [id, relayStatus({ actors, tasks, approvals }, id)])) as Record<string, RelayStatus>,
    [order, actors, tasks, approvals],
  );
  const lanes = useMemo(() => {
    const out: Handoff[][] = order.slice(0, -1).map(() => []);
    for (const h of list) {
      const i = laneIndex(order, h);
      if (i >= 0) out[i].push(h);
    }
    return out.map((l) => l.sort((a, b) => b.at - a.at));
  }, [order, list]);
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const tool = (agent: string, from: number, to?: number) => {
    const id = toolFor({ actors, spans }, agent, from, to);
    return id ? byId.get(id) : undefined;
  };

  /* ── Geometry: dots → connector paths ── */
  const root = useRef<HTMLElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const agentEls = useRef(new Map<string, HTMLElement>());
  const agentDots = useRef(new Map<string, HTMLElement>());
  const laneDots = useRef(new Map<string, HTMLElement>());
  const [wires, setWires] = useState<Wire[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const measure = useCallback(() => {
    const w = wrap.current;
    if (!w) return;
    const box = w.getBoundingClientRect();
    setSize((s) => (s.w === box.width && s.h === box.height ? s : { w: box.width, h: box.height }));
    // Stacked layout (narrow container): no connectors.
    if ((root.current?.clientWidth ?? 0) < 760) return setWires((x) => (x.length ? [] : x));
    const at = (el?: HTMLElement) => {
      if (!el) return undefined;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
    };
    const next: Wire[] = [];
    for (let i = 0; i < order.length - 1; i++) {
      for (const side of ["from", "to"] as const) {
        const agent = side === "from" ? order[i] : order[i + 1];
        const a = at(agentDots.current.get(agent));
        const b = at(laneDots.current.get(`${i}:${side}`));
        if (!a || !b) continue;
        next.push({ key: `${agent}|${i}|${side}`, d: connectorPath(a, b, a.y + (b.y - a.y) / 2, 12), agent, lane: i, side });
      }
    }
    setWires((prev) => (prev.length === next.length && prev.every((p, k) => p.key === next[k].key && p.d === next[k].d) ? prev : next));
  }, [order]);

  useLayoutEffect(measure);
  useEffect(() => {
    const w = wrap.current;
    if (!w || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(w);
    if (root.current) ro.observe(root.current);
    return () => ro.disconnect();
  }, [measure]);

  // Wires present at first paint draw in a stagger; later ones draw as they appear.
  const firstWires = useRef<Map<string, number> | null>(null);
  if (firstWires.current === null && wires.length) firstWires.current = new Map(wires.map((w, i) => [w.key, i]));
  const delayOf = (key: string) => (firstWires.current?.has(key) ? 120 + firstWires.current.get(key)! * 110 : 0);

  /* ── Arrivals: rise in, streak along the sender's connector, count ticks ── */
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [streaks, setStreaks] = useState<{ key: string; d: string }[]>([]);
  const wiresRef = useRef(wires);
  wiresRef.current = wires;
  useEffect(() => {
    if (!seen.current) {
      seen.current = new Set(list.map((h) => h.id));
      return;
    }
    const added = list.filter((h) => !seen.current!.has(h.id));
    if (!added.length) return;
    added.forEach((h) => seen.current!.add(h.id));
    setFresh((f) => new Set([...f, ...added.map((h) => h.id)]));
    if (reducedMotion()) return;
    const add = added.flatMap((h) => {
      const w = wiresRef.current.find((x) => x.lane === laneIndex(order, h) && x.side === "from");
      return w ? [{ key: `${h.id}:${Date.now()}`, d: w.d }] : [];
    });
    if (add.length) setStreaks((s) => [...s, ...add]);
  }, [list, order]);

  /* ── Hover / focus: brighten one agent's connectors ── */
  const [active, setActive] = useState<string | null>(null);

  /* ── Reassign ── */
  const [say, setSay] = useState("");
  const focusAfter = useRef<string | null>(null);
  const assign = (h: Handoff, agent: string) => {
    if (agent === h.to || !forwardTargets(order, h.to).includes(agent)) return;
    if (!handoffsProp) setAssigned((a) => ({ ...a, [h.id]: agent }));
    onAssign?.(h, agent);
    focusAfter.current = h.id;
    setSay(`${h.title} handed to ${name(agent)}.`);
  };
  useLayoutEffect(() => {
    const id = focusAfter.current;
    if (!id) return;
    focusAfter.current = null;
    wrap.current?.querySelector<HTMLElement>(`[data-handoff="${CSS.escape(id)}"]`)?.focus();
  });

  const restore = (h: Handoff, item: HandoffItem) => {
    // With a run, the run is told; the local mark also covers mapped items and plain data.
    if (run && !handoffsProp && h.task) run.emit({ type: "task.item.restore", id: h.task, item: item.id });
    if (!handoffsProp) setRestored((r) => new Set(r).add(itemKey(h.id, item.id)));
    onRestore?.(h, item);
    setSay(`${item.label} added back.`);
  };

  // Pointer drag onto a later agent card.
  const [drag, setDrag] = useState<Drag | null>(null);
  const onPointerDown = (e: PointerEvent<HTMLElement>, h: Handoff) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button, a, input")) return;
    if (!forwardTargets(order, h.to).length) return;
    setDrag({ id: h.id, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, active: false, over: -1, rects: [] });
  };
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (!drag) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    if (!drag.active && Math.hypot(dx, dy) < 5) return;
    let rects = drag.rects;
    let box = drag.box;
    if (!drag.active) {
      e.currentTarget.setPointerCapture(e.pointerId);
      const r = e.currentTarget.getBoundingClientRect();
      box = { left: r.left, top: r.top, width: r.width, height: r.height };
      rects = order.map((id) => {
        const r = agentEls.current.get(id)?.getBoundingClientRect();
        return { left: r?.left ?? 0, top: r?.top ?? 0, width: r?.width ?? 0, height: r?.height ?? 0 };
      });
    }
    setDrag({ ...drag, dx, dy, active: true, rects, box, over: columnAt(rects, e.clientX, e.clientY) });
  };
  const onPointerUp = (h: Handoff) => {
    if (drag?.active && drag.over >= 0) assign(h, order[drag.over]);
    setDrag(null);
  };

  // Keyboard pick-up.
  const [held, setHeld] = useState<{ id: string; target: string } | null>(null);
  const onKeyDown = (e: KeyboardEvent<HTMLElement>, h: Handoff) => {
    if (e.target !== e.currentTarget) return;
    if (held?.id === h.id) {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const t = stepTarget(order, h.to, held.target, e.key === "ArrowRight" ? 1 : -1);
        setHeld({ id: h.id, target: t });
        setSay(t === h.to ? `${name(t)}, where it is now.` : `${name(t)}.`);
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setHeld(null);
        if (held.target !== h.to) assign(h, held.target);
        else setSay(`${h.title} stays with ${name(h.to)}.`);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setHeld(null);
        setSay("Cancelled.");
      }
      return;
    }
    if (e.key === " ") {
      e.preventDefault();
      if (!forwardTargets(order, h.to).length) return setSay(`${name(h.to)} is the last agent; there's no one later to hand this to.`);
      setHeld({ id: h.id, target: h.to });
      setSay(`Picked up ${h.title}. Left and right arrows choose an agent, Space hands it over, Escape cancels.`);
    } else if (e.key === "Enter" && onOpen) {
      e.preventDefault();
      onOpen(h);
    }
  };

  const target = drag?.active ? (drag.over >= 0 ? order[drag.over] : undefined) : held?.target;
  const moving = drag?.active ? list.find((h) => h.id === drag.id) : held ? list.find((h) => h.id === held.id) : undefined;
  const valid = moving ? new Set(forwardTargets(order, moving.to)) : new Set<string>();

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) => setExpanded((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set(s).add(id)));

  const n = Math.max(1, order.length);
  const label = ariaLabel ?? (typeof title === "string" ? title : "Agent handoffs");

  /* ── Pieces ── */
  const agentCard = (agentId: string, i: number) => {
    const actor = byId.get(agentId);
    const st = status[agentId];
    const pill = PILL[st];
    const current = tasks.filter((t) => t.actor === agentId && !t.outcome).sort((a, b) => b.startedAt - a.startedAt)[0];
    const waiting = queued(agentId, list, tasks);
    const isTarget = !!moving && target === agentId && valid.has(agentId);
    const dropZone = !!moving && valid.has(agentId);
    const dim = active !== null && active !== agentId && !moving;
    const nextSrc = waiting[0]?.task ? taskById.get(waiting[0].task) : undefined;
    const nextTool = nextSrc && waiting[0] ? tool(waiting[0].from, nextSrc.startedAt, nextSrc.endedAt) : undefined;
    const curTool = current ? tool(agentId, current.startedAt) : undefined;
    return (
      <div
        key={agentId}
        ref={(el) => {
          if (el) agentEls.current.set(agentId, el);
          else agentEls.current.delete(agentId);
        }}
        role="group"
        tabIndex={-1}
        aria-label={`${name(agentId)}${actor?.model ? `, ${actor.model}` : ""}, ${pill.text}`}
        onPointerEnter={() => setActive(agentId)}
        onPointerLeave={() => setActive((a) => (a === agentId ? null : a))}
        onFocus={() => setActive(agentId)}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setActive((a) => (a === agentId ? null : a))}
        style={{ "--c": `${2 * i + 1} / span 2` } as CSSProperties}
        className={cn(
          "@container/agent relative flex min-w-0 flex-col gap-3 rounded-[16px] border bg-card p-4 outline-none [grid-column:var(--c)] [grid-row:1]",
          "@max-[759px]/relay:[grid-column:auto] @max-[759px]/relay:[grid-row:auto]",
          HAIRLINE,
          "dark:[background:color-mix(in_srgb,var(--card)_80%,#000)]",
          "transition-[opacity,box-shadow] duration-300",
          EASE,
          isTarget
            ? "shadow-[0_0_0_2px_var(--kn-line),0_10px_24px_-12px_rgb(0_0_0/0.4)]"
            : dropZone
              ? "shadow-[0_0_0_1px_color-mix(in_srgb,var(--kn-line)_50%,transparent),0_10px_24px_-16px_rgb(0_0_0/0.45)]"
              : "shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_6%,transparent),0_1px_2px_rgb(0_0_0/0.05),0_10px_24px_-16px_rgb(0_0_0/0.45)]",
          dim && "opacity-75",
        )}
      >
        <div className="flex items-start gap-3">
          <Logo actor={actor} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[14.5px] font-semibold leading-tight tracking-[-0.01em]">{name(agentId)}</span>
            {(actor?.model || actor?.spend !== undefined) && (
              <span className="truncate text-[12.5px] text-muted-foreground">
                {actor?.model}
                {/* On a narrow card the spend moves under the name, next to the model. */}
                {actor?.spend !== undefined && (
                  <span className="tabular-nums @min-[340px]/agent:hidden">
                    {actor.model ? " · " : ""}
                    {formatUsd(actor.spend)}
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex flex-none items-center gap-2">
            {actor?.spend !== undefined && <span className="text-[12.5px] tabular-nums text-muted-foreground @max-[339px]/agent:hidden">{formatUsd(actor.spend)}</span>}
            <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-[7px] px-2 text-[12px] font-medium", pill.className)}>
              {st === "working" && <Spinner label="" className="size-3" />}
              {pill.text}
            </span>
          </div>
        </div>
        {actor?.description && <p className="line-clamp-2 text-[13.5px] leading-relaxed text-muted-foreground">{actor.description}</p>}
        {/* What it's on, in a recessed well */}
        <div className="mt-auto flex h-10 min-w-0 items-center gap-2 rounded-[10px] bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] px-3 text-[13px] shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)] dark:bg-[color-mix(in_srgb,#000_32%,transparent)]">
          {current ? (
            <>
              {curTool && <Logo actor={curTool} size="sm" />}
              <span className="min-w-0 truncate font-medium">{current.title}</span>
              <span className="flex-none text-muted-foreground">{verb?.(agentId, current) ?? "Working"}</span>
            </>
          ) : waiting.length ? (
            <>
              <span className="flex-none text-muted-foreground">Up next</span>
              {nextTool && <Logo actor={nextTool} size="sm" />}
              <span className="min-w-0 truncate font-medium">{waiting[0].title}</span>
              {waiting.length > 1 && <span className="flex-none tabular-nums text-muted-foreground">+{waiting.length - 1}</span>}
            </>
          ) : (
            <span className="text-muted-foreground">Ready for a task</span>
          )}
        </div>
        {/* Connector dot */}
        {n > 1 && (
          <span
            ref={(el) => {
              if (el) agentDots.current.set(agentId, el);
              else agentDots.current.delete(agentId);
            }}
            aria-hidden="true"
            className="absolute -bottom-[5px] left-1/2 z-[2] size-2.5 -translate-x-1/2 rounded-full border-[1.5px] border-[var(--kn-line)] bg-card @max-[759px]/relay:hidden"
          />
        )}
      </div>
    );
  };

  const stateLine = (h: Handoff, s: HandoffState) => {
    const lost = h.items.filter((i) => i.lost).length;
    if (s === "working")
      return (
        <span className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
          <Spinner label="" className="size-3.5" />
          <span className="text-foreground/80">With {name(h.to)}</span>
        </span>
      );
    if (s === "done")
      return (
        <span className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
          Looks good
        </span>
      );
    if (s === "warning")
      return (
        <span className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
          <span className="size-2 rounded-full bg-amber-500" aria-hidden="true" />
          Needs a look
          {lost > 0 && <span className="text-muted-foreground">· {lost} lost</span>}
        </span>
      );
    return (
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className="size-2 rounded-full border-[1.5px] border-current opacity-60" aria-hidden="true" />
        Waiting for {name(h.to)}
      </span>
    );
  };

  const handoffCard = (h: Handoff, laneFrom: string) => {
    const s = handoffState(h, tasks);
    const isDragging = !!drag?.active && drag.id === h.id;
    const isHeld = held?.id === h.id;
    const canMove = forwardTargets(order, h.to).length > 0;
    const open = expanded.has(h.id);
    const src = h.task ? taskById.get(h.task) : undefined;
    const t = src ? tool(h.from, src.startedAt, src.endedAt) : undefined;
    const lost = h.items.filter((i) => i.lost).length;
    return (
      <li key={h.id} className={cn("relative", fresh.has(h.id) && !isDragging && "motion-safe:animate-[kn-rise_480ms_cubic-bezier(.22,1,.36,1)_both]")}>
        <article
          data-handoff={h.id}
          tabIndex={0}
          aria-roledescription="handoff"
          aria-label={`${h.title}, from ${name(h.from)} to ${name(h.to)}${lost ? `, ${lost} item${lost > 1 ? "s" : ""} lost` : ""}${isHeld ? ", picked up" : ""}`}
          onPointerDown={(e) => onPointerDown(e, h)}
          onPointerMove={onPointerMove}
          onPointerUp={() => onPointerUp(h)}
          onPointerCancel={() => setDrag(null)}
          onKeyDown={(e) => onKeyDown(e, h)}
          onBlur={() => held?.id === h.id && setHeld(null)}
          className={cn(
            "flex flex-col gap-1.5 rounded-[12px] border bg-card px-3.5 py-3 text-left text-[13px] outline-none",
            HAIRLINE,
            "dark:[background:color-mix(in_srgb,var(--card)_88%,#000)]",
            !isDragging && cn("transition-[box-shadow,scale] duration-200 motion-reduce:transition-none", EASE),
            canMove && "cursor-grab touch-none select-none active:cursor-grabbing",
            isDragging
              ? "opacity-40"
              : isHeld
                ? "shadow-[0_0_0_1.5px_var(--kn-line),0_8px_24px_-8px_rgb(0_0_0/0.25)]"
                : "shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_5%,transparent)]",
            focusRing,
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden="true" className="grid size-4 flex-none place-items-center text-muted-foreground [&>*]:size-full [&_svg]:size-full">
              {t ? actorIcon(t) : KIND[h.items[0]?.kind ?? "note"]}
            </span>
            <span className="min-w-0 truncate text-[14px] font-semibold tracking-[-0.005em]">{h.title}</span>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5 pl-[26px]">
            {h.from !== laneFrom && <span className="text-[12px] text-muted-foreground">From {name(h.from)}</span>}
            {h.items.length > 0 && (
              <button
                type="button"
                aria-expanded={open}
                aria-label={`${h.items.length} item${h.items.length > 1 ? "s" : ""} passed along${lost ? `, ${lost} lost` : ""}`}
                onClick={() => toggle(h.id)}
                className={cn("-mx-1 flex min-w-0 cursor-pointer items-center gap-1 rounded-[6px] px-1 text-left text-muted-foreground transition-colors duration-150 hover:text-foreground", focusRing)}
              >
                <span className="min-w-0 flex-1 truncate">
                  {h.items.map((it, k) => (
                    <span key={it.id}>
                      {k > 0 && ", "}
                      <span className={cn(it.lost && "line-through decoration-muted-foreground/60 opacity-70")}>{it.label}</span>
                    </span>
                  ))}
                </span>
                <Chevron open={open} />
              </button>
            )}
            {open && (
              <ul
                aria-label="Passed along"
                className="flex flex-col gap-1 rounded-[8px] bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] p-2 motion-safe:animate-[kn-rise_220ms_cubic-bezier(.22,1,.36,1)_both] dark:bg-[color-mix(in_srgb,#000_25%,transparent)]"
              >
                {h.items.map((it) => (
                  <li key={it.id} className="flex flex-col gap-0.5 text-[12.5px] leading-[1.4]">
                    <span className="flex min-w-0 items-start gap-2">
                      <span aria-hidden="true" className="mt-px grid size-3.5 flex-none text-muted-foreground [&_svg]:size-full">
                        {KIND[it.kind ?? "note"]}
                      </span>
                      <span className={cn("min-w-0 flex-1 break-words", it.lost && "text-muted-foreground line-through decoration-muted-foreground/60")}>
                        {it.label}
                        {it.lost && <span className="sr-only"> (lost: {it.lost.reason})</span>}
                      </span>
                    </span>
                    {it.lost && (
                      <span className="flex items-center gap-1 pl-5">
                        <Tooltip content={it.lost.reason}>
                          <button
                            type="button"
                            aria-label={`Why ${it.label} was lost`}
                            className={cn("flex cursor-help items-center gap-1 rounded-[6px] px-1 py-0.5 text-[11.5px] text-amber-700 transition-colors duration-150 hover:bg-muted dark:text-amber-300", focusRing)}
                          >
                            <Info />
                            Lost
                          </button>
                        </Tooltip>
                        <Button size="xs" variant="ghost" onClick={() => restore(h, it)} aria-label={`Add back ${it.label}`}>
                          Add back
                        </Button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="text-[13px]">{stateLine(h, s)}</div>
          </div>
        </article>
      </li>
    );
  };

  return (
    <section
      ref={root}
      aria-label={label}
      className={cn(
        "@container/relay relative rounded-[18px] border bg-card text-card-foreground",
        HAIRLINE,
        "shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_5%,transparent),0_1px_2px_rgb(0_0_0/0.04)] dark:[background:color-mix(in_srgb,var(--card)_55%,#000)]",
        "[--kn-line:#4f7df0] [--kn-line-hot:#a9c2ff] dark:[--kn-line:#6b95ff] dark:[--kn-line-hot:#dbe6ff]",
        className,
      )}
    >
      {title !== false && (
        <header className={cn("flex items-baseline gap-2 border-b px-5 py-3", HAIRLINE)}>
          <h3 className="text-[14px] font-semibold tracking-tight">{title}</h3>
          <span className="text-[12px] text-muted-foreground">
            {list.length} {list.length === 1 ? "handoff" : "handoffs"}
          </span>
        </header>
      )}

      {!order.length ? (
        <p className="px-5 py-12 text-center text-[13px] text-muted-foreground">No agents yet. Handoffs show up here when one agent passes work to the next.</p>
      ) : (
        <div className="overflow-x-auto">
          <div
            ref={wrap}
            style={{ "--cols": 2 * n, "--minw": `${n * 230}px` } as CSSProperties}
            className="relative grid min-w-[var(--minw)] grid-cols-[repeat(var(--cols),minmax(0,1fr))] gap-x-3 gap-y-[76px] p-5 @max-[759px]/relay:min-w-0 @max-[759px]/relay:grid-cols-1 @max-[759px]/relay:gap-y-3 @max-[759px]/relay:p-3"
          >
            <svg aria-hidden="true" width={size.w} height={size.h} className="pointer-events-none absolute inset-0 z-[1] overflow-visible @max-[759px]/relay:hidden">
              {wires.map((w) => {
                const on = active !== null && w.agent === active;
                return <WirePath key={w.key} d={w.d} delay={delayOf(w.key)} bright={on} opacity={active === null ? 0.85 : on ? 1 : 0.18} />;
              })}
              {streaks.map((s) => (
                <StreakPath key={s.key} d={s.d} onDone={() => setStreaks((all) => all.filter((x) => x.key !== s.key))} />
              ))}
            </svg>

            {order.flatMap((agentId, i) => {
              const out = [agentCard(agentId, i)];
              if (i < order.length - 1) {
                const from = order[i];
                const to = order[i + 1];
                out.push(
                  <Lane
                    key={`lane-${from}-${to}`}
                    index={i}
                    from={{ name: name(from), actor: byId.get(from) }}
                    to={{ name: name(to), actor: byId.get(to) }}
                    count={lanes[i].length}
                    dim={active !== null && active !== from && active !== to && !moving}
                    maxHeight={laneHeight}
                    dotRef={(side, el) => {
                      if (el) laneDots.current.set(`${i}:${side}`, el);
                      else laneDots.current.delete(`${i}:${side}`);
                    }}
                  >
                    {lanes[i].map((h) => handoffCard(h, from))}
                  </Lane>,
                );
              }
              return out;
            })}
          </div>
        </div>
      )}
      <p aria-live="polite" className="sr-only">
        {say}
      </p>
      {/* While dragging, a ghost follows the pointer above everything (lanes clip their cards). */}
      {drag?.active &&
        drag.box &&
        moving &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            aria-hidden="true"
            style={{ left: drag.box.left + drag.dx, top: drag.box.top + drag.dy, width: drag.box.width }}
            className={cn(
              "pointer-events-none fixed z-50 flex scale-[1.02] flex-col gap-1 rounded-[12px] border bg-card px-3.5 py-3 text-[13px] text-card-foreground",
              HAIRLINE,
              "shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_10%,transparent),0_18px_40px_-12px_rgb(0_0_0/0.4)] dark:[background:color-mix(in_srgb,var(--card)_88%,#000)]",
            )}
          >
            <span className="truncate text-[14px] font-semibold">{moving.title}</span>
            <span className="text-muted-foreground">{target && valid.has(target) ? `Hand to ${name(target)}` : "Drop on a later agent"}</span>
          </div>,
          document.body,
        )}
    </section>
  );
}

export default AgentHandoff;
