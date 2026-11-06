/** Join class names, skipping anything that is not a non-empty string (false, null, 0…). */
export function cn(...classes: unknown[]) {
  return classes.filter((c): c is string => typeof c === "string" && c.length > 0).join(" ");
}

/** Shared focus ring for interactive elements. */
export const focusRing = "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
