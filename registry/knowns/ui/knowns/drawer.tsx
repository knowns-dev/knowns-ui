"use client";
/** @registry name="drawer" type="ui" title="Drawer" description="A bottom sheet with a trigger: pull its handle down to dismiss, a fixed or full height, and the same slide as Sheet. Controlled or uncontrolled." */

import { cloneElement, useState, type ReactElement, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { Sheet, type SheetProps } from "./sheet";

const HEIGHT = {
  auto: "",
  half: "h-[50dvh]",
  full: "h-[85dvh]",
} as const;

export interface DrawerProps extends Omit<SheetProps, "side" | "size" | "open" | "onOpenChange" | "children" | "footer"> {
  /** The element that opens it (usually a Button). It is cloned with onClick, aria-haspopup and aria-expanded. */
  trigger?: ReactElement;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** "auto" fits the content (up to 85% of the screen), "half" and "full" fix the height. Default "auto". */
  height?: keyof typeof HEIGHT;
  /** Content, or a function that gets `close` so a row or a button can dismiss it. */
  children?: ReactNode | ((close: () => void) => ReactNode);
  footer?: ReactNode | ((close: () => void) => ReactNode);
}

/**
 * A drawer: Sheet from the bottom edge with its own trigger and state. Pull the handle or the header down to
 * dismiss (past 30% of its height, or a quick flick), or press Escape or the backdrop. Focus is trapped while it
 * is open and returns to the trigger. Reduced motion: it fades instead of sliding.
 */
export function Drawer({ trigger, open: openProp, defaultOpen = false, onOpenChange, height = "auto", children, footer, className, ...sheet }: DrawerProps) {
  const [own, setOwn] = useState(defaultOpen);
  const open = openProp ?? own;
  const set = (v: boolean) => {
    if (openProp === undefined) setOwn(v);
    onOpenChange?.(v);
  };
  const close = () => set(false);
  const props = trigger?.props as { onClick?: (e: unknown) => void } | undefined;

  return (
    <>
      {trigger
        ? cloneElement(trigger as ReactElement<Record<string, unknown>>, {
            "aria-haspopup": "dialog",
            "aria-expanded": open,
            onClick: (e: { defaultPrevented?: boolean }) => {
              props?.onClick?.(e);
              if (!e.defaultPrevented) set(true);
            },
          })
        : null}
      <Sheet {...sheet} side="bottom" open={open} onOpenChange={set} className={cn(HEIGHT[height], className)} footer={typeof footer === "function" ? footer(close) : footer}>
        {typeof children === "function" ? children(close) : children}
      </Sheet>
    </>
  );
}

export default Drawer;
