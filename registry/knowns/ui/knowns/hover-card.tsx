"use client";
/** @registry name="hover-card" type="ui" title="Hover card" description="A preview card that opens when the pointer rests on a link or focus lands on it: open and close delays, the card stays open while you move into it, and on touch a first tap opens it and a second follows the link." */

import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { FLOAT_FADE, FLOAT_SURFACE, useFloating, type FloatingAlign, type FloatingSide } from "./use-floating";

/**
 * Touch has no hover, so the first tap on the trigger opens the card instead of following its link, and a
 * tap while it is open goes through. Mouse and pen clicks always go through.
 */
export function interceptsTap(pointerType: string, open: boolean): boolean {
  return pointerType === "touch" && !open;
}

const TABBABLE = 'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"]';

/** The elements inside `root` that Tab can reach, in DOM order. */
function tabbables(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter((el) => {
    if (el.tabIndex < 0 || el.hasAttribute("disabled") || el.closest("[inert]")) return false;
    return el.checkVisibility ? el.checkVisibility() : true;
  });
}

function keyboardFocusIn(root: HTMLElement | null): boolean {
  const a = document.activeElement;
  if (!root || !a || !root.contains(a)) return false;
  try {
    return a.matches(":focus-visible");
  } catch {
    return false;
  }
}

export interface HoverCardProps {
  /** The element the card is about, usually a link. One element, so it can be described. */
  trigger: ReactElement<Record<string, unknown>>;
  /** The preview. A read-only card cannot be reached with Tab, so nothing in it may be the only way to something; set `interactive` for buttons or links. */
  children: ReactNode;
  /**
   * The card holds buttons or links. While it is open and the trigger has focus, Tab moves into the card, and Tab past its
   * last control (or Shift+Tab from its first) returns to the page order and closes it. There is no focus trap. The trigger
   * then announces a popup (aria-haspopup="dialog", aria-controls) instead of being described by the card.
   */
  interactive?: boolean;
  /** Accessible name of an interactive card. Default: the trigger's own text. */
  label?: string;
  /** Ms the pointer rests on the trigger before it opens. Default 500. Focus opens at once. */
  openDelay?: number;
  /** Ms after the pointer leaves before it closes; entering the card in that time keeps it open. Default 200. */
  closeDelay?: number;
  side?: FloatingSide;
  align?: FloatingAlign;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Width of the card in px. Default 288. */
  width?: number;
  className?: string;
}

/**
 * Hover card: a richer cousin of Tooltip for a link, a mention or an avatar. It opens after the pointer rests,
 * stays open while the pointer is over the trigger or the card, and closes on Escape or an outside tap. It is
 * non-modal. A read-only card takes no focus and the trigger points at it with aria-describedby; an `interactive` card
 * is reached with Tab from the trigger and is a labelled, non-modal dialog.
 */
export function HoverCard({ trigger, children, interactive = false, label, openDelay = 500, closeDelay = 200, side = "bottom", align = "center", open: openProp, onOpenChange, width = 288, className }: HoverCardProps) {
  const [own, setOwn] = useState(false);
  const open = openProp ?? own;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pointer = useRef("mouse");
  const id = useId();
  const triggerId = `${id}-trigger`;
  const quiet = useRef(false);
  const hovering = useRef(false);
  const { triggerRef, floatingRef, style, placement, portalHost, closing } = useFloating<HTMLSpanElement, HTMLDivElement>({ open, side, align, offset: 8 });

  const set = (v: boolean) => {
    if (openProp === undefined) setOwn(v);
    onOpenChange?.(v);
  };
  const enter = (delay: number) => {
    hovering.current = true;
    clearTimeout(timer.current);
    if (open) return;
    timer.current = setTimeout(() => set(true), delay);
  };
  const leave = (delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      // Focus a keyboard user has moved into an interactive card keeps it open, wherever the pointer is.
      if (interactive && (keyboardFocusIn(floatingRef.current) || keyboardFocusIn(triggerRef.current))) return;
      set(false);
    }, delay);
  };
  /** The trigger element itself (the span wraps it), focused without reopening the card. */
  const focusTrigger = () => {
    const el = tabbables(triggerRef.current)[0];
    quiet.current = true;
    el?.focus();
    quiet.current = false;
  };
  const keep = () => {
    hovering.current = true;
    clearTimeout(timer.current);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  // Escape, and a tap or click outside, close it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      clearTimeout(timer.current);
      const inside = interactive && floatingRef.current?.contains(document.activeElement);
      set(false);
      if (inside) focusTrigger();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (floatingRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      clearTimeout(timer.current);
      set(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const child = isValidElement(trigger) ? trigger : null;
  const triggerName = (child?.props.id as string | undefined) ?? triggerId;
  const described = child
    ? interactive
      ? // aria-expanded is left out: a link does not support it, and the card opens on hover and focus, not on activation.
        cloneElement(child, { id: triggerName, "aria-haspopup": "dialog", "aria-controls": open ? id : undefined })
      : cloneElement(child, { "aria-describedby": [child.props["aria-describedby"], open ? id : undefined].filter(Boolean).join(" ") || undefined })
    : trigger;

  const onTriggerKeyDown = (e: ReactKeyboardEvent) => {
    if (!interactive || !open || e.key !== "Tab" || e.shiftKey || e.defaultPrevented) return;
    if (floatingRef.current?.contains(e.target as Node)) return;
    const first = tabbables(floatingRef.current)[0];
    if (!first) return;
    e.preventDefault();
    first.focus();
  };
  const onCardKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key !== "Tab") return;
    const list = tabbables(floatingRef.current);
    const at = list.indexOf(document.activeElement as HTMLElement);
    if (!e.shiftKey && at === list.length - 1) {
      // Tab past the last control: focus the trigger and let the browser's own Tab step on to what follows it.
      clearTimeout(timer.current);
      set(false);
      focusTrigger();
    } else if (e.shiftKey && at <= 0) {
      e.preventDefault();
      clearTimeout(timer.current);
      set(false);
      focusTrigger();
    }
  };
  return (
    <span
      ref={triggerRef}
      className="inline-flex"
      onPointerDown={(e) => {
        pointer.current = e.pointerType;
      }}
      onPointerEnter={(e) => e.pointerType !== "touch" && enter(openDelay)}
      onPointerLeave={(e) => {
        if (e.pointerType === "touch") return;
        hovering.current = false;
        leave(closeDelay);
      }}
      onKeyDown={onTriggerKeyDown}
      onFocus={(e) => {
        if (quiet.current) return;
        if ((e.target as HTMLElement).matches?.(":focus-visible")) {
          clearTimeout(timer.current);
          set(true);
        }
      }}
      onBlur={(e) => {
        if (!interactive) return leave(0);
        // Focus moving between the trigger and the card is not leaving; React bubbles the card's events through the portal.
        const to = e.relatedTarget as Node | null;
        if (to && (floatingRef.current?.contains(to) || triggerRef.current?.contains(to))) return;
        // A click on plain text in the card drops focus to nothing while the pointer is still on it.
        if (!to && hovering.current) return;
        leave(closeDelay);
      }}
      onClickCapture={(e) => {
        if (interceptsTap(pointer.current, open)) {
          // The first tap shows the card; the link waits for the second.
          e.preventDefault();
          e.stopPropagation();
          clearTimeout(timer.current);
          set(true);
        }
      }}
    >
      {described}
      {portalHost &&
        createPortal(
          <div
            ref={floatingRef}
            id={id}
            {...(interactive ? { role: "dialog", "aria-label": label, "aria-labelledby": label ? undefined : triggerName } : {})}
            onKeyDown={interactive ? onCardKeyDown : undefined}
            data-side={placement}
            data-state={closing ? "closed" : "open"}
            style={{ ...style, width }}
            onPointerEnter={keep}
            onPointerLeave={() => {
              hovering.current = false;
              leave(closeDelay);
            }}
            className={cn(
              "z-[60] max-w-[calc(100vw-1rem)] overflow-auto p-3 leading-relaxed",
              FLOAT_SURFACE,
              FLOAT_FADE,
              className,
            )}
          >
            {children}
          </div>,
          portalHost,
        )}
    </span>
  );
}
