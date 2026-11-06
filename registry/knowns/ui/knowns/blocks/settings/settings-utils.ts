/** @registry part-of="settings-layout" */
/**
 * Pure helpers for the Settings blocks: validation, masking, team role rules, the notification matrix,
 * dirty tracking and the words shown for dates, money and statuses. No React, so tests and servers can use them.
 */

/** What every settings callback resolves to. `message` is shown on success ("Saved."), `error` on failure. */
export type SettingsResult = { ok: true; message?: string } | { ok: false; error: string };

/** A thrown error (offline, 500) as a SettingsResult, so a form never gets stuck saving. */
export async function settleResult<T extends SettingsResult>(p: Promise<T> | T): Promise<T | { ok: false; error: string }> {
  try {
    return await p;
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : "Could not save. Check your connection and try again." };
  }
}

/* ── Dirty tracking ── */

/** Keys whose values differ (=== per key, arrays and plain objects compared by JSON). */
export function changedKeys<T extends Record<string, unknown>>(saved: T, draft: T): (keyof T)[] {
  const keys = new Set<keyof T>([...Object.keys(saved), ...Object.keys(draft)] as (keyof T)[]);
  const same = (a: unknown, b: unknown) => a === b || (typeof a === "object" && a !== null && typeof b === "object" && b !== null && JSON.stringify(a) === JSON.stringify(b));
  return [...keys].filter((k) => !same(saved[k], draft[k]));
}

export const isDirty = <T extends Record<string, unknown>>(saved: T, draft: T) => changedKeys(saved, draft).length > 0;

/* ── Profile ── */

/** 3 to 30 characters: lowercase letters, digits, "-" and "_", starting with a letter or digit. Null when fine. */
export function usernameError(raw: string): string | null {
  const s = raw.trim();
  if (s.length < 3) return "Use at least 3 characters.";
  if (s.length > 30) return "Use at most 30 characters.";
  if (/[A-Z]/.test(s)) return "Use lowercase letters only.";
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(s)) return "Use letters, digits, - and _, starting with a letter or digit.";
  if (/[-_]$/.test(s)) return "Don't end with - or _.";
  return null;
}

/** The phrase the user types to confirm a destructive action. Case- and space-insensitive at the ends. */
export const confirmMatches = (typed: string, phrase: string) => typed.trim().toLowerCase() === phrase.trim().toLowerCase();

/** Accepts image files up to `maxMb`. Null when fine. */
export function avatarFileError(file: { type: string; size: number }, maxMb = 2): string | null {
  if (!/^image\/(png|jpe?g|webp|gif|avif)$/.test(file.type)) return "Use a PNG, JPG, WebP, GIF or AVIF image.";
  if (file.size > maxMb * 1024 * 1024) return `Use an image up to ${maxMb} MB.`;
  return null;
}

/* ── API keys ── */

export interface ApiKey {
  id: string;
  name: string;
  /** The public start of the key, e.g. "kn_live". */
  prefix: string;
  /** Last 4 characters, to tell keys apart. */
  last4: string;
  scopes: string[];
  createdAt: Date | string | number;
  lastUsedAt?: Date | string | number | null;
  expiresAt?: Date | string | number | null;
}

/** "kn_live_••••a1b2". */
export const maskKey = (k: Pick<ApiKey, "prefix" | "last4">) => `${k.prefix}_••••${k.last4}`;

/** Key names: trimmed, 1 to 60 characters. Null when fine. */
export function keyNameError(raw: string, taken: string[] = []): string | null {
  const s = raw.trim();
  if (!s) return "Give the key a name.";
  if (s.length > 60) return "Use at most 60 characters.";
  if (taken.some((t) => t.trim().toLowerCase() === s.toLowerCase())) return "A key with this name already exists.";
  return null;
}

export type KeyState = "active" | "expiring" | "expired";

/** Expired, expiring within 7 days, or active. */
export function keyState(k: Pick<ApiKey, "expiresAt">, now: number): KeyState {
  const t = time(k.expiresAt);
  if (t === null) return "active";
  if (t <= now) return "expired";
  return t - now < 7 * DAY ? "expiring" : "active";
}

/* ── Team ── */

export type TeamRole = "owner" | "admin" | "member" | "viewer";

export const ROLE_LABEL: Record<TeamRole, string> = { owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" };
export const ROLE_HINT: Record<TeamRole, string> = {
  owner: "Everything, including billing and deleting the team",
  admin: "Manage members and settings",
  member: "Use and edit everything in the team",
  viewer: "Read-only access",
};

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  avatarUrl?: string;
  joinedAt?: Date | string | number;
}

export interface TeamInvite {
  email: string;
  role: TeamRole;
  sentAt: Date | string | number;
}

const owners = (members: TeamMember[]) => members.filter((m) => m.role === "owner");

/** Why `actor` can't give `target` this role, or null. Owners and admins manage; only owners touch owners. */
export function roleChangeError(members: TeamMember[], actorId: string, targetId: string, role: TeamRole): string | null {
  const actor = members.find((m) => m.id === actorId);
  const target = members.find((m) => m.id === targetId);
  if (!actor || !target) return "That member is no longer on the team.";
  if (actorId === targetId) return "You can't change your own role. Ask another owner.";
  if (actor.role !== "owner" && actor.role !== "admin") return "Only owners and admins can change roles.";
  if ((target.role === "owner" || role === "owner") && actor.role !== "owner") return "Only owners can grant or remove the owner role.";
  if (target.role === "owner" && role !== "owner" && owners(members).length <= 1) return "A team needs at least one owner.";
  return null;
}

/** Why `actor` can't remove `target`, or null. Leaving yourself is allowed unless you are the last owner. */
export function removeError(members: TeamMember[], actorId: string, targetId: string): string | null {
  const actor = members.find((m) => m.id === actorId);
  const target = members.find((m) => m.id === targetId);
  if (!actor || !target) return "That member is no longer on the team.";
  if (target.role === "owner" && owners(members).length <= 1) return "A team needs at least one owner.";
  if (actorId === targetId) return null;
  if (actor.role !== "owner" && actor.role !== "admin") return "Only owners and admins can remove members.";
  if (target.role === "owner" && actor.role !== "owner") return "Only owners can remove an owner.";
  return null;
}

/** Roles `actor` may assign: admins can't hand out owner. */
export const assignableRoles = (actorRole: TeamRole): TeamRole[] => (actorRole === "owner" ? ["owner", "admin", "member", "viewer"] : actorRole === "admin" ? ["admin", "member", "viewer"] : []);

/** Splits pasted addresses on commas, semicolons, spaces and newlines; lowercases and de-duplicates. */
export function parseEmails(input: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of input.split(/[\s,;]+/)) {
    const e = raw.trim().replace(/^<|>$/g, "").toLowerCase();
    if (!e) continue;
    const list = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? valid : invalid;
    if (!list.includes(e)) list.push(e);
  }
  return { valid, invalid };
}

/** Emails that are already members or invited. */
export function alreadyOnTeam(emails: string[], members: TeamMember[], invites: TeamInvite[]): string[] {
  const known = new Set([...members.map((m) => m.email.toLowerCase()), ...invites.map((i) => i.email.toLowerCase())]);
  return emails.filter((e) => known.has(e.toLowerCase()));
}

/* ── Notifications ── */

export type NotificationMatrix = Record<string, Record<string, boolean>>;
export type RowState = "all" | "none" | "some";

/** Whether a row (one event) is on for every channel, none, or some. Channels a row doesn't offer are ignored. */
export function rowState(matrix: NotificationMatrix, eventId: string, channels: string[]): RowState {
  const row = matrix[eventId] ?? {};
  const on = channels.filter((c) => row[c]).length;
  return on === 0 ? "none" : on === channels.length ? "all" : "some";
}

/** One cell. Returns a new matrix. */
export const setCell = (matrix: NotificationMatrix, eventId: string, channel: string, on: boolean): NotificationMatrix => ({
  ...matrix,
  [eventId]: { ...(matrix[eventId] ?? {}), [channel]: on },
});

/** A whole row on or off. */
export const setRow = (matrix: NotificationMatrix, eventId: string, channels: string[], on: boolean): NotificationMatrix => ({
  ...matrix,
  [eventId]: { ...(matrix[eventId] ?? {}), ...Object.fromEntries(channels.map((c) => [c, on])) },
});

/** A whole channel (column) on or off, e.g. "turn off all email". */
export const setColumn = (matrix: NotificationMatrix, eventIds: string[], channel: string, on: boolean): NotificationMatrix =>
  eventIds.reduce((m, id) => setCell(m, id, channel, on), matrix);

/** "22:00" → minutes after midnight, or null. */
export function parseClock(s: string): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Quiet hours that wrap past midnight are fine ("22:00" to "07:00"). Same start and end is not. */
export function quietHoursError(from: string, to: string): string | null {
  const a = parseClock(from);
  const b = parseClock(to);
  if (a === null || b === null) return "Use a time like 22:00.";
  if (a === b) return "Start and end can't be the same.";
  return null;
}

/* ── Billing ── */

export type PlanStatus = "active" | "trialing" | "past_due" | "canceled";
export type InvoiceStatus = "paid" | "open" | "void" | "uncollectible" | "refunded";

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = { active: "Active", trialing: "Trial", past_due: "Payment due", canceled: "Canceled" };
export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = { paid: "Paid", open: "Open", void: "Void", uncollectible: "Uncollectible", refunded: "Refunded" };

export function money(cents: number, currency = "usd", locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase(), minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
}

/** "Visa", "Mastercard" from Stripe-style brand ids. */
export function cardBrand(brand: string): string {
  const b = brand.toLowerCase();
  return ({ visa: "Visa", mastercard: "Mastercard", amex: "American Express", discover: "Discover", jcb: "JCB", unionpay: "UnionPay", diners: "Diners Club" } as Record<string, string>)[b] ?? brand;
}

/** A card that expires this month or earlier. */
export const cardExpired = (expMonth: number, expYear: number, now: number) => {
  const d = new Date(now);
  return expYear < d.getUTCFullYear() || (expYear === d.getUTCFullYear() && expMonth < d.getUTCMonth() + 1);
};

/** 0..1 of a usage limit; null limit = unlimited (0). */
export const usageRatio = (used: number, limit: number | null) => (!limit ? 0 : Math.min(1, Math.max(0, used / limit)));

/* ── Time ── */

const DAY = 86_400_000;

export const time = (t: Date | string | number | null | undefined): number | null => {
  if (t === null || t === undefined || t === "") return null;
  const n = new Date(t).getTime();
  return Number.isFinite(n) ? n : null;
};

/** "Nov 6, 2026", in UTC so server and client render the same text. */
export function shortDate(t: Date | string | number | null | undefined, locale = "en-US"): string {
  const n = time(t);
  return n === null ? "" : new Date(n).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** "Never", "Today", "Yesterday", "5 days ago", then a short date. */
export function lastUsed(t: Date | string | number | null | undefined, now: number, locale = "en-US"): string {
  const n = time(t);
  if (n === null) return "Never";
  const days = Math.floor((now - n) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return shortDate(n, locale);
}
