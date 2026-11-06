/** @registry part-of="ghost-text" */
/**
 * Pure helpers for Ghost Text: how much of a suggestion is still ahead of what the user typed,
 * and how much a "word" accept takes. No React, so they are easy to test.
 */

/**
 * The part of `suggestion` still to show. `anchor` is the field's value when the suggestion arrived;
 * the suggestion continues it. Typing the same characters consumes the ghost; typing anything else,
 * deleting past the anchor or editing earlier text invalidates it (null).
 */
export function remainingGhost(anchor: string, suggestion: string, value: string): string | null {
  if (!suggestion) return null;
  const full = anchor + suggestion;
  if (value.length < anchor.length || !full.startsWith(value)) return null;
  const rest = full.slice(value.length);
  return rest || null;
}

/**
 * The next word of a ghost, for Ctrl/Cmd+Right: leading spaces plus the following run of word
 * characters, or a single punctuation mark, plus one trailing space when there is one.
 */
export function nextWord(ghost: string): string {
  const m = ghost.match(/^\s*(?:[\p{L}\p{N}_'-]+|[^\s\p{L}\p{N}_]+)\s?/u) ?? ghost.match(/^\s+/);
  return m ? m[0] : ghost;
}

/** Is the caret collapsed at the very end of the value? The ghost only shows there. */
export function caretAtEnd(value: string, start: number | null, end: number | null): boolean {
  return start !== null && start === end && start === value.length;
}

/** Screen-reader text for the hint referenced by aria-describedby. */
export function ghostHint(ghost: string | null, loading: boolean, word = true): string {
  if (loading && !ghost) return "Loading a suggestion.";
  if (!ghost) return "";
  return `Suggestion: ${ghost.trim()}. Press Tab to accept${word ? ", Control or Command plus Right Arrow to accept a word" : ""}, Escape to dismiss.`;
}
