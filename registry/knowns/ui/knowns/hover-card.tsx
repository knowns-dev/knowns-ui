"use client";
/** @registry name="hover-card" type="ui" title="Hover card" description="A preview card that opens when the pointer rests on a link or focus lands on it: open and close delays, the card stays open while you move into it, and on touch a first tap opens it and a second follows the link." */

import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { FLOAT_FADE, useFloating, type FloatingAlign, type FloatingSide } from "./use-floating";

/**
 * Touch has no hover, so the first tap on the trigger opens the card instead of following its link, and a
 * tap while it is open goes through. Mouse and pen clicks always go through.
 */
export function interceptsTap(pointerType: string, open: boolean): boolean {
  return pointerType === "touch" && !open;
}

export interface HoverCardProps {
  /** The element the card is about, usually a link. One element, so it can be described. */
  trigger: ReactElement<Record<string, unknown>>;
  /** The preview. Keep it informational: it cannot be reached with Tab, so nothing here may be the only way to something. */
  children: ReactNode;
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
 * non-modal and takes no focus; the trigger points at it with aria-describedby.
 */
export function HoverCard({ trigger, children, openDelay = 500, closeDelay = 200, side = "bottom", align = "center", open: openProp, onOpenChange, width = 288, className }: HoverCardProps) {
  const [own, setOwn] = useState(false);
  const open = openProp ?? own;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pointer = useRef("mouse");
  const id = useId();
  const { triggerRef, floatingRef, style, placement, portalHost, closing } = useFloating<HTMLSpanElement, HTMLDivElement>({ open, side, align, offset: 8 });

  const set = (v: boolean) => {
    if (openProp === undefined) setOwn(v);
    onOpenChange?.(v);
  };
  const enter = (delay: number) => {
    clearTimeout(timer.current);
    if (open) return;
    timer.current = setTimeout(() => set(true), delay);
  };
  const leave = (delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => set(false), delay);
  };
  const keep = () => clearTimeout(timer.current);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Escape, and a tap or click outside, close it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      clearTimeout(timer.current);
      set(false);
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
  const described = child
    ? cloneElement(child, { "aria-describedby": [child.props["aria-describedby"], open ? id : undefined].filter(Boolean).join(" ") || undefined })
    : trigger;

  return (
    <span
      ref={triggerRef}
      className="inline-flex"
      onPointerDown={(e) => {
        pointer.current = e.pointerType;
      }}
      onPointerEnter={(e) => e.pointerType !== "touch" && enter(openDelay)}
      onPointerLeave={(e) => e.pointerType !== "touch" && leave(closeDelay)}
      onFocus={(e) => {
        if ((e.target as HTMLElement).matches?.(":focus-visible")) {
          clearTimeout(timer.current);
          set(true);
        }
      }}
      onBlur={() => leave(0)}
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
            data-side={placement}
            data-state={closing ? "closed" : "open"}
            style={{ ...style, width }}
            onPointerEnter={keep}
            onPointerLeave={() => leave(closeDelay)}
            className={cn(
              "z-[60] max-w-[calc(100vw-1rem)] overflow-auto rounded-xl bg-popover p-4 text-[13px] leading-relaxed text-popover-foreground",
              "shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_12%,transparent),0_12px_32px_-12px_rgb(0_0_0/0.3),0_2px_6px_rgb(0_0_0/0.06)]",
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
