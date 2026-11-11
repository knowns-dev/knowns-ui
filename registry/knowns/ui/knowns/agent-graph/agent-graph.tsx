"use client";
/** @registry name="agent-graph" type="ui" title="Agent graph" description="Live graph of agents and the tools they call: tree, horizontal and center layouts, light streaks per call, detail popover." */

import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from "react";
import type { Actor, ActorState, Link, Span } from "@/registry/knowns/lib/knowns/types";
import { useAgentSnapshot, type AgentRun } from "@/registry/knowns/lib/knowns/run";
import { STATE_LABEL, actorColors, formatUsd, rootAgent, spanColor } from "@/registry/knowns/lib/knowns/status";
import { actorIcon } from "@/registry/knowns/lib/knowns/icons/actor-icon";
import { layoutScale } from "@/registry/knowns/lib/knowns/utils";
import { EASE, MOTION } from "@/registry/knowns/lib/knowns/motion-utils";
import { buildTree } from "./tree";
import { EMPTY_LAYOUT, layoutCenterStable, layoutFlow, layoutTree, type Layout } from "./layout";
import { layoutRadial } from "./radial";
import { contentBox, fitFrame, nodeBox, type Corner as ZoomCorner, type SafeArea } from "./frame";
import { pairKey, roundedPath, route, type Pt } from "./routing";
import { PulseLayer, type Flash, type Pulse, type PulseKind } from "./pulse-layer";
import { DetailCard } from "./detail-card";
import { Badge } from "../badge";
import { Button } from "../button";

export type AgentGraphLayout = "tree" | "horizontal" | "center" | "radial";
/** Where the zoom controls sit in a fixed frame. */
export type AgentGraphZoomCorner = ZoomCorner;

export interface AgentGraphHandle {
  /** Play the intro again from the start. */
  replayIntro: () => void;
}

export interface AgentGraphProps {
  /** A run created with `useAgentRun` / `createAgentRun`. Takes precedence over the data props. */
  run?: AgentRun;
  actors?: Actor[];
  /** Newest last. A new id sends a streak; once it gets an `outcome` the answer travels back. */
  spans?: Span[];
  /** Permanent links, drawn before any span uses them. */
  links?: Link[];
  /**
   * "tree": top-down. "horizontal": left to right, grows downward.
   * "center": root agent in the middle, branches on both sides (falls back to "tree" below 520px).
   * "radial": root agent in the middle, agents on an inner ring, tools on an outer ring beside their agent
   * (falls back to "tree" below 520px).
   */
  layout?: AgentGraphLayout;
  /** Controlled selection. Leave undefined to let the graph manage it. */
  selectedId?: string | null;
  onActorSelect?: (actor: Actor | null) => void;
  /** Clock for rates and link activity. Without it the graph ticks every second. */
  clock?: number;
  /** Window (ms) of spans counted toward link thickness. Default 20 000. */
  activityWindow?: number;
  /** Fixed height in px. Default: fits the graph. With a height, the graph sits in a fixed frame (see `fit`). */
  height?: number;
  /** Fixed width in px for the frame. Default: the container's width. */
  width?: number;
  /**
   * With a fixed height: "contain" (default) lays out for the frame and, if it still doesn't fit, scales the
   * whole canvas down to fit it (no scrollbars; pan and zoom instead). "none": the old behaviour, the canvas
   * scrolls sideways.
   */
  fit?: "contain" | "none";
  /**
   * Zoom out / in / fit buttons in a corner of the frame. Default: true ("bottom-right") in a fixed frame.
   * Fitting keeps the graph clear of them.
   */
  zoomControls?: boolean | ZoomCorner;
  /**
   * Touch in a fixed frame. "pan" (default): one finger pans, two pinch, like a canvas app. "scroll": swipes
   * scroll the page (touch-action: pan-y) and the graph only takes taps and its zoom buttons. Use "scroll"
   * when the graph sits in a long page, such as a landing hero, so a swipe never gets trapped.
   */
  touch?: "pan" | "scroll";
  formatSpend?: (amount: number) => string;
  /** Header title, or false to hide the header bar. */
  header?: ReactNode | false;
  /** Replace the body of the detail popover. */
  renderDetail?: (actor: Actor, spans: Span[]) => ReactNode;
  /**
   * How the graph appears on first layout (and after a reset, a new run, or replayIntro()).
   * "grow": nodes are revealed from You outward, each link drawing into its child before the child
   * pops in; "fade": a light fade; false: no intro (default). Skipped with reduced motion. "grow" is the one
   * kn-motion exception here: it explains the mechanism, so it plays on first layout and staggers past 4 items.
   */
  intro?: "grow" | "fade" | false;
  /** "grow": ms between nodes. Default 180; scaled down so the whole intro stays near 2.5s. */
  introSpeed?: number;
  /** Imperative handle: `replayIntro()`. */
  ref?: Ref<AgentGraphHandle>;
  className?: string;
}

const NARROW = 520;
/** Streak travel along a link: a kn-motion exception, it shows a message moving and reads as a progress signal. */
const PULSE_MS = 900;
const FLASH_MS = 700;
const EDGE = 1.25;
const CARD_W = 300;
const CORNER = 10;
/** Zoomed far out in a frame, agent names scale back up by this (CSS; 1 at 62% zoom and closer, at most 1.9). */
const LABEL_BOOST = "max(1, min(1.9, calc(0.62 / var(--kn-s, 1))))";
/** The zoom cluster's inset from the frame edges (Tailwind 2.5). */
const ZOOM_INSET = 10;
const NO_ACTORS: Actor[] = [];
const NO_SPANS: Span[] = [];
const NO_LINKS: Link[] = [];

const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ── Glyphs ── */

const ClockGlyph = () => (
  <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true">
    <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const CheckGlyph = () => (
  <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true">
    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ── Component ── */

type DrawnLink = { a: string; b: string; heat: number; running: number; tree: boolean };

export function AgentGraph(props: AgentGraphProps) {
  const {
    run,
    layout: layoutMode = "tree",
    selectedId,
    onActorSelect,
    clock: clockProp,
    activityWindow = 20000,
    height,
    formatSpend = formatUsd,
    header = "Agent graph",
    renderDetail,
    className,
    intro = false,
    introSpeed = 180,
    width: frameW,
    fit = "contain",
    zoomControls,
    touch = "pan",
  } = props;
  /** A fixed frame: the canvas is scaled to fit `height` (and `width`), with pan and zoom. */
  const framed = height !== undefined && fit === "contain";
  const showZoom = framed && zoomControls !== false;
  const zoomCorner: ZoomCorner = typeof zoomControls === "string" ? zoomControls : "bottom-right";

  const snap = useAgentSnapshot(run);
  const actors = snap?.actors ?? props.actors ?? NO_ACTORS;
  const spans = snap?.spans ?? props.spans ?? NO_SPANS;
  const permanent = snap?.links ?? props.links ?? NO_LINKS;

  const gid = `ag${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = width > 0 && width < NARROW;

  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    if (clockProp !== undefined) return;
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [clockProp]);
  const clock = clockProp ?? tick;

  const byId = useMemo(() => new Map(actors.map((a) => [a.id, a])), [actors]);
  const lead = rootAgent(actors);

  /* Links used by spans (and permanent ones), with activity. */
  const firstSeen = useRef(new Map<string, number>());
  const spanLinks = useMemo(() => {
    const map = new Map<string, DrawnLink>();
    const add = (x: string, y: string) => {
      if (x === y || !byId.has(x) || !byId.has(y)) return null;
      const k = pairKey(x, y);
      if (!firstSeen.current.has(k)) firstSeen.current.set(k, firstSeen.current.size);
      let l = map.get(k);
      if (!l) {
        const [a, b] = x < y ? [x, y] : [y, x];
        l = { a, b, heat: 0, running: 0, tree: false };
        map.set(k, l);
      }
      return l;
    };
    for (const [x, y] of permanent) add(x, y);
    for (const s of spans) {
      const l = add(s.from, s.to);
      if (!l) continue;
      if (s.startedAt >= clock - activityWindow && s.startedAt <= clock + 1000) l.heat++;
      if (!s.outcome) l.running++;
    }
    return map;
  }, [permanent, spans, byId, clock, activityWindow]);

  const adjacency = (links: Iterable<DrawnLink>) => {
    const m = new Map<string, Set<string>>();
    for (const { a, b } of links) {
      if (!m.has(a)) m.set(a, new Set());
      if (!m.has(b)) m.set(b, new Set());
      m.get(a)!.add(b);
      m.get(b)!.add(a);
    }
    return m;
  };

  // The tree only changes with topology, so actors stay put while spans stream in.
  const topoKey = useMemo(
    () => [...spanLinks.keys()].sort().join("|") + "#" + actors.map((a) => `${a.id}:${a.type}:${a.root ? 1 : 0}`).join(","),
    [spanLinks, actors],
  );
  const tree = useMemo(
    () => buildTree(actors, adjacency(spanLinks.values()), (a, b) => firstSeen.current.get(pairKey(a, b)) ?? Infinity),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topoKey],
  );

  /* Drawn links: every tree edge, plus span links that cross branches. */
  const links = useMemo(() => {
    const map = new Map<string, DrawnLink>();
    for (const [child, p] of tree.parent) {
      if (!p) continue;
      const k = pairKey(child, p);
      const base = spanLinks.get(k);
      const [a, b] = child < p ? [child, p] : [p, child];
      map.set(k, { a, b, heat: base?.heat ?? 0, running: base?.running ?? 0, tree: true });
    }
    for (const [k, l] of spanLinks) if (!map.has(k)) map.set(k, { ...l, tree: false });
    return map;
  }, [tree, spanLinks]);
  const neighbors = useMemo(() => adjacency(links.values()), [links]);

  const leadId = lead?.id;
  const agentKey = actors.filter((a) => a.type === "agent").map((a) => a.id).join(",");
  const agentIds = useMemo(() => new Set(agentKey.split(",")), [agentKey]);
  // Center re-lays out on every join or leave (everyone eases to the new spots); bursts of changes within
  // ~150ms make one relayout (at most 400ms late while changes keep coming). Other layouts use `tree` as is.
  const [centerTree, setCenterTree] = useState(tree);
  const burst = useRef<{ timer?: ReturnType<typeof setTimeout>; since?: number }>({});
  useEffect(() => {
    if (layoutMode !== "center") {
      clearTimeout(burst.current.timer);
      burst.current = {};
      setCenterTree(tree);
      return;
    }
    const b = burst.current;
    const now = Date.now();
    b.since ??= now;
    clearTimeout(b.timer);
    const flush = () => {
      burst.current = {};
      setCenterTree(tree);
    };
    if (now - b.since >= 400) flush();
    else b.timer = setTimeout(flush, 150);
  }, [tree, layoutMode]);
  useEffect(() => () => clearTimeout(burst.current.timer), []);
  // Center and radial reuse the previous layout (prev is only reused for the same key) to stay calm.
  const stable = useRef<{ key: string; layout: Layout } | null>(null);
  const geo = useMemo(() => {
    if (!width) return EMPTY_LAYOUT;
    const isStable = (layoutMode === "center" || layoutMode === "radial") && !narrow;
    if (!isStable) stable.current = null; // leaving center / radial: come back with a full layout
    // In a fixed frame the canvas is scaled to fit, so rows keep their natural spacing (no squeezing).
    if (layoutMode === "tree" || narrow && (layoutMode === "center" || layoutMode === "radial")) return layoutTree(tree, width, height, narrow, !framed);
    if (layoutMode === "horizontal") return layoutFlow(tree, width, height, narrow, false, leadId, agentIds, !framed);
    const key = `${layoutMode}|${width}|${height ?? ""}|${narrow}`;
    const prev = stable.current?.key === key ? stable.current.layout : null;
    const callers = new Map([...neighbors].map(([id, set]) => [id, [...set].filter((x) => agentIds.has(x))]));
    const next =
      layoutMode === "radial"
        ? layoutRadial(prev, tree, { avail: width, fixedH: height, narrow, leadId, agents: agentIds, callers })
        : layoutCenterStable(prev, centerTree, { avail: width, fixedH: height, narrow, leadId, agents: agentIds });
    stable.current = { key, layout: next };
    return next;
    // `neighbors` only matters for radial (shared tools); it changes with the tree anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, centerTree, width, height, narrow, layoutMode, leadId, agentIds]);
  const targets = geo.pos;
  const stageH = geo.height;
  const canvasW = geo.width;

  // Wider than the container: start scrolled to the root agent.
  const stageRef = useRef<HTMLDivElement>(null);
  const leadX = leadId ? targets.get(leadId)?.x : undefined;
  useEffect(() => {
    const el = stageRef.current;
    if (framed || !el || leadX === undefined || canvasW <= el.clientWidth) return;
    el.scrollLeft = leadX - el.clientWidth / 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasW]);

  /* ── Fixed frame: scale to fit, pan and zoom ──
     One transform on one layer (nodes, links, pulses, card), written straight to the DOM so zooming and
     panning never re-render the graph. A relayout re-fits, unless the user zoomed or panned (then their
     view is kept, clamped); "Fit" or a double-click on empty space goes back to fitting. */
  const layerRef = useRef<HTMLDivElement>(null);
  const view = useRef({ s: 1, x: 0, y: 0, user: false, shown: false });
  const frameBoxW = width;
  const frameBoxH = height ?? 0;
  // The zoom cluster's footprint (its size plus its inset from the frame edges), measured once it renders,
  // and where the stage starts inside the card (the cluster is placed against the card, under the header).
  const zoomRef = useRef<HTMLDivElement>(null);
  const [zoomBox, setZoomBox] = useState<{ w: number; h: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = zoomRef.current;
    if (!showZoom || !el) return setZoomBox(null);
    const measure = () => {
      const next = { w: el.offsetWidth + ZOOM_INSET, h: el.offsetHeight + ZOOM_INSET, top: stageRef.current?.offsetTop ?? 0 };
      setZoomBox((b) => (b && b.w === next.w && b.h === next.h && b.top === next.top ? b : next));
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [showZoom, zoomCorner]);
  const safeArea: SafeArea | null = showZoom && zoomBox ? { w: zoomBox.w, h: zoomBox.h, corner: zoomCorner } : null;
  // What has to fit: the nodes as drawn (tile + label), not the whole canvas with its padding.
  const content = useMemo(() => {
    const nodes = [...geo.pos].map(([id, p]) => {
      const a = byId.get(id);
      const tile = id === leadId ? (narrow ? 48 : 64) : a?.type === "agent" ? (narrow ? 42 : 56) : geo.stacked.has(id) ? (narrow ? 34 : 42) : narrow ? 36 : 48;
      return { x: p.x, y: p.y, tile, room: Math.max(64, Math.min(160, geo.room.get(id) ?? 120)) };
    });
    return { box: contentBox(nodes) ?? { x0: 0, y0: 0, x1: canvasW, y1: stageH }, nodes: nodes.map((n) => nodeBox(n)) };
  }, [geo, byId, leadId, narrow, canvasW, stageH]);
  const fitView = useCallback(
    () => fitFrame(frameBoxW, frameBoxH, content.box, safeArea, content.nodes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frameBoxW, frameBoxH, content, safeArea?.w, safeArea?.h, safeArea?.corner],
  );
  const clampView = useCallback(() => {
    const v = view.current;
    const fitS = fitView().s;
    v.s = Math.max(Math.min(fitS, 1) * 0.5, Math.min(3, v.s));
    // Keep at least a fifth of the canvas in the frame.
    const w = canvasW * v.s;
    const h = stageH * v.s;
    v.x = Math.max(frameBoxW * 0.2 - w, Math.min(frameBoxW * 0.8, v.x));
    v.y = Math.max(frameBoxH * 0.2 - h, Math.min(frameBoxH * 0.8, v.y));
  }, [fitView, canvasW, stageH, frameBoxW, frameBoxH]);
  const applyView = useCallback((animate: boolean) => {
    const layer = layerRef.current;
    const stage = stageRef.current;
    if (!layer || !stage) return;
    const v = view.current;
    const still = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    layer.style.transition = animate && !still ? "transform 450ms var(--kn-ease-inout,cubic-bezier(.65,0,.35,1))" : "none";
    layer.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.s})`;
    layer.style.setProperty("--kn-s", String(v.s));
    // Semantic zoom: CSS hides sub-labels (and, further out, tool labels); names of agents stay.
    stage.dataset.zoom = v.s < 0.5 ? "far" : v.s < 0.7 ? "mid" : "near";
  }, []);
  useLayoutEffect(() => {
    if (!framed || !frameBoxW || !canvasW) return;
    const v = view.current;
    if (v.user) clampView();
    else Object.assign(v, fitView());
    applyView(v.shown);
    v.shown = true;
  }, [framed, frameBoxW, frameBoxH, canvasW, stageH, fitView, clampView, applyView]);
  // Pointer on the canvas (but not on the zoom cluster): the cluster steps back so what's under it shows.
  const [overCanvas, setOverCanvas] = useState(false);
  const fitNow = useCallback(() => {
    Object.assign(view.current, fitView(), { user: false });
    applyView(true);
  }, [fitView, applyView]);
  const zoomAt = useCallback(
    (factor: number, px: number, py: number, animate: boolean) => {
      const v = view.current;
      const s0 = v.s;
      v.s = s0 * factor;
      clampView();
      const k = v.s / s0;
      v.x = px - (px - v.x) * k;
      v.y = py - (py - v.y) * k;
      v.user = true;
      clampView();
      applyView(animate);
    },
    [clampView, applyView],
  );
  // ctrl/⌘ + wheel (and trackpad pinch, which arrives as ctrl + wheel) zooms around the cursor. A plain wheel
  // still scrolls the page. Native listener: React's wheel handler is passive.
  useEffect(() => {
    const el = stageRef.current;
    if (!framed || !el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      // Screen px to the stage's layout px, so the focal point holds under CSS zoom (a docs preview at 50%).
      const r = el.getBoundingClientRect();
      const k = layoutScale(el);
      zoomAt(Math.exp(-e.deltaY * 0.0022), (e.clientX - r.left) / k.x, (e.clientY - r.top) / k.y, false);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [framed, zoomAt]);
  // Drag on empty canvas pans; two fingers pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean; dist?: number } | null>(null);
  const isEmptyTarget = (t: EventTarget | null) => !(t as HTMLElement | null)?.closest?.("button, a, input, [role=dialog], [data-zoom-controls], [data-card]");
  const onStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // touch="scroll": a finger never starts a pan, so the page keeps the swipe.
    if (!framed || (e.pointerType === "mouse" && e.button !== 0) || (e.pointerType === "touch" && touch === "scroll") || !isEmptyTarget(e.target)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
    const v = view.current;
    const pts = [...pointers.current.values()];
    gesture.current =
      pts.length >= 2
        ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2, vx: v.x, vy: v.y, moved: true, dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) }
        : { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y, moved: false };
  };
  const onStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!framed || !g || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const v = view.current;
    if (pts.length >= 2 && g.dist) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const r = e.currentTarget.getBoundingClientRect();
      const k = layoutScale(e.currentTarget);
      zoomAt(d / g.dist, ((pts[0].x + pts[1].x) / 2 - r.left) / k.x, ((pts[0].y + pts[1].y) / 2 - r.top) / k.y, false);
      g.dist = d;
      return;
    }
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.moved && Math.hypot(dx, dy) < 4) return;
    g.moved = true;
    // The drag follows the pointer in layout px (screen px divided by any CSS zoom).
    const k = layoutScale(e.currentTarget);
    v.x = g.vx + dx / k.x;
    v.y = g.vy + dy / k.y;
    v.user = true;
    clampView();
    applyView(false);
  };
  const onStagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (!pointers.current.size) gesture.current = null;
  };

  const perMinute = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of spans) {
      if (s.startedAt < clock - 60000) continue;
      m.set(s.from, (m.get(s.from) ?? 0) + 1);
      m.set(s.to, (m.get(s.to) ?? 0) + 1);
    }
    return m;
  }, [spans, clock]);

  /* Position easing (only runs while actors move to a new layout). */
  const display = useRef(new Map<string, Pt>());
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const raf = useRef<number | null>(null);
  const lastStep = useRef(0);
  const [, setFrame] = useState(0);

  const step = useCallback(() => {
    const t = performance.now();
    const dt = lastStep.current ? Math.min(1000, t - lastStep.current) : 16;
    lastStep.current = t;
    const k = 1 - Math.exp(-dt / 120); // time-based, so throttled tabs still converge
    let moving = false;
    const disp = display.current;
    for (const id of [...disp.keys()]) if (!targetsRef.current.has(id)) disp.delete(id);
    for (const [id, tgt] of targetsRef.current) {
      const cur = disp.get(id);
      if (!cur) {
        disp.set(id, { ...tgt });
        continue;
      }
      const dx = tgt.x - cur.x;
      const dy = tgt.y - cur.y;
      if (Math.abs(dx) + Math.abs(dy) < 0.5) {
        cur.x = tgt.x;
        cur.y = tgt.y;
      } else {
        cur.x += dx * k;
        cur.y += dy * k;
        moving = true;
      }
    }
    return moving;
  }, []);

  const kick = useCallback(() => {
    if (raf.current !== null) return;
    const loop = () => {
      const busy = step();
      setFrame((f) => (f + 1) % 1e9);
      raf.current = busy ? requestAnimationFrame(loop) : null;
      if (!busy) lastStep.current = 0;
    };
    raf.current = requestAnimationFrame(loop);
  }, [step]);

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    },
    [],
  );

  if (display.current.size === 0 && targets.size) for (const [id, p] of targets) display.current.set(id, { ...p });
  useEffect(() => {
    for (const [id, p] of targets) if (!display.current.has(id)) display.current.set(id, { ...p });
    kick();
  }, [targets, kick]);

  /* Intro: when each node becomes visible (performance.now ms). Filled by the intro effect below. */
  const introShown = useRef(new Map<string, number>());

  /* Spans → streaks. */
  const pulses = useRef<Pulse[]>([]);
  const flashes = useRef<Flash[]>([]);
  const pulseKick = useRef<(() => void) | null>(null);
  const seen = useRef(new Map<string, "run" | "success" | "failure">());
  const mounted = useRef(false);
  useEffect(() => {
    const t = performance.now();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dur = reduce ? 1 : PULSE_MS;
    const answer = (s: Span, start: number) => {
      const kind: PulseKind = s.outcome === "failure" ? "fail" : "ok";
      pulses.current.push({ key: `${s.id}:a`, from: s.to, to: s.from, start, dur, kind });
      if (kind === "fail") flashes.current.push({ from: s.from, to: s.to, start, until: start + dur + FLASH_MS });
    };
    // During the intro, a streak waits until both of its ends have appeared.
    const shown = (id: string) => introShown.current.get(id) ?? 0;
    const at = (s: Span, base: number) => Math.max(base, shown(s.from), shown(s.to));
    for (const s of spans) {
      const st = s.outcome ?? "run";
      const prev = seen.current.get(s.id);
      seen.current.set(s.id, st);
      if (prev === undefined) {
        if (!mounted.current && Date.now() - s.startedAt > 3000) continue;
        const t0 = at(s, t);
        pulses.current.push({ key: `${s.id}:o`, from: s.from, to: s.to, start: t0, dur, kind: "out" });
        if (st !== "run") answer(s, t0 + dur);
      } else if (prev === "run" && st !== "run") {
        answer(s, at(s, t));
      }
    }
    if (seen.current.size > spans.length * 2 + 200) {
      const live = new Set(spans.map((s) => s.id));
      for (const id of seen.current.keys()) if (!live.has(id)) seen.current.delete(id);
    }
    mounted.current = true;
    pulseKick.current?.();
  }, [spans]);

  /* Selection and focus. */
  const [ownSelected, setOwnSelected] = useState<string | null>(null);
  const selected = selectedId !== undefined ? selectedId : ownSelected;
  const [hot, setHot] = useState<string | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const closeRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(0);
  const onSelectRef = useRef(onActorSelect);
  onSelectRef.current = onActorSelect;

  const select = useCallback(
    (id: string | null) => {
      setOwnSelected(id);
      onSelectRef.current?.(id ? byId.get(id) ?? null : null);
    },
    [byId],
  );

  useEffect(() => {
    if (selected && !byId.has(selected)) select(null);
  }, [selected, byId, select]);

  useEffect(() => {
    if (selected) closeRef.current?.focus();
  }, [selected]);

  useLayoutEffect(() => {
    const h = cardRef.current?.offsetHeight ?? 0;
    if (Math.abs(h - cardH) > 1) setCardH(h);
  });

  const closeCard = useCallback(() => {
    const id = selected;
    select(null);
    if (id) requestAnimationFrame(() => nodeRefs.current.get(id)?.focus());
  }, [selected, select]);

  /* Derived display data. */
  const stateOf = (a: Actor): ActorState =>
    a.state ?? (spans.some((s) => !s.outcome && (s.to === a.id || s.from === a.id)) ? "busy" : "idle");
  const blocked = actors.filter((a) => a.state === "blocked");
  const failed = actors.filter((a) => a.state === "failed");
  const hasSpend = actors.some((a) => a.spend !== undefined);
  const totalSpend = actors.reduce((n, a) => n + (a.spend ?? 0), 0);
  const totalPerMin = spans.filter((s) => s.startedAt >= clock - 60000).length;

  // DOM and tab order follow the tree: top to bottom, left to right.
  const ordered = useMemo(() => {
    const out: Actor[] = [];
    const walk = (id: string) => {
      const a = byId.get(id);
      if (a) out.push(a);
      for (const c of tree.children.get(id) ?? []) walk(c);
    };
    tree.roots.forEach(walk);
    return out;
  }, [tree, byId]);

  const hues = useMemo(() => actorColors(actors), [actors]);
  const hueFor = (a: string, b: string) => spanColor(hues, leadId, a, b);
  const hueOf = (id: string) => hues.get(id) ?? "var(--muted-foreground)";

  const focusSet = hot ? new Set([hot, ...(neighbors.get(hot) ?? [])]) : null;

  const tileSize = (a: Actor) =>
    a === lead
      ? narrow ? 48 : 64
      : a.type === "agent"
        ? narrow ? 42 : 56
        : geo.stacked.has(a.id)
          ? narrow ? 34 : 42
          : narrow ? 36 : 48;
  const labelRoom = (a: Actor) => Math.max(64, Math.min(160, geo.room.get(a.id) ?? 120));

  const iconFor = (a: Actor): ReactNode => actorIcon(a, a === lead);

  const pos = (id: string) => display.current.get(id) ?? targets.get(id);
  const dip = Math.max(28, geo.rowGap * 0.35);
  const pathFor = (from: string, to: string, isTree: boolean): Pt[] | null => {
    const a = pos(from);
    const b = pos(to);
    if (!a || !b) return null;
    if (isTree) {
      const child = tree.parent.get(to) === from ? to : tree.parent.get(from) === to ? from : null;
      if (child && geo.stacked.has(child)) {
        // File-tree spine: straight down from the parent, then across into the child.
        const [P, C] = child === to ? [a, b] : [b, a];
        const pts = [P, { x: P.x, y: C.y }, C];
        return child === to ? pts : pts.reverse();
      }
      // The layout's own route (e.g. the center layout's tool grids), from live positions.
      if (child && geo.routeFor) {
        const [P, C] = child === to ? [a, b] : [b, a];
        const custom = geo.routeFor(child, P, C);
        if (custom) return child === to ? custom : [...custom].reverse();
      }
    }
    return route(a, b, !isTree, dip, geo.orient);
  };

  // A streak reaching an actor makes its halo flare up in the streak's colour.
  // Web Animations on the ring element: no React render, layered over the breathing.
  const arriveRef = useRef((id: string, color: string) => {
    const flare = nodeRefs.current.get(id)?.querySelector<HTMLElement>("[data-flare]");
    if (!flare?.animate || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // The glow is drawn once in the streak's colour; only its opacity moves (kn-motion: no box-shadow animation).
    flare.style.boxShadow = `0 0 0 2px color-mix(in srgb, ${color} 70%, transparent), 0 0 18px 6px color-mix(in srgb, ${color} 56%, transparent)`;
    flare.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { duration: MOTION.slow, easing: EASE.out });
  });
  const pulsePathRef = useRef((from: string, to: string) => pathFor(from, to, links.get(pairKey(from, to))?.tree ?? true));
  pulsePathRef.current = (from, to) => pathFor(from, to, links.get(pairKey(from, to))?.tree ?? true);
  const hueRef = useRef(hueFor);
  hueRef.current = hueFor;

  /* ── Intro ──
     Armed on mount, after a reset (the graph empties), when the run changes, or by replayIntro().
     Runs once on the next layout: WAAPI animations with delays computed up front (transform, opacity,
     stroke-dashoffset only), so React doesn't render per frame. */
  const introArmed = useRef(true);
  const [introTick, setIntroTick] = useState(0);
  /** The introTick an intro last ran for; the join effect treats that commit as a reveal, not joins. */
  const introRanAt = useRef(-1);
  useImperativeHandle(props.ref, () => ({
    replayIntro: () => {
      introArmed.current = true;
      setIntroTick((t) => t + 1);
    },
  }));
  const lastRun = useRef(run);
  if (lastRun.current !== run) {
    lastRun.current = run;
    introArmed.current = true;
  }
  if (actors.length === 0) introArmed.current = true;

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!introArmed.current || !root || !width || targets.size === 0) return;
    introArmed.current = false;
    introRanAt.current = introTick;
    const shown = introShown.current;
    shown.clear();
    root.getAnimations?.({ subtree: true }).forEach((an) => an.id === "kn-intro" && an.cancel());
    if (intro === false || matchMedia("(prefers-reduced-motion: reduce)").matches || typeof root.animate !== "function") return;
    const now = performance.now();
    const nodeEl = (id: string) => root.querySelector<HTMLElement>(`[data-actor="${CSS.escape(id)}"]`);

    if (intro === "fade") {
      root.querySelectorAll<HTMLElement>("[data-actor]").forEach((el) => {
        const an = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOTION.base, easing: EASE.out, fill: "backwards" });
        an.id = "kn-intro";
      });
      return;
    }

    // "grow": breadth-first from You (the roots), children in tree order.
    const order: string[] = [];
    const queue = [...tree.roots];
    while (queue.length) {
      const id = queue.shift()!;
      if (targets.has(id)) order.push(id);
      queue.push(...(tree.children.get(id) ?? []));
    }
    const POP = MOTION.slow;
    const n = order.length;
    // Cap the whole reveal near 2.5s: the step shrinks for big graphs.
    const step = Math.max(24, Math.min(introSpeed, n > 1 ? (2500 - POP) / (n - 1) : introSpeed));
    const draw = Math.min(MOTION.slow, step * 1.4);
    const appear = new Map<string, number>();
    order.forEach((id, i) => {
      const hasParent = !!tree.parent.get(id) && appear.has(tree.parent.get(id)!);
      const d = i === 0 ? 0 : i * step + (hasParent ? draw * 0.5 : 0);
      appear.set(id, d);
      shown.set(id, now + d + POP * 0.6);
      const el = nodeEl(id);
      if (!el) return;
      const an = el.animate(
        [
          { opacity: 0, transform: "scale(0.9)" },
          { opacity: 1, transform: "scale(1)" },
        ],
        { duration: POP, delay: d, easing: EASE.out, fill: "backwards" },
      );
      an.id = "kn-intro";
    });
    // Links: tree links draw from parent into the child just before it pops; cross links fade in later.
    root.querySelectorAll<SVGPathElement>("path[data-a]").forEach((el) => {
      const a = el.dataset.a!;
      const b = el.dataset.b!;
      const da = appear.get(a);
      const db = appear.get(b);
      if (da === undefined || db === undefined) return;
      if (el.dataset.tree) {
        const child = tree.parent.get(a) === b ? a : b;
        const parentId = child === a ? b : a;
        const len = el.getTotalLength?.() ?? 0;
        if (!len) return;
        const start = el.getPointAtLength(0);
        const pp = targets.get(parentId);
        // Draw from the parent's end of the path.
        const fromStart = !pp || Math.hypot(start.x - pp.x, start.y - pp.y) < Math.hypot(start.x - (targets.get(child)?.x ?? 0), start.y - (targets.get(child)?.y ?? 0));
        const an = el.animate(
          [
            { strokeDasharray: `${len} ${len}`, strokeDashoffset: fromStart ? len : -len },
            { strokeDasharray: `${len} ${len}`, strokeDashoffset: 0 },
          ],
          { duration: draw, delay: Math.max(0, appear.get(child)! - draw * 0.5), easing: EASE.out, fill: "backwards" },
        );
        an.id = "kn-intro";
      } else {
        const an = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOTION.slow, delay: Math.max(da, db) + POP, easing: EASE.out, fill: "backwards" });
        an.id = "kn-intro";
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introTick, width, targets, intro, introSpeed]);

  /* ── Join / leave ──
     A node that joins: its parent link draws (280ms), then the tile grows from 0.9 and fades in as the line
     arrives (280ms) and the label rises 6px. A node that leaves shrinks to 0.9 and fades, its link undraws
     (shorter than the enter), and only then is it unmounted. WAAPI only; reduced motion: instant. */
  const known = useRef<Set<string> | null>(null);
  const leaving = useRef(new Map<string, { actor: Actor; p: Pt; size: number; d?: string; at: number }>());
  const [, setLeaveTick] = useState(0);
  const lastActors = useRef<Actor[]>(actors);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !width || targets.size === 0) return;
    const ids = new Set(ordered.map((a) => a.id));
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const prevIds = known.current;
    known.current = ids;
    // First layout (or right after an intro took over): nothing "joins".
    if (!prevIds || introRanAt.current === introTick) {
      introRanAt.current = -1;
      return;
    }
    if (reduce || typeof root.animate !== "function") return;
    for (const id of ids) {
      if (prevIds.has(id)) continue;
      const el = root.querySelector<HTMLElement>(`[data-actor="${CSS.escape(id)}"]`);
      if (!el) continue;
      const parentId = tree.parent.get(id);
      const path = parentId
        ? [...root.querySelectorAll<SVGPathElement>("path[data-a]")].find((x) => (x.dataset.a === id && x.dataset.b === parentId) || (x.dataset.b === id && x.dataset.a === parentId))
        : undefined;
      const DRAW = MOTION.slow;
      let delay = 0;
      if (path && parentId && prevIds.has(parentId)) {
        const len = path.getTotalLength?.() ?? 0;
        if (len) {
          const start = path.getPointAtLength(0);
          const pp = targets.get(parentId);
          const cp = targets.get(id);
          const fromStart = !pp || !cp || Math.hypot(start.x - pp.x, start.y - pp.y) < Math.hypot(start.x - cp.x, start.y - cp.y);
          path.animate(
            [
              { strokeDasharray: `${len} ${len}`, strokeDashoffset: fromStart ? len : -len },
              { strokeDasharray: `${len} ${len}`, strokeDashoffset: 0 },
            ],
            { duration: DRAW, easing: EASE.out, fill: "backwards" },
          ).id = "kn-join";
          delay = DRAW * 0.75; // the tile starts growing as the line arrives
        }
      }
      const tile = el.querySelector<HTMLElement>("[data-tile]");
      const label = el.querySelector<HTMLElement>("[data-label]");
      tile?.animate([{ scale: "0.9", opacity: 0 }, { scale: "1", opacity: 1 }], { duration: MOTION.slow, delay, easing: EASE.out, fill: "backwards" });
      label?.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: MOTION.base, delay: delay + 40, easing: EASE.out, fill: "backwards" });
    }
  });

  // Leaving: remember what disappeared (not on a reset, which clears everything at once).
  useLayoutEffect(() => {
    const before = lastActors.current;
    lastActors.current = actors;
    if (!actors.length || before === actors) return;
    const now = new Set(actors.map((a) => a.id));
    const gone = before.filter((a) => !now.has(a.id) && display.current.has(a.id));
    if (!gone.length || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const a of gone) {
      const p = { ...display.current.get(a.id)! };
      const parentPath = rootRef.current
        ? [...rootRef.current.querySelectorAll<SVGPathElement>("path[data-a]")].find((x) => x.dataset.a === a.id || x.dataset.b === a.id)
        : undefined;
      leaving.current.set(a.id, { actor: a, p, size: tileSize(a), d: parentPath?.getAttribute("d") ?? undefined, at: performance.now() });
    }
    setLeaveTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actors]);

  // Animate ghosts out once they are mounted, then drop them.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !leaving.current.size) return;
    let latest = 0;
    for (const [id, g] of leaving.current) {
      const el = root.querySelector<HTMLElement>(`[data-ghost="${CSS.escape(id)}"]`);
      if (!el || el.dataset.animated) continue;
      el.dataset.animated = "1";
      el.querySelector<HTMLElement>("[data-tile]")?.animate([{ scale: "1", opacity: 1 }, { scale: "0.9", opacity: 0 }], { duration: MOTION.base, easing: EASE.out, fill: "forwards" });
      el.querySelector<HTMLElement>("[data-label]")?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: MOTION.fast, easing: EASE.out, fill: "forwards" });
      const path = root.querySelector<SVGPathElement>(`path[data-ghost-path="${CSS.escape(id)}"]`);
      const len = path?.getTotalLength?.() ?? 0;
      if (path && len)
        path.animate(
          [
            { strokeDasharray: `${len} ${len}`, strokeDashoffset: 0 },
            { strokeDasharray: `${len} ${len}`, strokeDashoffset: -len },
          ],
          { duration: MOTION.base, delay: 40, easing: EASE.out, fill: "forwards" },
        );
      latest = Math.max(latest, g.at);
    }
    const t = window.setTimeout(() => {
      const cutoff = performance.now() - (MOTION.base + 40);
      for (const [id, g] of leaving.current) if (g.at <= cutoff) leaving.current.delete(id);
      setLeaveTick((x) => x + 1);
    }, MOTION.base + 80);
    return () => clearTimeout(t);
  });

  // Quiet links first, busy ones on top, so shared bus segments show the busiest colour.
  const linkEls = [...links.entries()]
    .sort(([, x], [, y]) => x.running - y.running || x.heat - y.heat)
    .map(([k, l]) => {
      const pts = pathFor(l.a, l.b, l.tree);
      if (!pts) return null;
      // Links keep one hairline width; traffic shows only as the streak travelling along them.
      const w = EDGE;
      const dim = focusSet && !(l.a === hot || l.b === hot);
      return (
        <path
          key={k}
          data-a={l.a}
          data-b={l.b}
          data-tree={l.tree || undefined}
          d={roundedPath(pts, CORNER)}
          strokeWidth={w}
          style={{ ["--hue" as string]: hueFor(l.a, l.b) }}
          className={cn(
            "fill-none [stroke-linecap:round] [stroke-linejoin:round] transition-[stroke,opacity] duration-(--kn-dur) ease-(--kn-ease-out)",
            l.running
              ? "[stroke:color-mix(in_srgb,var(--hue)_22%,color-mix(in_srgb,var(--foreground)_12%,transparent))]"
              : "[stroke:color-mix(in_srgb,var(--foreground)_11%,transparent)]",
            !l.tree && "[stroke-dasharray:4_5]",
            dim && "opacity-20",
          )}
        />
      );
    });

  const sel = selected ? byId.get(selected) : undefined;
  const selPos = selected ? pos(selected) : undefined;
  let cardStyle: CSSProperties | undefined;
  if (sel && selPos && framed) {
    // In a fixed frame the card lives in the scaled layer but is scaled back by 1/k, so it reads at full
    // size and then moves with its node while panning. It's placed in frame pixels: beside the node on the
    // side with more room, clamped inside the frame, then converted back to canvas coordinates.
    const v = view.current;
    const half = (tileSize(sel) / 2) * v.s;
    const sx = v.x + selPos.x * v.s;
    const sy = v.y + selPos.y * v.s;
    const h = Math.min(cardH || 240, frameBoxH - 16);
    const left = Math.max(8, Math.min(frameBoxW - CARD_W - 8, sx < frameBoxW / 2 ? sx + half + 14 : sx - half - 14 - CARD_W));
    const top = Math.max(8, Math.min(frameBoxH - h - 8, sy - 40));
    cardStyle = {
      left: (left - v.x) / v.s,
      top: (top - v.y) / v.s,
      width: CARD_W,
      maxHeight: frameBoxH - 16,
      transform: "scale(calc(1 / var(--kn-s, 1)))",
      transformOrigin: "left top",
    };
  } else if (sel && selPos && !narrow) {
    const half = tileSize(sel) / 2;
    const left = selPos.x < canvasW / 2 ? selPos.x + half + 14 : selPos.x - half - 14 - CARD_W;
    const h = Math.min(cardH || 240, stageH - 16);
    cardStyle = {
      left: Math.max(8, Math.min(canvasW - CARD_W - 8, left)),
      top: Math.max(8, Math.min(stageH - h - 8, selPos.y - 40)),
      width: CARD_W,
      maxHeight: stageH - 16,
    };
  }

  const ariaFor = (a: Actor) => {
    const parts = [a.label, a.type, STATE_LABEL[stateOf(a)]];
    if (a.model) parts.push(a.model);
    if (a.activity) parts.push(a.activity);
    parts.push(`${perMinute.get(a.id) ?? 0} calls in the last minute`);
    return parts.join(", ");
  };

  return (
    <div
      ref={rootRef}
      style={frameW !== undefined ? { width: frameW, maxWidth: "100%" } : undefined}
      className={cn(
        "relative w-full min-w-0 overflow-hidden rounded-2xl border [border-color:color-mix(in_srgb,var(--foreground)_7%,transparent)] bg-card text-[13px] leading-snug text-card-foreground",
        "shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_5%,transparent),0_1px_2px_rgb(0_0_0/0.04)] dark:[background:color-mix(in_srgb,var(--card)_55%,#000)]",
        className,
      )}
    >
      {header !== false && (
        <div className="flex min-h-12 items-center justify-between gap-3 border-b [border-color:color-mix(in_srgb,var(--foreground)_6%,transparent)] px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true" className="relative size-[7px] flex-none rounded-full bg-emerald-500">
            </span>
            <div className="truncate font-semibold">{header}</div>
            {!narrow && (
              <div className="flex-none rounded-full border bg-muted/50 px-1.5 py-px text-[11px] tabular-nums text-muted-foreground">
                {totalPerMin}/min
              </div>
            )}
          </div>
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex gap-1.5" aria-live="polite">
              {blocked.length > 0 && (
                <Badge tone="warning" size="lg" shape="pill" icon={<ClockGlyph />} onClick={() => select(blocked[0].id)}>
                  {blocked.length} {blocked.length === 1 ? "needs" : "need"} you
                </Badge>
              )}
              {failed.length > 0 && (
                <Badge tone="danger" size="lg" shape="pill" icon={<span className="grid place-items-center text-[12px] font-bold leading-none">!</span>} onClick={() => select(failed[0].id)}>
                  {failed.length} failed
                </Badge>
              )}
            </div>
            {hasSpend && <div className="font-semibold tabular-nums">{formatSpend(totalSpend)}</div>}
          </div>
        </div>
      )}

      <div
        ref={stageRef}
        data-zoom="near"
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerUp}
        onPointerCancel={onStagePointerUp}
        onDoubleClick={(e) => framed && isEmptyTarget(e.target) && fitNow()}
        onPointerEnter={(e) => framed && e.pointerType === "mouse" && setOverCanvas(true)}
        onPointerLeave={() => setOverCanvas(false)}
        style={framed ? { height, touchAction: touch === "scroll" ? "pan-y" : "none" } : undefined}
        className={cn(
          "group/stage relative min-h-[200px] bg-muted/20 dark:bg-transparent [background-attachment:local] [background-image:radial-gradient(color-mix(in_srgb,var(--foreground)_7%,transparent)_1px,transparent_1.2px),linear-gradient(color-mix(in_srgb,var(--foreground)_3%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--foreground)_3%,transparent)_1px,transparent_1px)] [background-position:9px_9px,0_0,0_0] [background-size:18px_18px,90px_90px,90px_90px]",
          framed ? "cursor-grab select-none overflow-hidden active:cursor-grabbing" : "overflow-x-auto overflow-y-hidden",
        )}
      >
        <div
          ref={layerRef}
          className={cn("relative", framed ? "origin-top-left will-change-transform" : "min-w-full")}
          style={{ width: canvasW || undefined, height: width ? stageH : undefined }}
        >
          {width > 0 && (
            <>
              {/* Radial: a soft glow behind the lead, in its hue (a gradient, no filter). */}
              {geo.radial && leadId && targets.get(leadId) && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute rounded-full"
                  style={{
                    // The agent ring is an ellipse (vertical radius × aspect); the glow follows it.
                    left: targets.get(leadId)!.x - geo.radial.radii[0] * 1.1,
                    top: targets.get(leadId)!.y - geo.radial.radii[0] * geo.radial.aspect * 1.1,
                    width: geo.radial.radii[0] * 2.2,
                    height: geo.radial.radii[0] * geo.radial.aspect * 2.2,
                    background: `radial-gradient(closest-side, color-mix(in srgb, ${hueOf(leadId)} 16%, transparent), color-mix(in srgb, ${hueOf(leadId)} 5%, transparent) 55%, transparent)`,
                  }}
                />
              )}
              <svg className="absolute inset-0 overflow-visible" width={canvasW} height={stageH} aria-hidden="true">
                <g>{linkEls}</g>
                {[...leaving.current.values()].map((g) =>
                  g.d ? (
                    <path
                      key={`ghost-${g.actor.id}`}
                      data-ghost-path={g.actor.id}
                      d={g.d}
                      strokeWidth={EDGE}
                      className="fill-none [stroke-linecap:round] [stroke:color-mix(in_srgb,var(--foreground)_11%,transparent)]"
                    />
                  ) : null,
                )}
                <PulseLayer
                  pulses={pulses}
                  flashes={flashes}
                  pathRef={pulsePathRef}
                  hueRef={hueRef}
                  kickRef={pulseKick}
                  arriveRef={arriveRef}
                  corner={CORNER}
                />
              </svg>

              {ordered.map((a) => {
                const p = pos(a.id);
                if (!p) return null;
                const size = tileSize(a);
                const state = stateOf(a);
                const isLead = a === lead;
                const alert = state === "blocked" || state === "failed";
                const rate = perMinute.get(a.id) ?? 0;
                const sub = alert
                  ? STATE_LABEL[state]
                  : a.type === "tool"
                    ? rate
                      ? `${rate} ${rate === 1 ? "call" : "calls"}/min`
                      : undefined
                    : a.model;
                return (
                  <div
                    key={a.id}
                    data-actor={a.id}
                    style={{ left: p.x, top: p.y, ["--hue" as string]: hueOf(a.id) }}
                    className={cn(
                      "absolute size-0 transition-opacity duration-(--kn-dur-fast) ease-(--kn-ease-out) focus-within:z-10",
                      focusSet && !focusSet.has(a.id) && "opacity-30",
                      selected === a.id && "z-10",
                    )}
                  >
                    <button
                      ref={(el) => {
                        if (el) nodeRefs.current.set(a.id, el);
                        else nodeRefs.current.delete(a.id);
                      }}
                      type="button"
                      style={{ width: size, height: size }}
                      data-tile=""
                      aria-label={ariaFor(a)}
                      aria-expanded={selected === a.id}
                      aria-controls={selected === a.id ? `${gid}-card` : undefined}
                      onClick={() => (selected === a.id ? closeCard() : select(a.id))}
                      onMouseEnter={() => setHot(a.id)}
                      onMouseLeave={() => setHot((h) => (h === a.id ? null : h))}
                      onFocus={() => setHot(a.id)}
                      onBlur={() => setHot((h) => (h === a.id ? null : h))}
                      onKeyDown={(e) => {
                        if (e.key === "Escape" && selected) {
                          e.preventDefault();
                          closeCard();
                        }
                      }}
                      className={cn(
                        "absolute left-0 top-0 grid -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center border bg-card text-foreground",
                        "transition-[border-color,box-shadow] duration-(--kn-dur-fast) ease-(--kn-ease-out)",
                        // Quiet by default: a faint hairline, a deeper surface and a thin light on the top edge.
                        !isLead && !(a.type === "agent" && state === "busy") && !alert && "[border-color:color-mix(in_srgb,var(--foreground)_9%,transparent)] hover:[border-color:color-mix(in_srgb,var(--foreground)_18%,transparent)]",
                        !alert && "dark:[background:color-mix(in_srgb,var(--card)_70%,#000)]",
                        !isLead && selected !== a.id && "shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_6%,transparent),0_1px_2px_rgb(0_0_0/0.06),0_8px_20px_-12px_rgb(0_0_0/0.5)]",
                        "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:[outline-color:var(--hue)]",
                        isLead ? "rounded-[17px]" : geo.stacked.has(a.id) ? "rounded-[11px]" : "rounded-[14px]",
                        isLead &&
                          "[border-color:color-mix(in_srgb,var(--hue)_50%,var(--border))] shadow-[0_0_0_4px_color-mix(in_srgb,var(--hue)_12%,transparent),0_10px_28px_-10px_color-mix(in_srgb,var(--hue)_50%,transparent)]",
                        !isLead && a.type === "agent" && state === "busy" && "[border-color:color-mix(in_srgb,var(--hue)_40%,var(--border))]",
                        state === "blocked" && "border-amber-500 [background:color-mix(in_srgb,#f59e0b_9%,var(--card))]",
                        state === "failed" && "border-red-500 [background:color-mix(in_srgb,#ef4444_8%,var(--card))]",
                        state === "finished" && "opacity-80",
                        selected === a.id && "shadow-[0_0_0_3px_var(--background),0_0_0_5px_var(--hue)]",
                      )}
                    >
                      <span
                        data-ring
                        aria-hidden="true"
                        className={cn(
                          "pointer-events-none absolute -inset-px rounded-[inherit]",
                          state === "busy" && "animate-[kn-breathe_2.4s_ease-in-out_infinite] motion-reduce:animate-none",
                        )}
                      />
                      <span data-flare aria-hidden="true" className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-0" />
                      <span
                        aria-hidden="true"
                        className={cn(
                          "grid size-full place-items-center overflow-hidden rounded-[inherit] font-semibold",
                          narrow ? "text-[13px]" : "text-[15px]",
                        )}
                      >
                        {/* Built-in glyphs take the agent colour; brand logos carry their own. */}
                        <span
                          className={cn(
                            "grid size-[52%] place-items-center [&>svg]:size-full",
                            a.type === "agent" ? "text-[var(--hue)]" : a.type === "tool" ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {iconFor(a)}
                        </span>
                      </span>
                      {state === "blocked" && (
                        <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 grid size-[18px] place-items-center rounded-full border-2 border-background bg-amber-500 text-white">
                          <ClockGlyph />
                        </span>
                      )}
                      {state === "failed" && (
                        <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 grid size-[18px] place-items-center rounded-full border-2 border-background bg-red-500 text-[10px] font-extrabold text-white">
                          !
                        </span>
                      )}
                      {state === "finished" && (
                        <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 grid size-[18px] place-items-center rounded-full border-2 border-background bg-emerald-500 text-white">
                          <CheckGlyph />
                        </span>
                      )}
                    </button>
                    <div
                      aria-hidden="true"
                      data-label=""
                      style={{
                        top: size / 2 + 8,
                        maxWidth: labelRoom(a),
                        // In a frame zoomed far out, names of agents and the lead are scaled back up (to ~1.9×) to stay
                        // legible; the box shrinks by the same factor so the scaled label never outgrows its slot.
                        ...(framed && a.type !== "tool"
                          ? {
                              scale: LABEL_BOOST,
                              maxWidth: `calc(${labelRoom(a)}px / ${LABEL_BOOST})`,
                              transformOrigin: "top center",
                            }
                          : {}),
                      }}
                      className={cn(
                        "pointer-events-none absolute left-0 flex w-max -translate-x-1/2 flex-col items-center rounded-md bg-[color-mix(in_srgb,var(--background)_82%,transparent)] px-1.5 pb-0.5 pt-px text-center",
                        // Zoomed far out (a fixed frame scaled down): tool names go; agents and the lead keep theirs.
                        a.type === "tool" && "group-data-[zoom=far]/stage:hidden",
                      )}
                    >
                      <div className={cn("max-w-full truncate font-semibold", narrow ? "text-[11px]" : "text-[12.5px]")}>
                        {narrow ? a.short ?? a.label : a.label}
                      </div>
                      {alert ? (
                        <div
                          className={cn(
                            "max-w-full truncate text-[10.5px] font-semibold",
                            state === "blocked" ? "text-amber-700 dark:text-amber-400" : "text-red-600 dark:text-red-400",
                          )}
                        >
                          {STATE_LABEL[state]}
                        </div>
                      ) : (
                        !narrow &&
                        sub && <div className="max-w-full truncate text-[11.5px] text-muted-foreground group-data-[zoom=far]/stage:hidden group-data-[zoom=mid]/stage:hidden">{sub}</div>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Nodes that just left: shrink, then their link undraws, then they unmount. */}
              {[...leaving.current.values()].map((g) => (
                <div key={`ghost-${g.actor.id}`} data-ghost={g.actor.id} aria-hidden="true" className="pointer-events-none absolute size-0" style={{ left: g.p.x, top: g.p.y }}>
                  <div
                    data-tile=""
                    style={{ width: g.size, height: g.size }}
                    className="absolute left-0 top-0 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[14px] border bg-card [border-color:color-mix(in_srgb,var(--foreground)_9%,transparent)] dark:[background:color-mix(in_srgb,var(--card)_70%,#000)]"
                  >
                    <span className="grid size-[52%] place-items-center [&>svg]:size-full">{iconFor(g.actor)}</span>
                  </div>
                  <div data-label="" style={{ top: g.size / 2 + 8 }} className="absolute left-0 w-max -translate-x-1/2 text-[12.5px] font-semibold">
                    {g.actor.label}
                  </div>
                </div>
              ))}

              {sel && (
                <div
                  ref={cardRef}
                  id={`${gid}-card`}
                  role="dialog"
                  aria-label={`${sel.label} details`}
                  style={cardStyle}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      closeCard();
                    }
                  }}
                  className={cn(
                    "absolute z-20 overflow-auto overscroll-contain rounded-2xl border bg-popover p-4 pb-3 text-popover-foreground shadow-xl animate-[kn-rise_var(--kn-dur)_var(--kn-ease-out)] motion-reduce:animate-none",
                    narrow && "inset-x-2 bottom-2 max-h-[60%]",
                  )}
                >
                  {renderDetail ? (
                    renderDetail(sel, spans.filter((s) => s.from === sel.id || s.to === sel.id))
                  ) : (
                    <DetailCard
                      actor={sel}
                      state={stateOf(sel)}
                      recent={spans
                        .filter((s) => s.from === sel.id || s.to === sel.id)
                        .slice(-4)
                        .reverse()}
                      peers={[...(neighbors.get(sel.id) ?? [])].map((id) => byId.get(id)).filter((x): x is Actor => !!x)}
                      spansPerMinute={perMinute.get(sel.id) ?? 0}
                      iconFor={iconFor}
                      hueOf={hueOf}
                      formatSpend={formatSpend}
                      closeRef={closeRef}
                      onClose={closeCard}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
        {showZoom && (
          <div
            ref={zoomRef}
            data-zoom-controls=""
            data-corner={zoomCorner}
            role="group"
            aria-label="Zoom"
            style={zoomCorner === "top-right" ? { top: (zoomBox?.top ?? 0) + ZOOM_INSET } : undefined}
            className={cn(
              "absolute z-30 flex items-center gap-px overflow-hidden rounded-[10px] border p-0.5 [border-color:color-mix(in_srgb,var(--foreground)_9%,transparent)]",
              // Translucent, no blur: a node under it (after a manual zoom or pan) still reads through.
              "bg-card/80 shadow-[0_4px_14px_-6px_rgb(0_0_0/0.35)] dark:[background:color-mix(in_srgb,var(--card)_72%,transparent)]",
              "transition-opacity duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:opacity-100 focus-within:opacity-100 motion-reduce:transition-none",
              overCanvas ? "opacity-40" : "opacity-100",
              zoomCorner === "bottom-left" ? "bottom-2.5 left-2.5" : zoomCorner === "top-right" ? "right-2.5" : "bottom-2.5 right-2.5",
            )}
          >
            {[
              { label: "Zoom out", text: "−", on: () => zoomAt(1 / 1.25, frameBoxW / 2, frameBoxH / 2, true) },
              { label: "Zoom in", text: "+", on: () => zoomAt(1.25, frameBoxW / 2, frameBoxH / 2, true) },
              { label: "Fit to frame", text: "Fit", on: fitNow },
            ].map((b) => (
              <Button key={b.label} size="xs" variant="ghost" aria-label={b.label} title={b.label} onClick={b.on} className="min-w-6">
                {b.text}
              </Button>
            ))}
          </div>
        )}
      </div>

      <ul className="sr-only">
        {ordered.map((a) => {
          const p = tree.parent.get(a.id);
          const others = [...(neighbors.get(a.id) ?? [])].filter((id) => id !== p);
          return (
            <li key={a.id}>
              {ariaFor(a)}
              {p ? `. Under ${byId.get(p)?.label ?? p}` : ""}
              {others.length ? `. Linked to ${others.map((id) => byId.get(id)?.label ?? id).join(", ")}` : ""}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default AgentGraph;
