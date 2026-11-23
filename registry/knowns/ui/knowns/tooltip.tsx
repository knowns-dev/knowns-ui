"use client";
/** @registry name="tooltip" type="ui" title="Tooltip" description="Short hint on hover or focus, four sides, optional description; portaled above everything. TooltipGroup shares one tooltip across a toolbar that glides between triggers, with an optional hover highlight that glides with it." */

import { cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { EASE, MOTION } from "@/registry/knowns/lib/knowns/motion-utils";
import { restTransform, STRETCH_MS, stretchFrames, type HighlightBox } from "./tooltip-utils";
import { FLOAT_FADE, useFloating, type FloatingAlign, type FloatingSide } from "./use-floating";

export interface TooltipProps {
  /** The hint. Keep it short; it is read as the trigger's description. */
  content: ReactNode;
  /** Optional second, muted line. */
  description?: ReactNode;
  children: ReactNode;
  side?: FloatingSide;
  align?: FloatingAlign;
  /** Hover delay before showing, ms. Focus shows at once. Default 300. */
  delay?: number;
  /** Delay before hiding after the pointer leaves, ms. Default 80. */
  closeDelay?: number;
  /** Never show (the trigger keeps working). */
  disabled?: boolean;
  /** Classes for the inline wrapper around the trigger. */
  className?: string;
  /** Style of the inline wrapper, for a trigger that has to be placed (a segment over a bar, say). */
  style?: CSSProperties;
}

/** When a tooltip last closed: the next one within a moment opens at once, with no fade (a toolbar sweep). */
let lastClosed = 0;
const WARM_MS = 400;

/** What one trigger in a TooltipGroup hands to the shared tooltip. */
interface GroupEntry {
  id: string;
  el: HTMLElement;
  content: ReactNode;
  description?: ReactNode;
  side: FloatingSide;
  align: FloatingAlign;
}
interface GroupApi {
  show: (entry: GroupEntry, now: boolean, delay: number) => void;
  hide: (id: string, now: boolean) => void;
  sync: (entry: GroupEntry) => void;
  /** The pointer is on a trigger (at once, no delay) or has left it (the highlight waits closeDelay). */
  enter: (el: HTMLElement) => void;
  leave: (el: HTMLElement) => void;
  panelId: string;
}
const GroupApiContext = createContext<GroupApi | null>(null);
/** The id of the trigger the shared tooltip is on, or null while it is closed. */
const GroupActiveContext = createContext<string | null>(null);
/** The trigger under the pointer, for the group's hover highlight, or null once the pointer has left the group. */
const GroupHotContext = createContext<HTMLElement | null>(null);

const isExpanded = (v: unknown) => v === true || v === "true";
/** Cancels a WAAPI animation; its `finished` promise rejects on cancel, which nobody here awaits. */
const stop = (a: Animation | undefined) => {
  a?.finished?.catch(() => {});
  a?.cancel();
};
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Short hint on hover or focus. Wraps its child; the child should be focusable (a button, a link) so
 * keyboard users get the hint too. The hint renders in a portal with fixed positioning, flips when there
 * is no room, and hides itself while its trigger has an open popup (aria-expanded).
 */
export function Tooltip(props: TooltipProps) {
  const api = useContext(GroupApiContext);
  return api ? <GroupedTooltip {...props} api={api} /> : <SoloTooltip {...props} />;
}

function SoloTooltip({ content, description, children, side = "top", align = "center", delay = 300, closeDelay = 80, disabled, className, style: wrapStyle }: TooltipProps) {
  const [want, setWant] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const id = useId();

  const child = isValidElement(children) ? (children as ReactElement<Record<string, unknown>>) : null;
  const suppressed = disabled || (child ? isExpanded(child.props["aria-expanded"]) : false);
  const open = want && !suppressed;
  const { triggerRef, floatingRef, style, placement, portalHost, closing } = useFloating<HTMLSpanElement, HTMLDivElement>({ open, side, align, offset: 6 });
  const warm = useRef(false);

  const show = (now = false) => {
    clearTimeout(timer.current);
    warm.current = Date.now() - lastClosed < WARM_MS;
    timer.current = setTimeout(() => setWant(true), now || warm.current ? 0 : delay);
  };
  const hide = (now = false) => {
    clearTimeout(timer.current);
    const close = () => {
      lastClosed = Date.now();
      setWant(false);
    };
    if (now) close();
    else timer.current = setTimeout(close, closeDelay);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  // Escape dismisses even when the pointer, not focus, opened it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide(true);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Describe the focusable child itself; fall back to the wrapper for plain text children.
  const describedBy = open ? id : undefined;
  const trigger = child
    ? cloneElement(child, { "aria-describedby": cn(child.props["aria-describedby"], describedBy) || undefined })
    : children;

  return (
    <span
      ref={triggerRef}
      className={cn("inline-flex", className)}
      style={wrapStyle}
      onPointerEnter={(e) => e.pointerType !== "touch" && show()}
      onPointerLeave={() => hide()}
      onPointerDown={() => hide(true)}
      onFocus={(e) => (e.target as HTMLElement).matches?.(":focus-visible") && show(true)}
      onBlur={() => hide(true)}
      aria-describedby={child ? undefined : describedBy}
    >
      {trigger}
      {portalHost &&
        createPortal(
          <div
            ref={floatingRef}
            id={id}
            role="tooltip"
            data-side={placement}
            data-state={closing ? "closed" : "open"}
            data-warm={warm.current || undefined}
            style={style}
            className={cn(
              "pointer-events-none z-[70] w-max max-w-64 rounded-[8px] bg-foreground px-2 py-1 text-xs leading-[1.35] font-medium text-background",
              "shadow-[0_6px_20px_-8px_rgb(0_0_0/0.35)]",
              FLOAT_FADE,
              "data-[warm=true]:transition-none",
            )}
          >
            {content}
            {description && <div className="mt-0.5 font-normal text-background/70">{description}</div>}
          </div>,
          portalHost,
        )}
    </span>
  );
}

/** A trigger inside a TooltipGroup: it owns no panel, it tells the group where it is and what to say. */
function GroupedTooltip({ content, description, children, side = "top", align = "center", delay = 300, disabled, className, style: wrapStyle, api }: TooltipProps & { api: GroupApi }) {
  const id = useId();
  const el = useRef<HTMLSpanElement>(null);
  const activeId = useContext(GroupActiveContext);
  const child = isValidElement(children) ? (children as ReactElement<Record<string, unknown>>) : null;
  const suppressed = disabled || (child ? isExpanded(child.props["aria-expanded"]) : false);
  const entry = (): GroupEntry => ({ id, el: el.current as HTMLElement, content, description, side, align });
  const mine = activeId === id;

  // Text changed while the shared tooltip is on this trigger: hand over the new text.
  useEffect(() => {
    if (mine && el.current) api.sync(entry());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, content, description, side, align]);
  useEffect(() => {
    if (suppressed && mine) api.hide(id, true);
  }, [suppressed, mine, api, id]);
  useEffect(() => () => api.hide(id, true), [api, id]);

  const describedBy = mine ? api.panelId : undefined;
  const trigger = child ? cloneElement(child, { "aria-describedby": cn(child.props["aria-describedby"], describedBy) || undefined }) : children;
  return (
    <span
      ref={el}
      className={cn("inline-flex", className)}
      style={wrapStyle}
      onPointerEnter={(e) => {
        if (e.pointerType === "touch") return;
        if (el.current) api.enter(el.current);
        if (!suppressed) api.show(entry(), false, delay);
      }}
      onPointerLeave={() => {
        if (el.current) api.leave(el.current);
        api.hide(id, false);
      }}
      onPointerDown={() => api.hide(id, true)}
      onFocus={(e) => !suppressed && (e.target as HTMLElement).matches?.(":focus-visible") && api.show(entry(), true, delay)}
      onBlur={() => api.hide(id, false)}
      aria-describedby={child ? undefined : describedBy}
    >
      {trigger}
    </span>
  );
}

export interface TooltipGroupProps {
  children: ReactNode;
  /** Delay before the first tooltip opens, ms. Moving to another trigger while one is open has none. Default: each Tooltip's own delay (300). */
  delay?: number;
  /** Delay before the shared tooltip closes after the pointer leaves every trigger, ms. Crossing the gap between two buttons never flickers. Default 140. */
  closeDelay?: number;
}

/**
 * Every Tooltip inside shares ONE tooltip. The first opens after its delay; moving to the next trigger glides the same
 * tooltip to it and morphs its size to the new text, with no close, no reopen and no delay. Meant for a tool rail or a
 * toolbar where a person sweeps across buttons. Reduced motion: the tooltip jumps instead of gliding.
 */
export function TooltipGroup({ children, delay, closeDelay = 140 }: TooltipGroupProps) {
  const [active, setActive] = useState<GroupEntry | null>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const openRef = useRef(false);
  const activeRef = useRef<GroupEntry | null>(null);
  const pending = useRef<string | null>(null);
  const panelId = useId();
  openRef.current = open;
  activeRef.current = active;

  const show = useCallback((entry: GroupEntry, now: boolean, d: number) => {
    clearTimeout(timer.current);
    const go = () => {
      pending.current = null;
      setActive(entry);
      setOpen(true);
    };
    // Already open: move at once. Just closed: warm, at once. Otherwise the normal delay.
    if (now || openRef.current || Date.now() - lastClosed < WARM_MS) go();
    else {
      pending.current = entry.id;
      timer.current = setTimeout(go, delay ?? d);
    }
  }, [delay]);
  const hide = useCallback((id: string, now: boolean) => {
    // Only the trigger the tooltip is on (or one still waiting for its delay) may close it.
    if (activeRef.current?.id !== id && pending.current !== id) return;
    clearTimeout(timer.current);
    if (pending.current === id) {
      pending.current = null;
      if (!openRef.current) return;
    }
    const close = () => {
      if (!openRef.current) return;
      lastClosed = Date.now();
      setOpen(false);
    };
    if (now) close();
    else timer.current = setTimeout(close, closeDelay);
  }, [closeDelay]);
  const sync = useCallback((entry: GroupEntry) => setActive((a) => (a && a.id === entry.id ? entry : a)), []);
  const [hot, setHot] = useState<HTMLElement | null>(null);
  const hotTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const enter = useCallback((el: HTMLElement) => {
    clearTimeout(hotTimer.current);
    setHot(el);
  }, []);
  // Crossing the gap to the next trigger cancels this, so the highlight glides on instead of fading.
  const leave = useCallback((el: HTMLElement) => {
    clearTimeout(hotTimer.current);
    hotTimer.current = setTimeout(() => setHot((h) => (h === el ? null : h)), closeDelay);
  }, [closeDelay]);
  useEffect(() => () => {
    clearTimeout(timer.current);
    clearTimeout(hotTimer.current);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (clearTimeout(timer.current), (lastClosed = Date.now()), setOpen(false));
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const api = useMemo<GroupApi>(() => ({ show, hide, sync, enter, leave, panelId }), [show, hide, sync, enter, leave, panelId]);
  return (
    <GroupApiContext.Provider value={api}>
      <GroupActiveContext.Provider value={open && active ? active.id : null}>
        <GroupHotContext.Provider value={hot}>
          {children}
          <GroupPanel active={active} open={open} panelId={panelId} />
        </GroupHotContext.Provider>
      </GroupActiveContext.Provider>
    </GroupApiContext.Provider>
  );
}

/**
 * One hover highlight for a TooltipGroup's toolbar: a pill behind the trigger under the pointer that glides to the
 * next one with the tooltip instead of jumping. The edge facing the move is stiff and the trailing edge soft, so it
 * stretches across the gap and settles (transform only). It shows at once on hover, fades in and out at the fast
 * duration, and waits the group's closeDelay before fading, so crossing a gap never flickers. Put it first inside the
 * positioned toolbar element, next to the triggers; their wrappers must share it as their offset parent. A selected
 * trigger keeps its own state. Reduced motion: it jumps.
 */
export function TooltipGroupHighlight({ className }: { className?: string }) {
  const hot = useContext(GroupHotContext);
  const ref = useRef<HTMLSpanElement>(null);
  const shownOn = useRef<HighlightBox | null>(null);
  const anim = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!hot) {
      // Fading out: keep the last place, and the next hover appears in place rather than travelling.
      shownOn.current = null;
      return;
    }
    const box: HighlightBox = { x: hot.offsetLeft, y: hot.offsetTop, w: hot.offsetWidth, h: hot.offsetHeight };
    const from = shownOn.current;
    shownOn.current = box;
    el.style.width = `${box.w}px`;
    el.style.height = `${box.h}px`;
    el.style.transform = restTransform(box);
    if (anim.current) stop(anim.current);
    anim.current = null;
    if (!from || (from.x === box.x && from.y === box.y) || reducedMotion() || typeof el.animate !== "function") return;
    // Frames are sampled from the token curves, so the playback itself is linear.
    anim.current = el.animate(stretchFrames(from, box), { duration: STRETCH_MS, easing: "linear" });
  }, [hot]);
  return (
    <span
      ref={ref}
      aria-hidden
      data-slot="tooltip-group-highlight"
      data-on={hot ? "" : undefined}
      className={cn(
        "pointer-events-none absolute top-0 left-0 origin-top-left rounded-[9px] bg-[color-mix(in_srgb,var(--muted)_70%,transparent)] opacity-0 transition-opacity duration-(--kn-dur-fast) ease-(--kn-ease-out) data-[on]:opacity-100 motion-reduce:transition-none",
        className,
      )}
    />
  );
}

/** The one tooltip of a group: positioned with a translate so it can glide, sized from its content so it can morph. */
function GroupPanel({ active, open, panelId }: { active: GroupEntry | null; open: boolean; panelId: string }) {
  const { triggerRef, floatingRef, style, placement, portalHost, closing, ready } = useFloating<HTMLElement, HTMLDivElement>({ open, side: active?.side ?? "top", align: active?.align ?? "center", offset: 6 });
  if (active) (triggerRef as { current: HTMLElement | null }).current = active.el;
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const settled = useRef(false);
  // The label that was here a moment ago slides out toward where the tooltip came from; the new one slides in from the far side.
  const prev = useRef<GroupEntry | null>(null);
  const [leaving, setLeaving] = useState<{ entry: GroupEntry; dir: "fwd" | "back" } | null>(null);
  const [axis, setAxis] = useState<"x" | "y">("y");
  const oldLabel = useRef<HTMLDivElement>(null);
  const newLabel = useRef<HTMLDivElement>(null);
  /** How far each label travels along the move, px. */
  const OFFSET = 9;
  const shift = (sign: number) => (axis === "y" ? `0 ${sign * OFFSET}px` : `${sign * OFFSET}px 0`);
  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = active;
    if (!active || !before || before.id === active.id || !open || !settled.current) return;
    const from = before.el.getBoundingClientRect();
    const to = active.el.getBoundingClientRect();
    const dx = to.left - from.left;
    const dy = to.top - from.top;
    const ax = Math.abs(dy) >= Math.abs(dx) ? "y" : "x";
    const d = (ax === "y" ? dy : dx) >= 0 ? "fwd" : "back";
    setAxis(ax);
    setLeaving({ entry: before, dir: d });
  }, [active, open]);
  // The swap runs as WAAPI from explicit start frames, started before the first paint of the move, so it never depends
  // on a state change landing in a painted frame: the old label is out (half of MOTION.fast) before the new one starts,
  // and the new one is hidden until then (fill backwards). Each travels OFFSET px along the move, clipped by the box.
  useLayoutEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setLeaving(null), MOTION.fast * 1.5 + 20);
    if (reducedMotion()) return () => clearTimeout(t);
    const half = MOTION.fast / 2;
    const anims = [
      oldLabel.current?.animate?.([{ opacity: 1, translate: "0 0" }, { opacity: 0, translate: shift(leaving.dir === "fwd" ? 1 : -1) }], { duration: half, easing: EASE.out, fill: "forwards" }),
      newLabel.current?.animate?.([{ opacity: 0, translate: shift(leaving.dir === "fwd" ? -1 : 1) }, { opacity: 1, translate: "0 0" }], { duration: MOTION.fast, delay: half, easing: EASE.out, fill: "backwards" }),
    ];
    return () => {
      clearTimeout(t);
      anims.forEach(stop);
    };
    // shift reads axis, which is set in the same commit as leaving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);
  useLayoutEffect(() => {
    const f = floatingRef.current;
    if (!f) return;
    const w = f.offsetWidth;
    const h = f.offsetHeight;
    setBox((b) => (b && b.w === w && b.h === h ? b : { w, h }));
  });
  // Glide only once the tooltip has been shown in place: the first placement never travels from the corner.
  const glide = settled.current && open;
  useEffect(() => {
    if (open && ready) settled.current = true;
    if (!open && !closing) {
      settled.current = false;
      prev.current = null;
    }
  });
  if (!portalHost || !active) return null;
  const x = typeof style.left === "number" ? style.left : 0;
  const y = typeof style.top === "number" ? style.top : 0;
  // One line: the label, then the hint as a small key chip on the right, so the box stays short and the width change is what reads.
  const content = (e: GroupEntry) => (
    <span className="flex items-center gap-2 whitespace-nowrap">
      {e.content}
      {e.description && <kbd className="rounded-[4px] bg-background/15 px-1 font-sans text-[11px] leading-[1.45] font-medium text-background/80">{e.description}</kbd>}
    </span>
  );
  return createPortal(
    <div className="pointer-events-none fixed top-0 left-0 z-[70]" data-slot="tooltip-group">
      {/* Natural size, hidden: the group measures and places from this box (it has no transform, so fixed coordinates are true), and the visible tooltip follows it. */}
      <div ref={floatingRef} aria-hidden className="invisible absolute top-0 left-0 w-max max-w-64 px-2 py-1 text-xs leading-[1.35] font-medium">
        {content(active)}
      </div>
      <div
        id={panelId}
        role="tooltip"
        data-side={placement}
        data-state={closing ? "closed" : "open"}
        data-glide={glide || undefined}
        style={{ position: "absolute", left: 0, top: 0, translate: `${x}px ${y}px`, width: box?.w, height: box?.h, visibility: style.visibility }}
        className={cn(
          "overflow-hidden rounded-[8px] bg-foreground text-xs leading-[1.35] font-medium text-background",
          "shadow-[0_6px_20px_-8px_rgb(0_0_0/0.35)]",
          FLOAT_FADE,
          // First show: a small rise and scale in place. Moving on: the box stretches (size on a short curve, position on a longer one).
          "transition-[opacity,scale] duration-(--kn-dur-fast) ease-(--kn-ease-out) starting:scale-[0.96] motion-reduce:transition-none",
          "data-[glide=true]:transition-[opacity,translate,width,height] data-[glide=true]:duration-(--kn-dur) data-[glide=true]:ease-(--kn-ease-inout)",
          "data-[glide=true]:[transition-duration:var(--kn-dur),var(--kn-dur),var(--kn-dur-fast),var(--kn-dur-fast)]",
        )}
      >
        {/* Both labels travel the way the tooltip does and are clipped to the box. The old one is mostly gone before the new one passes half. */}
        {leaving && (
          <div ref={oldLabel} aria-hidden data-label="old" className="absolute top-0 left-0 w-max max-w-64 px-2 py-1 opacity-0 motion-reduce:hidden">
            {content(leaving.entry)}
          </div>
        )}
        <div key={active.id} ref={newLabel} data-label="new" className="w-max max-w-64 px-2 py-1">
          {content(active)}
        </div>
      </div>
    </div>,
    portalHost,
  );
}
