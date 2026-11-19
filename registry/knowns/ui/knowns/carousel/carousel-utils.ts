/** @registry part-of="carousel" */
/** Pure parts of the carousel: which slide is first in view, and how far one step scrolls. */

/** Index of the first visible slide for a scroll position, clamped to the last start that still fills the view. */
export function activeIndex(scrollLeft: number, step: number, count: number, perView: number): number {
  if (step <= 0 || count <= 0) return 0;
  const last = Math.max(0, count - Math.max(1, perView));
  return Math.min(last, Math.max(0, Math.round(scrollLeft / step)));
}

/** The index the arrows and keys move to: one slide, kept inside 0 to the last start. */
export function stepIndex(from: number, dir: 1 | -1, count: number, perView: number): number {
  const last = Math.max(0, count - Math.max(1, perView));
  return Math.min(last, Math.max(0, from + dir));
}
