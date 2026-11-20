/** @registry part-of="dither-field" */
/** Pure parts of the dither field: the dot pitch for a size and density, and a stable key for the clear box. */
import type { BgClear } from "./bg-canvas";
import { densityScale, type BgDensity } from "./bg-utils";

/** Dot pitch in CSS px: the cell size shrunk by density (more density, finer dots), kept between 2 and `max`. */
export function ditherPitch(size: number, density: BgDensity | undefined, max: number): number {
  return Math.min(max, Math.max(2, size / Math.sqrt(densityScale(density))));
}

/** A stable key for the `clear` prop, so an inline { x, y, w, h } does not rebuild the field every render. */
export function clearKey(clear: BgClear): string {
  return typeof clear === "object" ? `${clear.x},${clear.y},${clear.w},${clear.h}` : String(clear);
}
