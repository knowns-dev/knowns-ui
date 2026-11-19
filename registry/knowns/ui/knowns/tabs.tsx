"use client";
/** @registry name="tabs" type="ui" title="Tabs" description="Tabs in underline, pill and button styles, horizontal or vertical, with icons, counts, overflow scrolling and a sliding indicator." */

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";

export type TabsVariant = "underline" | "pill" | "button";
export type TabsSize = "sm" | "md";
export type TabsOrientation = "horizontal" | "vertical";
export type TabsActivation = "automatic" | "manual";

type Ctx = {
  value: string;
  set: (v: string) => void;
  id: string;
  variant: TabsVariant;
  size: TabsSize;
  orientation: TabsOrientation;
  activationMode: TabsActivation;
  fullWidth: boolean;
  /** Link mode: the triggers are links, the list is a nav landmark. */
  links: boolean;
  /** Tab that takes Tab-key focus when no tab is selected (first enabled one). */
  fallback: string | null;
  setFallback: (v: string | null) => void;
  /** Values whose TabsPanel is mounted, so tabs only point aria-controls at panels that exist. */
  panels: ReadonlySet<string>;
  registerPanel: (v: string) => () => void;
};
const TabsCtx = createContext<Ctx | null>(null);
const useTabs = () => {
  const c = useContext(TabsCtx);
  if (!c) throw new Error("Tabs parts must be inside <Tabs>");
  return c;
};

/* ── Pure helpers (exported for tests) ── */

/**
 * Index of the tab a key moves to, skipping disabled tabs and wrapping; null if the key is not a
 * navigation key for this orientation. Horizontal uses Left/Right (mirrored in RTL), vertical Up/Down.
 */
export function nextTabIndex(disabled: boolean[], current: number, key: string, orientation: TabsOrientation = "horizontal", rtl = false): number | null {
  const n = disabled.length;
  const enabled = disabled.map((d, i) => (d ? -1 : i)).filter((i) => i >= 0);
  if (!enabled.length) return null;
  if (key === "Home") return enabled[0] ?? null;
  if (key === "End") return enabled[enabled.length - 1] ?? null;
  const fwd = orientation === "vertical" ? "ArrowDown" : rtl ? "ArrowLeft" : "ArrowRight";
  const back = orientation === "vertical" ? "ArrowUp" : rtl ? "ArrowRight" : "ArrowLeft";
  const step = key === fwd ? 1 : key === back ? -1 : 0;
  if (!step) return null;
  for (let k = 1; k <= n; k++) {
    const i = (((current + step * k) % n) + n) % n;
    if (!disabled[i]) return i;
  }
  return null;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where the moving indicator sits for a selected tab box (offsets inside the list). */
export function indicatorRect(variant: TabsVariant, orientation: TabsOrientation, tab: Box, flush?: "start" | "end"): Box {
  if (variant !== "underline") return tab;
  if (orientation === "vertical") {
    const inset = Math.min(6, tab.h / 4);
    return { x: 0, y: tab.y + inset, w: 2, h: tab.h - 2 * inset };
  }
  const inset = Math.min(8, tab.w / 4);
  // A flush tab has no padding on one side, so its line runs to that edge: the line and the label start together.
  const left = flush === "start" ? 0 : inset;
  const right = flush === "end" ? 0 : inset;
  return { x: tab.x + left, y: tab.y + tab.h - 2, w: tab.w - left - right, h: 2 };
}

/** Which ends of a horizontally scrolling list have hidden tabs (1px tolerance for subpixel widths). */
export function fadeEdges(scrollLeft: number, clientWidth: number, scrollWidth: number): { start: boolean; end: boolean } {
  return { start: scrollLeft > 1, end: scrollLeft + clientWidth < scrollWidth - 1 };
}

/** CSS mask that fades the clipped ends of the list. */
export function fadeMask({ start, end }: { start: boolean; end: boolean }, size = 24): string | undefined {
  if (!start && !end) return undefined;
  return `linear-gradient(to right, ${start ? `transparent, #000 ${size}px` : "#000"}, ${end ? `#000 calc(100% - ${size}px), transparent` : "#000"})`;
}

/* ── Tabs ── */

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** "underline" (default): a line under the active tab. "pill": a raised pill on a muted track. "button": joined, bordered segments. */
  variant?: TabsVariant;
  size?: TabsSize;
  /** "vertical" lays the list out as a sidebar next to the panels; arrows become Up/Down. */
  orientation?: TabsOrientation;
  /** "automatic" (default): arrows move focus and select. "manual": arrows move focus; Enter or Space selects. */
  activationMode?: TabsActivation;
  /** Horizontal only: tabs share the full width equally. */
  fullWidth?: boolean;
  /**
   * Link mode, for tabs that are routes: give each TabsTrigger an `href` and it renders as a link, so Ctrl or Cmd click opens a
   * new tab. The list becomes a nav landmark (name it with aria-label on TabsList) and the selected link gets aria-current="page";
   * there is no tablist, no tab role and no arrow-key roving, so the links keep their own semantics. `value` is the current route.
   */
  links?: boolean;
  children: ReactNode;
  className?: string;
}

/** Tabs with arrow-key navigation. Controlled (`value`) or uncontrolled (`defaultValue`). */
export function Tabs({
  value,
  defaultValue,
  onValueChange,
  variant = "underline",
  size = "md",
  orientation = "horizontal",
  activationMode = "automatic",
  fullWidth = false,
  links = false,
  children,
  className,
}: TabsProps) {
  const [own, setOwn] = useState(defaultValue ?? "");
  const [fallback, setFallback] = useState<string | null>(null);
  const [panels, setPanels] = useState<ReadonlySet<string>>(() => new Set());
  const registerPanel = useCallback((v: string) => {
    setPanels((p) => new Set(p).add(v));
    return () =>
      setPanels((p) => {
        const n = new Set(p);
        n.delete(v);
        return n;
      });
  }, []);
  const id = useId();
  const current = value ?? own;
  const set = (v: string) => {
    if (value === undefined) setOwn(v);
    if (v !== current) onValueChange?.(v);
  };
  return (
    <TabsCtx.Provider value={{ value: current, set, id, variant, size, orientation, activationMode, fullWidth, links, fallback, setFallback, panels, registerPanel }}>
      <div
        data-orientation={orientation}
        className={cn(orientation === "vertical" ? "flex flex-row items-start gap-6" : "flex flex-col gap-3", className)}
      >
        {children}
      </div>
    </TabsCtx.Provider>
  );
}

/* ── List ── */

const EASE = "ease-(--kn-ease-out)";

const WRAP: Record<TabsVariant, Record<TabsOrientation, string>> = {
  underline: { horizontal: "w-full", vertical: "" },
  pill: { horizontal: "max-w-full rounded-[10px] bg-muted p-0.5", vertical: "rounded-[12px] bg-muted p-1" },
  button: {
    horizontal: "max-w-full rounded-[9px] bg-card shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_14%,transparent),0_1px_2px_rgb(0_0_0/0.04)]",
    vertical: "rounded-[10px] bg-card shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_14%,transparent),0_1px_2px_rgb(0_0_0/0.04)]",
  },
};

const TRACK: Record<TabsVariant, Record<TabsOrientation, string>> = {
  // The hairline the underline rides on, drawn inside the list so the indicator covers it.
  underline: { horizontal: "gap-1 shadow-[inset_0_-1px_0_var(--border)]", vertical: "gap-0.5 shadow-[inset_1px_0_0_var(--border)]" },
  pill: { horizontal: "gap-0.5", vertical: "gap-0.5" },
  // Hairline dividers between joined segments.
  button: {
    horizontal: "rounded-[9px] [&>[data-value]+[data-value]]:shadow-[inset_1px_0_0_color-mix(in_srgb,var(--foreground)_12%,transparent)]",
    vertical: "overflow-hidden rounded-[10px] [&>[data-value]+[data-value]]:shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_12%,transparent)]",
  },
};

const INDICATOR: Record<TabsVariant, string> = {
  underline: "rounded-full bg-foreground",
  pill: "rounded-[8px] bg-card shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_8%,transparent),0_1px_3px_rgb(0_0_0/0.08)] dark:bg-[color-mix(in_srgb,var(--foreground)_12%,var(--card))]",
  button: "bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] dark:bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)]",
};

export interface TabsListProps {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** Overrides the value set on Tabs. */
  variant?: TabsVariant;
  size?: TabsSize;
  fullWidth?: boolean;
  /** Underline, horizontal: the first label sits on the list's start edge, with no leading padding, so it lines up with a title above. The line under it starts there too. */
  flush?: boolean;
}

export function TabsList({ children, className, "aria-label": label, "aria-labelledby": labelledBy, ...over }: TabsListProps) {
  const t = useTabs();
  const variant = over.variant ?? t.variant;
  const vertical = t.orientation === "vertical";
  const fullWidth = !vertical && (over.fullWidth ?? t.fullWidth);
  const list = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<(Box & { instant: boolean }) | null>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const tabs = () => [...(list.current?.querySelectorAll<HTMLElement>(":scope > [data-value]") ?? [])];
  const isOff = (b: HTMLElement) => (b as HTMLButtonElement).disabled || b.getAttribute("aria-disabled") === "true";
  const isSel = (b: HTMLElement) => b.getAttribute("aria-selected") === "true" || b.getAttribute("aria-current") === "page";

  /** Measure the selected tab, the overflow edges, and the tab that takes focus when none is selected. */
  const measure = useCallback(() => {
    const l = list.current;
    if (!l) return;
    const all = tabs();
    const sel = all.find(isSel);
    if (sel) {
      const rtl = getComputedStyle(l).direction === "rtl";
      const first = over.flush && !vertical && variant === "underline" && sel === all[0];
      const r = indicatorRect(variant, t.orientation, { x: sel.offsetLeft, y: sel.offsetTop, w: sel.offsetWidth, h: sel.offsetHeight }, first ? (rtl ? "end" : "start") : undefined);
      setInd((p) => (p && p.x === r.x && p.y === r.y && p.w === r.w && p.h === r.h ? p : { ...r, instant: !p }));
    } else setInd(null);
    if (!vertical) {
      const e = fadeEdges(l.scrollLeft, l.clientWidth, l.scrollWidth);
      setEdges((p) => (p.start === e.start && p.end === e.end ? p : e));
    }
    const fb = sel ? null : (all.find((b) => !isOff(b))?.dataset.value ?? null);
    if (fb !== t.fallback) t.setFallback(fb);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, t.orientation, vertical, t.fallback, over.flush]);

  useLayoutEffect(() => {
    measure();
  });

  useLayoutEffect(() => {
    const l = list.current;
    if (!l || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(l);
    tabs().forEach((b) => ro.observe(b));
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, children]);

  /* Keep the selected tab in view when it changes (scroll the list only, never the page). */
  useLayoutEffect(() => {
    const l = list.current;
    const sel = tabs().find(isSel);
    if (!l || !sel || vertical) return;
    const pad = 24;
    if (sel.offsetLeft - pad < l.scrollLeft) l.scrollLeft = Math.max(0, sel.offsetLeft - pad);
    else if (sel.offsetLeft + sel.offsetWidth + pad > l.scrollLeft + l.clientWidth) l.scrollLeft = sel.offsetLeft + sel.offsetWidth + pad - l.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.value, vertical]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const all = tabs();
    const i = all.indexOf(document.activeElement as HTMLElement);
    if (i === -1) return;
    const rtl = !vertical && getComputedStyle(e.currentTarget).direction === "rtl";
    const next = nextTabIndex(
      all.map(isOff),
      i,
      e.key,
      t.orientation,
      rtl,
    );
    if (next === null) return;
    e.preventDefault();
    const tab = all[next];
    if (!tab) return;
    tab.focus();
    if (t.activationMode === "automatic") t.set(tab.dataset.value!);
  };

  const mask = vertical ? undefined : fadeMask(edges);
  const indStyle: CSSProperties | undefined = ind ? { transform: `translate(${ind.x}px, ${ind.y}px)`, width: ind.w, height: ind.h } : undefined;

  const Outer = t.links ? "nav" : "div";
  return (
    <Outer
      aria-label={t.links ? label : undefined}
      aria-labelledby={t.links ? labelledBy : undefined}
      className={cn(
        "relative min-w-0",
        vertical ? "flex w-48 flex-none flex-col" : fullWidth ? "flex w-full" : "inline-flex",
        // Pill and button lists keep their natural width (Tabs is a flex column, which would stretch them).
        !vertical && !fullWidth && variant !== "underline" && "self-start",
        WRAP[variant][t.orientation],
        className,
      )}
    >
      <div
        ref={list}
        role={t.links ? undefined : "tablist"}
        aria-label={t.links ? undefined : label}
        aria-labelledby={t.links ? undefined : labelledBy}
        aria-orientation={t.links ? undefined : t.orientation}
        onKeyDown={t.links ? undefined : onKeyDown}
        onScroll={vertical ? undefined : measure}
        style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
        className={cn(
          "relative flex min-w-0",
          vertical ? "flex-col" : "flex-1 items-center overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          TRACK[variant][t.orientation],
          over.flush && !vertical && variant === "underline" && "[&>[data-value]:nth-child(2)]:ps-0",
        )}
      >
        <span
          aria-hidden="true"
          style={indStyle}
          className={cn(
            "pointer-events-none absolute top-0 left-0 will-change-transform",
            INDICATOR[variant],
            ind ? "opacity-100" : "opacity-0",
            !ind?.instant && "transition-[transform,opacity] duration-(--kn-dur) ease-(--kn-ease-out) motion-reduce:transition-none",
          )}
        />
        {children}
      </div>
    </Outer>
  );
}

/* ── Trigger ── */

const TRIGGER_SIZE: Record<TabsVariant, Record<TabsSize, string>> = {
  underline: { sm: "h-8 px-2.5 text-[12.5px] gap-1.5 [&_svg]:size-3.5", md: "h-9 px-3 text-[13.5px] gap-1.5 [&_svg]:size-4" },
  pill: { sm: "h-6 px-2.5 text-[12px] gap-1.5 [&_svg]:size-3.5", md: "h-7 px-3 text-[13px] gap-1.5 [&_svg]:size-3.5" },
  button: { sm: "h-7 px-3 text-[12.5px] gap-1.5 [&_svg]:size-3.5", md: "h-8 px-3.5 text-[13px] gap-2 [&_svg]:size-4" },
};
const VERTICAL_SIZE: Record<TabsSize, string> = {
  sm: "h-8 px-2.5 text-[12.5px] gap-2 [&_svg]:size-3.5",
  md: "h-9 px-3 text-[13.5px] gap-2.5 [&_svg]:size-4",
};
const TRIGGER_SHAPE: Record<TabsVariant, string> = {
  underline: "rounded-[7px]",
  pill: "rounded-[8px]",
  button: "",
};

export interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  disabled?: boolean;
  /** Glyph before the label. */
  icon?: ReactNode;
  /** Count or short text after the label, e.g. 12 → "Runs 12". Read as part of the tab name. */
  badge?: ReactNode;
  /** Link mode (inside `<Tabs links>`): the destination. The trigger renders as a link, so Ctrl or Cmd click opens a new tab. */
  href?: string;
  /** Link mode: called on click before the value is set. Call preventDefault to route yourself (a client router) instead of letting the browser navigate. */
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  className?: string;
}

export function TabsTrigger({ value, children, disabled, icon, badge, href, onClick, className }: TabsTriggerProps) {
  const t = useTabs();
  const selected = t.value === value;
  const vertical = t.orientation === "vertical";
  const focusable = selected || t.fallback === value;
  const link = href !== undefined;
  const onPress = (e: MouseEvent<HTMLElement>) => {
    if (disabled) return void e.preventDefault();
    onClick?.(e);
    // A plain click selects the tab. Ctrl, Cmd, Shift, Alt or a middle click on a link is the browser's (a new tab or window).
    if (link && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)) return;
    t.set(value);
  };
  const Tag = link ? "a" : "button";
  const tagProps = link
    ? { href: disabled ? undefined : href, "aria-current": selected ? ("page" as const) : undefined, "aria-disabled": disabled || undefined, tabIndex: disabled ? -1 : undefined }
    : { type: "button" as const, role: "tab", id: `${t.id}-tab-${value}`, "aria-selected": selected, "aria-controls": t.panels.has(value) ? `${t.id}-panel-${value}` : undefined, tabIndex: focusable ? 0 : -1, disabled };
  return (
    <Tag
      {...tagProps}
      data-value={value}
      onClick={onPress}
      className={cn(
        "relative z-10 inline-flex cursor-pointer items-center font-medium whitespace-nowrap select-none",
        `transition-colors duration-(--kn-dur-fast) ${EASE}`,
        vertical ? cn("w-full justify-start text-left", VERTICAL_SIZE[t.size], t.variant === "button" ? "" : "rounded-[8px]") : cn(TRIGGER_SIZE[t.variant][t.size], TRIGGER_SHAPE[t.variant], "justify-center"),
        t.fullWidth && !vertical ? "min-w-0 flex-1" : "flex-none",
        selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        // Unselected rows get a faint hover wash (the indicator marks the selected one).
        !selected && t.variant !== "underline" && "hover:bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)]",
        !selected && t.variant === "underline" && vertical && "hover:bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)]",
        "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-muted-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-45",
        // Inset ring: the list may scroll, which would clip an outside outline.
        "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      {icon && (
        <span aria-hidden="true" className="grid flex-none place-items-center">
          {icon}
        </span>
      )}
      <span className={cn("min-w-0", vertical && "flex-1 truncate")}>{children}</span>
      {badge !== undefined && badge !== null && badge !== false && " " /* so the name reads "Runs 12" */}
      {badge !== undefined && badge !== null && badge !== false && (
        <span
          className={cn(
            "flex-none rounded-full px-1.5 text-[11px] leading-[18px] font-medium tabular-nums transition-colors ease-(--kn-ease-out) duration-(--kn-dur-fast)",
            selected ? "bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)] text-foreground" : "bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] text-muted-foreground",
          )}
        >
          {badge}
        </span>
      )}
    </Tag>
  );
}

/* ── Panel ── */

export function TabsContent({
  value,
  children,
  className,
  keepMounted,
}: {
  value: string;
  children: ReactNode;
  className?: string;
  /** Keep the panel in the DOM (hidden) while another tab is selected, so its state survives. */
  keepMounted?: boolean;
}) {
  const t = useTabs();
  const selected = t.value === value;
  const mounted = selected || !!keepMounted;
  const { registerPanel } = t;
  useLayoutEffect(() => (mounted ? registerPanel(value) : undefined), [mounted, value, registerPanel]);
  if (!mounted) return null;
  return (
    <div
      role="tabpanel"
      id={`${t.id}-panel-${value}`}
      aria-labelledby={`${t.id}-tab-${value}`}
      hidden={!selected}
      tabIndex={0}
      className={cn("min-w-0 rounded-md outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", t.orientation === "vertical" && "flex-1", className)}
    >
      {children}
    </div>
  );
}
