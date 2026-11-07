/** @registry part-of="cookie-consent" */
/**
 * Pure helpers for Cookie Consent: building a choice, saving and reading it, and the event that reopens the
 * preferences. No React, so tests, servers and your own script loader can use them (e.g. `readConsent` before
 * adding an analytics script).
 */

export interface ConsentCategoryLike {
  id: string;
  /** Always on and cannot be turned off (strictly necessary cookies). */
  required?: boolean;
}

/** One boolean per category id. */
export type ConsentChoice = Record<string, boolean>;

/** Bump when the meaning of the categories changes: everyone is asked again. */
export const CONSENT_VERSION = 1;

/** Dispatched on `window` by `openCookiePreferences()`; the block listens for it. */
export const CONSENT_EVENT = "kn:cookie-preferences";

/** Everything on. */
export const acceptAll = (categories: readonly ConsentCategoryLike[]): ConsentChoice => Object.fromEntries(categories.map((c) => [c.id, true]));

/** Only the required categories on: rejecting is one click, never harder than accepting. */
export const rejectAll = (categories: readonly ConsentCategoryLike[]): ConsentChoice => Object.fromEntries(categories.map((c) => [c.id, Boolean(c.required)]));

/** A complete choice from a partial one: required categories forced on, unknown ids dropped, missing ones off. */
export function normalizeChoice(categories: readonly ConsentCategoryLike[], partial: Record<string, boolean | undefined>): ConsentChoice {
  return Object.fromEntries(categories.map((c) => [c.id, c.required ? true : partial[c.id] === true]));
}

export interface StoredConsent {
  version: number;
  choice: ConsentChoice;
  /** ISO time of the choice. */
  at: string;
}

export const serializeConsent = (choice: ConsentChoice, now = new Date(), version = CONSENT_VERSION): string => JSON.stringify({ version, choice, at: now.toISOString() } satisfies StoredConsent);

/**
 * The saved choice, or null when there is none, it is unreadable, it is from another version, or a category was
 * added since (then people are asked again).
 */
export function parseConsent(raw: string | null | undefined, categories: readonly ConsentCategoryLike[], version = CONSENT_VERSION): StoredConsent | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const { version: v, choice, at } = data as Partial<StoredConsent>;
  if (v !== version || !choice || typeof choice !== "object" || typeof at !== "string") return null;
  if (!categories.every((c) => typeof (choice as Record<string, unknown>)[c.id] === "boolean")) return null;
  return { version: v, choice: normalizeChoice(categories, choice), at };
}

/** The saved choice from a storage, or null. Never throws (storage can be blocked). */
export function readConsent(storage: Pick<Storage, "getItem"> | null | undefined, key: string, categories: readonly ConsentCategoryLike[]): ConsentChoice | null {
  try {
    return parseConsent(storage?.getItem(key), categories)?.choice ?? null;
  } catch {
    return null;
  }
}

/** Saves a choice. Returns false when storage is blocked or full. */
export function writeConsent(storage: Pick<Storage, "setItem"> | null | undefined, key: string, choice: ConsentChoice, now = new Date()): boolean {
  try {
    storage?.setItem(key, serializeConsent(choice, now));
    return Boolean(storage);
  } catch {
    return false;
  }
}

/** Opens the preferences dialog from anywhere, e.g. a "Cookie settings" link in the footer. */
export function openCookiePreferences(target: EventTarget | undefined = typeof window === "undefined" ? undefined : window) {
  target?.dispatchEvent(new Event(CONSENT_EVENT));
}
