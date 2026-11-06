import type { Pt } from "./routing";
import type { Tree } from "./tree";

/** Space above the first row and below the last one (tile + label). */
const PAD_TOP = 48;
const PAD_BOTTOM = 72;

export type Layout = {
  pos: Map<string, Pt>;
  /** Horizontal room for each node's label. */
  room: Map<string, number>;
  /** Leaves drawn as a vertical list under their parent (crowded graphs). */
  stacked: Set<string>;
  width: number;
  height: number;
  rowGap: number;
  /** Direction of the tree's flow; decides how links are routed. */
  orient: "v" | "h";
  /** Stable center layout only: the tree it was made for, and how many nodes left since the last full layout. */
  parents?: Map<string, string | null>;
  holes?: number;
  /**
   * Center layout only: a custom route (parent → child polyline) for tree links that the default elbow
   * would draw through other tiles, computed from live positions so it follows the animation. Null: default.
   */
  routeFor?: (child: string, parent: Pt, child_: Pt) => Pt[] | null;
  lead?: string;
  /** Stable center layout only: true when this layout was computed from scratch. */
  full?: boolean;
  /** Radial layout only: polar placement around the lead, kept between updates. */
  radial?: RadialState;
};

export type RadialState = {
  /** [0]: the agent ring's horizontal radius. The rings are ellipses: vertical radius = radius × `aspect`. */
  radii: number[];
  /** Vertical / horizontal radius of every ring (1 = circles; from the target box when the frame is fixed). */
  aspect: number;
  /** Screen angle (radians: 0 = right, π/2 = down) of every node but the lead. */
  angle: Map<string, number>;
  /** 0: on the agent ring; 1: placed freely (tools, the user). */
  ring: Map<string, number>;
  /** Elliptical radius (in horizontal-radius units) of every node not on the agent ring. */
  rad: Map<string, number>;
  /** Slot count of the inner ring (4, 8, 10, 16…). */
  slots: number;
  /** Shape of each tree link, by child id (see radial.ts `shapedRoute`). */
  shape: Map<string, "h" | "hv" | "vh" | "v">;
};

/**
 * Tidy top-down layout, measured in pixels:
 * 1. every leaf gets a fixed column; spare width is shared out evenly;
 * 2. if that overflows, leaf-only families stack vertically under their parent (file-tree style);
 * 3. if it still overflows, the canvas grows wider than the container and scrolls.
 */
/**
 * `squeeze` (default true): with a fixed height, rows are squeezed or stretched to exactly that height.
 * False (a fixed frame that scales the canvas to fit): rows are only ever stretched; a taller tree keeps its
 * natural spacing (stacked lists stay a full row apart, their labels never overlap) and is scaled instead.
 */
export function layoutTree(tree: Tree, avail: number, fixedH: number | undefined, narrow: boolean, squeeze = true): Layout {
  const padX = narrow ? 22 : 44;
  const LEAF = narrow ? 64 : 92;
  const COL = narrow ? 120 : 160;
  const INDENT = narrow ? 28 : 36;
  const GAP = narrow ? 88 : 106; // tile + two-line label below + breathing room
  const ROW = narrow ? 108 : 136;
  const inner = Math.max(0, avail - padX * 2);

  const kids = (id: string) => tree.children.get(id) ?? [];
  const stackable = (id: string) => kids(id).length >= 2 && kids(id).every((c) => kids(c).length === 0);

  const measure = (stack: boolean) => {
    const m = new Map<string, number>();
    const f = (id: string): number => {
      const ch = kids(id);
      const v = !ch.length ? LEAF : stack && stackable(id) ? COL : ch.reduce((s, c) => s + f(c), 0);
      m.set(id, v);
      return v;
    };
    return { m, total: tree.roots.reduce((s, r) => s + f(r), 0) };
  };
  let stack = false;
  let { m, total } = measure(false);
  if (total > inner) {
    stack = true;
    ({ m, total } = measure(true));
  }
  const scale = total > 0 && total < inner ? inner / total : 1;
  const width = Math.max(avail, Math.ceil(total * scale + padX * 2));

  const pos = new Map<string, Pt>();
  const row = new Map<string, number>();
  const room = new Map<string, number>();
  const stacked = new Set<string>();
  let cursor = padX;
  const place = (id: string, d: number): number => {
    const ch = kids(id);
    const span = m.get(id)! * scale;
    let x: number;
    if (!ch.length) {
      x = cursor + span / 2;
      cursor += span;
    } else if (stack && stackable(id)) {
      const x0 = cursor;
      x = x0 + Math.min(span / 2, narrow ? 26 : 34);
      cursor += span;
      ch.forEach((c, i) => {
        pos.set(c, { x: x + INDENT, y: PAD_TOP + (d + 1) * ROW + i * GAP });
        stacked.add(c);
        room.set(c, narrow ? 96 : 132);
      });
    } else {
      const xs = ch.map((c) => place(c, d + 1));
      x = (xs[0] + xs[xs.length - 1]) / 2;
    }
    pos.set(id, { x, y: PAD_TOP + d * ROW });
    row.set(id, d);
    return x;
  };
  tree.roots.forEach((r) => place(r, 0));

  let maxY = PAD_TOP;
  for (const p of pos.values()) maxY = Math.max(maxY, p.y);
  let height = Math.max(narrow ? 300 : 340, maxY + PAD_BOTTOM);
  let rowGap = ROW;
  if (fixedH !== undefined && maxY > PAD_TOP) {
    // Squeeze or stretch vertically to the requested height.
    const fill = (fixedH - PAD_TOP - PAD_BOTTOM) / (maxY - PAD_TOP);
    const k = squeeze ? fill : Math.max(1, fill);
    for (const p of pos.values()) p.y = PAD_TOP + (p.y - PAD_TOP) * k;
    rowGap = ROW * k;
    height = Math.max(fixedH, Math.ceil(PAD_TOP + (maxY - PAD_TOP) * k + PAD_BOTTOM));
  } else if (maxY === PAD_TOP) {
    for (const p of pos.values()) p.y = height / 2;
  }

  // Label room on each row: the gap to the nearest neighbour on that row.
  const rows = new Map<number, string[]>();
  for (const [id, d] of row) rows.set(d, [...(rows.get(d) ?? []), id]);
  for (const ids of rows.values()) {
    ids.sort((a, b) => pos.get(a)!.x - pos.get(b)!.x);
    ids.forEach((id, i) => {
      const x = pos.get(id)!.x;
      const left = i ? x - pos.get(ids[i - 1])!.x : 2 * (x - 8);
      const right = i < ids.length - 1 ? pos.get(ids[i + 1])!.x - x : 2 * (width - 8 - x);
      room.set(id, Math.min(left, right) - 14);
    });
  }
  return { pos, room, stacked, width, height, rowGap, orient: "v" };
}

/**
 * Left-to-right layouts. Leaves stack vertically, so crowded graphs grow taller (page scroll)
 * instead of wider. With `center`, the lead sits in the middle and its branches are split
 * between the right and the left side, balanced by leaf count; the user sits above the lead.
 */
export function layoutFlow(
  tree: Tree,
  avail: number,
  fixedH: number | undefined,
  narrow: boolean,
  center: boolean,
  leadId: string | undefined,
  agents: Set<string>,
  /** As in layoutTree: false in a fixed frame that scales to fit (only stretch, never squeeze). */
  squeeze = true,
): Layout {
  const kids = (id: string) => tree.children.get(id) ?? [];
  const LEAF_H = narrow ? 88 : 106; // leaves: tile + two-line label below + breathing room
  const NODE_H = narrow ? 112 : 136; // agents and inner nodes: tile + label below
  const LABEL = narrow ? 48 : 66; // half a label: how far the outer column's labels reach past the tile
  const pad = narrow ? 20 : 36;
  const MINCOL = narrow ? 100 : 136;
  const MAXCOL = narrow ? 150 : 230;
  const TOP = 24;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const sizes = new Map<string, number>();
  const size = (id: string): number => {
    const ch = kids(id);
    const v = Math.max(ch.length || agents.has(id) ? NODE_H : LEAF_H, ch.reduce((n, c) => n + size(c), 0));
    sizes.set(id, v);
    return v;
  };
  const depthOf = (id: string): number => {
    const ch = kids(id);
    return ch.length ? 1 + Math.max(...ch.map(depthOf)) : 0;
  };
  const pos = new Map<string, Pt>();
  const placeSide = (roots: string[], x0: number, dir: 1 | -1, colGap: number, yStart: number, d0: number) => {
    const place = (id: string, d: number, y0: number): number => {
      const ch = kids(id);
      const sz = sizes.get(id) ?? size(id);
      let y: number;
      if (!ch.length) {
        y = y0 + sz / 2;
      } else {
        const inner = ch.reduce((n, c) => n + (sizes.get(c) ?? size(c)), 0);
        let c0 = y0 + (sz - inner) / 2;
        const ys = ch.map((c) => {
          const yy = place(c, d + 1, c0);
          c0 += sizes.get(c)!;
          return yy;
        });
        y = (ys[0] + ys[ys.length - 1]) / 2;
      }
      pos.set(id, { x: x0 + dir * d * colGap, y });
      return y;
    };
    let cursor = yStart;
    for (const r of roots) {
      place(r, d0, cursor);
      cursor += sizes.get(r)!;
    }
  };
  tree.roots.forEach(size);

  let width = avail;
  let height: number;
  let colGap: number;
  const user = leadId ? tree.parent.get(leadId) ?? null : null;
  const sum = (ids: string[]) => ids.reduce((n, c) => n + sizes.get(c)!, 0);

  if (center && leadId) {
    const ch = kids(leadId);
    const tot = sum(ch);
    const right: string[] = [];
    const left: string[] = [];
    let acc = 0;
    for (const c of ch) {
      (acc < tot / 2 ? right : left).push(c);
      acc += sizes.get(c)!;
    }
    const sideDepth = ch.length ? 1 + Math.max(...ch.map(depthOf)) : 0;
    colGap = sideDepth ? clamp((avail / 2 - pad - LABEL) / sideDepth, MINCOL, MAXCOL) : 0;
    const half = Math.max(avail / 2, pad + LABEL + sideDepth * colGap);
    width = Math.ceil(half * 2);
    const hR = sum(right);
    const hL = sum(left);
    const userGap = user ? (narrow ? 104 : 128) : 0;
    const body = Math.max(hR, hL, NODE_H);
    const cy = TOP + Math.max(body / 2, userGap + 28);
    pos.set(leadId, { x: half, y: cy });
    if (user) pos.set(user, { x: half, y: cy - userGap });
    placeSide(right, half, 1, colGap, cy - hR / 2, 1);
    placeSide(left, half, -1, colGap, cy - hL / 2, 1);
    let extraY = cy + body / 2;
    for (const r of tree.roots) {
      if (r === user || r === leadId) continue;
      placeSide([r], pad + 30, 1, colGap, extraY, 0);
      extraY += sizes.get(r)!;
    }
    height = extraY + 30;
  } else {
    const depth = tree.depth;
    colGap = depth ? clamp((avail - 2 * pad - LABEL - 40) / depth, MINCOL, MAXCOL) : 0;
    const content = 40 + depth * colGap + LABEL;
    width = Math.max(avail, Math.ceil(2 * pad + content));
    const x0 = (width - content) / 2 + 30;
    placeSide(tree.roots, x0, 1, colGap, TOP, 0);
    height = TOP + sum(tree.roots) + 30;
  }
  height = Math.max(narrow ? 300 : 340, height);

  if (fixedH !== undefined) {
    const fill = (fixedH - TOP - 30) / Math.max(1, height - TOP - 30);
    const k = squeeze ? fill : Math.max(1, fill);
    for (const p of pos.values()) p.y = TOP + (p.y - TOP) * k;
    height = Math.max(fixedH, Math.ceil(TOP + (height - TOP - 30) * k + 30));
  }

  const room = new Map<string, number>();
  for (const id of pos.keys()) room.set(id, Math.min(150, Math.max(64, colGap - 18)));
  if (leadId) room.set(leadId, Math.max(120, colGap));
  return { pos, room, stacked: new Set(), width, height, rowGap: colGap, orient: "h" };
}

/* ── Stable center layout: keep everyone where they are, find a good spot for newcomers ── */

export type Box = { x0: number; y0: number; x1: number; y1: number };

/**
 * Tile + label box of a node at `p`, as AgentGraph draws it: the label (two lines) sits under the tile and
 * is at most `room` wide (clamped to 64–160px like the component). Columns are spaced so neighbouring
 * rooms never meet, so only a vertical margin is added.
 */
export function labelBox(p: Pt, tile: number, room: number, margin = 6): Box {
  const w = Math.max(tile, Math.max(64, Math.min(160, room)));
  return { x0: p.x - w / 2, x1: p.x + w / 2, y0: p.y - tile / 2 - margin, y1: p.y + tile / 2 + 42 + margin };
}

export const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

export type Seg = { a: Pt; b: Pt };
export const segsOf = (pts: Pt[]): Seg[] => pts.slice(1).map((b, i) => ({ a: pts[i], b }));

/** Proper crossing of two axis-aligned segments (touching at ends does not count). */
export function segmentsCross(s: Seg, t: Seg): boolean {
  const sh = Math.abs(s.a.y - s.b.y) < 0.5;
  const th = Math.abs(t.a.y - t.b.y) < 0.5;
  if (sh === th) return false;
  const [h, v] = sh ? [s, t] : [t, s];
  const [hx0, hx1] = [Math.min(h.a.x, h.b.x), Math.max(h.a.x, h.b.x)];
  const [vy0, vy1] = [Math.min(v.a.y, v.b.y), Math.max(v.a.y, v.b.y)];
  const x = v.a.x;
  const y = h.a.y;
  return x > hx0 + 0.5 && x < hx1 - 0.5 && y > vy0 + 0.5 && y < vy1 - 0.5;
}

/** Two axis-aligned segments on the same line that share more than a point (one link would run along another). */
export function segmentsMerge(s: Seg, t: Seg): boolean {
  const sv = Math.abs(s.a.x - s.b.x) < 0.5;
  const tv = Math.abs(t.a.x - t.b.x) < 0.5;
  if (sv !== tv) return false;
  if (sv) {
    if (Math.abs(s.a.x - t.a.x) > 1) return false;
    return Math.min(Math.max(s.a.y, s.b.y), Math.max(t.a.y, t.b.y)) - Math.max(Math.min(s.a.y, s.b.y), Math.min(t.a.y, t.b.y)) > 1;
  }
  if (Math.abs(s.a.y - t.a.y) > 1) return false;
  return Math.min(Math.max(s.a.x, s.b.x), Math.max(t.a.x, t.b.x)) - Math.max(Math.min(s.a.x, s.b.x), Math.min(t.a.x, t.b.x)) > 1;
}

export const segHitsBox = (s: Seg, b: Box) => {
  const x0 = Math.min(s.a.x, s.b.x);
  const x1 = Math.max(s.a.x, s.b.x);
  const y0 = Math.min(s.a.y, s.b.y);
  const y1 = Math.max(s.a.y, s.b.y);
  return x0 < b.x1 && x1 > b.x0 && y0 < b.y1 && y1 > b.y0;
};

export interface StableOptions {
  avail: number;
  fixedH?: number;
  narrow: boolean;
  leadId?: string;
  agents: Set<string>;
}

/**
 * Why a center layout looks the way it does (for tests and debugging). The center layout is recomputed on
 * every change: "first" without a previous layout, "relayout" otherwise. The other members are used by the
 * radial layout ("grow") or kept for older callers.
 */
export type RelayoutReason =
  | "first"
  | "relayout"
  | "lead"
  | "reparent"
  | "burst"
  | "compact"
  | "orphan"
  | "nofit"
  | "shift"
  | "grow"
  | null;

/* ── Compact center layout ── */

const CC = {
  /** Tool row pitch: natural, and the tightest that keeps a clean channel between rows. */
  ROW: 118,
  ROW_MIN: 110,
  /** Agent block (tile + label) height, natural and tightest. */
  NODE: 136,
  NODE_MIN: 118,
  /** Gap between agent blocks on one side. */
  GAP: 18,
  GAP_MIN: 8,
  /** Lead → agent column, agent → first tool column, tool column → tool column. */
  A: 176,
  A_MIN: 140,
  D: 150,
  D_MIN: 118,
  TC: 132,
  TC_MIN: 112,
  /** Vertical room above the first and below the last row. */
  TOP: 14,
  BOTTOM: 24,
  PAD_X: 16,
  USER_GAP: 128,
  MAX_COLS: 4,
};

/** Columns a grid of `n` tools wants: one up to 3, two up to 8, three beyond. */
export function gridColumns(n: number): number {
  return n <= 3 ? 1 : n <= 8 ? 2 : 3;
}

/**
 * Splits weighted items into two sides, keeping the order. Items with a previous side keep it unless the
 * two sides end up off by more than `tolerance` (a fraction of the heavier side); then the items that
 * best close the gap move, one at a time. New items go to the lighter side. Returns +1 (right) / -1 (left).
 */
export function balanceSides(items: { id: string; weight: number; prev?: 1 | -1 }[], tolerance = 0.3): Map<string, 1 | -1> {
  const side = new Map<string, 1 | -1>();
  let r = 0;
  let l = 0;
  for (const it of items) {
    if (it.prev) {
      side.set(it.id, it.prev);
      if (it.prev === 1) r += it.weight;
      else l += it.weight;
    }
  }
  for (const it of items) {
    if (it.prev) continue;
    const s: 1 | -1 = r <= l ? 1 : -1;
    side.set(it.id, s);
    if (s === 1) r += it.weight;
    else l += it.weight;
  }
  // Too lopsided: move whichever item brings the sides closest, until within tolerance or no move helps.
  for (let guard = 0; guard < items.length; guard++) {
    const heavy: 1 | -1 = r >= l ? 1 : -1;
    const diff = Math.abs(r - l);
    if (diff <= tolerance * Math.max(r, l)) break;
    let best: { id: string; w: number; gain: number } | null = null;
    for (const it of items) {
      if (side.get(it.id) !== heavy) continue;
      const after = Math.abs(diff - 2 * it.weight);
      if (after >= diff) continue;
      const gain = diff - after;
      if (!best || gain > best.gain + 1e-9) best = { id: it.id, w: it.weight, gain };
    }
    if (!best) break;
    side.set(best.id, heavy === 1 ? -1 : 1);
    if (heavy === 1) {
      r -= best.w;
      l += best.w;
    } else {
      l -= best.w;
      r += best.w;
    }
  }
  return side;
}

type Route = { bus: number; ch: number };

/**
 * Compact, balanced center layout, recomputed on every change (the component eases everyone to their new
 * spot). `prev` only keeps things calm: agents stay on their side unless the balance is off by more than
 * 30%, and every list keeps its first-appearance order.
 * - The lead sits vertically centred, the user right above it.
 * - The lead's agents split left/right by subtree height.
 * - Each agent's tools pack into a grid next to it (1 column up to 3 tools, 2 up to 8, 3 beyond; capped by
 *   the width). Links into later columns run down a bus in the gap, along a channel between rows, and drop
 *   into the tile (`routeFor`), so they never cut through another tile or label.
 * - It aims for a canvas no taller than the fixed height (or ~0.75 × the width): first more grid columns for
 *   the heaviest agents, then tighter gaps; only then does the canvas grow (or, with a fixed height, widen).
 */
export function layoutCenterStable(prev: Layout | null | undefined, tree: Tree, opts: StableOptions): Layout & { reason: RelayoutReason } {
  const { avail, fixedH, narrow, leadId, agents } = opts;
  const reason: RelayoutReason = prev?.pos.size ? "relayout" : "first";
  // No lead to center on: the plain left-to-right layout.
  if (!leadId || !tree.parent.has(leadId)) {
    const l = layoutFlow(tree, avail, fixedH, narrow, true, leadId, agents);
    return { ...l, parents: new Map(tree.parent), holes: 0, lead: leadId, full: true, reason };
  }
  const kids = (id: string) => tree.children.get(id) ?? [];
  const user = tree.parent.get(leadId) ?? null;
  const branches = kids(leadId);
  const isGrid = (a: string) => kids(a).length > 0 && kids(a).every((c) => kids(c).length === 0);
  const extraRoots = tree.roots.filter((r) => r !== leadId && r !== user);

  // Previous sides, to keep agents where they were.
  const prevLead = prev?.pos.get(leadId);
  const prevSide = (id: string): 1 | -1 | undefined => {
    const p = prev?.pos.get(id);
    if (!p || !prevLead) return undefined;
    return p.x > prevLead.x + 1 ? 1 : p.x < prevLead.x - 1 ? -1 : undefined;
  };

  /** Deep branches (an agent with sub-agents): one column per level, like the tidy layout. */
  const deepSize = (id: string, row: number, node: number): number => {
    const ch = kids(id);
    if (!ch.length) return agents.has(id) ? node : row;
    return Math.max(node, ch.reduce((n, c) => n + deepSize(c, row, node), 0));
  };
  const deepDepth = (id: string): number => (kids(id).length ? 1 + Math.max(...kids(id).map(deepDepth)) : 0);

  type Plan = { cols: Map<string, number>; row: number; node: number; gap: number; A: number; D: number; TC: number };
  const rowsOf = (a: string, cols: Map<string, number>) => Math.ceil(kids(a).length / (cols.get(a) ?? 1));
  const blockH = (a: string, p: Plan) => {
    if (!kids(a).length) return p.node;
    if (!isGrid(a)) return deepSize(a, p.row, p.node);
    return Math.max(p.node, rowsOf(a, p.cols) * p.row);
  };
  /** Columns (in tool-column steps) a branch reaches past its agent. */
  const reach = (a: string, p: Plan) => (!kids(a).length ? 0 : isGrid(a) ? p.cols.get(a)! : deepDepth(a));
  const sideWidth = (ids: string[], p: Plan) => {
    let w = p.A + Math.min(150, p.D - 16) / 2;
    for (const a of ids) {
      const k = reach(a, p);
      if (k) w = Math.max(w, p.A + p.D + (k - 1) * p.TC + Math.min(150, p.TC - 14) / 2);
    }
    return w + CC.PAD_X;
  };
  const sideHeight = (ids: string[], p: Plan) => ids.reduce((n, a) => n + blockH(a, p), 0) + Math.max(0, ids.length - 1) * p.gap;

  // Horizontal spacing: natural, squeezed toward the minimum when the container is narrow.
  const half = avail / 2;
  const spacing = (t: number) => ({ A: CC.A - (CC.A - CC.A_MIN) * t, D: CC.D - (CC.D - CC.D_MIN) * t, TC: CC.TC - (CC.TC - CC.TC_MIN) * t });
  /** Most grid columns that fit in half the container at the tightest spacing. */
  const maxCols = Math.max(1, Math.min(CC.MAX_COLS, 1 + Math.floor((half - CC.A_MIN - CC.D_MIN - (CC.TC_MIN - 14) / 2 - CC.PAD_X) / CC.TC_MIN)));

  const plan: Plan = { cols: new Map(), row: CC.ROW, node: CC.NODE, gap: CC.GAP, ...spacing(0) };
  for (const a of branches) plan.cols.set(a, Math.min(maxCols, gridColumns(kids(a).length)));

  const weightOf = (a: string) => blockH(a, plan) + plan.gap;
  let sides = balanceSides(branches.map((a) => ({ id: a, weight: weightOf(a), prev: prevSide(a) })));
  const onSide = (s: 1 | -1) => branches.filter((a) => sides.get(a) === s);
  const userH = user ? CC.USER_GAP : 0;
  const bodyH = () => Math.max(sideHeight(onSide(1), plan), sideHeight(onSide(-1), plan), CC.NODE + 2 * userH);
  const target = Math.max(narrow ? 300 : 340, fixedH ?? Math.round(avail * 0.75));
  const needH = () => bodyH() + CC.TOP + CC.BOTTOM;

  /** The fewest columns above `cols` that saves `a` a row (or null within `limit`). */
  const nextCols = (a: string, limit: number) => {
    const n = kids(a).length;
    const cols = plan.cols.get(a)!;
    for (let c = cols + 1; c <= limit; c++) if (Math.ceil(n / c) < Math.ceil(n / cols)) return c;
    return null;
  };
  /** The agent to widen: on the taller side, the one with the most rows that can still lose one. */
  const widenCandidate = (limit: number) => {
    const tall: 1 | -1 = sideHeight(onSide(1), plan) >= sideHeight(onSide(-1), plan) ? 1 : -1;
    const pick = (ids: string[]) =>
      ids
        .filter((a) => isGrid(a) && nextCols(a, limit) !== null)
        .sort((x, y) => rowsOf(y, plan.cols) - rowsOf(x, plan.cols) || branches.indexOf(x) - branches.indexOf(y))[0];
    return pick(onSide(tall)) ?? pick(branches);
  };
  // 1. More grid columns for the agents with the most rows, while the width allows.
  const widen = (limit: number) => {
    for (let guard = 0; guard < 200 && needH() > target; guard++) {
      const cand = widenCandidate(limit);
      if (!cand) break;
      plan.cols.set(cand, nextCols(cand, limit)!);
      sides = balanceSides(branches.map((a) => ({ id: a, weight: weightOf(a), prev: sides.get(a) })));
    }
  };
  widen(maxCols);
  // 2. Tighter rows and gaps.
  for (let t = 0.25; t <= 1.001 && needH() > target; t += 0.25) {
    plan.row = CC.ROW - (CC.ROW - CC.ROW_MIN) * t;
    plan.node = CC.NODE - (CC.NODE - CC.NODE_MIN) * t;
    plan.gap = CC.GAP - (CC.GAP - CC.GAP_MIN) * t;
  }
  // 3. A fixed frame that still overflows: more columns past the width, only while that improves how
  //    big the whole canvas can be drawn when scaled to fit the frame (k = min(1, W/w, H/h)).
  if (fixedH !== undefined && needH() > target) {
    const fitScale = () => {
      const w = Math.max(avail, sideWidth(onSide(1), plan) + sideWidth(onSide(-1), plan));
      return Math.min(1, avail / w, fixedH / Math.max(fixedH, needH()));
    };
    for (let guard = 0; guard < 60; guard++) {
      const before = fitScale();
      const saved = new Map(plan.cols);
      const savedSides = sides;
      const cand = widenCandidate(CC.MAX_COLS + 3);
      if (!cand) break;
      plan.cols.set(cand, nextCols(cand, CC.MAX_COLS + 3)!);
      sides = balanceSides(branches.map((a) => ({ id: a, weight: weightOf(a), prev: sides.get(a) })));
      if (fitScale() <= before + 1e-6) {
        plan.cols = saved;
        sides = savedSides;
        break;
      }
    }
  }

  // Horizontal spacing: as roomy as the container allows.
  for (let t = 0; t <= 1.001; t += 0.25) {
    Object.assign(plan, spacing(t));
    if (Math.max(sideWidth(onSide(1), plan), sideWidth(onSide(-1), plan)) <= half) break;
  }
  const wR = sideWidth(onSide(1), plan);
  const wL = sideWidth(onSide(-1), plan);
  const width = Math.max(avail, Math.ceil(wL + wR));
  const leadX = width === avail && wL <= half && wR <= half ? half : wL + (width - wL - wR) / 2;

  const extraH = extraRoots.reduce((n, r) => n + (kids(r).length + 1) * plan.row, 0);
  const natural = Math.max(narrow ? 300 : 340, needH() + extraH);
  // The body sits vertically centred in the canvas. A fixed height is the canvas height unless the content
  // can't fit even packed tight: then the canvas keeps its natural height and the component scales it down.
  const canvasH = fixedH !== undefined ? Math.max(fixedH, natural) : natural;
  const bodyTop = Math.max(CC.TOP, (canvasH - extraH - bodyH()) / 2);
  const leadY = Math.round(bodyTop + bodyH() / 2);

  const pos = new Map<string, Pt>();
  const room = new Map<string, number>();
  const routes = new Map<string, Route>();
  const toolRoom = Math.min(150, Math.max(64, plan.TC - 14));
  const agentRoom = Math.min(150, Math.max(64, plan.D - 16));
  pos.set(leadId, { x: leadX, y: leadY });
  room.set(leadId, Math.min(150, Math.max(96, plan.A - 20)));
  if (user) {
    pos.set(user, { x: leadX, y: leadY - CC.USER_GAP });
    room.set(user, 120);
  }

  const placeDeep = (id: string, x: number, dir: 1 | -1, y0: number) => {
    const size = deepSize(id, plan.row, plan.node);
    const ch = kids(id);
    let y = y0 + size / 2;
    if (ch.length) {
      let c0 = y0 + (size - ch.reduce((n, c) => n + deepSize(c, plan.row, plan.node), 0)) / 2;
      const ys = ch.map((c) => {
        const cy = placeDeep(c, x + dir * plan.TC, dir, c0);
        c0 += deepSize(c, plan.row, plan.node);
        return cy;
      });
      y = (ys[0] + ys[ys.length - 1]) / 2;
    }
    pos.set(id, { x, y });
    room.set(id, agents.has(id) ? agentRoom : toolRoom);
    return y;
  };

  for (const s of [1, -1] as const) {
    const ids = onSide(s);
    let y = leadY - sideHeight(ids, plan) / 2;
    const ax = leadX + s * plan.A;
    for (const a of ids) {
      const h = blockH(a, plan);
      pos.set(a, { x: ax, y: y + h / 2 });
      room.set(a, agentRoom);
      const ch = kids(a);
      if (ch.length && isGrid(a)) {
        const cols = plan.cols.get(a)!;
        const rows = Math.ceil(ch.length / cols);
        const top = y + (h - rows * plan.row) / 2 + plan.row / 2;
        ch.forEach((c, i) => {
          const r = Math.floor(i / cols);
          const k = i % cols;
          const ty = top + r * plan.row;
          pos.set(c, { x: ax + s * (plan.D + k * plan.TC), y: ty });
          room.set(c, toolRoom);
          // Later columns: down the bus, along the channel above the row, then into the tile.
          if (k > 0) routes.set(c, { bus: s * (plan.D / 2), ch: -(plan.row / 2 - 21) });
        });
      } else if (ch.length) {
        let c0 = y + (h - ch.reduce((n, c) => n + deepSize(c, plan.row, plan.node), 0)) / 2;
        for (const c of ch) {
          placeDeep(c, ax + s * plan.D, s, c0);
          c0 += deepSize(c, plan.row, plan.node);
        }
      }
      y += h + plan.gap;
    }
  }

  // Other roots (not under the user): a short list under the body, in the lead's column.
  let ey = leadY + bodyH() / 2 + CC.TOP;
  for (const r of extraRoots) {
    const walk = (id: string, depth: number) => {
      pos.set(id, { x: leadX + depth * plan.TC, y: ey });
      room.set(id, toolRoom);
      ey += plan.row;
      kids(id).forEach((c) => walk(c, depth + 1));
    };
    walk(r, 0);
  }

  const routeFor = (child: string, parent: Pt, c: Pt): Pt[] | null => {
    const r = routes.get(child);
    if (!r) return null;
    const bx = parent.x + r.bus;
    const cy = c.y + r.ch;
    return [parent, { x: bx, y: parent.y }, { x: bx, y: cy }, { x: c.x, y: cy }, c];
  };

  return {
    pos,
    room,
    stacked: new Set(),
    width,
    height: Math.max(canvasH, ...[...pos.values()].map((p) => p.y + CC.BOTTOM)),
    rowGap: plan.TC,
    orient: "h",
    parents: new Map(tree.parent),
    holes: 0,
    lead: leadId,
    full: true,
    routeFor,
    reason,
  };
}

export const EMPTY_LAYOUT: Layout = {
  pos: new Map(),
  room: new Map(),
  stacked: new Set(),
  width: 0,
  height: 0,
  rowGap: 0,
  orient: "v",
};
