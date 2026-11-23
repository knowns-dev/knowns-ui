"use client";
/** @registry name="hold-button" type="ui" title="Hold button" description="A button for a risky action that only fires after a full press and hold: the fill sweeps with the clock, letting go early draws it back, and a finished hold runs the action and lands on a done state with a check. Mouse, touch, Space or Enter." */

/**
 * HoldButton: press and hold to run something you cannot take back (refund, revoke, delete, deploy). The fill grows with
 * the clock (linear, it is a timer), an early release draws it back (--kn-dur, ease-out), and a full hold calls
 * `onComplete`. While it runs the button is busy; once it resolves the label swaps to `doneLabel` and a check pops in
 * (the rare confirm, the motion lib's pop). Throwing or returning false goes back to the start.
 * Keyboard: hold Space or Enter. Reduced motion: the fill still shows progress (it is state), the draw back and the pop are instant.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { MotionStyle, usePlay } from "@/registry/knowns/lib/knowns/motion";
import { Spinner } from "../spinner";
import { HOLD_MS, holdHint, holdPhase, holdProgress, isHoldKey } from "./hold-button-utils";

export { HOLD_MS, holdHint, holdPhase, holdProgress, isHoldKey } from "./hold-button-utils";

export interface HoldButtonProps {
  children: ReactNode;
  /** Runs once a hold completes. Return false (or throw) to go back to the start; otherwise the button shows the done state. */
  onComplete: () => unknown;
  /** How long to hold, ms. Default 1200. */
  duration?: number;
  /** The label once it is done, e.g. "Refunded $240". Without it the button returns to the start after the action. */
  doneLabel?: ReactNode;
  /** The label while the action runs. Default the children. */
  busyLabel?: ReactNode;
  /** "danger" (default) for destructive actions, "primary" for the accent. */
  tone?: "danger" | "primary";
  size?: "sm" | "md";
  /** Show the hint ("Press and hold for 1.2 seconds...") under the button and point aria-describedby at it. Default true. */
  hint?: boolean;
  /** An element that describes the button, when you render the hint yourself. */
  describedBy?: string;
  disabled?: boolean;
  className?: string;
}

type State = "idle" | "busy" | "done";

/**
 * The fill is the solid colour of the done state, so through the hold it is the obvious thing in both themes; the label
 * over it is a second, inverted copy clipped to the fill (white on red-600 is 4.8:1, the empty part keeps its own ink).
 */
const TONE = {
  danger: {
    shell: "text-red-700 shadow-[0_0_0_1px_rgb(220_38_38/0.45)] dark:text-red-300 dark:shadow-[0_0_0_1px_rgb(248_113_113/0.45)]",
    fill: "bg-red-600",
    ink: "text-white",
    done: "bg-red-600 text-white shadow-none",
  },
  primary: {
    shell: "text-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--kn-accent,var(--primary))_50%,transparent)]",
    fill: "bg-[var(--kn-accent,var(--primary))]",
    ink: "text-[var(--primary-foreground)]",
    done: "bg-[var(--kn-accent,var(--primary))] text-[var(--primary-foreground)] shadow-none",
  },
} as const;

export function HoldButton({ children, onComplete, duration = HOLD_MS, doneLabel, busyLabel, tone = "danger", size = "md", hint = true, describedBy, disabled, className }: HoldButtonProps) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [state, setState] = useState<State>("idle");
  const startedAt = useRef<number | null>(null);
  const raf = useRef(0);
  const hintId = useId();
  const play = usePlay(state, (prev, next) => (prev !== "done" && next === "done" ? "pop" : undefined));
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const release = () => {
    cancelAnimationFrame(raf.current);
    if (startedAt.current === null) return;
    startedAt.current = null;
    setHolding(false);
    setProgress(0);
  };
  const finish = async () => {
    startedAt.current = null;
    setHolding(false);
    setState("busy");
    let ok = true;
    try {
      ok = (await onComplete()) !== false;
    } catch {
      ok = false;
    }
    setProgress(0);
    setState(ok && doneLabel != null ? "done" : "idle");
  };
  const begin = () => {
    if (disabled || state !== "idle" || startedAt.current !== null) return;
    startedAt.current = performance.now();
    setHolding(true);
    const tick = () => {
      const at = startedAt.current;
      if (at === null) return;
      const now = performance.now();
      setProgress(holdProgress(now - at, duration));
      if (holdPhase(at, now, duration) === "done") return void finish();
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const t = TONE[tone];
  const done = state === "done";
  const busy = state === "busy";
  return (
    <span className={cn("inline-flex flex-col items-start gap-1.5", className)}>
      <MotionStyle />
      <button
        type="button"
        aria-describedby={describedBy ?? (hint && !done ? hintId : undefined)}
        aria-busy={busy || undefined}
        aria-disabled={done || undefined}
        disabled={disabled || busy}
        data-state={holding ? "holding" : state}
        className={cn(
          "relative inline-flex touch-manipulation select-none items-center justify-center gap-1.5 overflow-hidden font-medium",
          size === "sm" ? "h-8 rounded-[9px] px-3 text-[13px]" : "h-9 rounded-[10px] px-3.5 text-[13.5px]",
          "transition-[background-color,color,box-shadow,transform] duration-(--kn-dur-fast) ease-(--kn-ease-out) motion-reduce:transition-none",
          done || busy ? t.done : t.shell,
          !done && "active:scale-[0.97]",
          "disabled:opacity-70",
          focusRing,
        )}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          begin();
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") e.preventDefault();
          if (isHoldKey(e)) begin();
        }}
        onKeyUp={(e) => (e.key === " " || e.key === "Enter") && release()}
        onBlur={release}
      >
        {/* The fill follows the clock while held (no transition); let go and it draws back. */}
        <span
          aria-hidden="true"
          data-slot="hold-fill"
          className={cn("absolute inset-0 origin-left", t.fill, !holding && "transition-transform duration-(--kn-dur) ease-(--kn-ease-out) motion-reduce:transition-none", (done || busy) && "opacity-0")}
          style={{ transform: `scaleX(${progress})` }}
        />
        {/* The label again, inverted, clipped to the fill: it stays readable over both parts. */}
        {state === "idle" && (
          <span
            aria-hidden="true"
            data-slot="hold-ink"
            className={cn("pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5", t.ink, !holding && "transition-[clip-path] duration-(--kn-dur) ease-(--kn-ease-out) motion-reduce:transition-none")}
            style={{ clipPath: `inset(0 ${+((1 - progress) * 100).toFixed(2)}% 0 0)` }}
          >
            {children}
          </span>
        )}
        {/* Every label sits in one grid cell, so the button is as wide as the longest and never shifts as the state changes. */}
        <span className="relative grid">
          <span aria-hidden={state !== "idle" || undefined} className={cn("col-start-1 row-start-1 flex items-center justify-center gap-1.5", state !== "idle" && "invisible")}>
            {children}
          </span>
          <span aria-hidden={!busy || undefined} className={cn("col-start-1 row-start-1 flex items-center justify-center gap-1.5", !busy && "invisible")}>
            <Spinner className="size-[1.1em]" label="" />
            {busyLabel ?? children}
          </span>
          {doneLabel != null && (
            <span aria-hidden={!done || undefined} className={cn("col-start-1 row-start-1 flex items-center justify-center gap-1.5", !done && "invisible")}>
              <span key={done ? "on" : "off"} data-kn-m={done ? play : undefined} className="grid place-items-center">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-[1.05em]">
                  <path d="M3.5 8.5 6.5 11.5 12.5 5" />
                </svg>
              </span>
              {doneLabel}
            </span>
          )}
        </span>
      </button>
      {hint && !describedBy && !done && (
        <span id={hintId} className="text-[12px] text-muted-foreground">
          {holdHint(duration)}
        </span>
      )}
      <span role="status" className="sr-only">
        {done ? doneLabel : busy ? "Working" : ""}
      </span>
    </span>
  );
}

export default HoldButton;
