/** @registry part-of="display-heading" */
/** Pure helper for DisplayHeading: where the accent goes in a headline. No React. */

export type AccentDevice = "marker" | "word" | "stop" | "none";

/** The headline cut around the first match of `word`: [before, match, after]. No match, or an empty word, leaves the text whole. Case matters. */
export function splitAccent(text: string, word?: string): [string, string, string] {
  if (!word) return [text, "", ""];
  const i = text.indexOf(word);
  if (i < 0) return [text, "", ""];
  return [text.slice(0, i), word, text.slice(i + word.length)];
}

/** A headline without its closing full stop, so the "stop" device can draw its own. Only a single final period is removed. */
export function stripStop(text: string): string {
  return text.endsWith(".") && !text.endsWith("..") ? text.slice(0, -1) : text;
}
