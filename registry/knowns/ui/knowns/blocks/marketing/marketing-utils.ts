/** @registry part-of="marketing-core" */
/**
 * Pure helpers for the marketing blocks (Hero, Logo Cloud, Feature Grid / Split, Stats Band, CTA):
 * scroll tilt, marquee timing, bento spans, row sides and the shared action type. No React.
 */

export interface MarketingAction {
  label: string;
  href?: string;
  onClick?: () => void;
  /** Opens in a new tab with rel="noreferrer". */
  external?: boolean;
}

/* ── Product shot tilt ── */

/**
 * How far an element has travelled through the viewport: 0 when its top meets the bottom edge,
 * 1 once its top reaches `settle` of the viewport height (default 35% from the top). Clamped.
 */
export function scrollProgress(top: number, viewport: number, settle = 0.35) {
  if (viewport <= 0) return 1;
  const start = viewport;
  const end = viewport * settle;
  const p = (start - top) / (start - end);
  return Math.min(1, Math.max(0, p));
}

/** Tilt in degrees for a progress: `max` at 0, flat at 1, eased out so it settles softly. */
export function tiltFor(progress: number, max = 14) {
  const p = Math.min(1, Math.max(0, progress));
  const eased = 1 - (1 - p) ** 3;
  return +(max * (1 - eased)).toFixed(2);
}

/* ── Marquee ── */

/** Seconds for one loop at a steady speed: wider tracks take longer, so speed feels the same. */
export function marqueeDuration(itemCount: number, speed: "slow" | "normal" | "fast" = "normal", itemWidth = 160) {
  const pxPerSec = speed === "slow" ? 30 : speed === "fast" ? 80 : 50;
  return Math.max(8, Math.round((itemCount * itemWidth) / pxPerSec));
}

/** Copies of the list needed so one track is at least `minItems` long (the marquee renders two tracks). */
export function marqueeCopies(itemCount: number, minItems = 8) {
  if (itemCount <= 0) return 0;
  return Math.max(1, Math.ceil(minItems / itemCount));
}

/* ── Bento ── */

export type BentoSize = "sm" | "wide" | "tall" | "lg";

/** Grid spans for a bento cell in a 4-column (3 on tablets) grid. */
/** Span classes for a bento cell. Container queries (@xl = 576px), so the grid fits the space it is given, not the viewport. */
export function bentoSpan(size: BentoSize = "sm") {
  switch (size) {
    case "wide":
      return "@xl:col-span-2";
    case "tall":
      return "@xl:row-span-2";
    case "lg":
      return "@xl:col-span-2 @xl:row-span-2";
    default:
      return "";
  }
}

/** Cells a bento layout uses, to check that a set of sizes fills whole rows of `cols`. */
export function bentoArea(sizes: BentoSize[]) {
  return sizes.reduce((n, s) => n + (s === "lg" ? 4 : s === "wide" || s === "tall" ? 2 : 1), 0);
}

/* ── Feature split ── */

/** Which side the media sits on for row i: alternating, starting on the right unless `start` is "left". */
export function mediaSide(i: number, start: "left" | "right" = "right"): "left" | "right" {
  const flip = i % 2 === 1;
  return (start === "right") !== flip ? "right" : "left";
}

/* ── Stats ── */

/** Splits "12.5k", "99.9%", "$4M", "3x" into the number to tick and the text around it. */
export function parseStat(text: string): { prefix: string; value: number; decimals: number; suffix: string } | null {
  const m = /^([^0-9-]*)(-?\d[\d,]*(?:\.\d+)?)(.*)$/.exec(text.trim());
  if (!m) return null;
  const raw = m[2].replace(/,/g, "");
  const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;
  return { prefix: m[1], value: Number(raw), decimals, suffix: m[3] };
}

/* ── Copy ── */

/** A shell command chip's copy text: trims a leading "$ " prompt. */
export function commandText(cmd: string) {
  return cmd.replace(/^\s*\$\s+/, "").trim();
}
