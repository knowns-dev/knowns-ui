import { labelBox, overlaps, segHitsBox, segmentsCross, segmentsMerge, segsOf, type Box, type Layout, type RadialState, type RelayoutReason, type Seg } from "./layout";
// Tree links are drawn with the shape the layout picked for each (Layout.routeFor → shapedRoute).
import type { Pt } from "./routing";
import type { Tree } from "./tree";

/**
 * Radial layout: the lead in the middle, agents on a tight inner ring (diagonals first), tools packed
 * close around the agent that calls them, the user just above the lead. The rings are ellipses shaped like
 * the target box (a fixed frame), so the graph fills it instead of leaving wide empty bands.
 *
 * Placement is kept in polar form (screen angle + elliptical radius) so the layout is stable: newcomers
 * take the closest free spot, and when the agent ring has to grow every node keeps its angle and only
 * drifts outward. Pure and deterministic.
 */

export interface RadialOptions {
  avail: number;
  fixedH?: number;
  narrow: boolean;
  leadId?: string;
  agents: Set<string>;
  /** Agents that talk to each node (from the drawn links). A tool shared by several agents sits between them. */
  callers?: Map<string, string[]>;
}

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
/** Agent ring: start radius and growth step (it grows until no label collides). */
const RING0 = 120;
const GROW = 8;
const MAX_GROW = 160;
/** Search for a free spot: angle step, how far out to look. */
const ANG_STEP = 2 * DEG;
const RHO_SPAN = 900;
/** A ray's second candidate spot is at least this much further out than its first. */
const ROW_OUT = 60;
/** Closest free spots that get the (costlier) link checks. */
const SHORTLIST = 16;
/** Canvas padding around the node boxes. */
const PAD = 16;
/** Ring shapes a fixed frame also tries, relative to the frame's own aspect. */
const ASPECT_TRIES = [0.95, 0.88, 0.8, 0.72, 0.64, 1.08, 1.16];
/** Ring aspect without a fixed frame. */
const FREE_ASPECT = 0.8;

const ROOM = { lead: 150, agent: 128, other: 100 };
const TILE = { lead: 64, agent: 56, other: 48 };

/** Costs (in px of distance) of a spot's links. */
const COST = { cross: 30, merge: 400, hit: 500, angle: 60, userAngle: 240, grow: 3 };

/** Normalise to (-π, π]. */
export const wrapAngle = (a: number) => {
  let x = a % TAU;
  if (x <= -Math.PI) x += TAU;
  if (x > Math.PI) x -= TAU;
  return x;
};
export const angleDist = (a: number, b: number) => Math.abs(wrapAngle(a - b));

/**
 * Inner-ring slot angles in fill order for a ring of `slots` (4, 8, 16, …): the four diagonals first
 * (upper-left, upper-right, lower-left, lower-right), then right, left, bottom, top, then the halfway
 * angles between taken slots, clockwise from the top. Each list starts with the previous one, so agents
 * never change angle when the ring gets more slots.
 */
export function agentSlotOrder(slots: number): number[] {
  const out = [-135, -45, 135, 45].map((d) => d * DEG);
  if (slots <= 4) return out;
  out.push(...[0, 180, 90, -90].map((d) => d * DEG));
  let n = 8;
  while (n < slots) {
    const step = TAU / (n * 2);
    const add: number[] = [];
    for (let k = 0; k < n; k++) add.push(wrapAngle(-Math.PI / 2 + step + k * 2 * step));
    out.push(...add);
    n *= 2;
  }
  return out;
}

/** Inner-ring slot count for `n` agents: 4, 8, 16, 32… */
export const slotsFor = (n: number) => {
  let s = 4;
  while (s < n) s *= 2;
  return s;
};

/**
 * Agent-ring slots (arc angles, fill order) for a ring of `slots`. With the user on top (it talks to the
 * lead and sits just above it) the top slot stays free; 8–9 agents then get a 10-slot ring - You on top,
 * eight agents in mirrored pairs, the bottom for a ninth - instead of a crowded 16-slot one.
 */
export function ringSlots(slots: number, userOnTop: boolean): number[] {
  if (!userOnTop) return agentSlotOrder(slots);
  if (slots === 10) return [-120, -60, 120, 60, -156, -24, 156, 24, 90].map((d) => d * DEG);
  return agentSlotOrder(slots).filter((a) => angleDist(a, -Math.PI / 2) > 1e-6);
}
/** Agents a ring of `slots` holds. */
export const slotCapacity = (slots: number, userOnTop: boolean) => ringSlots(slots, userOnTop).length;
/** Smallest ring for `n` agents: 4, 8, (10 with the user on top), 16, 32… */
export function ringFor(n: number, userOnTop: boolean) {
  for (const s of userOnTop ? [4, 8, 10] : [4, 8]) if (n <= slotCapacity(s, userOnTop)) return s;
  let s = 16;
  while (n > slotCapacity(s, userOnTop)) s *= 2;
  return s;
}

/** Mean direction of a set of angles; null when they cancel out. */
export function meanAngle(angles: number[]): number | null {
  if (!angles.length) return null;
  const x = angles.reduce((s, a) => s + Math.cos(a), 0);
  const y = angles.reduce((s, a) => s + Math.sin(a), 0);
  return Math.hypot(x, y) < 1e-6 * angles.length ? null : Math.atan2(y, x);
}

/** Distance from the centre to an ellipse (horizontal radius r, vertical r × e) along screen angle a. */
const rhoAt = (a: number, r: number, e: number) => (r * e) / Math.hypot(e * Math.cos(a), Math.sin(a));

/**
 * Angles measured along an ellipse's perimeter ("arc angles"): 2π is one lap, and equal steps cover equal
 * lengths of ring. Agent slots, sectors and preferred directions live in arc angles, so on a wide ring
 * every agent gets the same share of the band its tools sit in (screen angles would give the agents at
 * the top and bottom a sliver). With aspect 1 it is the identity.
 */
export function arcAngles(e: number) {
  const N = 1440;
  const th: number[] = [0];
  const s: number[] = [0];
  let prev = { x: 1, y: 0 };
  let len = 0;
  let unwrap = 0;
  for (let i = 1; i <= N; i++) {
    const t = (i / N) * TAU;
    const p = { x: Math.cos(t), y: e * Math.sin(t) };
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
    let a = Math.atan2(p.y, p.x) + unwrap;
    if (a < th[i - 1] - 1e-9) {
      unwrap += TAU;
      a += TAU;
    }
    th.push(a);
    s.push(len);
  }
  const k = TAU / len;
  for (let i = 0; i <= N; i++) s[i] *= k;
  const lookup = (xs: number[], ys: number[], v: number) => {
    let x = v % TAU;
    if (x < 0) x += TAU;
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= x) lo = mid;
      else hi = mid;
    }
    const f = xs[hi] === xs[lo] ? 0 : (x - xs[lo]) / (xs[hi] - xs[lo]);
    return wrapAngle(ys[lo] + f * (ys[hi] - ys[lo]));
  };
  return {
    /** Screen angle → arc angle. */
    toArc: (a: number) => (e === 1 ? wrapAngle(a) : lookup(th, s, a)),
    /** Arc angle → screen angle. */
    fromArc: (a: number) => (e === 1 ? wrapAngle(a) : lookup(s, th, a)),
  };
}

/** Ring aspect for a target box: its height / width, kept between 0.5 and 1. */
export const aspectFor = (avail: number, fixedH: number | undefined) =>
  fixedH === undefined ? FREE_ASPECT : Math.max(0.5, Math.min(1, fixedH / Math.max(1, avail)));

/**
 * Link shapes, parent → child: "h" sideways, a vertical bus halfway, sideways; "hv" sideways then into the
 * child from above or below; "vh" out of the parent's top or bottom, then sideways into the child; "v" a
 * horizontal bus halfway. Each link takes the one that runs through no tile and along no other agent's bus.
 */
export type Shape = "h" | "hv" | "vh" | "v";
const SHAPES: Shape[] = ["h", "hv", "vh", "v"];
/** Small preference for fewer bends when shapes tie. */
const BENDS: Record<Shape, number> = { h: 0, hv: 3, vh: 4, v: 6 };
export function shapedRoute(shape: Shape, a: Pt, b: Pt): Pt[] {
  if (Math.abs(a.x - b.x) < 1 || Math.abs(a.y - b.y) < 0.5) return [a, b];
  if (shape === "hv") return [a, { x: b.x, y: a.y }, b];
  if (shape === "vh") return [a, { x: a.x, y: b.y }, b];
  if (shape === "v") {
    const my = a.y + (b.y - a.y) / 2;
    return [a, { x: a.x, y: my }, { x: b.x, y: my }, b];
  }
  const mx = a.x + (b.x - a.x) / 2;
  return [a, { x: mx, y: a.y }, { x: mx, y: b.y }, b];
}

type Kind = "lead" | "agent" | "other";
type Link = { p: string; c: string; segs: Seg[]; bb: Box };
type Owned = { k: string; box: Box };

export function layoutRadial(prev: Layout | null | undefined, tree: Tree, opts: RadialOptions): Layout & { reason: RelayoutReason } {
  const { avail, fixedH, leadId, agents } = opts;
  const aspect = aspectFor(avail, fixedH);
  const kindOf = (id: string): Kind => (id === leadId ? "lead" : agents.has(id) ? "agent" : "other");
  const roomOf = (id: string) => ROOM[kindOf(id)];
  const tileOf = (id: string) => TILE[kindOf(id)];

  // Breadth-first order: parents before children, the lead's agents before their tools.
  const order: string[] = [];
  const queue = [...tree.roots];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    queue.push(...(tree.children.get(id) ?? []));
  }
  // Agents first (inner ring), then everyone else (the user comes first: it is a root), each in tree order.
  const ordered = [...order.filter((id) => kindOf(id) === "agent"), ...order.filter((id) => kindOf(id) === "other")];

  const arcs = new Map<number, ReturnType<typeof arcAngles>>();
  const arcOf = (st: RadialState) => {
    if (!arcs.has(st.aspect)) arcs.set(st.aspect, arcAngles(st.aspect));
    return arcs.get(st.aspect)!;
  };
  // The user talking to the lead sits just above it: the agent ring leaves the top slot free.
  const userOnTop = tree.roots.some((r) => r !== leadId && tree.children.get(r)?.includes(leadId ?? ""));

  /* ── Placement state (relative to the lead at 0,0) ── */
  const agentCount = ordered.filter((id) => kindOf(id) === "agent").length;
  const fresh = (e = aspect): RadialState => ({
    radii: [RING0],
    aspect: e,
    angle: new Map(),
    ring: new Map(),
    rad: new Map(),
    slots: ringFor(agentCount, userOnTop),
    shape: new Map(),
  });

  const at = (a: number, rho: number): Pt => ({ x: Math.round(rho * Math.cos(a)), y: Math.round(rho * Math.sin(a)) });
  const rel = (st: RadialState, id: string): Pt => {
    if (id === leadId || !st.angle.has(id)) return { x: 0, y: 0 };
    const a = st.angle.get(id)!;
    const r = st.ring.get(id) === 0 ? st.radii[0] : st.rad.get(id)!;
    return at(a, rhoAt(a, r, st.aspect));
  };
  const has = (st: RadialState, id: string) => id === leadId || st.angle.has(id);
  const placed = (st: RadialState) => [...(leadId && tree.parent.has(leadId) ? [leadId] : []), ...st.angle.keys()];
  const boxAt = (id: string, p: Pt, margin = 6): Box => labelBox(p, tileOf(id), roomOf(id), margin);
  const anyOverlap = (st: RadialState) => {
    const ids = placed(st);
    const bs = ids.map((id) => boxAt(id, rel(st, id)));
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) if (overlaps(bs[i], bs[j])) return true;
    return false;
  };
  const linkOf = (shape: Shape, p: Pt, c: Pt) => segsOf(shapedRoute(shape, p, c));
  const bboxOf = (segs: Seg[]): Box => {
    const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const { a, b: c } of segs) {
      b.x0 = Math.min(b.x0, a.x, c.x);
      b.y0 = Math.min(b.y0, a.y, c.y);
      b.x1 = Math.max(b.x1, a.x, c.x);
      b.y1 = Math.max(b.y1, a.y, c.y);
    }
    return b;
  };
  /** Bounding boxes that touch or overlap (with a pixel of slack: merges need collinear segments). */
  const near = (a: Box, b: Box) => a.x0 <= b.x1 + 1 && b.x0 <= a.x1 + 1 && a.y0 <= b.y1 + 1 && b.y0 <= a.y1 + 1;
  const links = (st: RadialState, skip?: string): Link[] => {
    const out: Link[] = [];
    for (const [c, p] of tree.parent)
      if (p && c !== skip && has(st, c) && has(st, p)) {
        const segs = linkOf(st.shape.get(c) ?? "h", rel(st, p), rel(st, c));
        out.push({ p, c, segs, bb: bboxOf(segs) });
      }
    return out;
  };
  const thinBoxes = (st: RadialState): Owned[] => placed(st).map((k) => ({ k, box: boxAt(k, rel(st, k), 0) }));
  /** A link running through someone else's tile or label. */
  const hitsOthers = (segs: Seg[], ends: string[], boxes: Owned[], bb = bboxOf(segs)) => {
    let n = 0;
    for (const o of boxes) if (!ends.includes(o.k) && near(bb, o.box)) for (const sg of segs) if (segHitsBox(sg, o.box)) n++;
    return n;
  };
  /** Cost of a link drawn as `shape`: through tiles, along another agent's bus, across other links. */
  const linkCost = (segs: Seg[], p: string, c: string, boxes: Owned[], existing: Link[]) => {
    const bb = bboxOf(segs);
    let cost = hitsOthers(segs, [p, c], boxes, bb) * COST.hit;
    for (const t of existing) {
      if (!near(bb, t.bb)) continue;
      for (const sg of segs)
        for (const tg of t.segs) {
          if (segmentsCross(sg, tg)) cost += COST.cross;
          if (t.p !== p && segmentsMerge(sg, tg)) cost += COST.merge;
        }
    }
    return cost;
  };
  const bestShape = (P: Pt, C: Pt, p: string, c: string, boxes: Owned[], existing: Link[]) => {
    let best = { shape: "h" as Shape, cost: Infinity, hits: 0 };
    for (const shape of SHAPES) {
      const segs = linkOf(shape, P, C);
      const cost = linkCost(segs, p, c, boxes, existing) + BENDS[shape];
      if (cost < best.cost) best = { shape, cost, hits: hitsOthers(segs, [p, c], boxes) };
    }
    return best;
  };
  /** Re-pick every link's shape for the current positions; keep a shape unless another one is clearly better. */
  const reshape = (st: RadialState, only?: (c: string) => boolean) => {
    const boxes = thinBoxes(st);
    for (const c of ordered) {
      const p = tree.parent.get(c);
      if (!p || !has(st, c) || !has(st, p) || (only && !only(c))) continue;
      const existing = links(st, c);
      const P = rel(st, p);
      const C = rel(st, c);
      const cur = st.shape.get(c);
      const best = bestShape(P, C, p, c, boxes, existing);
      const curCost = cur ? linkCost(linkOf(cur, P, C), p, c, boxes, existing) + BENDS[cur] : Infinity;
      if (best.cost < curCost - COST.cross) st.shape.set(c, best.shape);
      else if (cur) st.shape.set(c, cur);
    }
  };

  /** Grow the agent ring by d; everyone outside it drifts out by the same amount (same angle). */
  const growRing = (st: RadialState, d: number) => {
    const r0 = st.radii[0];
    for (const [id, r] of st.rad) if (r > r0) st.rad.set(id, r + d);
    st.radii[0] = r0 + d;
  };

  const placeAgent = (st: RadialState, id: string): boolean => {
    const count = [...st.ring.values()].filter((r) => r === 0).length + 1;
    // More agents than this ring has slots: a bigger ring that keeps every slot (4 → 8, 8 → 16) is taken
    // in place; one with new angles (8 → 10 with the user on top) means laying out again.
    if (count > slotCapacity(st.slots, userOnTop)) {
      const next = ringFor(count, userOnTop);
      const cur = ringSlots(st.slots, userOnTop);
      const bigger = ringSlots(next, userOnTop);
      if (!cur.every((a, i) => Math.abs(a - bigger[i]) < 1e-9)) return false;
      st.slots = next;
    }
    const arc = arcOf(st);
    const taken = [...st.angle].filter(([k]) => st.ring.get(k) === 0).map(([, a]) => arc.toArc(a));
    const slot = ringSlots(st.slots, userOnTop).find((a) => !taken.some((t) => angleDist(t, a) < 1e-3));
    if (slot === undefined) return false;
    st.angle.set(id, arc.fromArc(slot));
    st.ring.set(id, 0);
    // The lead's links to its agents (each in its best shape) must not run through an agent or the user.
    const inner = (k: string) => k === leadId || st.ring.get(k) === 0 || (tree.parent.get(k) ?? null) === null;
    const agentLinksHit = () => {
      if (!leadId) return false;
      const boxes = thinBoxes(st).filter((o) => inner(o.k));
      const ring = [...st.ring].filter(([, r]) => r === 0).map(([k]) => k);
      return ring.some((k) => tree.parent.get(k) === leadId && bestShape({ x: 0, y: 0 }, rel(st, k), leadId, k, boxes, []).hits > 0);
    };
    // Grow the agent ring until no label collides (with each other, the lead or anyone outside) and the
    // lead's links get through.
    for (let g = 0; g < MAX_GROW && anyOverlap(st); g++) growRing(st, GROW);
    if (anyOverlap(st)) return false;
    for (let g = 0; g < MAX_GROW / 4 && agentLinksHit(); g++) growRing(st, GROW);
    if (anyOverlap(st)) return false;
    reshape(st, (c) => st.ring.get(c) === 0);
    // The lead's link to it must not run through the user (or a tool) sitting inside the ring.
    const others = thinBoxes(st).filter((o) => kindOf(o.k) === "other");
    const shape = st.shape.get(id) ?? "h";
    return leadId === undefined || hitsOthers(linkOf(shape, { x: 0, y: 0 }, rel(st, id)), [id, leadId], others) === 0;
  };

  /**
   * First distance in [from, to] along screen angle a where `id`'s box overlaps none of `boxes`. Each box
   * blocks one open interval of distances (four linear conditions), so this is exact, not a scan; the
   * rounded position is checked once more.
   */
  const freeAlong = (a: number, from: number, to: number, boxes: Owned[], probe: Box, id: string): number | null => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const blocked: [number, number][] = [];
    // coef · ρ < rhs for each side of the overlap test; a box blocks where all four hold.
    const side = (coef: number, rhs: number, iv: [number, number]) => {
      if (Math.abs(coef) < 1e-9) {
        if (rhs <= 0) iv[0] = Infinity;
      } else if (coef > 0) iv[1] = Math.min(iv[1], rhs / coef);
      else iv[0] = Math.max(iv[0], rhs / coef);
    };
    for (const { box: B } of boxes) {
      const iv: [number, number] = [-Infinity, Infinity];
      side(c, B.x1 - probe.x0, iv);
      side(-c, probe.x1 - B.x0, iv);
      side(s, B.y1 - probe.y0, iv);
      side(-s, probe.y1 - B.y0, iv);
      if (iv[0] < iv[1] && iv[1] > from - 1 && iv[0] < to + 1) blocked.push(iv);
    }
    blocked.sort((x, y) => x[0] - y[0]);
    // Sorted by start, one pass is enough: ρ only moves forward, past the end of each interval it is in.
    let rho = from;
    for (const [lo, hi] of blocked) if (lo - 1 < rho && rho < hi + 1) rho = hi + 1;
    // Rounding to whole pixels can still touch a neighbour: nudge out a little.
    for (let n = 0; n < 6 && rho <= to; n++, rho += 2) {
      const box = boxAt(id, at(a, rho));
      if (!boxes.some((o) => overlaps(box, o.box))) return rho;
    }
    return null;
  };

  const placeOuter = (st: RadialState, id: string): boolean => {
    const parent = tree.parent.get(id) ?? null;
    const kids = (tree.children.get(id) ?? []).filter((k) => has(st, k));
    const isUser = parent === null;
    const callers = (opts.callers?.get(id) ?? []).filter((c) => st.ring.get(c) === 0);
    // Who it should sit close to: its calling agents, else its parent; the user: whoever it talks to.
    const anchors = isUser ? (kids.length ? kids : leadId ? [leadId] : []) : callers.length ? callers : has(st, parent) ? [parent] : [];
    const anchorPts = anchors.map((k) => rel(st, k));
    // Directions in arc angles (see arcAngles): equal shares of the ring for every agent.
    const arc = arcOf(st);
    const onRing = anchors.filter((k) => st.ring.get(k) === 0).map((k) => arc.toArc(st.angle.get(k)!));
    // Preferred direction: the user straight up; a tool along its callers' mean ray (the lead's own: down).
    const phiArc = isUser ? -Math.PI / 2 : (meanAngle(onRing) ?? (onRing.length ? onRing[0] : Math.PI / 2));
    const phi = arc.fromArc(phiArc);
    // A tool stays on its caller's side: closer (along the ring) to its caller's ray than to any other agent's.
    const own = new Set([parent, ...callers]);
    const rivals = [...st.angle].filter(([k]) => st.ring.get(k) === 0 && !own.has(k)).map(([, a]) => arc.toArc(a));
    const sectored = !isUser && parent !== leadId && onRing.length > 0;
    const inSector = (aa: number) => !sectored || rivals.every((r) => angleDist(aa, phiArc) <= angleDist(aa, r) + 1e-6);

    const r0 = st.radii[0];
    const others = placed(st).map((k) => ({ k, box: boxAt(k, rel(st, k)) }));
    // How much a spot would make the graph scale down in the target box (wider than tall by 1 / aspect):
    // the extent that sets the scale, in px of width. Growing the short way is what shrinks the graph.
    const bb = others.reduce(
      (b, o) => ({ x0: Math.min(b.x0, o.box.x0), y0: Math.min(b.y0, o.box.y0), x1: Math.max(b.x1, o.box.x1), y1: Math.max(b.y1, o.box.y1) }),
      { x0: 0, y0: 0, x1: 0, y1: 0 },
    );
    const extent = (b: Box) => Math.max(b.x1 - b.x0, (b.y1 - b.y0) / st.aspect);
    const before = extent(bb);
    const growth = (box: Box) =>
      extent({ x0: Math.min(bb.x0, box.x0), y0: Math.min(bb.y0, box.y0), x1: Math.max(bb.x1, box.x1), y1: Math.max(bb.y1, box.y1) }) - before;
    // Closest free spot along each ray: tools start just outside the agent ring, the user right by the lead.
    const spots: { a: number; rho: number; p: Pt; base: number }[] = [];
    const steps = Math.ceil(Math.PI / ANG_STEP);
    const probe = boxAt(id, { x: 0, y: 0 });
    // Fan out from the preferred angle: 0, +1, −1, +2… steps (the half-turn only once).
    for (let i = 0; i < 2 * steps; i++) {
      const k = i % 2 ? (i + 1) / 2 : -i / 2;
      const a = wrapAngle(phi + k * ANG_STEP);
      const aa = arc.toArc(a);
      if (!inSector(aa)) continue;
      const start = isUser ? 40 : rhoAt(a, r0, st.aspect) + 1;
      // The closest free spot on the ray, and the next one at least a row further out (a link that would
      // cross a nearer tile can often get past it from there).
      const first = freeAlong(a, start, start + RHO_SPAN, others, probe, id);
      if (first === null) continue;
      const second = freeAlong(a, first + ROW_OUT, start + RHO_SPAN, others, probe, id);
      for (const rho of second === null ? [first] : [first, second]) {
        const p = at(a, rho);
        const box = boxAt(id, p);
        const dist = anchorPts.length ? anchorPts.reduce((s, q) => s + Math.hypot(p.x - q.x, p.y - q.y), 0) / anchorPts.length : rho;
        spots.push({ a, rho, p, base: dist + angleDist(aa, phiArc) * (isUser ? COST.userAngle : COST.angle) + growth(box) * COST.grow });
      }
    }
    if (!spots.length) return false;
    spots.sort((x, y) => x.base - y.base);

    // Links (each in its best shape): crossings cost a little, running along another agent's bus or
    // through a tile costs a lot; so does sitting on someone else's link.
    const existing = links(st);
    const thin = thinBoxes(st);
    let best: { a: number; rho: number; score: number; shapes: [string, Shape][] } | null = null;
    const consider = (s: (typeof spots)[number]) => {
      let score = s.base;
      const shapes: [string, Shape][] = [];
      const mine: [string, string, Pt, Pt][] = [];
      if (parent !== null && has(st, parent)) mine.push([parent, id, rel(st, parent), s.p]);
      for (const k of kids) mine.push([id, k, s.p, rel(st, k)]);
      for (const [p, c, P, C] of mine) {
        const b = bestShape(P, C, p, c, thin, existing);
        score += b.cost;
        shapes.push([c, b.shape]);
      }
      const myBox = boxAt(id, s.p, 0);
      for (const t of existing) if (near(t.bb, myBox)) for (const tg of t.segs) if (segHitsBox(tg, myBox)) score += COST.hit;
      if (!best || score < best.score) best = { a: s.a, rho: s.rho, score, shapes };
    };
    spots.slice(0, SHORTLIST).forEach(consider);
    // The closest spots all put a link through a tile (or sit on one): look at every free spot.
    if (best!.score - spots[0].base >= COST.hit) spots.slice(SHORTLIST).forEach(consider);
    st.angle.set(id, best!.a);
    st.ring.set(id, 1);
    st.rad.set(id, best!.rho / rhoAt(best!.a, 1, st.aspect));
    for (const [c, shape] of best!.shapes) st.shape.set(c, shape);
    return true;
  };

  const place = (st: RadialState, id: string) => (id === leadId ? true : kindOf(id) === "agent" ? placeAgent(st, id) : placeOuter(st, id));

  const build = (st: RadialState, ids: string[], reason: RelayoutReason, full: boolean) => {
    // Positions moved since some links were shaped (the ring grew): check every shape once more.
    reshape(st);
    // Canvas: the node boxes plus padding (at least the container's width, and the fixed height if any).
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const id of ids) {
      if (!has(st, id) && id !== leadId) continue;
      const b = boxAt(id, rel(st, id), 0);
      [x0, y0, x1, y1] = [Math.min(x0, b.x0), Math.min(y0, b.y0), Math.max(x1, b.x1), Math.max(y1, b.y1)];
    }
    if (x0 === Infinity) [x0, y0, x1, y1] = [-ROOM.lead / 2, -TILE.lead / 2, ROOM.lead / 2, TILE.lead / 2 + 42];
    const natW = Math.ceil(x1 - x0 + 2 * PAD);
    const natH = Math.ceil(y1 - y0 + 2 * PAD);
    const width = Math.max(avail, natW);
    const height = fixedH !== undefined ? Math.max(fixedH, natH) : Math.max(Math.round(width * 0.65), natH, 340);
    // The boxes are centred on the canvas (the lead sits near, not exactly at, the middle).
    const cx = Math.round((width - (x0 + x1)) / 2);
    const cy = Math.round((height - (y0 + y1)) / 2);
    const pos = new Map<string, Pt>();
    const room = new Map<string, number>();
    for (const id of ids) {
      const p = rel(st, id);
      pos.set(id, { x: cx + p.x, y: cy + p.y });
      room.set(id, roomOf(id));
    }
    return {
      pos,
      room,
      stacked: new Set<string>(),
      width,
      height,
      rowGap: 150,
      orient: "h" as const,
      parents: new Map(tree.parent),
      holes: full ? 0 : (prev?.holes ?? 0),
      lead: leadId,
      full,
      radial: st,
      // Tree links in their picked shape, from live positions (they follow the easing).
      routeFor: (child: string, P: Pt, C: Pt) => {
        const shape = st.shape.get(child);
        return shape ? shapedRoute(shape, P, C) : null;
      },
      reason,
    };
  };

  /** Links through someone else's tile, and links running along another agent's bus. */
  const flaws = (st: RadialState) => {
    const all = links(st);
    const boxes = thinBoxes(st);
    let n = 0;
    for (const l of all) n += hitsOthers(l.segs, [l.p, l.c], boxes, l.bb);
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++)
        if (all[i].p !== all[j].p && near(all[i].bb, all[j].bb))
          for (const a of all[i].segs) for (const b of all[j].segs) if (segmentsMerge(a, b)) n++;
    return n;
  };
  const layAll = (e: number) => {
    const st = fresh(e);
    for (const id of ordered) if (!place(st, id)) break;
    return st;
  };
  const fromScratch = (reason: RelayoutReason) => {
    if (fixedH === undefined) return build(layAll(aspect), order, reason, true);
    // A fixed frame: try a few ring shapes around the box's own and keep the one that fills it best
    // (largest scale to fit, then the box's own shape). Joins afterwards keep that shape.
    // A link through a tile or along another agent's bus costs as much as 1.5% of scale.
    const score = (l: ReturnType<typeof build>) => Math.min(1, avail / l.width, fixedH / l.height) - 0.015 * flaws(l.radial);
    let best: { l: ReturnType<typeof build>; score: number } | null = null;
    for (const e of [aspect, ...ASPECT_TRIES.map((f) => Math.max(0.45, Math.min(1, aspect * f)))]) {
      const l = build(layAll(e), order, reason, true);
      const sc = score(l);
      if (!best || sc > best.score + 0.005) best = { l, score: sc };
    }
    return best!.l;
  };

  /* ── Stable update ── */
  if (!prev?.radial?.rad || !prev.radial.shape || !prev.parents) return fromScratch("first");
  if (prev.lead !== leadId) return fromScratch("lead");
  const ids = [...tree.parent.keys()];
  const kept = ids.filter((id) => prev.pos.has(id));
  for (const id of kept) if ((prev.parents.get(id) ?? null) !== (tree.parent.get(id) ?? null)) return fromScratch("reparent");
  const removed = [...prev.pos.keys()].filter((id) => !tree.parent.has(id)).length;
  const holes = (prev.holes ?? 0) + removed;
  const added = ordered.filter((id) => !prev.pos.has(id));
  if (kept.length < 2 || added.length > Math.max(4, kept.length / 2)) return fromScratch("burst");
  if (holes > Math.max(3, ids.length / 4)) return fromScratch("compact");

  const keep = <T,>(m: Map<string, T>) => new Map([...m].filter(([k]) => tree.parent.has(k)));
  const st: RadialState = {
    radii: [...prev.radial.radii],
    aspect: prev.radial.aspect,
    angle: keep(prev.radial.angle),
    ring: keep(prev.radial.ring),
    rad: keep(prev.radial.rad),
    slots: prev.radial.slots,
    shape: keep(prev.radial.shape),
  };
  for (const id of added) if (!place(st, id)) return fromScratch("nofit");
  const out = build(st, order, null, false);
  // A ring that grew, or a canvas that changed (size or where the lead sits), moves everyone a little:
  // same angles, new radius or offset. AgentGraph eases there; report it as "grow".
  const lp = leadId ? out.pos.get(leadId) : undefined;
  const pp = leadId ? prev.pos.get(leadId) : undefined;
  const grew =
    st.radii[0] !== prev.radial.radii[0] ||
    out.width !== prev.width ||
    out.height !== prev.height ||
    (!!lp && !!pp && (lp.x !== pp.x || lp.y !== pp.y));
  return { ...out, holes, reason: grew ? "grow" : null };
}
