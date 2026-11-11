/** @registry part-of="knowns-core" */

/**
 * The colour roles semantic components share. `accent` follows `--kn-accent` (set it on any ancestor to recolour a region);
 * the others are fixed signal colours that hold up in light and dark.
 */
export type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

export const TONES: readonly Tone[] = ["neutral", "accent", "success", "warning", "danger"];
