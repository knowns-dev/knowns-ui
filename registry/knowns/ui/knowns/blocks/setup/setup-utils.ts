/** @registry part-of="setup-wizard" */
/**
 * Pure helpers for the Setup Wizard: which screen is showing and how a step maps to the URL.
 * No React, so tests and servers can use them.
 */

/** Keeps a step index inside 0..count-1 (0 when there are no steps or the value is not a number). */
export function clampStep(index: number, count: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), Math.max(count - 1, 0));
}

/** The index a URL value names (`?step=model`), or null when it names nothing. */
export function stepFromParam(value: string | null | undefined, ids: readonly string[]): number | null {
  if (!value) return null;
  const i = ids.indexOf(value);
  return i === -1 ? null : i;
}

/** What to show next to the steps: the wizard's own steps, a review screen, or the final success screen. */
export type WizardPhase = "step" | "review" | "success";

/** `count` steps, then an optional review screen at index `count`. `finished` wins. */
export function wizardPhase(index: number, count: number, hasReview: boolean, finished: boolean): WizardPhase {
  if (finished) return "success";
  return hasReview && index >= count ? "review" : "step";
}

/** The last screen's index: the last step, or the review screen after it. */
export const lastIndex = (count: number, hasReview: boolean) => Math.max(count - 1, 0) + (hasReview ? 1 : 0);

/** "Step 2 of 4". Counts the review screen as a step when there is one. */
export const stepCaption = (index: number, count: number, hasReview: boolean) => `Step ${index + 1} of ${count + (hasReview ? 1 : 0)}`;

/** The URL value for a screen: the step's id, or null on the review screen (it has no id of its own). */
export const paramForStepId = (ids: readonly string[], index: number): string | null => ids[index] ?? null;
