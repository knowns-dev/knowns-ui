/** @registry part-of="agent-cursors" */
/**
 * The look of an agent's live pointer, shared by Agent Cursors (documents and tables) and the AI whiteboard: the
 * arrow and the name pill with a status line. They draw only; the caller positions them.
 */
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";

const HAIRLINE = "[border-color:color-mix(in_srgb,var(--foreground)_9%,transparent)]";

/** The arrow, tip at the top left of its box (offset by -2px so the tip sits on the point). */
export function CursorPointer({ color, className }: { color: string; className?: string }) {
  return (
    <svg width="20" height="22" viewBox="0 0 20 22" className={cn("-translate-x-[2px] -translate-y-[2px] drop-shadow-[0_1px_2px_rgb(0_0_0/0.2)]", className)} aria-hidden>
      <path d="M2.5 2 17.5 10.4l-6.6 1.7-3.3 6.9z" fill={color} stroke="white" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

export interface CursorTagProps extends Omit<ComponentProps<"div">, "children"> {
  /** The agent's name. */
  name: string;
  /** What it is doing, in a few words: "thinking", "adding notes". */
  status?: ReactNode;
  color: string;
  /** Greys the dot, for an agent that stepped away. */
  away?: boolean;
  /** Shown after the status, such as a spend. */
  trailing?: ReactNode;
}

/** The name pill: a dot in the agent's colour, the name, and a status line under it. */
export function CursorTag({ name, status, color, away, trailing, className, ...rest }: CursorTagProps) {
  return (
    <div className={cn("flex max-w-[190px] flex-col rounded-lg border bg-popover px-2 py-1 text-popover-foreground shadow-[0_4px_12px_-4px_rgb(0_0_0/0.18)]", HAIRLINE, className)} {...rest}>
      <span className="flex items-center gap-1.5 text-[11.5px] leading-4 font-medium">
        <span className="size-1.5 flex-none rounded-full" style={{ background: away ? "var(--muted-foreground)" : color }} />
        <span className="truncate">{name}</span>
      </span>
      {(status || trailing) && (
        <span className="flex gap-1 pl-3 text-[11px] leading-4 whitespace-nowrap text-muted-foreground">
          <span className="truncate">{status}</span>
          {trailing}
        </span>
      )}
    </div>
  );
}
