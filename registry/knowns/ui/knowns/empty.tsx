"use client";
/** @registry name="empty" type="ui" title="Empty" description="The state of a list with nothing in it: an icon, a title, one sentence and the next action. Dashed or plain, three sizes." */

/*
 * The shape (an icon tile, a title, a description and an action row) follows the Empty of shadcn/ui (MIT, https://ui.shadcn.com),
 * Copyright (c) 2023 shadcn. Changes: Knowns tokens, one props-based component, sizes.
 */
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";

export interface EmptyProps extends Omit<ComponentProps<"div">, "title"> {
  /** Leading icon, drawn in a tile. */
  icon?: ReactNode;
  title: ReactNode;
  /** One sentence on why it is empty and what to do. */
  description?: ReactNode;
  /** Buttons or links under the text. The first should be the main action. */
  actions?: ReactNode;
  /** Dashed outline, for a region that is a drop target or a list. Default false. */
  bordered?: boolean;
  size?: "sm" | "md" | "lg";
}

const PAD = { sm: "gap-3 p-6", md: "gap-4 p-10", lg: "gap-5 p-16" } as const;

/**
 * An empty state. It paints at once and never animates: nothing changed yet is not news. Use `role="status"` on
 * the wrapper only where the emptiness appears after a search or filter, so a screen reader hears it.
 */
export function Empty({ icon, title, description, actions, bordered = false, size = "md", className, children, ...rest }: EmptyProps) {
  return (
    <div data-slot="empty" className={cn("flex w-full min-w-0 flex-col items-center justify-center rounded-2xl text-center text-balance", PAD[size], bordered && "border border-dashed border-border", className)} {...rest}>
      {icon ? <div data-slot="empty-icon" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground [&_svg]:size-5 [&_svg]:shrink-0" aria-hidden="true">{icon}</div> : null}
      <div className="flex max-w-sm flex-col items-center gap-1.5">
        <div data-slot="empty-title" className={cn("font-semibold tracking-tight text-foreground", size === "sm" ? "text-[14px]" : "text-[16px]")}>{title}</div>
        {description ? <p data-slot="empty-description" className="text-[13.5px] leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div data-slot="empty-actions" className="flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
      {children}
    </div>
  );
}

export default Empty;
