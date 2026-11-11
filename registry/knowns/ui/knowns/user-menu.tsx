"use client";
/** @registry name="user-menu" type="ui" title="User menu" description="Account menu behind an avatar: identity header with plan badge, account rows with shortcut hints, theme and status switches, async sign out, and a bottom sheet on phones." */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { Avatar } from "./avatar";
import { Badge } from "./badge";
import { Spinner } from "./spinner";
import { GlideHighlight, matchIndex, useGlide } from "./menu";
import { FLOAT_FADE, portalHostFor, useExit, useFloating } from "./use-floating";

/* ── Types ── */

export type UserMenuTheme = "light" | "dark" | "system";
export type UserPresence = "available" | "busy" | "away";

export interface UserMenuUser {
  name: string;
  email?: string;
  /** Photo; falls back to initials. */
  image?: string;
  /** Small badge after the name in the header, e.g. "Pro". */
  plan?: ReactNode;
}

export interface UserMenuItem {
  id: string;
  label: ReactNode;
  /** Text for typeahead when `label` is not a string. */
  textValue?: string;
  /** 16px icon on the left. */
  icon?: ReactNode;
  /** Hint on the right, e.g. "⌘,". Visual only (aria-hidden): wire the real shortcut yourself. */
  shortcut?: string;
  /** Renders the row as a link (<a role="menuitem">). onSelect still fires. */
  href?: string;
  target?: string;
  disabled?: boolean;
}

export interface UserMenuProps {
  user: UserMenuUser;
  /** Account rows, in order (3 or 4 read best). Sections: pass several arrays. */
  items: UserMenuItem[] | UserMenuItem[][];
  /** A row was picked. The menu closes afterwards. */
  onSelect?: (item: UserMenuItem) => void;
  /** Shows the Light / Dark / System switch. Picking a value keeps the menu open. */
  theme?: UserMenuTheme;
  onThemeChange?: (theme: UserMenuTheme) => void;
  /** Shows the status switch and a presence dot on the trigger. */
  status?: UserPresence;
  onStatusChange?: (status: UserPresence) => void;
  /** Shows "Sign out". A returned promise keeps the menu open with a spinner until it settles. */
  onSignOut?: () => unknown;
  signOutLabel?: string;
  /** Name and chevron next to the avatar from 640px up. Default false (avatar only). */
  showName?: boolean;
  /** A 24px avatar in a 32px hit area, the size of the icon buttons beside it in a header. Default false (32px avatar). */
  compact?: boolean;
  /** Horizontal alignment to the trigger. Default "end" (header right corner). */
  align?: "start" | "end";
  /** Below 640px the panel opens as a bottom sheet. "never" keeps the popover everywhere. */
  sheet?: "auto" | "never";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * A small mark on the avatar (a plan star, a verified tick), on a ring in the background colour so it
   * reads on any photo. Bottom-right, or top-right when the presence mark is shown. Size it about 12px.
   * Decorative here: name it with `badgeLabel`.
   */
  badge?: ReactNode;
  /** What the badge means, added to the trigger's name ("Account: Ada Lovelace, Pro"). */
  badgeLabel?: string;
  /** Accessible name of the trigger. Default "Account: <name>", then the badge label and the status. */
  "aria-label"?: string;
  className?: string;
}

/* ── Pure helpers (exported for tests) ── */

export const THEMES: { value: UserMenuTheme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];
export const PRESENCE: { value: UserPresence; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "busy", label: "Busy" },
  { value: "away", label: "Away" },
];

/** One stop for the arrow keys: an account row, a whole switch (theme / status), or Sign out. */
export type Entry = { kind: "item"; item: UserMenuItem } | { kind: "switch"; name: "theme" | "status" } | { kind: "signout" };

export function buildEntries(items: UserMenuItem[] | UserMenuItem[][], o: { theme: boolean; status: boolean; signOut: boolean }): Entry[] {
  const flat = (Array.isArray(items[0]) ? (items as UserMenuItem[][]).flat() : (items as UserMenuItem[])).map((item): Entry => ({ kind: "item", item }));
  return [
    ...(o.status ? [{ kind: "switch", name: "status" } as Entry] : []),
    ...flat,
    ...(o.theme ? [{ kind: "switch", name: "theme" } as Entry] : []),
    ...(o.signOut ? [{ kind: "signout" } as Entry] : []),
  ];
}

const enabled = (e: Entry) => e.kind !== "item" || !e.item.disabled;

/** Next enabled entry from `from` in direction `dir`, looping. -1 when none is enabled. */
export function stepEntry(entries: Entry[], from: number, dir: 1 | -1): number {
  const n = entries.length;
  for (let k = 1; k <= n; k++) {
    const i = (((from + dir * k) % n) + n) % n;
    if (enabled(entries[i])) return i;
  }
  return -1;
}

/** The option `dir` steps from `current` inside a switch, looping. */
export function stepOption<T extends string>(options: { value: T }[], current: T, dir: 1 | -1): T {
  const i = Math.max(0, options.findIndex((o) => o.value === current));
  return options[(i + dir + options.length) % options.length].value;
}

export type UserMenuKey = "next" | "prev" | "first" | "last" | "left" | "right" | "activate" | "close" | "tab" | "type" | null;

/** What a key does while the panel has focus. */
export function userMenuKey(key: string): UserMenuKey {
  switch (key) {
    case "ArrowDown":
      return "next";
    case "ArrowUp":
      return "prev";
    case "Home":
    case "PageUp":
      return "first";
    case "End":
    case "PageDown":
      return "last";
    case "ArrowLeft":
      return "left";
    case "ArrowRight":
      return "right";
    case "Enter":
    case " ":
      return "activate";
    case "Escape":
      return "close";
    case "Tab":
      return "tab";
    default:
      return key.length === 1 ? "type" : null;
  }
}

/** Drag distance (px) or speed (px/ms) that closes the sheet when released. */
export function sheetShouldClose(dy: number, velocity: number, height: number): boolean {
  return dy > Math.min(120, height * 0.3) || (dy > 24 && velocity > 0.5);
}

const isPromise = (v: unknown): v is PromiseLike<unknown> => typeof (v as PromiseLike<unknown>)?.then === "function";

/* ── Small parts ── */

const PRESENCE_TEXT: Record<UserPresence, string> = { available: "available", busy: "busy", away: "away" };

/** Presence glyph: the shape differs per status, not only the colour (filled dot, bar, hollow ring). */
/** The ring that holds a badge on the avatar's corner. Decorative: the trigger's name says what it means. */
function AvatarBadge({ children, corner, large }: { children: ReactNode; corner: "top" | "bottom"; large?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute -right-1 grid place-items-center rounded-full bg-background [&_svg]:size-full",
        corner === "top" ? "-top-1" : "-bottom-1",
        large ? "size-[18px] p-[2px]" : "size-[15px] p-[1.5px]",
      )}
    >
      {children}
    </span>
  );
}

export function PresenceGlyph({ status, className }: { status: UserPresence; className?: string }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden className={cn("size-3 flex-none", className)}>
      {status === "available" && <circle cx="6" cy="6" r="5" className="fill-emerald-500" />}
      {status === "busy" && (
        <>
          <circle cx="6" cy="6" r="5" className="fill-red-500" />
          <rect x="3" y="5.1" width="6" height="1.8" rx=".9" className="fill-white" />
        </>
      )}
      {status === "away" && <circle cx="6" cy="6" r="3.6" fill="none" strokeWidth="2.4" className="stroke-amber-500" />}
    </svg>
  );
}

const THEME_ICON: Record<UserMenuTheme, ReactNode> = {
  light: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden className="size-3.5">
      <circle cx="8" cy="8" r="2.75" />
      <path d="M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9" />
    </svg>
  ),
  dark: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden className="size-3.5">
      <path d="M13.5 9.6A5.75 5.75 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1Z" />
    </svg>
  ),
  system: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-3.5">
      <rect x="2" y="2.75" width="12" height="8.5" rx="1.5" />
      <path d="M5.5 13.75h5" />
    </svg>
  ),
};

const SignOutIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-4">
    <path d="M6 13.5H3.75a1.25 1.25 0 0 1-1.25-1.25v-8.5A1.25 1.25 0 0 1 3.75 2.5H6M10.5 11l3-3-3-3M13.5 8H6" />
  </svg>
);

const Chevron = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-3.5 text-muted-foreground">
    <path d="M4.5 6.5 8 10l3.5-3.5" />
  </svg>
);

/** Matches max-width 639px; false on the server. */
function usePhone(enabledFlag: boolean) {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    if (!enabledFlag || typeof matchMedia === "undefined") return;
    const m = matchMedia("(max-width: 639px)");
    const on = () => setPhone(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [enabledFlag]);
  return enabledFlag && phone;
}

function useReduced() {
  const [r, setR] = useState(false);
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setR(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return r;
}

/* ── Component ── */

/**
 * Account menu behind an avatar: who is signed in (name, email, plan), a few account rows, an inline
 * theme switch, an optional presence switch and Sign out. A popover from 640px up, a bottom sheet below.
 * Focus sits on the list; the active row (or the chosen option of a switch) is aria-activedescendant.
 */
export function UserMenu({
  user,
  items,
  onSelect,
  theme,
  onThemeChange,
  status,
  onStatusChange,
  onSignOut,
  signOutLabel = "Sign out",
  showName = false,
  compact = false,
  align = "end",
  sheet = "auto",
  badge,
  badgeLabel,
  open: openProp,
  onOpenChange,
  "aria-label": ariaLabel,
  className,
}: UserMenuProps) {
  const [own, setOwn] = useState(false);
  const open = openProp ?? own;
  const setOpen = useCallback(
    (v: boolean) => {
      if (openProp === undefined) setOwn(v);
      onOpenChange?.(v);
    },
    [openProp, onOpenChange],
  );

  const phone = usePhone(sheet === "auto");
  const reduced = useReduced();
  const baseId = useId();
  const listId = `${baseId}-list`;
  const headId = `${baseId}-head`;

  const hasTheme = Boolean(onThemeChange);
  const hasStatus = Boolean(onStatusChange);
  const entries = buildEntries(items, { theme: hasTheme, status: hasStatus, signOut: Boolean(onSignOut) });
  const sections = Array.isArray(items[0]) ? (items as UserMenuItem[][]) : [items as UserMenuItem[]];

  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", timer: undefined as ReturnType<typeof setTimeout> | undefined });
  const fl = useFloating<HTMLButtonElement, HTMLDivElement>({ open: open && !phone, side: "auto", align, offset: 6 });
  const sheetExit = useExit(open && phone, 260);
  const [sheetHost, setSheetHost] = useState<HTMLElement | null>(null);
  const triggerEl = fl.triggerRef;

  const close = useCallback(
    (refocus: boolean) => {
      setOpen(false);
      if (refocus) triggerEl.current?.focus();
    },
    [setOpen, triggerEl],
  );

  /* Open: highlight the first row, focus the list, start the entrance. */
  const ready = phone ? open && sheetHost !== null : fl.ready;
  useLayoutEffect(() => {
    if (!open) {
      setShown(false);
      setActive(-1);
      setBusy(false);
      return;
    }
    if (phone) setSheetHost(portalHostFor(triggerEl.current));
  }, [open, phone, triggerEl]);
  useEffect(() => {
    if (!ready) return;
    list.current?.focus({ preventScroll: true });
    setActive((a) => (a >= 0 ? a : stepEntry(entries, -1, 1)));
    const raf = requestAnimationFrame(() => {
      setDragY(0);
      setShown(true);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  /* Close on a press outside the trigger and the panel. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (t.closest?.(`[data-kn-user-menu="${baseId}"]`) || triggerEl.current?.contains(t)) return;
      if (!busy) close(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, close, baseId, triggerEl, busy]);

  /* Ids for aria-activedescendant. */
  const entryId = (i: number) => `${baseId}-e${i}`;
  const optionId = (name: string, value: string) => `${baseId}-${name}-${value}`;
  const activeEntry = entries[active];
  const activeId =
    activeEntry?.kind === "switch"
      ? optionId(activeEntry.name, activeEntry.name === "theme" ? (theme ?? "system") : (status ?? "available"))
      : active >= 0
        ? entryId(active)
        : null;
  const glideId = activeEntry && activeEntry.kind !== "switch" ? entryId(active) : null;
  const hi = useGlide(list, glideId, shown, phone);

  const signOut = () => {
    if (!onSignOut || busy) return;
    const r = onSignOut();
    if (!isPromise(r)) return close(false);
    setBusy(true);
    Promise.resolve(r).finally(() => {
      setBusy(false);
      close(Boolean(triggerEl.current?.isConnected));
    });
  };

  const pick = (e: Entry, option?: string) => {
    if (e.kind === "item") {
      if (e.item.disabled) return;
      onSelect?.(e.item);
      if (e.item.href) setTimeout(() => close(true), 0);
      else close(true);
    } else if (e.kind === "switch") {
      if (e.name === "theme") onThemeChange?.((option ?? stepOption(THEMES, theme ?? "system", 1)) as UserMenuTheme);
      else onStatusChange?.((option ?? stepOption(PRESENCE, status ?? "available", 1)) as UserPresence);
    } else signOut();
  };

  const onKeyDown = (ev: ReactKeyboardEvent<HTMLDivElement>) => {
    const action = userMenuKey(ev.key);
    if (!action) return;
    if (busy && action !== "tab") return ev.preventDefault();
    const e = entries[active];
    switch (action) {
      case "next":
      case "prev":
        ev.preventDefault();
        setActive((a) => stepEntry(entries, a, action === "next" ? 1 : -1));
        return;
      case "first":
        ev.preventDefault();
        setActive(stepEntry(entries, -1, 1));
        return;
      case "last":
        ev.preventDefault();
        setActive(stepEntry(entries, 0, -1));
        return;
      case "left":
      case "right":
        if (e?.kind !== "switch") return;
        ev.preventDefault();
        if (e.name === "theme") onThemeChange?.(stepOption(THEMES, theme ?? "system", action === "right" ? 1 : -1));
        else onStatusChange?.(stepOption(PRESENCE, status ?? "available", action === "right" ? 1 : -1));
        return;
      case "activate":
        ev.preventDefault();
        if (!e) return;
        // Links: let the real anchor handle Enter so modifiers and history work.
        if (e.kind === "item" && e.item.href) document.getElementById(entryId(active))?.click();
        else if (e.kind === "switch") return; // Enter on a switch keeps the chosen value; arrows change it.
        else pick(e);
        return;
      case "close":
        ev.preventDefault();
        close(true);
        return;
      case "tab":
        triggerEl.current?.focus();
        setOpen(false);
        return;
      case "type": {
        ev.preventDefault();
        const t = typed.current;
        clearTimeout(t.timer);
        t.text += ev.key.toLowerCase();
        t.timer = setTimeout(() => (t.text = ""), 500);
        const rows = entries.map((x) => (x.kind === "item" ? x.item : { label: x.kind === "signout" ? signOutLabel : "", textValue: "", disabled: true }));
        const i = matchIndex(rows, active, t.text);
        if (i >= 0) setActive(i);
        return;
      }
    }
  };

  /* Bottom sheet drag (not under reduced motion). */
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; dy: number; v: number } | null>(null);
  const [dragY, setDragY] = useState(0);
  const onDragStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!phone || reduced || busy) return;
    drag.current = { y: e.clientY, t: performance.now(), dy: 0, v: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const now = performance.now();
    const dy = Math.max(0, e.clientY - d.y);
    d.v = (dy - d.dy) / Math.max(1, now - d.t);
    d.dy = dy;
    d.t = now;
    setDragY(dy);
  };
  const onDragEnd = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    // Closing keeps the pulled position: the exit carries it on down to the edge instead of snapping back first.
    if (sheetShouldClose(d.dy, d.v, panel.current?.offsetHeight ?? 400)) close(true);
    else setDragY(0);
  };

  /* ── Render ── */

  const trigger = (
    <button
      ref={fl.triggerRef}
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      aria-label={ariaLabel ?? [`Account: ${user.name}`, badge ? badgeLabel : undefined, status ? PRESENCE_TEXT[status] : undefined].filter(Boolean).join(", ")}
      onClick={() => setOpen(!open)}
      onKeyDown={(e) => {
        if (open) return;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          setOpen(true);
          if (e.key === "ArrowUp") setActive(stepEntry(entries, 0, -1));
        }
      }}
      className={cn(
        "group relative inline-flex items-center gap-2 rounded-full outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        compact && "size-8 justify-center",
        showName && "sm:rounded-lg sm:py-1 sm:pr-1.5 sm:pl-1 sm:hover:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)]",
        className,
      )}
    >
      <span className="relative inline-flex">
        <Avatar label={user.name} src={user.image} size={compact ? "sm" : "md"} shape="circle" decorative />
        {status && (
          <span className="absolute -right-0.5 -bottom-0.5 grid size-3.5 place-items-center rounded-full bg-background">
            <PresenceGlyph status={status} className="size-2.5" />
          </span>
        )}
        {badge && <AvatarBadge corner={status ? "top" : "bottom"}>{badge}</AvatarBadge>}
      </span>
      {showName && (
        <span className="hidden max-w-[10rem] items-center gap-1 sm:inline-flex">
          <span className="truncate text-[13px] font-medium">{user.name}</span>
          {Chevron}
        </span>
      )}
    </button>
  );

  // The rows do not stagger in: the menu is opened often, so the panel fades as one piece.
  const rowStyle = () => undefined;
  const rowMotion = "";

  const switchRow = (name: "theme" | "status", i: number) => {
    const options = name === "theme" ? THEMES : PRESENCE;
    const value = name === "theme" ? (theme ?? "system") : (status ?? "available");
    const isActive = active === i;
    const at = options.findIndex((o) => o.value === value);
    return (
      <div
        key={name}
        role="group"
        aria-label={name === "theme" ? "Theme" : "Status"}
        id={entryId(i)}
        onPointerMove={() => !busy && setActive(i)}
        className={cn("relative flex items-center justify-between gap-3 px-2.5 py-1.5", rowMotion)}
        style={rowStyle()}
      >
        <span className="text-[13px] text-muted-foreground" aria-hidden>
          {name === "theme" ? "Theme" : "Status"}
        </span>
        <span className={cn("relative grid grid-cols-3 rounded-lg p-0.5", "bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)]", isActive && "ring-1 ring-ring/50")}>
          <span
            aria-hidden
            className="absolute inset-y-0.5 left-0.5 rounded-md bg-background shadow-[0_1px_2px_rgb(0_0_0/0.12)] transition-[translate] duration-[var(--kn-dur-fast,120ms)] ease-[var(--kn-ease-out,cubic-bezier(.22,1,.36,1))] motion-reduce:transition-none dark:bg-[color-mix(in_srgb,var(--foreground)_22%,var(--background))] dark:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_12%,transparent)]"
            style={{ width: `calc((100% - 4px) / 3)`, translate: `${at * 100}% 0` }}
          />
          {options.map((o) => (
            <span
              key={o.value}
              id={optionId(name, o.value)}
              role="menuitemradio"
              aria-checked={o.value === value}
              aria-label={o.label}
              title={o.label}
              onClick={() => !busy && pick(entries[i], o.value)}
              className={cn(
                "relative z-10 grid h-6 min-w-9 cursor-default place-items-center rounded-md px-2 text-[12px]",
                o.value === value ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {name === "theme" ? THEME_ICON[o.value as UserMenuTheme] : <PresenceGlyph status={o.value as UserPresence} className="size-2.5" />}
            </span>
          ))}
        </span>
      </div>
    );
  };

  const itemRow = (item: UserMenuItem, i: number) => {
    const Tag = item.href ? "a" : "div";
    return (
      <Tag
        key={item.id}
        id={entryId(i)}
        role="menuitem"
        aria-disabled={item.disabled || undefined}
        tabIndex={-1}
        {...(item.href ? { href: item.href, target: item.target, rel: item.target === "_blank" ? "noopener noreferrer" : undefined } : {})}
        onPointerMove={() => !busy && !item.disabled && setActive(i)}
        onClick={(e) => {
          if (item.disabled || busy) return e.preventDefault();
          onSelect?.(item);
          if (item.href) setTimeout(() => close(false), 0);
          else close(true);
        }}
        className={cn(
          "relative flex h-9 cursor-default items-center gap-2.5 rounded-[8px] px-2.5 text-[13.5px] outline-none select-none",
          item.disabled ? "text-muted-foreground/60" : "text-foreground",
          rowMotion,
        )}
        style={rowStyle()}
      >
        {item.icon && <span className="grid size-4 flex-none place-items-center text-muted-foreground [&_svg]:size-4">{item.icon}</span>}
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.shortcut && (
          <kbd aria-hidden className="font-sans text-[11.5px] tracking-wide text-muted-foreground">
            {item.shortcut}
          </kbd>
        )}
      </Tag>
    );
  };

  let index = 0;
  const statusRow = hasStatus ? switchRow("status", index++) : null;
  const itemSections = sections.map((sec) => sec.map((it) => itemRow(it, index++)));
  const themeRow = hasTheme ? switchRow("theme", index++) : null;
  const signOutIndex = onSignOut ? index++ : -1;

  const sep = <div role="separator" aria-hidden className="mx-2.5 my-1 h-px bg-border" />;
  const content = (
    <>
      <div id={headId} className={cn("flex min-w-0 items-center gap-3 px-2.5 pt-2 pb-2.5", rowMotion)} style={rowStyle()}>
        <span className="relative inline-flex flex-none">
          <Avatar label={user.name} src={user.image} size="lg" shape="circle" decorative />
          {badge && (
            <AvatarBadge corner="bottom" large>
              {badge}
            </AvatarBadge>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[14px] font-medium">{user.name}</span>
            {user.plan && (
              <Badge size="sm" tone="accent" className="flex-none">
                {user.plan}
              </Badge>
            )}
          </div>
          {user.email && <div className="truncate text-[12.5px] text-muted-foreground">{user.email}</div>}
        </div>
      </div>
      {sep}
      <div
        ref={list}
        id={listId}
        role="menu"
        tabIndex={-1}
        aria-labelledby={headId}
        aria-activedescendant={activeId ?? undefined}
        aria-busy={busy || undefined}
        onKeyDown={onKeyDown}
        className="relative flex flex-col outline-none"
      >
        <GlideHighlight hi={hi} />
        {statusRow}
        {statusRow && sep}
        {itemSections.map((rows, s) => (
          <div key={s} role="none" className="flex flex-col">
            {s > 0 && sep}
            {rows}
          </div>
        ))}
        {themeRow && sep}
        {themeRow}
        {onSignOut && (
          <>
            {sep}
            <div
              id={entryId(signOutIndex)}
              role="menuitem"
              aria-disabled={busy || undefined}
              tabIndex={-1}
              onPointerMove={() => !busy && setActive(signOutIndex)}
              onClick={signOut}
              className={cn("relative flex h-9 cursor-default items-center gap-2.5 rounded-[8px] px-2.5 text-[13.5px] outline-none select-none", rowMotion)}
              style={rowStyle()}
            >
              <span className="grid size-4 flex-none place-items-center text-muted-foreground">{busy ? <Spinner label="" className="size-3.5" /> : SignOutIcon}</span>
              <span className="flex-1">{busy ? `${signOutLabel}…` : signOutLabel}</span>
              {busy && <span className="sr-only" role="status">Signing out</span>}
            </div>
          </>
        )}
      </div>
    </>
  );

  const popover =
    !phone && fl.portalHost
      ? createPortal(
          <div
            ref={fl.floatingRef}
            data-kn-user-menu={baseId}
            data-state={fl.closing ? "closed" : "open"}
            style={fl.style}
            className={cn(
              "z-50 w-[272px] overflow-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-[0_12px_32px_-8px_rgb(0_0_0/0.25),0_2px_6px_-2px_rgb(0_0_0/0.12)]",
              FLOAT_FADE,
            )}
          >
            {content}
          </div>,
          fl.portalHost,
        )
      : null;

  const bottomSheet =
    sheetExit.mounted && phone && sheetHost
      ? createPortal(
          <div data-kn-user-menu={baseId} className="fixed inset-0 z-50">
            <div
              aria-hidden
              onClick={() => !busy && close(true)}
              className={cn("absolute inset-0 bg-black/40 transition-opacity duration-[var(--kn-dur,180ms)]", shown ? "opacity-100" : "opacity-0")}
            />
            <div
              ref={panel}
              // Inline, so the drag, the enter from the bottom edge and the exit back to it share one property.
              style={{ translate: shown ? `0 ${dragY}px` : reduced ? "0 0" : "0 100%" }}
              className={cn(
                "absolute inset-x-0 bottom-0 max-h-[85vh] overflow-auto rounded-t-2xl border-t bg-popover px-2 pt-1 pb-[max(12px,env(safe-area-inset-bottom))] text-popover-foreground",
                !drag.current && "transition-[translate,opacity] duration-[var(--kn-dur,180ms)] ease-[var(--kn-ease-out,cubic-bezier(.22,1,.36,1))]",
                shown ? "opacity-100" : "opacity-0",
              )}
            >
              <div onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd} className={cn("flex justify-center py-2", !reduced && "cursor-grab touch-none")}>
                <span aria-hidden className="h-1 w-9 rounded-full bg-[color-mix(in_srgb,var(--foreground)_22%,transparent)]" />
              </div>
              {content}
            </div>
          </div>,
          sheetHost,
        )
      : null;

  return (
    <>
      {trigger}
      {popover}
      {bottomSheet}
    </>
  );
}

export default UserMenu;
