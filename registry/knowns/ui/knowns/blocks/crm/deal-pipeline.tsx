"use client";
/** @registry name="deal-pipeline" type="block" title="Deal pipeline" description="A sales pipeline: stage columns with deal count, total and weighted value, deal cards with amount, close date, owner and last touch, and moving a deal by drag or by keyboard." */

/**
 * DealPipeline: stage columns of deal cards for a sales pipeline. Each column shows its count, total value and weighted
 * value (total times the stage's chance to close); the header adds up the whole pipeline. A deal moves between stages
 * and inside a stage by dragging it (mouse anywhere on the card, touch and pen by the grip) or from the keyboard:
 * Space lifts the focused deal, the arrow keys move it, Space or Enter drops it, Escape puts it back. A screen reader
 * hears each step. Deals are controlled or uncontrolled; `onMove` can refuse a move.
 *
 * It does not use the Kanban board: that one is a Pro item and this block is Free. It keeps its own small rules in
 * deal-pipeline-utils.ts. Nothing is fetched and no clock is read: `today` comes in as a prop.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { EASE, MOTION, TickNumber, prefersReducedMotion } from "@/registry/knowns/lib/knowns/motion";
import { Avatar } from "../../avatar";
import {
  closeState,
  flipFrom,
  formatClose,
  formatMoney,
  groupDeals,
  keyboardTarget,
  moveDeal,
  pipelineTotals,
  positionOf,
  slotIndex,
  stageTotals,
  type Deal,
  type DealMove,
  type MoveKey,
  type Pt,
  type PipelineStage,
} from "./deal-pipeline-utils";

export * from "./deal-pipeline-utils";

export interface DealPipelineProps {
  stages: PipelineStage[];
  /** Controlled deals. The order inside a stage is the array order. */
  deals?: Deal[];
  defaultDeals?: Deal[];
  onDealsChange?: (deals: Deal[]) => void;
  /** Called after a drop or a keyboard drop. Return false to refuse it: the deal goes back. */
  onMove?: (move: DealMove) => boolean | void;
  onDealOpen?: (deal: Deal) => void;
  /** ISO date of today (YYYY-MM-DD). Close dates before it read overdue, within a week soon. Without it nothing is marked. */
  today?: string;
  currency?: string;
  title?: ReactNode;
  /** Right side of the header, next to the totals. */
  actions?: ReactNode;
  /** Stages share the width but are never narrower than this (px); past that the board scrolls. Default 256. */
  columnMinWidth?: number;
  /** "panel" (default): its own card. "none": no outer surface, for a page. */
  surface?: "panel" | "none";
  className?: string;
  "aria-label"?: string;
}

const TONE_DOT: Record<NonNullable<PipelineStage["tone"]>, string> = {
  neutral: "bg-muted-foreground/50",
  accent: "bg-primary",
  info: "bg-sky-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

const Grip = () => (
  <svg viewBox="0 0 12 16" className="size-3.5" fill="currentColor" aria-hidden>
    <circle cx="4" cy="4" r="1.1" />
    <circle cx="8" cy="4" r="1.1" />
    <circle cx="4" cy="8" r="1.1" />
    <circle cx="8" cy="8" r="1.1" />
    <circle cx="4" cy="12" r="1.1" />
    <circle cx="8" cy="12" r="1.1" />
  </svg>
);

/** The card on its own, so the drag ghost and the column share one look. */
export function DealCardView({ deal, currency = "USD", today, className }: { deal: Deal; currency?: string; today?: string; className?: string }) {
  const state = closeState(deal.close, today);
  return (
    <div className={cn("rounded-xl border bg-card px-3 py-2.5 text-card-foreground shadow-xs", className)}>
      <div className="flex items-start gap-1.5">
        <span data-grip className="-my-1 -ml-1.5 flex touch-none items-center self-stretch px-1 text-muted-foreground/60" aria-hidden>
          <Grip />
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13px] leading-snug font-medium">{deal.title}</p>
          {deal.company && <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{deal.company}</p>}
        </div>
      </div>
      <p className="mt-2 text-[13.5px] font-semibold tracking-tight tabular-nums">{formatMoney(deal.amount, currency)}</p>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
        <span className={cn("truncate", state === "overdue" && "font-medium text-red-600 dark:text-red-400", state === "soon" && "text-amber-700 dark:text-amber-300")}>
          {deal.close ? (
            <>
              {state === "overdue" && <span className="sr-only">Overdue, </span>}
              Close {formatClose(deal.close)}
            </>
          ) : (
            "No close date"
          )}
        </span>
        {deal.owner && <Avatar label={deal.owner} src={deal.ownerSrc} size="xs" shape="circle" />}
      </div>
      {deal.lastTouch && <p className="mt-1 truncate text-[11.5px] text-muted-foreground">Last touch {deal.lastTouch}</p>}
    </div>
  );
}

interface Gesture {
  id: string;
  preview: Deal[];
  /** Pointer drag only: where the floating copy is. */
  ghost?: { x: number; y: number; w: number; dx: number; dy: number };
}

export function DealPipeline({
  stages,
  deals: controlled,
  defaultDeals,
  onDealsChange,
  onMove,
  onDealOpen,
  today,
  currency = "USD",
  title,
  actions,
  columnMinWidth = 256,
  surface = "panel",
  className,
  "aria-label": ariaLabel = "Deal pipeline",
}: DealPipelineProps) {
  const [inner, setInner] = useState<Deal[]>(defaultDeals ?? []);
  const deals = controlled ?? inner;
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [live, setLive] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusId = useRef<string | null>(null);
  const justDragged = useRef(false);
  /** Where each card was laid out last time, relative to the board, for the FLIP glide. */
  const layouts = useRef(new Map<string, Pt>());
  /** Where the floating copy was let go (viewport), so the card glides from there into its slot. */
  const released = useRef<{ id: string; x: number; y: number } | null>(null);
  const hintId = useId();
  const shown = gesture?.preview ?? deals;
  const groups = useMemo(() => groupDeals(shown, stages), [shown, stages]);
  const totals = useMemo(() => pipelineTotals(shown, stages), [shown, stages]);
  const stageTitle = useCallback((id: string) => stages.find((s) => s.id === id)?.title ?? id, [stages]);

  const commit = useCallback(
    (id: string, preview: Deal[]): "moved" | "refused" | "same" => {
      const from = positionOf(deals, id);
      const to = positionOf(preview, id);
      setGesture(null);
      if (!from || !to || preview === deals) return "same";
      if (from.stage === to.stage && from.index === to.index) return "same";
      if (onMove?.({ deal: id, from: from.stage, to: to.stage, index: to.index }) === false) {
        setLive(`Move refused. ${stageTitle(from.stage)} kept the deal.`);
        return "refused";
      }
      if (controlled === undefined) setInner(preview);
      onDealsChange?.(preview);
      return "moved";
    },
    [deals, controlled, onMove, onDealsChange, stageTitle],
  );

  // A move to another column remounts the card, so put focus back on it after every keyboard step and drop.
  useLayoutEffect(() => {
    const id = focusId.current;
    if (!id) return;
    focusId.current = null;
    const el = [...(rootRef.current?.querySelectorAll<HTMLElement>("[data-deal-id]") ?? [])].find((n) => n.dataset.dealId === id);
    el?.focus({ preventScroll: false });
  });

  // FLIP: after every change of order, each card that moved glides from where it was to where it is, with a translate
  // only (transform is the one property that never re-lays out). The floating copy while dragging is not a card here: it
  // is fixed to the pointer and has no transition. Reduced motion and the first paint snap.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const origin = root.getBoundingClientRect();
    const scroll = scrollRef.current?.scrollLeft ?? 0;
    const calm = prefersReducedMotion();
    const next = new Map<string, Pt>();
    const drop = released.current;
    released.current = null;
    for (const el of root.querySelectorAll<HTMLElement>("[data-deal-id]")) {
      const id = el.dataset.dealId!;
      const running = typeof el.getAnimations === "function" ? el.getAnimations() : [];
      const seen = el.getBoundingClientRect();
      for (const a of running) a.cancel();
      const r = running.length ? el.getBoundingClientRect() : seen;
      const layout = { x: r.left - origin.left + scroll, y: r.top - origin.top };
      next.set(id, layout);
      if (calm || typeof el.animate !== "function") continue;
      let from: Pt | null;
      if (drop && drop.id === id) from = flipFrom({ x: drop.x - origin.left + scroll, y: drop.y - origin.top }, { x: drop.x - origin.left + scroll, y: drop.y - origin.top }, layout);
      else from = flipFrom(layouts.current.get(id), { x: seen.left - origin.left + scroll, y: seen.top - origin.top }, layout);
      if (from) el.animate([{ transform: `translate(${from.x}px, ${from.y}px)` }, { transform: "translate(0, 0)" }], { duration: MOTION.slow, easing: EASE.inOut });
    }
    layouts.current = next;
  }, [shown, gesture?.ghost ? 1 : 0]);

  const where = (list: Deal[], id: string) => {
    const at = positionOf(list, id);
    if (!at) return "";
    const n = (groupDeals(list, stages).get(at.stage) ?? []).length;
    return `${stageTitle(at.stage)}, position ${at.index + 1} of ${n}`;
  };

  /* ── Keyboard ── */

  const onKeyDown = (e: ReactKeyboardEvent<HTMLElement>, deal: Deal) => {
    if (e.target !== e.currentTarget) return;
    const lifted = gesture && !gesture.ghost && gesture.id === deal.id;
    if (!lifted) {
      if (e.key === " ") {
        e.preventDefault();
        setGesture({ id: deal.id, preview: deals });
        setLive(`Picked up ${deal.title}. ${where(deals, deal.id)}. Arrow keys move it, Space drops it, Escape cancels.`);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onDealOpen?.(deal);
      }
      return;
    }
    const preview = gesture.preview;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      focusId.current = deal.id;
      const text = where(preview, deal.id);
      if (commit(deal.id, preview) !== "refused") setLive(`Dropped ${deal.title}. ${text}.`);
    } else if (e.key === "Escape") {
      e.preventDefault();
      focusId.current = deal.id;
      setGesture(null);
      setLive(`Cancelled. ${deal.title} stays in ${where(deals, deal.id)}.`);
    } else if (e.key === "Tab") {
      setGesture(null);
    } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      const target = keyboardTarget(preview, stages, deal.id, e.key as MoveKey);
      if (!target) {
        setLive(`${deal.title} cannot move further. ${where(preview, deal.id)}.`);
        return;
      }
      const next = moveDeal(preview, stages, deal.id, target.stage, target.index);
      focusId.current = deal.id;
      setGesture({ id: deal.id, preview: next });
      setLive(`${where(next, deal.id)}.`);
    }
  };

  // A click outside puts a lifted deal back.
  useEffect(() => {
    if (!gesture || gesture.ghost) return;
    const out = (ev: PointerEvent) => {
      if (!rootRef.current?.contains(ev.target as Node)) setGesture(null);
    };
    document.addEventListener("pointerdown", out);
    return () => document.removeEventListener("pointerdown", out);
  }, [gesture]);

  /* ── Pointer ── */

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>, deal: Deal) => {
    if (e.button !== 0 || gesture) return;
    const onGrip = (e.target as HTMLElement).closest("[data-grip]") !== null;
    if (e.pointerType !== "mouse" && !onGrip) return;
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY };
    const dx = start.x - rect.left;
    const dy = start.y - rect.top;
    let started = false;
    let base = deals;
    let last: Deal[] = deals;
    let lastPointer: { x: number; y: number } | null = null;

    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
    const move = (ev: PointerEvent) => {
      if (!started) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 4) return;
        started = true;
        base = deals;
        setLive(`Picked up ${deal.title}.`);
      }
      const root = rootRef.current;
      if (!root) return;
      const cols = [...root.querySelectorAll<HTMLElement>("[data-stage]")];
      let col: HTMLElement | undefined;
      for (const c of cols) {
        const r = c.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX <= r.right) col = c;
      }
      const stage = col ? stages.find((s) => s.id === col!.dataset.stage) : undefined;
      let preview = last;
      if (col && stage && !stage.locked) {
        const mids = [...col.querySelectorAll<HTMLElement>("[data-deal-id]")].filter((n) => n.dataset.dealId !== deal.id).map((n) => {
          const r = n.getBoundingClientRect();
          return r.top + r.height / 2;
        });
        preview = moveDeal(base, stages, deal.id, stage.id, slotIndex(mids, ev.clientY));
      }
      last = preview;
      lastPointer = { x: ev.clientX, y: ev.clientY };
      const sc = scrollRef.current;
      if (sc) {
        const r = sc.getBoundingClientRect();
        if (ev.clientX < r.left + 40) sc.scrollLeft -= 14;
        else if (ev.clientX > r.right - 40) sc.scrollLeft += 14;
      }
      setGesture({ id: deal.id, preview, ghost: { x: ev.clientX, y: ev.clientY, w: rect.width, dx, dy } });
    };
    const up = () => {
      stop();
      if (!started) return;
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 0);
      if (lastPointer) released.current = { id: deal.id, x: lastPointer.x - dx, y: lastPointer.y - dy };
      const text = where(last, deal.id);
      if (commit(deal.id, last) !== "refused") setLive(`Dropped ${deal.title}. ${text}.`);
    };
    const cancel = () => {
      stop();
      setGesture(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };

  const dragging = gesture?.ghost ? shown.find((d) => d.id === gesture.id) : undefined;
  const money = (n: number) => formatMoney(n, currency, true);
  const sizeText = (n: number) => `${n} ${n === 1 ? "deal" : "deals"}`;

  return (
    <div ref={rootRef} className={cn("relative", surface === "panel" && "rounded-2xl border bg-card p-4 shadow-xs", "text-foreground", className)} aria-label={ariaLabel} role="group">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
          <p className="text-[12.5px] text-muted-foreground tabular-nums">
            <TickNumber value={totals.count} /> {totals.count === 1 ? "deal" : "deals"} · <TickNumber value={totals.amount} format={money} /> total · <TickNumber value={totals.weighted} format={money} /> weighted
          </p>
        </div>
        {actions}
      </div>
      <p id={hintId} className="sr-only">
        Press Space on a deal to pick it up. Use the arrow keys to move it between stages or up and down, Space to drop it and Escape to cancel.
      </p>
      <div ref={scrollRef} className="relative -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: "thin" }}>
        {stages.map((stage) => {
          const list = groups.get(stage.id) ?? [];
          const t = stageTotals(list, stage);
          const overTarget = Boolean(gesture) && !stage.locked && list.some((d) => d.id === gesture?.id);
          return (
            <section
              key={stage.id}
              data-stage={stage.id}
              aria-label={`${stage.title}, ${sizeText(t.count)}, ${formatMoney(t.amount, currency)}`}
              className={cn("flex min-w-0 flex-1 basis-0 snap-start flex-col rounded-xl bg-muted/50 p-2 transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out)", overTarget && "bg-muted")}
              style={{ minWidth: columnMinWidth }}
            >
              <header className="px-1.5 pt-1 pb-2">
                <div className="flex items-center gap-2">
                  <span className={cn("size-2 shrink-0 rounded-full", TONE_DOT[stage.tone ?? "neutral"])} aria-hidden />
                  <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold">{stage.title}</h3>
                  <TickNumber value={t.count} className="text-[12px] text-muted-foreground" />
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground tabular-nums">
                  <TickNumber value={t.amount} format={money} />
                  <span className="mx-1" aria-hidden>
                    ·
                  </span>
                  <TickNumber value={t.weighted} format={money} /> at {Math.round(stage.probability * 100)}%
                </p>
              </header>
              <ul className="flex min-h-12 flex-1 flex-col gap-2" role="list">
                {list.map((deal) => {
                  const lifted = gesture?.id === deal.id;
                  const asGhostSource = lifted && gesture?.ghost;
                  return (
                    <li key={deal.id}>
                      <div
                        data-deal-id={deal.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={lifted && !gesture?.ghost}
                        aria-roledescription="draggable deal"
                        aria-describedby={hintId}
                        aria-label={`${deal.title}${deal.company ? `, ${deal.company}` : ""}, ${formatMoney(deal.amount, currency)}`}
                        onKeyDown={(e) => onKeyDown(e, deal)}
                        onPointerDown={(e) => onPointerDown(e, deal)}
                        onClick={() => {
                          if (!justDragged.current && !gesture) onDealOpen?.(deal);
                        }}
                        className={cn("block cursor-default rounded-xl select-none", onDealOpen && "cursor-pointer", focusRing, lifted && !gesture?.ghost && "ring-2 ring-primary", asGhostSource && "opacity-45")}
                        style={{ touchAction: "pan-y" }}
                      >
                                        <DealCardView deal={deal} currency={currency} today={today} className={cn(lifted && "border-primary/50")} />
                      </div>
                    </li>
                  );
                })}
                {list.length === 0 && (
                  <li className="grid flex-1 place-items-center rounded-xl border border-dashed px-3 py-4 text-center text-[12px] text-muted-foreground">{stage.locked ? "Filled by the system" : "No deals"}</li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {live}
      </div>
      {dragging && gesture?.ghost && (
        <div className="pointer-events-none fixed z-50" style={{ left: gesture.ghost.x - gesture.ghost.dx, top: gesture.ghost.y - gesture.ghost.dy, width: gesture.ghost.w }} aria-hidden>
          <DealCardView deal={dragging} currency={currency} today={today} className="rotate-1 shadow-lg" />
        </div>
      )}
    </div>
  );
}

export default DealPipeline;
