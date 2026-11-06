"use client";
/** @registry name="agent-cursors" type="ui" title="Agent cursors" description="Agents editing a document like multiplayer teammates: coloured live pointers with name, action and spend, suggestions typed in as tracked changes with accept, reject and Accept all, image resize, code edits, margin comments with a typing indicator, and a Table tab." */

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import type { AgentRun } from "@/registry/knowns/lib/knowns/run";
import { useAgentSnapshot } from "@/registry/knowns/lib/knowns/run";
import type { Actor } from "@/registry/knowns/lib/knowns/types";
import { AGENT_PALETTE, formatUsd, readableInk, rootAgent, STATE_LABEL } from "@/registry/knowns/lib/knowns/status";
import { actorIcon } from "@/registry/knowns/lib/knowns/icons/actor-icon";
import { cn, focusRing, layoutScale, localRect } from "@/registry/knowns/lib/knowns/utils";
import { Button } from "../button";
import { SegmentedControl } from "../segmented-control";
import {
  approach,
  cellId,
  drift,
  imageWidth,
  isText,
  layoutTags,
  lengthOf,
  RESIZE_STEPS,
  segments,
  type CursorComment,
  type CursorDoc,
  type CursorTable,
  type DocBlock,
  type Presence,
  type Rect,
  type Resolution,
  type ResizeSuggestion,
  type Segment,
  type Suggestion,
  type TagBox,
  type TextSuggestion,
} from "./cursors-model";

export type { CursorComment, CursorDoc, CursorTable, DocBlock, Presence, Resolution, ResizeSuggestion, Suggestion, TextSuggestion } from "./cursors-model";
export { cellId } from "./cursors-model";

export type CursorsTab = "doc" | "table";

export interface AgentCursorsProps {
  /** Agents (label, model, spend, state, activity) from a run. */
  run?: AgentRun;
  /** Plain data instead of a run. */
  actors?: Actor[];
  doc: CursorDoc;
  /** Adds a Table tab where the same agents edit cells. */
  table?: CursorTable;
  suggestions?: Suggestion[];
  comments?: CursorComment[];
  /** Where each agent is (a block, cell, suggestion or comment id), what it is doing, and whether it is away. */
  presence?: Record<string, Presence>;
  onAccept?: (s: Suggestion) => void;
  onReject?: (s: Suggestion) => void;
  /** Called after Accept all, with the suggestions it accepted. */
  onAcceptAll?: (accepted: Suggestion[]) => void;
  tab?: CursorsTab;
  defaultTab?: CursorsTab;
  onTabChange?: (tab: CursorsTab) => void;
  /** Type suggestions and comments in letter by letter (default true). Off, or with reduced motion, they appear whole. */
  typing?: boolean;
  /** ms per character (default 34). */
  typeSpeed?: number;
  className?: string;
  "aria-label"?: string;
}

/**
 * Pointer colours: the house palette, reordered so neighbours differ in hue (indigo, sky, teal, pink, violet,
 * cyan, blue). Pointers sit close together on one page, so they need to be told apart at a glance.
 */
const CURSOR_ORDER = [0, 1, 3, 4, 2, 5, 6];
function cursorColors(actors: Actor[]): Map<string, string> {
  const root = rootAgent(actors);
  const agents = actors.filter((a) => a.type === "agent");
  const ordered = root ? [root, ...agents.filter((a) => a !== root)] : agents;
  return new Map(ordered.map((a, i) => [a.id, AGENT_PALETTE[CURSOR_ORDER[i % CURSOR_ORDER.length]]]));
}

const EASE = "ease-[cubic-bezier(.22,1,.36,1)]";
const HAIRLINE = "[border-color:color-mix(in_srgb,var(--foreground)_9%,transparent)]";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Tints and ink for one agent colour. */
function tone(color: string) {
  const { ink, fill } = readableInk(color);
  return { color, ink, fill, soft: `color-mix(in srgb, ${color} 12%, transparent)`, line: `color-mix(in srgb, ${color} 60%, transparent)`, faint: `color-mix(in srgb, ${color} 45%, transparent)` };
}
type Tone = ReturnType<typeof tone>;

function Avatar({ actor, t, size = 22, ring = true }: { actor: Actor; t: Tone; size?: number; ring?: boolean }) {
  return (
    <span
      className="grid flex-none place-items-center overflow-hidden rounded-full bg-background text-[10px] font-semibold text-foreground [&_svg]:size-[62%]"
      style={{ width: size, height: size, boxShadow: ring ? `0 0 0 1.5px ${t.color}` : undefined }}
    >
      {actorIcon(actor)}
    </span>
  );
}

const CheckIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-3.5">
    <path d="m3.5 8.5 3 3 6-7" />
  </svg>
);
const CrossIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden className="size-3.5">
    <path d="m4.5 4.5 7 7m0-7-7 7" />
  </svg>
);
const DocIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden className="size-3.5 flex-none">
    <path d="M4 1.75h5.25L12.5 5v9.25H4z" />
    <path d="M9 1.75V5.25h3.5" />
  </svg>
);

/**
 * Stand-in art for an image block without a src: a small sync panel drawn in UI parts (two devices with their
 * progress), sized in container units so it scales cleanly while an agent resizes the block.
 */
function SyncPanelArt({ label }: { label: string }) {
  const rows = [
    { name: "MacBook Pro", note: "Up to date", done: 1, tone: "bg-emerald-500" },
    { name: "Phone", note: "3 changes to send", done: 0.62, tone: "bg-sky-500" },
    { name: "Tablet", note: "Waiting for signal", done: 0.18, tone: "bg-amber-500" },
  ];
  return (
    <div role="img" aria-label={label} className={cn("@container size-full overflow-hidden rounded-lg border bg-background", HAIRLINE)}>
      <div className="flex h-full flex-col gap-[3.5cqw] p-[5cqw] text-[3.6cqw] leading-tight">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Sync</span>
          <span className="flex items-center gap-[1.5cqw] rounded-full bg-muted px-[2.5cqw] py-[0.8cqw] text-[3cqw] text-muted-foreground">
            <span className="size-[1.8cqw] rounded-full bg-emerald-500" />
            Online
          </span>
        </div>
        <div className="flex flex-1 flex-col justify-around">
          {rows.map((r) => (
            <div key={r.name} className="flex items-center gap-[3cqw]">
              <span className="grid size-[8cqw] flex-none place-items-center rounded-[1.8cqw] bg-muted text-[3.4cqw] font-semibold text-muted-foreground">{r.name[0]}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-[1.2cqw]">
                <div className="flex justify-between gap-[2cqw]">
                  <span className="truncate font-medium">{r.name}</span>
                  <span className="truncate text-[3cqw] text-muted-foreground">{r.note}</span>
                </div>
                <div className="h-[1.6cqw] overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", r.tone)} style={{ width: `${r.done * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AgentCursors({
  run,
  actors: actorsProp,
  doc,
  table,
  suggestions = [],
  comments = [],
  presence = {},
  onAccept,
  onReject,
  onAcceptAll,
  tab: tabProp,
  defaultTab = "doc",
  onTabChange,
  typing = true,
  typeSpeed = 34,
  className,
  "aria-label": label = "Agents editing the document",
}: AgentCursorsProps) {
  const snap = useAgentSnapshot(run);
  const actors = snap?.actors ?? actorsProp ?? [];
  const agents = useMemo(() => actors.filter((a) => a.type === "agent"), [actors]);
  const colors = useMemo(() => cursorColors(actors), [actors]);
  const tones = useMemo(() => new Map(agents.map((a) => [a.id, tone(colors.get(a.id) ?? "#6366f1")])), [agents, colors]);
  const toneOf = (id: string) => tones.get(id) ?? tone("#6366f1");
  const agentOf = (id: string): Actor => agents.find((a) => a.id === id) ?? { id, type: "agent", label: id };

  const [tabState, setTabState] = useState<CursorsTab>(defaultTab);
  const tab = table ? (tabProp ?? tabState) : "doc";
  const setTab = (t: CursorsTab) => {
    setTabState(t);
    onTabChange?.(t);
  };

  const reduced = useReducedMotion();
  const animate = typing && !reduced;
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* ── Resolution and typing ── */

  const [resolved, setResolved] = useState<Record<string, Resolution>>({});
  const resolvedOf = useCallback((id: string) => resolved[id], [resolved]);
  const [typed, setTyped] = useState<Record<string, number>>({});
  const typedOf = useCallback((c: Suggestion | CursorComment) => (animate ? Math.min(typed[c.id] ?? 0, lengthOf(c)) : lengthOf(c)), [animate, typed]);
  const changes = useMemo<(Suggestion | CursorComment)[]>(() => [...suggestions, ...comments], [suggestions, comments]);

  // One clock: each agent types its first unfinished change, one step per tick. Paused offscreen.
  useEffect(() => {
    if (!animate || !visible) return;
    const id = window.setInterval(() => {
      setTyped((prev) => {
        let next: Record<string, number> | null = null;
        const busy = new Set<string>();
        for (const c of changes) {
          if (busy.has(c.agentId) || resolved[c.id]) continue;
          const n = prev[c.id] ?? 0;
          if (n >= lengthOf(c)) continue;
          busy.add(c.agentId);
          next ??= { ...prev };
          next[c.id] = n + 1;
        }
        return next ?? prev;
      });
    }, typeSpeed);
    return () => window.clearInterval(id);
  }, [animate, visible, changes, resolved, typeSpeed]);

  const pending = suggestions.filter((s) => !resolved[s.id]);
  const resolve = (s: Suggestion, state: Resolution["state"]) => {
    if (resolved[s.id]) return;
    setResolved((r) => ({ ...r, [s.id]: { state, at: Date.now() } }));
    (state === "accepted" ? onAccept : onReject)?.(s);
  };
  const acceptAll = () => {
    if (!pending.length) return;
    const at = Date.now();
    setResolved((r) => ({ ...r, ...Object.fromEntries(pending.map((s) => [s.id, { state: "accepted" as const, at }])) }));
    onAcceptAll?.(pending);
  };
  const spend = agents.reduce((sum, a) => sum + (a.spend ?? 0), 0);

  /* ── Pointers ── */

  const frameRef = useRef<HTMLDivElement>(null);
  const pointerEls = useRef(new Map<string, HTMLDivElement>());
  const tagEls = useRef(new Map<string, HTMLDivElement>());
  const live = useRef({ agents, presence, animate });
  live.current = { agents, presence, animate };

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !visible) return;
    const pos = new Map<string, { x: number; y: number; on: boolean; still: number }>();
    const tagPos = new Map<string, { left: number; top: number }>();
    let raf = 0;
    let last = performance.now();
    // Lines of body text, as soft obstacles for tags. Text reflows only on edits and resizes, so re-read a few
    // times a second rather than every frame.
    let soft: Rect[] = [];
    let softAt = -Infinity;
    const range = document.createRange();
    const step = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const { agents, presence, animate } = live.current;
      // Everything below is in the frame's own layout px, so the cursors land right under CSS zoom too.
      const fr = frame.getBoundingClientRect();
      const sc = layoutScale(frame);
      const local = (r: DOMRect): Rect => ({ left: (r.left - fr.left) / sc.x, top: (r.top - fr.top) / sc.y, w: r.width / sc.x, h: r.height / sc.y });
      const targets = agents.map((a, i) => {
        const caret = frame.querySelector<HTMLElement>(`[data-kn-caret="${CSS.escape(a.id)}"]`);
        const id = presence[a.id]?.target;
        const anchor = caret ?? (id ? frame.querySelector<HTMLElement>(`[data-kn-anchor="${CSS.escape(id)}"]`) : null);
        const r = anchor && anchor.getClientRects().length ? localRect(anchor, frame) : null;
        if (!r) return { a, i, on: false, x: 0, y: 0 };
        // The caret's foot while typing; otherwise a spot near the start of the target.
        const x = caret ? r.right : r.left + Math.min(28 + i * 9, r.width * 0.4);
        const y = caret ? r.bottom - 2 : r.top + Math.min(r.height * 0.55, 18);
        return { a, i, on: true, x, y };
      });
      const boxes: TagBox[] = [];
      for (const t of targets) {
        const p = pos.get(t.a.id) ?? { x: t.x, y: t.y, on: t.on, still: 0 };
        const away = Boolean(presence[t.a.id]?.away);
        if (t.on) {
          const nx = animate && p.on ? approach(p.x, t.x, dt) : t.x;
          const ny = animate && p.on ? approach(p.y, t.y, dt) : t.y;
          p.still = Math.hypot(nx - p.x, ny - p.y) < 0.2 ? p.still + dt : 0;
          p.x = nx;
          p.y = ny;
        }
        p.on = t.on;
        pos.set(t.a.id, p);
        const [wx, wy] = animate && !away && p.still > 600 ? drift(now, t.i) : [0, 0];
        const x = p.x + wx;
        const y = p.y + wy;
        const el = pointerEls.current.get(t.a.id);
        if (el) {
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
          el.style.opacity = p.on ? (away ? "0.45" : "1") : "0";
        }
        const tag = tagEls.current.get(t.a.id);
        if (tag && p.on) boxes.push({ id: t.a.id, x, y, w: tag.offsetWidth, h: tag.offsetHeight });
        else if (tag) tag.style.opacity = "0";
      }
      // Tags keep off the comment rail and off the text being edited (each line of a pending suggestion).
      const obstacles: Rect[] = [];
      for (const el of frame.querySelectorAll<HTMLElement>("[data-kn-rail-card], [data-kn-edit]")) {
        for (const r of el.getClientRects()) obstacles.push(local(r));
      }
      if (now - softAt > 150) {
        softAt = now;
        soft = [];
        for (const el of frame.querySelectorAll<HTMLElement>("[data-kn-text]")) {
          range.selectNodeContents(el);
          for (const r of range.getClientRects()) if (r.width > 1) soft.push(local(r));
        }
      }
      for (const pl of layoutTags(boxes, { w: frame.offsetWidth, h: frame.offsetHeight }, { obstacles, soft })) {
        const tag = tagEls.current.get(pl.id)!;
        const prev = tagPos.get(pl.id);
        // Ease between spots so a tag that changes side glides instead of jumping.
        const left = prev && animate ? approach(prev.left, pl.left, dt, 90) : pl.left;
        const top = prev && animate ? approach(prev.top, pl.top, dt, 90) : pl.top;
        tagPos.set(pl.id, { left, top });
        tag.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
        tag.style.opacity = presence[pl.id]?.away ? "0.7" : "1";
        // Last resort over text: a slightly see-through card with a blur keeps both readable.
        tag.toggleAttribute("data-on-text", pl.onText);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  /* ── Comments rail (wide) or inline (narrow) ── */

  const [wide, setWide] = useState(true);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWide(e.contentRect.width >= 760));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pageRef = useRef<HTMLDivElement>(null);
  const [railTops, setRailTops] = useState<Record<string, number>>({});
  const railEls = useRef(new Map<string, HTMLDivElement>());
  const docComments = comments.filter((c) => doc.blocks.some((b) => b.id === c.blockId));
  useLayoutEffect(() => {
    if (!wide || tab !== "doc") return;
    const page = pageRef.current;
    if (!page) return;
    const tops: Record<string, number> = {};
    let floor = 0;
    for (const c of docComments) {
      const block = page.querySelector<HTMLElement>(`[data-kn-anchor="${CSS.escape(c.blockId)}"]`);
      const top = Math.max(block ? block.offsetTop : 0, floor);
      tops[c.id] = top;
      floor = top + (railEls.current.get(c.id)?.offsetHeight ?? 72) + 8;
    }
    setRailTops((prev) => (JSON.stringify(prev) === JSON.stringify(tops) ? prev : tops));
  });

  /* ── Rendering helpers ── */

  const describe = (s: TextSuggestion, del: string, ins: string) =>
    del && ins ? `replace “${del}” with “${ins}”` : ins ? `insert “${ins}”` : `delete “${del}”`;

  // Render functions, not components: they run on every typing tick and must not remount (focus would be lost).
  function actions(s: Suggestion, who: string) {
    return (
      <span className="absolute bottom-full left-0 z-20 mb-1 hidden items-center gap-0.5 rounded-lg border bg-popover p-0.5 text-popover-foreground shadow-md group-focus-within/sg:flex group-hover/sg:flex">
        <button type="button" aria-label={`Accept suggestion from ${who}`} onClick={() => resolve(s, "accepted")} className={cn("grid size-6 place-items-center rounded-md hover:bg-muted", focusRing)}>
          <CheckIcon />
        </button>
        <button type="button" aria-label={`Reject suggestion from ${who}`} onClick={() => resolve(s, "rejected")} className={cn("grid size-6 place-items-center rounded-md hover:bg-muted", focusRing)}>
          <CrossIcon />
        </button>
      </span>
    );
  }

  const onSuggestionKey = (s: Suggestion, done: boolean) => (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget || !done) return;
    if (e.key === "Enter") {
      e.preventDefault();
      resolve(s, "accepted");
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      resolve(s, "rejected");
    }
  };

  function renderSegment(g: Segment, i: number): ReactNode {
    if (g.kind === "text") return <Fragment key={i}>{g.text}</Fragment>;
    const t = toneOf(g.s.agentId);
    const who = agentOf(g.s.agentId).label;
    if (g.kind === "resolved") {
      const fresh = Date.now() - g.at < 1500;
      return (
        <span
          key={`${g.s.id}-${g.state}`}
          style={{ "--kn-c": g.state === "accepted" ? t.color : "var(--muted-foreground)" } as CSSProperties}
          className={cn("rounded-[3px] transition-[background-color] duration-[900ms] ease-out", fresh && "starting:bg-[color-mix(in_srgb,var(--kn-c)_28%,transparent)]")}
        >
          {g.text}
        </span>
      );
    }
    return (
      <span
        key={g.s.id}
        role="group"
        tabIndex={0}
        data-kn-anchor={g.s.id}
        data-kn-edit=""
        aria-label={`${who} suggests: ${describe(g.s, g.del, g.done ? g.s.insert : g.ins)}${g.done ? ". Enter accepts, Delete rejects." : ", still typing."}`}
        onKeyDown={onSuggestionKey(g.s, g.done)}
        className={cn("group/sg relative rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring")}
      >
        {g.del && (
          <del className="text-muted-foreground decoration-[1.5px]" style={{ textDecorationColor: t.faint }}>
            {g.del}
          </del>
        )}
        <ins className={cn("rounded-[3px] px-[2px] no-underline", g.del && "ml-[3px]")} style={{ background: t.soft, boxShadow: `inset 0 -1.5px 0 ${t.line}` }}>
          {g.ins}
        </ins>
        {!g.done && <span data-kn-caret={g.s.agentId} aria-hidden className="ml-px inline-block h-[1.05em] w-[2px] translate-y-[0.15em] rounded-full" style={{ background: t.color }} />}
        {g.done && actions(g.s, who)}
      </span>
    );
  }

  const textSuggestionsFor = (id: string) => suggestions.filter((s): s is TextSuggestion => isText(s) && s.blockId === id);
  const renderText = (id: string, text: string) =>
    segments(text, textSuggestionsFor(id), (sid) => typedOf(suggestions.find((s) => s.id === sid)!), resolvedOf).map(renderSegment);
  /** The agent working in a block or cell right now: pointed at it (or at a change in it), or still typing there. */
  const activeIn = (id: string) => {
    for (const a of agents) {
      const p = presence[a.id];
      if (!p?.target || p.away) continue;
      if (p.target === id || suggestions.some((s) => s.id === p.target && s.blockId === id) || comments.some((c) => c.id === p.target && c.blockId === id)) return a.id;
    }
    return suggestions.find((s) => s.blockId === id && !resolved[s.id] && typedOf(s) < lengthOf(s))?.agentId;
  };
  const isActive = (a: Actor) => Boolean(presence[a.id]?.target) && !presence[a.id]?.away;

  function commentCard(c: CursorComment) {
    const t = toneOf(c.agentId);
    const a = agentOf(c.agentId);
    const n = typedOf(c);
    const writing = n < c.text.length;
    return (
      <div key={c.id} data-kn-rail-card="" className={cn("rounded-xl border bg-background p-2.5 text-[12.5px] shadow-[0_1px_2px_rgb(0_0_0/0.04)]", HAIRLINE)} style={{ borderLeft: `2px solid ${t.color}` }} data-kn-anchor={c.id}>
        <div className="flex items-center gap-1.5">
          <Avatar actor={a} t={t} size={18} />
          <span className="font-medium">{a.label}</span>
          {c.at && <span className="ml-auto text-[11px] text-muted-foreground">{c.at}</span>}
        </div>
        <p className="mt-1 leading-snug text-foreground/90" aria-label={writing ? undefined : c.text}>
          <span aria-hidden={writing || undefined}>{c.text.slice(0, n)}</span>
          {writing && <span data-kn-caret={c.agentId} aria-hidden className="ml-px inline-block h-[1em] w-[2px] translate-y-[0.15em] rounded-full" style={{ background: t.color }} />}
        </p>
        {writing && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground" role="status">
            <span aria-hidden className="flex gap-0.5">
              {[0, 1, 2].map((d) => (
                <span key={d} className={cn("size-1 rounded-full bg-current", animate && "animate-pulse")} style={{ animationDelay: `${d * 160}ms` }} />
              ))}
            </span>
            {a.label} is writing a comment…
          </p>
        )}
      </div>
    );
  }

  function imageBlock(b: Extract<DocBlock, { type: "image" }>) {
    const s = suggestions.find((x): x is ResizeSuggestion => x.kind === "resize" && x.blockId === b.id);
    const r = s ? resolved[s.id] : undefined;
    const progress = s ? typedOf(s) / RESIZE_STEPS : 0;
    const width = imageWidth(b.width, s, progress, r);
    const height = Math.round((width * b.height) / b.width);
    const active = s && !r;
    const t = s ? toneOf(s.agentId) : undefined;
    const done = progress >= 1;
    const who = s ? agentOf(s.agentId).label : "";
    return (
      <figure className="my-1">
        <div
          className="group/sg relative max-w-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ width, aspectRatio: `${b.width} / ${b.height}` }}
          {...(active
            ? { role: "group", tabIndex: 0, "aria-label": `${who} suggests: resize the image from ${b.width} to ${s.width} px wide${done ? ". Enter accepts, Delete rejects." : ", in progress."}`, onKeyDown: onSuggestionKey(s, done), "data-kn-anchor": s.id }
            : {})}
        >
          {b.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.src} alt={b.alt} className="size-full rounded-lg object-cover" />
          ) : (
            <SyncPanelArt label={b.alt} />
          )}
          {active && t && (
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-lg" style={{ boxShadow: `0 0 0 1.5px ${t.line}` }}>
              {["-left-1 -top-1", "-right-1 -top-1", "-left-1 -bottom-1", "-right-1 -bottom-1"].map((p) => (
                <span key={p} className={cn("absolute size-2 rounded-[2px] border bg-background", p)} style={{ borderColor: t.color }} {...(p === "-right-1 -bottom-1" && !done ? { "data-kn-caret": s.agentId } : {})} />
              ))}
              <span className="absolute -bottom-7 right-0 rounded-md px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums" style={{ background: t.fill, color: t.ink }}>
                {width} × {height}
              </span>
            </div>
          )}
          {active && done && actions(s, who)}
        </div>
        {b.caption && <figcaption className={cn("text-[12px] text-muted-foreground", active ? "mt-8" : "mt-1.5")}>{b.caption}</figcaption>}
      </figure>
    );
  }

  function block(b: DocBlock) {
    const by = activeIn(b.id);
    const bar = by ? toneOf(by).faint : "transparent";
    const inline = !wide ? docComments.filter((c) => c.blockId === b.id) : [];
    const body = (() => {
      switch (b.type) {
        case "heading":
          return b.level === 2 ? <h4 data-kn-text="" className="text-[15px] font-semibold tracking-tight">{renderText(b.id, b.text)}</h4> : <h3 data-kn-text="" className="text-[22px] font-semibold tracking-[-0.02em]">{renderText(b.id, b.text)}</h3>;
        case "paragraph":
          return <p data-kn-text="" className="text-[14px] leading-[1.7] text-foreground/85">{renderText(b.id, b.text)}</p>;
        case "bullet":
          return (
            <p data-kn-text="" className="relative pl-4 text-[14px] leading-[1.7] text-foreground/85 before:absolute before:left-1 before:top-[0.8em] before:size-1 before:rounded-full before:bg-foreground/40">{renderText(b.id, b.text)}</p>
          );
        case "code":
          return (
            <pre className={cn("overflow-x-auto rounded-lg border bg-muted/40 px-3.5 py-3 font-mono text-[12.5px] leading-relaxed", HAIRLINE)}>
              <code data-kn-text="">{renderText(b.id, b.text)}</code>
            </pre>
          );
        case "image":
          return imageBlock(b);
      }
    })();
    return (
      <div key={b.id} data-kn-anchor={b.id} className="relative">
        <span aria-hidden className={cn("absolute -left-3.5 top-1 bottom-1 w-[2px] rounded-full transition-[background-color] duration-500", EASE)} style={{ background: bar }} />
        {body}
        {inline.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {inline.map(commentCard)}
          </div>
        )}
      </div>
    );
  }

  const status = (a: Actor) => {
    const p = presence[a.id];
    if (p?.away) return "Away";
    return p?.action ?? a.activity ?? (a.state ? STATE_LABEL[a.state] : "Idle");
  };

  /* ── Layout ── */

  return (
    <div ref={rootRef} role="region" aria-label={label} className={cn("@container flex flex-col gap-2.5 text-foreground", className)}>
      {table && (
        <SegmentedControl
          size="sm"
          aria-label="View"
          className="self-start"
          value={tab}
          onValueChange={(v) => setTab(v as CursorsTab)}
          options={[
            { value: "doc", label: "Doc" },
            { value: "table", label: "Table" },
          ]}
        />
      )}
      <div className={cn("overflow-visible rounded-2xl border bg-card text-card-foreground", HAIRLINE)}>
        <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5", HAIRLINE)}>
          <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <DocIcon />
            <span className="truncate">{doc.path ?? "Untitled"}</span>
          </span>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
            <span className="flex items-center gap-1.5" aria-label={`${agents.length} agents in this document, ${agents.filter(isActive).length} active`}>
              {agents.map((a) => {
                const t = toneOf(a.id);
                const away = presence[a.id]?.away;
                return (
                  <span key={a.id} title={`${a.label}: ${status(a)}`} className={cn("relative transition-[opacity,filter] duration-300", away && "opacity-45 grayscale")}>
                    <Avatar actor={a} t={t} size={22} ring={false} />
                    {isActive(a) && <span aria-hidden className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-card" style={{ background: t.color }} />}
                  </span>
                );
              })}
            </span>
            <span className="whitespace-nowrap text-[12.5px] text-muted-foreground tabular-nums" aria-live="polite">
              {pending.length} {pending.length === 1 ? "suggestion" : "suggestions"}
            </span>
            <span className="text-[12.5px] font-medium tabular-nums">{formatUsd(spend)}</span>
            <Button size="sm" onClick={acceptAll} disabled={!pending.length}>
              Accept all
            </Button>
          </div>
        </div>

        <div ref={frameRef} className="relative">
          {tab === "doc" ? (
            <div className={cn("grid gap-6 px-6 py-6 @[760px]:px-10", wide && docComments.length > 0 && "grid-cols-[minmax(0,1fr)_220px]")}>
              <div ref={pageRef} className="relative flex min-w-0 flex-col gap-3.5">
                {doc.blocks.map(block)}
              </div>
              {wide && docComments.length > 0 && (
                <aside aria-label="Comments" className="relative">
                  {docComments.map((c) => (
                    <div
                      key={c.id}
                      ref={(el) => {
                        if (el) railEls.current.set(c.id, el);
                        else railEls.current.delete(c.id);
                      }}
                      className={cn("absolute inset-x-0 transition-[top] duration-300 starting:opacity-0", EASE)}
                      style={{ top: railTops[c.id] ?? 0 }}
                    >
                      {commentCard(c)}
                    </div>
                  ))}
                </aside>
              )}
            </div>
          ) : (
            table && (
              <div className="overflow-x-auto px-4 py-4">
                <table className="w-full min-w-[520px] border-separate border-spacing-0 text-left text-[13px]">
                  <thead>
                    <tr>
                      {table.columns.map((c) => (
                        <th key={c} scope="col" className={cn("border-b px-3 py-2 text-[12px] font-medium text-muted-foreground", HAIRLINE)}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row) => (
                      <tr key={row.id}>
                        {row.cells.map((cell, ci) => {
                          const id = cellId(row.id, ci);
                          const by = activeIn(id);
                          return (
                            <td key={ci} data-kn-anchor={id} className={cn("border-b px-3 py-2.5 align-top transition-[box-shadow] duration-300", HAIRLINE, ci === 0 && "font-medium")} style={{ boxShadow: by ? `inset 0 0 0 1px ${toneOf(by).faint}` : "inset 0 0 0 1px transparent" }}>
                              <span data-kn-text="">{renderText(id, cell)}</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Pointers: decorative, the same information is in the legend and in each suggestion's label. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {agents.map((a) => {
              const t = toneOf(a.id);
              const away = presence[a.id]?.away;
              return (
                <Fragment key={a.id}>
                  <div
                    ref={(el) => {
                      if (el) pointerEls.current.set(a.id, el);
                      else pointerEls.current.delete(a.id);
                    }}
                    className="absolute left-0 top-0 opacity-0 transition-opacity duration-300 will-change-transform"
                  >
                    <svg width="20" height="22" viewBox="0 0 20 22" className="-translate-x-[2px] -translate-y-[2px] drop-shadow-[0_1px_2px_rgb(0_0_0/0.2)]">
                      <path d="M2.5 2 17.5 10.4l-6.6 1.7-3.3 6.9z" fill={t.color} stroke="white" strokeWidth="1" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div
                    ref={(el) => {
                      if (el) tagEls.current.set(a.id, el);
                      else tagEls.current.delete(a.id);
                    }}
                    className={cn("absolute left-0 top-0 flex max-w-[190px] flex-col rounded-lg border bg-popover px-2 py-1 text-popover-foreground opacity-0 data-on-text:bg-popover/92 data-on-text:backdrop-blur-sm shadow-[0_4px_12px_-4px_rgb(0_0_0/0.18)] transition-opacity duration-300 will-change-transform", HAIRLINE)}
                  >
                    <span className="flex items-center gap-1.5 text-[11.5px] leading-4 font-medium">
                      <span className="size-1.5 flex-none rounded-full" style={{ background: away ? "var(--muted-foreground)" : t.color }} />
                      <span className="truncate">{a.label}</span>
                    </span>
                    <span className="flex gap-1 pl-3 text-[10.5px] leading-4 whitespace-nowrap text-muted-foreground">
                      <span className="truncate">{status(a)}</span>
                      {a.spend != null && <span className="flex-none tabular-nums">· {formatUsd(a.spend)}</span>}
                    </span>
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>

        <ul aria-label="Agents" className={cn("flex flex-wrap gap-x-5 gap-y-1.5 border-t px-4 py-2.5 text-[12px]", HAIRLINE)}>
          {agents.map((a) => {
            const t = toneOf(a.id);
            const away = presence[a.id]?.away;
            return (
              <li key={a.id} className={cn("flex min-w-0 items-center gap-1.5", away && "text-muted-foreground")}>
                <span aria-hidden className="size-2 flex-none rounded-full" style={{ background: away ? "var(--muted-foreground)" : t.color }} />
                <span className="font-medium">{a.label}</span>
                <span className="truncate text-muted-foreground">{status(a)}</span>
                {a.spend != null && <span className="tabular-nums text-muted-foreground">{formatUsd(a.spend)}</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
