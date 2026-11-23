"use client";
/** @registry name="action-button" type="ui" title="Action button" description="One button that morphs through a run: Run, then working with a spinner, then a done check, then back. The width follows the label, the icon crossfades and the check pops; it never swaps for another element." */

/**
 * ActionButton: a Button that runs something and shows how it went, in place. Click and `onAction` runs: the icon turns
 * into a spinner and the label into `workingLabel`, the width easing to the new label; when it resolves the spinner
 * becomes a check that pops (the rare confirm) and the label `doneLabel`; after `doneFor` ms it eases back. A failure
 * (false or a throw) goes straight back. Control it with `state` instead, for a run that lives elsewhere.
 * It stays focusable while working (aria-busy, clicks ignored) and announces each state. Reduced motion: instant.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { MotionStyle, usePlay } from "@/registry/knowns/lib/knowns/motion";
import { buttonClass, type ButtonSize, type ButtonVariant } from "../button";
import { Spinner } from "../spinner";

export type ActionState = "idle" | "working" | "done";

export interface ActionButtonProps {
  /** The idle label, e.g. "Run". */
  children: ReactNode;
  /** Icon before the idle label (a play glyph for Run). */
  icon?: ReactNode;
  /** Label while working. Default "Working". */
  workingLabel?: ReactNode;
  /** Label once done. Default "Done". */
  doneLabel?: ReactNode;
  /** Runs on click. Return false or throw for a failure: it goes back to idle at once. */
  onAction?: () => unknown;
  /** Controlled state; without it the button follows onAction. */
  state?: ActionState;
  onStateChange?: (state: ActionState) => void;
  /** How long the done state shows before it eases back, ms. Default 1600; 0 keeps it. */
  doneFor?: number;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

const Check = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-[1.05em]">
    <path d="M3.5 8.5 6.5 11.5 12.5 5" />
  </svg>
);

export function ActionButton({ children, icon, workingLabel = "Working", doneLabel = "Done", onAction, state: stateProp, onStateChange, doneFor = 1600, variant = "primary", size = "md", disabled, className, "aria-label": ariaLabel }: ActionButtonProps) {
  const [own, setOwn] = useState<ActionState>("idle");
  const state = stateProp ?? own;
  const set = (s: ActionState) => {
    if (stateProp === undefined) setOwn(s);
    onStateChange?.(s);
  };
  const play = usePlay(state, (prev, next) => (prev === "working" && next === "done" ? "pop" : undefined));

  // Done eases back after doneFor.
  useEffect(() => {
    if (state !== "done" || !doneFor) return;
    const t = window.setTimeout(() => set("idle"), doneFor);
    return () => window.clearTimeout(t);
    // set is stable enough for a timer; it reads the latest props when it fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, doneFor]);

  const run = async () => {
    if (state !== "idle" || disabled) return;
    set("working");
    let ok = true;
    try {
      ok = (await onAction?.()) !== false;
    } catch {
      ok = false;
    }
    set(ok ? "done" : "idle");
  };

  // The label slot eases its width to the current label, measured from hidden copies of all three.
  const measure = useRef<Record<ActionState, HTMLSpanElement | null>>({ idle: null, working: null, done: null });
  const [widths, setWidths] = useState<Record<ActionState, number> | null>(null);
  useLayoutEffect(() => {
    const read = () => {
      const m = measure.current;
      if (!m.idle || !m.working || !m.done) return;
      const next = { idle: m.idle.offsetWidth, working: m.working.offsetWidth, done: m.done.offsetWidth };
      setWidths((w) => (w && w.idle === next.idle && w.working === next.working && w.done === next.done ? w : next));
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    Object.values(measure.current).forEach((e) => e && ro.observe(e));
    return () => ro.disconnect();
  }, []);

  const label = state === "working" ? workingLabel : state === "done" ? doneLabel : children;
  const working = state === "working";
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-busy={working || undefined}
      aria-disabled={working || undefined}
      disabled={disabled}
      data-state={state}
      onClick={(e) => {
        if (working) return void e.preventDefault();
        if (stateProp === undefined || onAction) void run();
      }}
      className={buttonClass(variant, size, false, cn("relative", working && "cursor-progress", className))}
    >
      <MotionStyle />
      {/* The icon slot: the idle icon, the spinner and the check share one cell and crossfade, so nothing shifts. */}
      <span aria-hidden="true" className="relative grid size-[1.1em] shrink-0 place-items-center">
        <span className={cn("col-start-1 row-start-1 grid place-items-center transition-[opacity,scale] duration-(--kn-dur-fast) ease-(--kn-ease-out) motion-reduce:transition-none", state === "idle" ? "scale-100 opacity-100" : "scale-90 opacity-0")}>{icon}</span>
        <span className={cn("col-start-1 row-start-1 grid place-items-center transition-opacity duration-(--kn-dur-fast) ease-(--kn-ease-out) motion-reduce:transition-none", working ? "opacity-100" : "opacity-0")}>{working && <Spinner className="size-[1.1em]" label="" />}</span>
        <span key={state === "done" ? "done" : "rest"} data-kn-m={state === "done" ? play : undefined} className={cn("col-start-1 row-start-1 grid place-items-center", state === "done" ? "opacity-100" : "opacity-0")}>
          <Check />
        </span>
      </span>
      {/* The label slot: its width eases to the current label (one control morphing, named in the motion guard). */}
      <span className="relative inline-grid overflow-hidden whitespace-nowrap transition-[width] duration-(--kn-dur) ease-(--kn-ease-out) motion-reduce:transition-none" style={{ width: widths ? widths[state] : undefined }}>
        <span key={state} className="kn-m-text col-start-1 row-start-1">
          {label}
        </span>
      </span>
      {/* Hidden copies to measure each label at the button's own type. */}
      <span aria-hidden="true" className="pointer-events-none invisible absolute top-0 left-0 flex whitespace-nowrap">
        <span ref={(e) => void (measure.current.idle = e)}>{children}</span>
        <span ref={(e) => void (measure.current.working = e)}>{workingLabel}</span>
        <span ref={(e) => void (measure.current.done = e)}>{doneLabel}</span>
      </span>
      <span role="status" className="sr-only">
        {working ? "Working" : state === "done" ? "Done" : ""}
      </span>
    </button>
  );
}

export default ActionButton;
