"use client";
/** @registry part-of="data-table" */
/**
 * The bar that offers actions for the selected rows. Its space opens in a Fold (grid rows, 180ms in and 120ms out, ease out)
 * so the table never jumps when the first row is ticked or the selection clears, and the bar itself rises 6px and fades in
 * the same time; with reduced motion it just appears. It stays mounted for the exit, so the count it shows never jumps
 * to 0 while it fades, and the count rolls when it changes. DataTable places it at the end of the table, in flow below
 * the last row, so no row hides under it, and sticky at the bottom of the window while the end is out of view (not in a portal),
 * so it works in a card, a sheet or an iframe.
 */
import { useRef, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Fold, MOTION, MotionStyle, TickNumber } from "@/registry/knowns/lib/knowns/motion";

export interface DataTableActionBarProps {
  /** Selected rows. The bar shows while this is above 0. */
  count: number;
  onClear: () => void;
  /** The actions, usually small secondary Buttons. */
  children: ReactNode;
  /** What is selected, singular and plural: ["run", "runs"]. Default ["row", "rows"]. */
  noun?: [string, string];
  className?: string;
}

export function DataTableActionBar({ count, onClear, children, noun = ["row", "rows"], className }: DataTableActionBarProps) {
  const open = count > 0;
  const last = useRef(count);
  if (open) last.current = count;
  const n = last.current;
  return (
    <>
      {open && <MotionStyle />}
      {/* The Fold is the sticky element: its space grows with the bar, so the table below the rows never jumps, and it floats while the end of the table is below the window. */}
      <Fold open={open} ms={MOTION.fast + 20} className="pointer-events-none sticky bottom-0 z-[3]">
        <div className="flex justify-center px-3 py-3">
          <div
            role="toolbar"
            aria-label="Actions for the selected rows"
            className={cn(
              "pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-xl border bg-popover p-1.5 pl-3 text-[13px] text-popover-foreground shadow-lg",
              "transition-[opacity,translate] duration-(--kn-dur-fast) ease-(--kn-ease-out) motion-reduce:transition-none",
              open ? "translate-y-0 opacity-100 duration-(--kn-dur) starting:translate-y-1.5 starting:opacity-0" : "translate-y-1.5 opacity-0",
              className,
            )}
          >
            <span className="font-medium tabular-nums">
              {/* Screen readers get the words once; the digit rolls for the eye only. */}
              <span className="sr-only">
                {n} {n === 1 ? noun[0] : noun[1]} selected
              </span>
              <span aria-hidden>
                <TickNumber value={n} /> {n === 1 ? noun[0] : noun[1]} selected
              </span>
            </span>
            <span className="h-4 w-px bg-border" aria-hidden />
            {children}
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear selection"
              title="Clear selection (Esc)"
              className={cn("inline-flex size-7 items-center justify-center rounded-[8px] text-muted-foreground transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:text-foreground", focusRing)}
            >
              <svg viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="size-3.5">
                <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </Fold>
    </>
  );
}
