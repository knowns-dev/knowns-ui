/**
 * Pure rules for DealPipeline: grouping, moving a deal, per-stage totals and weighted value, money and close-date
 * text, the keyboard target and the drop slot under a pointer. Nothing here touches the DOM or the clock.
 */

export interface PipelineStage {
  id: string;
  title: string;
  /** Chance a deal in this stage closes, 0 to 1. Weighted value is amount times this. Won is 1, lost 0. */
  probability: number;
  tone?: "neutral" | "accent" | "info" | "success" | "warning" | "danger";
  /** Deals cannot be dropped here (a Won stage that only a payment can fill). */
  locked?: boolean;
}

export interface Deal {
  id: string;
  stage: string;
  title: string;
  /** Company name shown under the title. */
  company?: string;
  /** In the major unit of the pipeline's currency (dollars, not cents). */
  amount: number;
  /** ISO date, YYYY-MM-DD. */
  close?: string;
  owner?: string;
  /** Free text such as "2d ago"; the caller owns the clock. */
  lastTouch?: string;
}

export interface DealMove {
  deal: string;
  from: string;
  to: string;
  /** Position inside the target stage, counted after the deal is taken out. */
  index: number;
}

const clampProb = (p: number) => (Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0);
const money = (n: number) => (Number.isFinite(n) ? n : 0);

/** Deals per stage in array order. A deal whose stage does not exist is left out, never shown in the wrong column. */
export function groupDeals(deals: Deal[], stages: PipelineStage[]): Map<string, Deal[]> {
  const out = new Map<string, Deal[]>(stages.map((s) => [s.id, []]));
  for (const d of deals) out.get(d.stage)?.push(d);
  return out;
}

export interface StageTotals {
  count: number;
  amount: number;
  weighted: number;
}

export function stageTotals(deals: Deal[], stage: PipelineStage): StageTotals {
  const amount = deals.reduce((s, d) => s + money(d.amount), 0);
  return { count: deals.length, amount, weighted: amount * clampProb(stage.probability) };
}

/** Totals across every stage, for the header. */
export function pipelineTotals(deals: Deal[], stages: PipelineStage[]): StageTotals {
  const groups = groupDeals(deals, stages);
  return stages.reduce(
    (t, s) => {
      const x = stageTotals(groups.get(s.id) ?? [], s);
      return { count: t.count + x.count, amount: t.amount + x.amount, weighted: t.weighted + x.weighted };
    },
    { count: 0, amount: 0, weighted: 0 },
  );
}

/**
 * Takes a deal out and puts it into `stage` at `index` (counted after removal). Returns the same array when nothing
 * changes (unknown deal or stage, or dropped on its own slot), so a caller can skip a re-render and a callback.
 */
export function moveDeal(deals: Deal[], stages: PipelineStage[], id: string, stage: string, index: number): Deal[] {
  const from = deals.find((d) => d.id === id);
  if (!from || !stages.some((s) => s.id === stage)) return deals;
  const rest = deals.filter((d) => d.id !== id);
  const column = rest.filter((d) => d.stage === stage);
  const at = Math.min(Math.max(0, Math.trunc(index) || 0), column.length);
  const next = { ...from, stage };
  // Absolute position: just before the deal now at `at` in that column, or after the last one of it (or the end).
  const before = column[at];
  let pos: number;
  if (before) pos = rest.indexOf(before);
  else if (column.length) pos = rest.indexOf(column[column.length - 1]!) + 1;
  else pos = rest.length;
  const out = [...rest.slice(0, pos), next, ...rest.slice(pos)];
  // Only the order inside each stage matters: a deal dropped on its own slot changes nothing a person can see.
  const key = (list: Deal[]) => stages.map((s) => list.filter((d) => d.stage === s.id).map((d) => d.id).join(",")).join("|");
  const same = key(out) === key(deals);
  return same ? deals : out;
}

/** Where a deal sits now: its stage and its index in it. */
export function positionOf(deals: Deal[], id: string): { stage: string; index: number } | null {
  const d = deals.find((x) => x.id === id);
  if (!d) return null;
  return { stage: d.stage, index: deals.filter((x) => x.stage === d.stage && deals.indexOf(x) < deals.indexOf(d)).length };
}

export type MoveKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End";

/**
 * The slot a lifted deal moves to for a key: left and right go to the neighbouring unlocked stage keeping the index as
 * far as it fits, up and down reorder inside the stage, Home and End jump to its top and bottom. Null when it cannot move.
 */
export function keyboardTarget(deals: Deal[], stages: PipelineStage[], id: string, key: MoveKey): { stage: string; index: number } | null {
  const at = positionOf(deals, id);
  if (!at) return null;
  const groups = groupDeals(deals, stages);
  const si = stages.findIndex((s) => s.id === at.stage);
  if (si < 0) return null;
  const size = (groups.get(at.stage) ?? []).length;
  if (key === "ArrowUp") return at.index > 0 ? { stage: at.stage, index: at.index - 1 } : null;
  if (key === "ArrowDown") return at.index < size - 1 ? { stage: at.stage, index: at.index + 1 } : null;
  if (key === "Home") return at.index > 0 ? { stage: at.stage, index: 0 } : null;
  if (key === "End") return at.index < size - 1 ? { stage: at.stage, index: size - 1 } : null;
  const step = key === "ArrowLeft" ? -1 : 1;
  for (let i = si + step; i >= 0 && i < stages.length; i += step) {
    const s = stages[i]!;
    if (s.locked) continue;
    const n = (groups.get(s.id) ?? []).length;
    return { stage: s.id, index: Math.min(at.index, n) };
  }
  return null;
}

/** Index to drop at for a pointer at `y`, given the vertical midpoints of the cards already in the stage (dragged one excluded). */
export function slotIndex(mids: number[], y: number): number {
  let i = 0;
  while (i < mids.length && y > mids[i]!) i += 1;
  return i;
}

/** "$18,400" for a card; with `compact`, "$1.2M" for a total. Whole units only. */
export function formatMoney(amount: number, currency = "USD", compact = false): string {
  const n = money(amount);
  const big = compact && Math.abs(n) >= 10_000;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: big ? 1 : 0, notation: big ? "compact" : "standard" }).format(n);
  } catch {
    return `${currency} ${Math.round(n).toLocaleString("en-US")}`;
  }
}

const DAY = 86_400_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const toUtc = (iso: string) => (ISO.test(iso) ? Date.parse(`${iso}T00:00:00Z`) : NaN);

/** "Dec 12" from an ISO date; the raw text when it is not a date. UTC, so the server and the browser agree. */
export function formatClose(iso: string): string {
  const t = toUtc(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export type CloseState = "overdue" | "soon" | "later" | "none";

/** overdue: before today. soon: within `soonDays`. Without a valid today or date nothing is marked. */
export function closeState(close: string | undefined, today: string | undefined, soonDays = 7): CloseState {
  if (!close || !today) return "none";
  const c = toUtc(close);
  const t = toUtc(today);
  if (Number.isNaN(c) || Number.isNaN(t)) return "none";
  const days = Math.round((c - t) / DAY);
  return days < 0 ? "overdue" : days <= soonDays ? "soon" : "later";
}

export interface Pt {
  x: number;
  y: number;
}

/**
 * FLIP start offset for a card that was laid out at `prev` and now sits at `layout`. `visual` is where it looked to be
 * with any glide still running, and `layout` is where it is without one, so a card hit by a second move starts from
 * where it is on screen, not from where its last glide was heading. Null when it did not move enough to see (under half a px).
 */
export function flipFrom(prev: Pt | undefined, visual: Pt, layout: Pt): Pt | null {
  if (!prev) return null;
  const dx = prev.x + (visual.x - layout.x) - layout.x;
  const dy = prev.y + (visual.y - layout.y) - layout.y;
  return Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 ? null : { x: dx, y: dy };
}
