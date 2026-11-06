/** @registry part-of="message-actions" */
/** Pure helpers for Message Actions. No React, so they are easy to test. */

export type Feedback = "up" | "down" | null;

/** Roving focus in a horizontal toolbar: the next index for a key, or null. Wraps around. */
export function toolbarKey(i: number, key: string, n: number): number | null {
  if (!n) return null;
  if (key === "ArrowRight") return (i + 1) % n;
  if (key === "ArrowLeft") return (i - 1 + n) % n;
  if (key === "Home") return 0;
  if (key === "End") return n - 1;
  return null;
}

/** The next version (1-based) when stepping, clamped to 1..total. */
export const stepVersion = (current: number, total: number, dir: 1 | -1) => Math.min(total, Math.max(1, current + dir));

/** Toggle a reason chip in the list. */
export const toggleReason = (list: string[], reason: string) => (list.includes(reason) ? list.filter((r) => r !== reason) : [...list, reason]);

/** Clicking the pressed thumb again clears it. */
export const nextFeedback = (current: Feedback, clicked: "up" | "down"): Feedback => (current === clicked ? null : clicked);

export const DEFAULT_REASONS = ["Not accurate", "Not what I asked", "Too long", "Out of date", "Unsafe or harmful"];
