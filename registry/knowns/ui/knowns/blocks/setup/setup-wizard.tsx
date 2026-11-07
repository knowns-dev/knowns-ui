"use client";
/** @registry name="setup-wizard" type="block" title="Setup wizard" description="A multi-step setup on the Stepper: per-step validation, Back, Next and Skip, a review step, a final success state, focus to the step heading and optional URL sync. Works in a page or a dialog." */
/**
 * Setup wizard: a stepper over one step at a time. Next runs the step's `validate` (sync or async) and stays put
 * with an alert when it returns a message; Back and finished steps in the stepper go back; optional steps can be
 * skipped. An optional review screen comes after the last step, then `onFinish` and a success state. The step is a
 * form, so Enter in a field moves on, and focus goes to the step heading on every change. Controlled with
 * `current` / `onCurrentChange`, or uncontrolled; `syncUrl="step"` keeps `?step=<id>` in the address bar.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Button } from "../../button";
import { Stepper, type Step } from "../../stepper";
import { clampStep, lastIndex, paramForStepId, stepCaption, stepFromParam, wizardPhase } from "./setup-utils";

export interface WizardStep {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  /** Shows "Optional" in the stepper and a Skip button. */
  optional?: boolean;
  /** Return a message to stay on this step, or null / undefined to go on. May be async. */
  validate?: () => string | null | undefined | Promise<string | null | undefined>;
  /** The fields or content of this step. */
  children: ReactNode;
}

export interface WizardReview {
  title?: ReactNode;
  description?: ReactNode;
  /** A summary of what was chosen. */
  children: ReactNode;
}

export interface WizardSuccess {
  title: ReactNode;
  description?: ReactNode;
  /** E.g. a link or button to open the product. */
  action?: ReactNode;
}

export interface SetupWizardProps {
  steps: WizardStep[];
  /** A review screen after the last step. Its Next button reads `finishLabel`. */
  review?: WizardReview;
  /** The screen after finishing. Without it, a short default is shown. */
  success?: WizardSuccess;
  /** Controlled step index (the review screen is index `steps.length`). */
  current?: number;
  defaultCurrent?: number;
  onCurrentChange?: (index: number) => void;
  /** Runs when the last screen is submitted. May be async: the button shows a spinner meanwhile. */
  onFinish?: () => void | Promise<void>;
  finishLabel?: string;
  /** Keeps the current step id in this query parameter (`?step=model`) and reads it on load. */
  syncUrl?: string;
  /** "plain" drops the card border and padding, for a wizard inside a Dialog or your own panel. */
  variant?: "card" | "plain";
  className?: string;
  "aria-label"?: string;
}

/** A stepper-led setup flow with validation, review and success. */
export function SetupWizard({
  steps,
  review,
  success,
  current,
  defaultCurrent = 0,
  onCurrentChange,
  onFinish,
  finishLabel = "Finish",
  syncUrl,
  variant = "card",
  className,
  "aria-label": ariaLabel = "Setup",
}: SetupWizardProps) {
  const count = steps.length;
  const hasReview = Boolean(review);
  const last = lastIndex(count, hasReview);
  const ids = steps.map((s) => s.id);
  const [own, setOwn] = useState(() => clampStep(defaultCurrent, last + 1));
  const index = clampStep(current ?? own, last + 1);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  const go = (to: number) => {
    const next = clampStep(to, last + 1);
    setError(null);
    moved.current = true;
    if (current === undefined) setOwn(next);
    onCurrentChange?.(next);
    if (syncUrl && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const id = paramForStepId(ids, next);
      if (id) url.searchParams.set(syncUrl, id);
      else url.searchParams.delete(syncUrl);
      window.history.replaceState(null, "", url);
    }
  };

  // Read ?step= once, after mount, so server and client markup match.
  useEffect(() => {
    if (!syncUrl) return;
    const i = stepFromParam(new URLSearchParams(window.location.search).get(syncUrl), ids);
    if (i !== null && i !== index) {
      if (current === undefined) setOwn(i);
      onCurrentChange?.(i);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus the heading when the screen changes (not on first render).
  useEffect(() => {
    if (moved.current) headingRef.current?.focus();
  }, [index, finished]);

  const phase = wizardPhase(index, count, hasReview, finished);
  const step = steps[index];
  const isLast = index === last;

  const next = async () => {
    if (busy) return;
    if (phase === "step" && step?.validate) {
      setBusy(true);
      let message: string | null | undefined;
      try {
        message = await step.validate();
      } finally {
        setBusy(false);
      }
      if (message) {
        setError({ id: step.id, message });
        return;
      }
    }
    if (!isLast) return go(index + 1);
    setBusy(true);
    try {
      await onFinish?.();
      moved.current = true;
      setFinished(true);
    } finally {
      setBusy(false);
    }
  };

  const stepperSteps: Step[] = [
    ...steps.map((s): Step => ({ id: s.id, title: s.title, description: s.description, optional: s.optional, status: error?.id === s.id ? "error" : undefined })),
    ...(review ? [{ id: "review", title: review.title ?? "Review" } as Step] : []),
  ];
  const stepperCurrent = finished ? stepperSteps.length : index;

  return (
    <section aria-label={ariaLabel} className={cn("@container w-full", variant === "card" && "rounded-xl border bg-card p-4 text-card-foreground sm:p-6", className)}>
      <div className="hidden @[34rem]:block">
        <Stepper steps={stepperSteps} current={stepperCurrent} onStepClick={finished ? undefined : go} aria-label={`${ariaLabel} progress`} />
      </div>
      <div className="@[34rem]:hidden">
        <Stepper steps={stepperSteps} current={stepperCurrent} onStepClick={finished ? undefined : go} orientation="vertical" size="sm" aria-label={`${ariaLabel} progress`} />
      </div>

      <div className="mt-6 border-t pt-6">
        {phase === "success" ? (
          <div role="status" className="flex flex-col items-start gap-1">
            <h3 ref={headingRef} tabIndex={-1} className={cn("rounded-sm text-[18px] leading-7 font-semibold text-foreground outline-none", focusRing)}>
              {success?.title ?? "Setup complete"}
            </h3>
            <p className="text-[14px] leading-5 text-muted-foreground">{success?.description ?? "Everything is saved. You can change any of it later in Settings."}</p>
            {success?.action && <div className="mt-3">{success.action}</div>}
          </div>
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void next();
            }}
          >
            <p className="text-[12.5px] text-muted-foreground">{stepCaption(index, count, hasReview)}</p>
            <h3 ref={headingRef} tabIndex={-1} className={cn("mt-0.5 rounded-sm text-[18px] leading-7 font-semibold text-foreground outline-none", focusRing)}>
              {phase === "review" ? (review?.title ?? "Review") : step?.title}
            </h3>
            {(phase === "review" ? review?.description : step?.description) && (
              <p className="mt-1 text-[14px] leading-5 text-muted-foreground">{phase === "review" ? review?.description : step?.description}</p>
            )}
            <div className="mt-4">{phase === "review" ? review?.children : step?.children}</div>
            {error && error.id === step?.id && (
              <p role="alert" className="mt-3 text-[13.5px] leading-5 text-red-600 dark:text-red-400">
                {error.message}
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" disabled={index === 0 || busy} onClick={() => go(index - 1)}>
                Back
              </Button>
              <Button type="submit" loading={busy}>
                {isLast ? finishLabel : "Next"}
              </Button>
              {phase === "step" && step?.optional && !isLast && (
                <Button type="button" variant="quiet" disabled={busy} onClick={() => go(index + 1)}>
                  Skip
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
