/** @registry part-of="marquee" */

/**
 * The marquee's numbers: how long one loop takes for a steady speed, and how many equal groups the track needs so
 * the box is always covered. Pure, so they are tested without a browser.
 */

export type MarqueeSpeed = "slow" | "normal" | "fast";

/** Pixels per second for each speed. */
export const MARQUEE_PX_PER_SEC: Record<MarqueeSpeed, number> = { slow: 30, normal: 50, fast: 80 };

/** Seconds for one loop at a steady speed: wider tracks take longer, so speed feels the same. */
export function marqueeDuration(itemCount: number, speed: MarqueeSpeed = "normal", itemWidth = 160) {
  return Math.max(8, Math.round((itemCount * itemWidth) / MARQUEE_PX_PER_SEC[speed]));
}

/** Copies of the list needed so one track is at least `minItems` long (the marquee renders two tracks). */
export function marqueeCopies(itemCount: number, minItems = 8) {
  if (itemCount <= 0) return 0;
  return Math.max(1, Math.ceil(minItems / itemCount));
}

/**
 * Seconds for one loop of a measured group `length` px long. A `duration` you pass wins; a group that has not been
 * measured yet (0) falls back to the count-based guess.
 */
export function marqueeLoopSeconds(length: number, speed: MarqueeSpeed, count: number, duration?: number) {
  if (duration !== undefined && duration > 0) return duration;
  if (length <= 0) return marqueeDuration(count, speed);
  return Math.max(4, Math.round(length / MARQUEE_PX_PER_SEC[speed]));
}

/**
 * Equal groups the track holds: enough that one loop (one group) plus the box never leaves a gap, never fewer than
 * two. `box` and `group` are lengths in px along the loop's axis.
 */
export function marqueeSets(box: number, group: number) {
  if (box <= 0 || group <= 0) return 2;
  return Math.max(2, Math.ceil(box / group) + 1);
}
