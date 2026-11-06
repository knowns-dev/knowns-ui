/**
 * Pure helpers for the Layout blocks (SiteHeader, SiteFooter, AnnouncementBar): link types, keyboard
 * mapping for the top navigation, active-link matching, countdown parts and dismissal memory.
 * No React here, so tests run them directly.
 */
import type { ReactNode } from "react";

/* ── Navigation data ── */

export interface NavLink {
  label: string;
  href: string;
  /** Opens in a new tab with rel="noreferrer". */
  external?: boolean;
}

export interface NavMegaItem extends NavLink {
  description?: string;
  /** A 16px icon. */
  icon?: ReactNode;
}

export interface NavMegaGroup {
  title: string;
  items: NavMegaItem[];
}

/** One top-level entry: a link, a small dropdown list, or a mega panel with groups and an optional featured card. */
export type NavEntry =
  | ({ kind?: "link" } & NavLink)
  | { kind: "dropdown"; label: string; items: NavMegaItem[] }
  | { kind: "mega"; label: string; groups: NavMegaGroup[]; featured?: ReactNode };

export const entryKind = (e: NavEntry) => e.kind ?? "link";

/** Every href an entry leads to (for active matching). */
export function entryHrefs(e: NavEntry): string[] {
  if (e.kind === "dropdown") return e.items.map((i) => i.href);
  if (e.kind === "mega") return e.groups.flatMap((g) => g.items.map((i) => i.href));
  return [e.href];
}

/** Whether `href` is the current page or a parent section of it: "/docs" is active on "/docs/install". */
export function isActiveHref(href: string, current: string | undefined) {
  if (!current || !href || /^[a-z]+:/i.test(href)) return false;
  const clean = (s: string) => s.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
  const h = clean(href);
  const c = clean(current);
  if (h === "/") return c === "/";
  return c === h || c.startsWith(`${h}/`);
}

/** Index of the top-level entry that holds the current page, or -1. */
export function activeEntry(entries: NavEntry[], current: string | undefined) {
  return entries.findIndex((e) => entryHrefs(e).some((h) => isActiveHref(h, current)));
}

/* ── Keyboard for the top navigation (disclosure pattern) ── */

export type TopNavKey = "next" | "prev" | "first" | "last" | "open" | "close" | null;

/** Arrow keys move between top-level items, Down opens a panel, Escape closes it. */
export function topNavKey(key: string): TopNavKey {
  switch (key) {
    case "ArrowRight":
      return "next";
    case "ArrowLeft":
      return "prev";
    case "Home":
      return "first";
    case "End":
      return "last";
    case "ArrowDown":
      return "open";
    case "Escape":
      return "close";
    default:
      return null;
  }
}

/** Wrap-around step through n items. */
export function stepIndex(i: number, n: number, dir: 1 | -1) {
  if (n <= 0) return -1;
  return (((i + dir) % n) + n) % n;
}

/** Down/Up inside an open panel: the next or previous link, wrapping. */
export function panelStep(i: number, n: number, key: string) {
  if (key === "ArrowDown") return stepIndex(i, n, 1);
  if (key === "ArrowUp") return i <= 0 ? -1 : i - 1; // -1 = back to the trigger
  if (key === "Home") return 0;
  if (key === "End") return n - 1;
  return null;
}

/* ── Sticky header ── */

/** Pixels scrolled before the header gets its blurred background and hairline. */
export const SCROLLED_AT = 4;
export const isScrolled = (y: number, at = SCROLLED_AT) => y > at;

/* ── Countdown ── */

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

/** Time left until `end`, never negative. */
export function countdownParts(end: number | Date | string, now = Date.now()): CountdownParts {
  const t = typeof end === "number" ? end : new Date(end).getTime();
  let left = Math.max(0, Math.floor((t - now) / 1000));
  const days = Math.floor(left / 86400);
  left -= days * 86400;
  const hours = Math.floor(left / 3600);
  left -= hours * 3600;
  const minutes = Math.floor(left / 60);
  const seconds = left - minutes * 60;
  return { days, hours, minutes, seconds, done: t - now <= 0 };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2d 04:09:07", "04:09:07" or "09:07" when under an hour. */
export function countdownText(p: CountdownParts) {
  const hms = p.days || p.hours ? `${pad(p.hours)}:${pad(p.minutes)}:${pad(p.seconds)}` : `${pad(p.minutes)}:${pad(p.seconds)}`;
  return p.days ? `${p.days}d ${hms}` : hms;
}

/** "2 days, 4 hours and 9 minutes left": for screen readers, without the ticking seconds. */
export function countdownLabel(p: CountdownParts) {
  if (p.done) return "Ended";
  const parts: string[] = [];
  const unit = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
  if (p.days) parts.push(unit(p.days, "day"));
  if (p.hours) parts.push(unit(p.hours, "hour"));
  if (p.minutes || !parts.length) parts.push(unit(p.minutes, "minute"));
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
  return `${text} left`;
}

/* ── Dismissal memory ── */

export const dismissKey = (id: string) => `kn-announcement:${id}`;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function storage(s?: StorageLike | null): StorageLike | null {
  if (s !== undefined) return s;
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null; // blocked storage (private mode, sandboxed frames)
  }
}

/** Whether the bar with this id was dismissed in this browser. Never throws. */
export function isDismissed(id: string, s?: StorageLike | null) {
  try {
    return storage(s)?.getItem(dismissKey(id)) === "1";
  } catch {
    return false;
  }
}

export function rememberDismissed(id: string, s?: StorageLike | null) {
  try {
    storage(s)?.setItem(dismissKey(id), "1");
  } catch {
    /* storage full or blocked: the bar just comes back next visit */
  }
}

export function forgetDismissed(id: string, s?: StorageLike | null) {
  try {
    storage(s)?.removeItem(dismissKey(id));
  } catch {
    /* ignore */
  }
}

/* ── Scroll lock for the mobile drawer ── */

/** Locks page scroll, keeping the scrollbar gap so nothing shifts. Returns the undo function. */
export function lockScroll(doc: Document = document) {
  const root = doc.documentElement;
  const prev = { overflow: root.style.overflow, paddingRight: root.style.paddingRight };
  const gap = (doc.defaultView?.innerWidth ?? 0) - root.clientWidth;
  root.style.overflow = "hidden";
  if (gap > 0) root.style.paddingRight = `${gap}px`;
  return () => {
    root.style.overflow = prev.overflow;
    root.style.paddingRight = prev.paddingRight;
  };
}
