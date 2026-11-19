"use client";
/** @registry name="context-menu" type="ui" title="Context menu" description="The menu under the pointer: right-click, Shift+F10 or the menu key, and a long press on touch. Built on Menu, so it has the same sections, checkable rows, submenus and typeahead." */

import { cloneElement, useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { Menu, type MenuProps } from "../menu";

/** How long a finger rests before the menu opens, and how far it may drift (px) before that counts as a scroll. */
export const LONG_PRESS_MS = 500;
export const LONG_PRESS_SLOP = 8;

export interface LongPress {
  start(x: number, y: number): void;
  move(x: number, y: number): void;
  cancel(): void;
}

/** A press that fires `fire(x, y)` after `delay` unless it ends, or drifts past `slop`, first. Pure, so it can be tested with fake timers. */
export function createLongPress(fire: (x: number, y: number) => void, delay = LONG_PRESS_MS, slop = LONG_PRESS_SLOP): LongPress {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let origin = { x: 0, y: 0 };
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  return {
    start(x, y) {
      cancel();
      origin = { x, y };
      timer = setTimeout(() => {
        timer = null;
        fire(origin.x, origin.y);
      }, delay);
    },
    move(x, y) {
      if (timer !== null && Math.hypot(x - origin.x, y - origin.y) > slop) cancel();
    },
    cancel,
  };
}

export interface ContextMenuProps extends Omit<MenuProps, "trigger" | "openOn" | "side" | "align" | "width"> {
  /** The region that opens the menu. One element: it is cloned with the handlers, so it must pass props and a ref to a DOM node. */
  children: ReactElement;
  /** Long press on touch and pen. Default true. */
  longPress?: boolean;
}

/**
 * A menu for a region: right-click opens it at the pointer, Shift+F10 or the menu key opens it at the region, and
 * a long press does the same on a touch screen (iOS never sends a contextmenu event for it). It is Menu with
 * openOn="contextmenu", so rows, sections, checked rows, submenus and keyboard navigation are Menu's.
 */
export function ContextMenu({ children, longPress = true, ...menu }: ContextMenuProps) {
  const press = useRef<LongPress | null>(null);
  useEffect(() => () => press.current?.cancel(), []);
  const props = children.props as { className?: string; onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void; onPointerMove?: (e: ReactPointerEvent<HTMLElement>) => void; onPointerUp?: (e: ReactPointerEvent<HTMLElement>) => void; onPointerCancel?: (e: ReactPointerEvent<HTMLElement>) => void };

  const region = longPress
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        // iOS shows its own callout on a long press; without this it covers the menu.
        className: cn("[-webkit-touch-callout:none]", props.className),
        onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
          props.onPointerDown?.(e);
          if (e.pointerType === "mouse" || e.defaultPrevented) return;
          const target = e.currentTarget;
          press.current?.cancel();
          press.current = createLongPress((x, y) => {
            // The menu listens for contextmenu, so hand it one at the finger.
            target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y }));
          });
          press.current.start(e.clientX, e.clientY);
        },
        onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
          props.onPointerMove?.(e);
          press.current?.move(e.clientX, e.clientY);
        },
        onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
          props.onPointerUp?.(e);
          press.current?.cancel();
        },
        onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => {
          props.onPointerCancel?.(e);
          press.current?.cancel();
        },
      })
    : children;

  return <Menu {...menu} trigger={region} openOn="contextmenu" />;
}

export default ContextMenu;
