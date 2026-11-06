"use client";

import type { ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";

export type StepStatus = "done" | "current" | "upcoming" | "error";

export interface Step {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  /** Overrides the status derived from `current` (e.g. "error" on a step that failed validation). */
  status?: StepStatus;
  /** Shows "Optional" under the title. */
  optional?: boolean;
}

/* ── Pure helpers (exported for tests) ── */

/** Status of step `index`: an explicit status wins; otherwise before `current` is done, at it current, after it upcoming. */
export function stepStatus(index: number, current: number, explicit?: StepStatus): StepStatus {
  if (explicit) return explicit;
  return index < current ? "done" : index === current ? "current" : "upcoming";
}

/** Steps you can jump back to: finished (or failed) ones before the current step. */
export function canVisit(status: StepStatus, index: number, current: number) {
  return index < current && (status === "done" || status === "error");
}

/* ── Component ── */

const Check = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5">
    <path d="m4 8.5 2.5 2.5L12 5.5" />
  </svg>
);
const Bang = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="size-3.5">
    <path d="M8 4.5v4.25M8 11.25v.01" />
  </svg>
);

const DOT: Record<StepStatus, string> = {
  done: "bg-primary text-primary-foreground",
  current: "bg-card text-foreground shadow-[0_0_0_1.5px_var(--foreground),0_0_0_5px_color-mix(in_srgb,var(--foreground)_8%,transparent)]",
  upcoming: "bg-card text-muted-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_16%,transparent)]",
  error: "bg-red-500/10 text-red-600 shadow-[0_0_0_1.5px_rgb(239_68_68/0.7)] dark:text-red-400",
};

const STATUS_LABEL: Record<StepStatus, string> = { done: "completed", current: "current", upcoming: "not started", error: "has an error" };

export interface StepperProps {
  steps: Step[];
  /** Index of the current step (0-based). Steps before it are done. */
  current: number;
  /** Makes finished steps before `current` clickable (they become buttons). */
  onStepClick?: (index: number) => void;
  orientation?: "horizontal" | "vertical";
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}

/** Progress through a multi-step flow. Finished steps can be revisited; a step can be marked as an error. */
export function Stepper({ steps, current, onStepClick, orientation = "horizontal", size = "md", className, "aria-label": label = "Progress" }: StepperProps) {
  const vertical = orientation === "vertical";
  const dot = size === "sm" ? "size-6 text-[11.5px]" : "size-7 text-[12.5px]";

  return (
    <nav aria-label={label} className={className}>
      <ol className={cn("flex", vertical ? "flex-col" : "items-start")}>
        {steps.map((step, i) => {
          const status = stepStatus(i, current, step.status);
          const nextStatus = i < steps.length - 1 ? stepStatus(i + 1, current, steps[i + 1].status) : null;
          const clickable = !!onStepClick && canVisit(status, i, current);
          const lineDone = status === "done" && nextStatus !== null;
          const marker = (
            <span className={cn("relative z-[1] grid flex-none place-items-center rounded-full font-semibold tabular-nums transition-[background-color,box-shadow] duration-300 ease-[cubic-bezier(.22,1,.36,1)]", dot, DOT[status])}>
              {status === "done" ? <Check /> : status === "error" ? <Bang /> : i + 1}
            </span>
          );
          const text = (
            <span className={cn("flex min-w-0 flex-col", vertical ? "pt-0.5" : "items-center text-center")}>
              <span className={cn("text-[13px] font-medium leading-snug", status === "upcoming" ? "text-muted-foreground" : "text-foreground", status === "error" && "text-red-700 dark:text-red-300")}>
                {step.title}
              </span>
              {step.optional && <span className="text-[11.5px] text-muted-foreground">Optional</span>}
              {step.description && <span className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{step.description}</span>}
            </span>
          );
          const body = (
            <>
              {marker}
              {text}
              <span className="sr-only">, {STATUS_LABEL[status]}</span>
            </>
          );
          const inner = cn("flex rounded-[10px]", vertical ? "items-start gap-3 py-1 pr-2" : "flex-col items-center gap-2 px-1");
          return (
            <li
              key={step.id}
              aria-current={status === "current" ? "step" : undefined}
              className={cn("relative flex min-w-0", vertical ? "flex-col pb-5 last:pb-0" : "flex-1 flex-col items-center")}
            >
              {/* Connector to the next step: from this marker's centre to the next one. */}
              {nextStatus !== null && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute bg-[color-mix(in_srgb,var(--foreground)_14%,transparent)]",
                    vertical
                      ? cn("w-px", size === "sm" ? "left-3 top-8 bottom-1" : "left-3.5 top-9 bottom-1")
                      : cn("h-px", size === "sm" ? "left-[calc(50%+18px)] right-[calc(-50%+18px)] top-3" : "left-[calc(50%+20px)] right-[calc(-50%+20px)] top-3.5"),
                  )}
                >
                  <span
                    className={cn(
                      "absolute inset-0 origin-left bg-foreground transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none",
                      vertical && "origin-top",
                      lineDone ? "scale-100" : vertical ? "scale-y-0" : "scale-x-0",
                    )}
                  />
                </span>
              )}
              {clickable ? (
                <button type="button" onClick={() => onStepClick?.(i)} className={cn(inner, "cursor-pointer text-left hover:[&>span:first-child]:opacity-85", focusRing)}>
                  {body}
                </button>
              ) : (
                <div className={inner}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
