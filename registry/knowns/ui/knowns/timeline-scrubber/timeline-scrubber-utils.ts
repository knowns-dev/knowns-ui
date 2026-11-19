/** Pure logic for the timeline scrubber: snapping a value, value to position and back, the ticks, keyboard moves and keeping the card inside the track. */

/** Rounds `value` to the nearest `step` counted from `min`, kept inside [min, max]. A bad step or range gives `min`. */
export function snap(value: number, min: number, max: number, step: number): number {
  if (!Number.isFinite(value) || !(max > min)) return min;
  const s = step > 0 ? step : 0;
  const v = s ? min + Math.round((value - min) / s) * s : value;
  // Rounding in floating point can leave dust like 0.30000000000000004; trim to the step's precision.
  const digits = s ? Math.min(10, (String(s).split(".")[1] ?? "").length) : 6;
  return Math.min(max, Math.max(min, Number(v.toFixed(digits))));
}

/** Where a value sits on the track, 0 to 100 (percent of its width). */
export function toPercent(value: number, min: number, max: number): number {
  if (!(max > min)) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

/** The value under a pointer: `ratio` is 0 to 1 across the track, snapped to the step. */
export function fromRatio(ratio: number, min: number, max: number, step: number): number {
  const r = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  return snap(min + r * (max - min), min, max, step);
}

/** The tick values from `min` to `max`, every `every`. Always includes both ends, so a range that is not a whole number of steps still closes. */
export function buildTicks(min: number, max: number, every: number): number[] {
  if (!(max > min)) return [min];
  if (!(every > 0)) return [min, max];
  const out: number[] = [];
  const n = Math.floor((max - min) / every + 1e-9);
  for (let i = 0; i <= n; i++) out.push(snap(min + i * every, min, max, 0));
  if (out[out.length - 1] !== max) out.push(max);
  return out;
}

/** The value after a key press, or null when the key does nothing: arrows by `step`, Page Up and Down by `big`, Home and End to the ends. */
export function moveValue(key: string, value: number, min: number, max: number, step: number, big: number): number | null {
  const s = step > 0 ? step : (max - min) / 100;
  const b = big > 0 ? big : s * 10;
  let next: number;
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      next = value + s;
      break;
    case "ArrowLeft":
    case "ArrowDown":
      next = value - s;
      break;
    case "PageUp":
      next = value + b;
      break;
    case "PageDown":
      next = value - b;
      break;
    case "Home":
      next = min;
      break;
    case "End":
      next = max;
      break;
    default:
      return null;
  }
  return snap(next, min, max, step);
}

/**
 * How far to nudge a card, in px, so it stays inside the track. The card is centred on the marker at `ratio`
 * (0 to 1) across a track `trackWidth` wide; the result is 0 while it fits and shifts it back by the overhang
 * otherwise, keeping `pad` px from each edge. A card wider than the track is centred.
 */
export function cardShift(ratio: number, cardWidth: number, trackWidth: number, pad = 0): number {
  if (!(trackWidth > 0) || !(cardWidth > 0)) return 0;
  const free = trackWidth - cardWidth - pad * 2;
  if (free < 0) return trackWidth / 2 - ratio * trackWidth;
  const left = ratio * trackWidth - cardWidth / 2;
  return Math.min(trackWidth - cardWidth - pad, Math.max(pad, left)) - left;
}
