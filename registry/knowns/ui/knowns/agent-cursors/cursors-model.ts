/**
 * Agent Cursors model: the document, tracked-change suggestions and comments, plus the pure helpers the
 * component uses (text segments with suggestions applied, tag layout without overlaps, pointer motion).
 * No React, no DOM.
 */

/* ── Document ── */

export type DocBlock =
  | { id: string; type: "heading"; text: string; level?: 1 | 2 }
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "bullet"; text: string }
  | { id: string; type: "code"; text: string; lang?: string }
  | { id: string; type: "image"; alt: string; width: number; height: number; src?: string; caption?: string };

export interface CursorDoc {
  /** Shown in the header, e.g. "Harbor / Releases". */
  path?: string;
  blocks: DocBlock[];
}

/** A table the same agents edit. Cell ids are `${row.id}:${columnIndex}`; suggestions and presence use them. */
export interface CursorTable {
  columns: string[];
  rows: { id: string; cells: string[] }[];
}

export const cellId = (row: string, col: number) => `${row}:${col}`;

/* ── Changes ── */

/** Replace `range` ([start, end) in the block's original text) with `insert`. An empty range inserts. */
export interface TextSuggestion {
  id: string;
  agentId: string;
  /** Block id, or a table cell id. */
  blockId: string;
  kind?: "text";
  range: [number, number];
  insert: string;
}

/** Resize an image block to `width` (height keeps the aspect ratio). */
export interface ResizeSuggestion {
  id: string;
  agentId: string;
  blockId: string;
  kind: "resize";
  width: number;
}

export type Suggestion = TextSuggestion | ResizeSuggestion;

export interface CursorComment {
  id: string;
  agentId: string;
  blockId: string;
  text: string;
  /** e.g. "now", "2m". */
  at?: string;
}

/** Where an agent is and what it says it is doing. `target` is a block, cell, suggestion or comment id. */
export interface Presence {
  target?: string;
  action?: string;
  away?: boolean;
}

export type Resolution = { state: "accepted" | "rejected"; at: number };

export const isText = (s: Suggestion): s is TextSuggestion => s.kind !== "resize";

/** Steps a resize "types" in, so it animates on the same clock as text. */
export const RESIZE_STEPS = 24;

/** How many steps a change takes to appear in full. */
export const lengthOf = (s: Suggestion | CursorComment) => ("text" in s ? s.text.length : isText(s) ? s.insert.length : RESIZE_STEPS);

/* ── Text segments ── */

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "pending"; s: TextSuggestion; del: string; ins: string; done: boolean }
  | { kind: "resolved"; s: TextSuggestion; text: string; state: "accepted" | "rejected"; at: number };

/**
 * Splits a block's text around its text suggestions, in order. Overlapping suggestions after the first are
 * left out (one change per span of text). Accepted ones show their insert, rejected ones the original.
 */
export function segments(text: string, suggestions: TextSuggestion[], typed: (id: string) => number, resolved: (id: string) => Resolution | undefined): Segment[] {
  const sorted = suggestions
    .map((s) => ({ ...s, range: [clamp(s.range[0], 0, text.length), clamp(s.range[1], 0, text.length)] as [number, number] }))
    .sort((a, b) => a.range[0] - b.range[0] || a.range[1] - b.range[1]);
  const out: Segment[] = [];
  let at = 0;
  for (const s of sorted) {
    const [start, end] = s.range;
    if (start < at || end < start) continue;
    if (start > at) out.push({ kind: "text", text: text.slice(at, start) });
    const del = text.slice(start, end);
    const r = resolved(s.id);
    if (r) out.push({ kind: "resolved", s, text: r.state === "accepted" ? s.insert : del, state: r.state, at: r.at });
    else {
      const n = clamp(typed(s.id), 0, s.insert.length);
      out.push({ kind: "pending", s, del, ins: s.insert.slice(0, n), done: n >= s.insert.length });
    }
    at = end;
  }
  if (at < text.length || !out.length) out.push({ kind: "text", text: text.slice(at) });
  return out;
}

/** The block text with every accepted suggestion applied (pending and rejected ones left out). */
export function appliedText(text: string, suggestions: TextSuggestion[], resolved: (id: string) => Resolution | undefined) {
  return segments(text, suggestions, () => 0, resolved)
    .map((g) => (g.kind === "pending" ? g.del : g.text))
    .join("");
}

/** Width an image shows at: its own, the accepted resize, or the pending one part way (`progress` 0..1). */
export function imageWidth(base: number, s: ResizeSuggestion | undefined, progress: number, r: Resolution | undefined) {
  if (!s || r?.state === "rejected") return base;
  if (r?.state === "accepted") return s.width;
  return Math.round(base + (s.width - base) * clamp(progress, 0, 1));
}

/* ── Tags ── */

export interface TagBox {
  id: string;
  /** Pointer tip, relative to the frame. */
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface TagPlacement {
  id: string;
  /** Top-left of the tag, relative to the frame. */
  left: number;
  top: number;
  side: "right" | "left";
  /** True when no clean spot fitted and the tag covers body text. */
  onText: boolean;
}
export interface Rect {
  left: number;
  top: number;
  w: number;
  h: number;
}

/** How far (px) a tag may move from its pointer tip to clear an obstacle. */
const MAX_REACH = 110;

const overlapArea = (a: Rect, b: Rect, gap: number) =>
  Math.max(0, Math.min(a.left + a.w + gap, b.left + b.w) - Math.max(a.left, b.left - gap)) * Math.max(0, Math.min(a.top + a.h + gap, b.top + b.h) - Math.max(a.top, b.top - gap));

/**
 * Places each pointer's tag at its tip: below right by default, else below left, above right or above left,
 * taking the first spot that stays inside the frame and covers nothing. `obstacles` (the comment rail, the
 * text being edited) must stay clear; `soft` ones (lines of body text) are avoided when any whitespace spot
 * near the tip fits: the margin past a line's end, above the line, or the gap between blocks. When every
 * spot clashes, the least costly wins, and `onText` says the tag covers text (draw it opaque enough to read).
 */
export function layoutTags(boxes: TagBox[], frame: { w: number; h: number }, opts: { gap?: number; obstacles?: Rect[]; soft?: Rect[] } = {}): TagPlacement[] {
  const gap = opts.gap ?? 4;
  const obstacles = opts.obstacles ?? [];
  const soft = opts.soft ?? [];
  const placed: (Rect & { id: string; side: "right" | "left"; onText: boolean })[] = [];
  const order = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const b of order) {
    const spots: { left: number; top: number; side: "right" | "left" }[] = [
      { left: b.x + 10, top: b.y + 16, side: "right" },
      { left: b.x - b.w - 4, top: b.y + 16, side: "left" },
      { left: b.x + 10, top: b.y - b.h - 6, side: "right" },
      { left: b.x - b.w - 4, top: b.y - b.h - 6, side: "left" },
    ];
    // Also try just outside whatever sits near the tip (below, above, left, right of it), so a pointer
    // typing in a rail card gets its tag beside the card, and one inside a paragraph finds the margin or
    // the gap under the block.
    const near = (o: Rect) => b.x >= o.left - b.w - 12 && b.x <= o.left + o.w + 12 && b.y >= o.top - b.h - 20 && b.y <= o.top + o.h + 20;
    for (const o of [...obstacles, ...placed, ...soft].filter(near)) {
      const candidates: typeof spots = [
        { left: b.x + 10, top: o.top + o.h + gap, side: "right" },
        { left: b.x - b.w - 4, top: o.top + o.h + gap, side: "left" },
        { left: b.x + 10, top: o.top - b.h - gap, side: "right" },
        { left: b.x - b.w - 4, top: o.top - b.h - gap, side: "left" },
        { left: o.left - b.w - gap, top: b.y + 16, side: "left" },
        { left: o.left + o.w + gap, top: b.y + 16, side: "right" },
        { left: o.left + o.w + gap, top: b.y - b.h / 2, side: "right" },
      ];
      // A tag reads as the pointer's only while it stays close to the tip.
      spots.push(...candidates.filter((c) => Math.abs(c.top - b.y) <= MAX_REACH && Math.min(Math.abs(c.left - b.x), Math.abs(c.left + b.w - b.x)) <= MAX_REACH));
    }
    let best: (typeof spots)[number] & { cost: number; onText: boolean } = { ...spots[0], cost: Infinity, onText: false };
    for (const sp of spots) {
      const inside = sp.left >= 0 && sp.top >= 0 && sp.left + b.w <= frame.w && sp.top + b.h <= frame.h;
      const r = { left: clamp(sp.left, 0, Math.max(0, frame.w - b.w)), top: clamp(sp.top, 0, Math.max(0, frame.h - b.h)), w: b.w, h: b.h };
      // Tags covering each other read worst, then covering an obstacle, then covering plain text.
      const hard = placed.reduce((sum, o) => sum + 4 * overlapArea(r, o, gap), 0) + obstacles.reduce((sum, o) => sum + overlapArea(r, o, gap), 0);
      const text = soft.reduce((sum, o) => sum + overlapArea(r, o, 0), 0);
      // Spots that leave the frame only win when nothing else fits; far spots cost a little so near ones win ties.
      const dist = Math.hypot(r.left - b.x, r.top - b.y);
      const cost = hard + text * 0.35 + (inside ? 0 : 1e6) + dist * 1e-3;
      // The first clean spot in order wins: below right, then the other corners, then the whitespace nearby.
      if (hard === 0 && text === 0 && inside) {
        best = { ...sp, left: r.left, top: r.top, cost, onText: false };
        break;
      }
      if (cost < best.cost) best = { ...sp, left: r.left, top: r.top, cost, onText: text > 0 };
    }
    placed.push({ id: b.id, left: best.left, top: best.top, w: b.w, h: b.h, side: best.side, onText: best.onText });
  }
  const byId = new Map(placed.map((p) => [p.id, p]));
  return boxes.map((b) => {
    const p = byId.get(b.id)!;
    return { id: p.id, left: p.left, top: p.top, side: p.side, onText: p.onText };
  });
}

/* ── Motion ── */

/** Frame-rate independent ease toward a target (exponential, time constant `tau` ms). Snaps within 0.25px. */
export function approach(current: number, target: number, dt: number, tau = 160) {
  if (Math.abs(target - current) < 0.25) return target;
  return current + (target - current) * (1 - Math.exp(-Math.max(0, dt) / tau));
}

/** Small idle wander around the target, a few px, different per agent. */
export function drift(t: number, seed: number, amp = 5): [number, number] {
  const a = t / 1000;
  return [Math.sin(a * 0.9 + seed * 1.7) * amp, Math.cos(a * 0.7 + seed * 2.3) * amp * 0.6];
}

/* ── Totals ── */

export function pendingCount(suggestions: Suggestion[], resolved: (id: string) => Resolution | undefined) {
  return suggestions.filter((s) => !resolved(s.id)).length;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}
