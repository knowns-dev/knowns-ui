"use client";
/** @registry name="resizable" type="ui" title="Resizable panels" description="Split panels with draggable, keyboard-operable handles, min and max sizes, collapsible panels and sizes saved between visits." */

import { Children, cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactElement, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { initialSizes, keyDirection, keyStep, parseSaved, pxToPercent, resize, type PanelLimits } from "./resizable-utils";

export type ResizableDirection = "horizontal" | "vertical";

interface Ctx {
  direction: ResizableDirection;
  dragging: boolean;
}
const GroupCtx = createContext<Ctx>({ direction: "horizontal", dragging: false });

export interface ResizablePanelProps {
  children?: ReactNode;
  /** Starting size in %. Panels without one share what is left. */
  defaultSize?: number;
  /** Smallest size in % (unless collapsed). Default 10. */
  minSize?: number;
  /** Largest size in %. Default 100. */
  maxSize?: number;
  /** Can shrink to nothing: drag it shut, or press Enter on its handle. */
  collapsible?: boolean;
  /** Accessible name for the panel region. */
  label?: string;
  className?: string;
}

/** One panel. Place it inside a ResizablePanelGroup, with a ResizableHandle between neighbours. */
export function ResizablePanel(_props: ResizablePanelProps) {
  // Rendered by the group, which owns the sizes.
  return null;
}
ResizablePanel.displayName = "ResizablePanel";

export interface ResizableHandleProps {
  /** A small grip in the middle of the line. Default false. */
  withGrip?: boolean;
  /** Names the divider for screen readers, e.g. "Resize sidebar". */
  label?: string;
  className?: string;
}

/** The divider between two panels: a focusable separator. The group wires it up. */
export function ResizableHandle(props: ResizableHandleProps & { __handle?: HandleInternals }) {
  return props.__handle ? <HandleView {...props} __handle={props.__handle} /> : null;
}
ResizableHandle.displayName = "ResizableHandle";

export interface ResizablePanelGroupProps {
  /** "horizontal": side by side. "vertical": stacked. Default "horizontal". */
  direction?: ResizableDirection;
  /** ResizablePanel and ResizableHandle elements, alternating. */
  children: ReactNode;
  /** Remembers the sizes in localStorage under this key. Applied right after mount, so a server render shows the defaults. */
  storageKey?: string;
  /** Called with the sizes (%) after every change. */
  onLayout?: (sizes: number[]) => void;
  /** Name for the group landmark. */
  label?: string;
  className?: string;
}

const HANDLE_PX = 1;

/**
 * Split panels. Drag a handle, or focus it and use the arrow keys (Shift for 10%), Home and End to reach a
 * panel's limits, Enter to collapse or reopen a collapsible neighbour, and double click to reset. Handles
 * are role=separator with the size of the panel before them. Give the group a height (or let its parent
 * give it one): panels fill it.
 */
export function ResizablePanelGroup({ direction = "horizontal", children, storageKey, onLayout, label, className }: ResizablePanelGroupProps) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<ResizablePanelProps & ResizableHandleProps>[];
  const panels = items.filter((c) => c.type === ResizablePanel);
  const limits: PanelLimits[] = panels.map((p) => ({ min: p.props.minSize, max: p.props.maxSize, collapsible: p.props.collapsible }));
  const defaults = useMemo(() => initialSizes(panels.map((p) => p.props.defaultSize)), [panels.map((p) => p.props.defaultSize).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const [sizes, setSizes] = useState(defaults);
  const [dragging, setDragging] = useState(false);
  const before = useRef<Record<number, number>>({}); // the size a collapsed panel returns to
  const key = storageKey ? `kn-resizable:${storageKey}` : undefined;
  const horizontal = direction === "horizontal";

  // Saved sizes apply after mount, so the server render and the first client render match.
  useEffect(() => {
    if (!key) return;
    try {
      const saved = parseSaved(localStorage.getItem(key), panels.length);
      if (saved) setSizes(saved);
    } catch {
      /* private mode */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const commit = useCallback(
    (next: number[]) => {
      setSizes(next);
      onLayout?.(next);
      if (!key) return;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* private mode or full */
      }
    },
    [key, onLayout],
  );

  const room = () => {
    const el = root.current;
    if (!el) return 0;
    const full = horizontal ? el.clientWidth : el.clientHeight;
    return full - HANDLE_PX * Math.max(0, panels.length - 1);
  };

  const move = (i: number, delta: number, from: number[] = sizes) => commit(resize(from, i, delta, limits));

  const onKey = (i: number, e: KeyboardEvent<HTMLElement>) => {
    const dir = keyDirection(e.key, direction);
    if (dir) {
      e.preventDefault();
      move(i, dir * keyStep(e.shiftKey));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      // Home: the panel before the handle at its smallest; End: at its largest.
      move(i, e.key === "Home" ? -100 : 100);
    } else if (e.key === "Enter") {
      const target = limits[i]?.collapsible ? i : limits[i + 1]?.collapsible ? i + 1 : -1;
      if (target < 0) return;
      e.preventDefault();
      const other = target === i ? i + 1 : i;
      const now = sizes[target];
      const next = sizes.slice();
      if (now > 0) {
        before.current[target] = now;
        next[other] += now;
        next[target] = 0;
        commit(next);
      } else {
        const back = Math.min(before.current[target] ?? defaults[target] ?? 25, next[other] - (limits[other]?.collapsible ? 0 : (limits[other]?.min ?? 10)));
        next[target] = Math.max(back, 0);
        next[other] -= next[target];
        commit(next.map((v) => Math.round(v * 1000) / 1000));
      }
    }
  };

  const drag = useRef<{ x: number; start: number[]; room: number } | null>(null);
  const down = (i: number, e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: horizontal ? e.clientX : e.clientY, start: sizes, room: room() };
    setDragging(true);
  };
  const moveTo = (i: number, e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const px = (horizontal ? e.clientX : e.clientY) - d.x;
    move(i, pxToPercent(px, d.room), d.start);
  };
  const up = () => {
    drag.current = null;
    setDragging(false);
  };

  let p = -1;
  const style: CSSProperties = { display: "flex", flexDirection: horizontal ? "row" : "column" };
  return (
    <GroupCtx.Provider value={{ direction, dragging }}>
      <div ref={root} role="group" aria-label={label} data-direction={direction} data-dragging={dragging || undefined} style={style} className={cn("h-full w-full min-h-0 min-w-0", className)}>
        {items.map((c, k) => {
          if (c.type === ResizablePanel) {
            p += 1;
            const i = p;
            const size = sizes[i] ?? 0;
            return (
              <div
                key={k}
                id={`${id}-p${i}`}
                role={c.props.label ? "region" : undefined}
                aria-label={c.props.label}
                data-collapsed={size === 0 || undefined}
                style={{ flex: `${size} 1 0px`, minWidth: 0, minHeight: 0, overflow: "hidden" }}
                className={cn("relative", !dragging && "transition-[flex-grow] duration-200 ease-out motion-reduce:transition-none", c.props.className)}
              >
                {c.props.children}
              </div>
            );
          }
          if (c.type === ResizableHandle) {
            const i = p; // between panel i and i + 1
            const a = limits[i] ?? {};
            const now = sizes[i] ?? 0;
            return cloneElement(c as ReactElement<Record<string, unknown>>, {
              key: k,
              __handle: {
                id: `${id}-p${i}`,
                now,
                min: a.collapsible ? 0 : (a.min ?? 10),
                max: a.max ?? 100,
                onKey: (e: KeyboardEvent<HTMLElement>) => onKey(i, e),
                onDown: (e: PointerEvent<HTMLElement>) => down(i, e),
                onMove: (e: PointerEvent<HTMLElement>) => moveTo(i, e),
                onUp: up,
                onReset: () => commit(defaults),
              },
            });
          }
          return c;
        })}
      </div>
    </GroupCtx.Provider>
  );
}

interface HandleInternals {
  id: string;
  now: number;
  min: number;
  max: number;
  onKey: (e: KeyboardEvent<HTMLElement>) => void;
  onDown: (e: PointerEvent<HTMLElement>) => void;
  onMove: (e: PointerEvent<HTMLElement>) => void;
  onUp: () => void;
  onReset: () => void;
}

function HandleView({ withGrip, label, className, __handle: h }: ResizableHandleProps & { __handle: HandleInternals }) {
  const { direction, dragging } = useContext(GroupCtx);
  const horizontal = direction === "horizontal";
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={horizontal ? "vertical" : "horizontal"}
      aria-label={label ?? "Resize panels"}
      aria-controls={h.id}
      aria-valuenow={Math.round(h.now)}
      aria-valuemin={Math.round(h.min)}
      aria-valuemax={Math.round(h.max)}
      data-dragging={dragging || undefined}
      onKeyDown={h.onKey}
      onPointerDown={h.onDown}
      onPointerMove={h.onMove}
      onPointerUp={h.onUp}
      onPointerCancel={h.onUp}
      onDoubleClick={h.onReset}
      style={{ flex: "none", [horizontal ? "width" : "height"]: HANDLE_PX, touchAction: "none" }}
      className={cn(
        "group/handle relative z-10 bg-border outline-none transition-colors duration-150",
        horizontal ? "cursor-col-resize" : "cursor-row-resize",
        // A wider target than the 1px line: 12px, 20px on touch screens.
        horizontal ? "after:absolute after:inset-y-0 after:-inset-x-1.5 pointer-coarse:after:-inset-x-2.5" : "after:absolute after:inset-x-0 after:-inset-y-1.5 pointer-coarse:after:-inset-y-2.5",
        "after:content-['']",
        "hover:bg-foreground/30 focus-visible:bg-ring data-[dragging]:bg-ring",
        className,
      )}
    >
      {withGrip && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[5px] border bg-card text-muted-foreground shadow-xs",
            horizontal ? "h-5 w-3" : "h-3 w-5 rotate-90",
          )}
        >
          <svg viewBox="0 0 8 12" className="size-2.5" fill="currentColor">
            <circle cx="2.5" cy="3" r="1" />
            <circle cx="5.5" cy="3" r="1" />
            <circle cx="2.5" cy="6" r="1" />
            <circle cx="5.5" cy="6" r="1" />
            <circle cx="2.5" cy="9" r="1" />
            <circle cx="5.5" cy="9" r="1" />
          </svg>
        </span>
      )}
    </div>
  );
}
