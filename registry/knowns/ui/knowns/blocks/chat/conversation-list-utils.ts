/** @registry part-of="conversation-list" */
/** Pure helpers for the conversation list: grouping, pinned, search, rename and keyboard moves. No React. */

export type ChatTime = number | Date | string;

export interface ChatConversationLike {
  id: string;
  title: string;
  /** Last activity; decides the Today / Yesterday / Earlier group. */
  updatedAt: ChatTime;
  /** Kept at the top in its own "Pinned" group. */
  pinned?: boolean;
}

export type ConversationGroupLabel = "Pinned" | "Today" | "Yesterday" | "Earlier";

export interface ConversationGroup<T extends ChatConversationLike> {
  label: ConversationGroupLabel;
  items: T[];
}

export const toTime = (t: ChatTime): number => (typeof t === "number" ? t : typeof t === "string" ? Date.parse(t) : t.getTime());

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Which day group a time falls in, by calendar day in local time. */
export function groupLabel(time: ChatTime, now: ChatTime = Date.now()): Exclude<ConversationGroupLabel, "Pinned"> {
  const today = startOfDay(toTime(now));
  const t = toTime(time);
  if (t >= today) return "Today";
  const yesterday = startOfDay(today - 1);
  if (t >= yesterday) return "Yesterday";
  return "Earlier";
}

const ORDER: ConversationGroupLabel[] = ["Pinned", "Today", "Yesterday", "Earlier"];

/** Newest first: pinned ones in their own group, the rest grouped Today / Yesterday / Earlier. Empty groups are left out. */
export function groupConversations<T extends ChatConversationLike>(conversations: T[], now: ChatTime = Date.now()): ConversationGroup<T>[] {
  const sorted = [...conversations].sort((a, b) => toTime(b.updatedAt) - toTime(a.updatedAt));
  const by = new Map<ConversationGroupLabel, T[]>();
  for (const c of sorted) {
    const label = c.pinned ? "Pinned" : groupLabel(c.updatedAt, now);
    by.set(label, [...(by.get(label) ?? []), c]);
  }
  return ORDER.filter((l) => by.has(l)).map((label) => ({ label, items: by.get(label)! }));
}

/** A rename is kept only when it has text and differs from the old title. Returns the trimmed title or null. */
export function cleanTitle(next: string, previous: string): string | null {
  const t = next.replace(/\s+/g, " ").trim().slice(0, 120);
  return t && t !== previous ? t : null;
}

/** Where focus lands after a conversation is deleted: the next one in list order, else the previous, else none. */
export function nextAfterDelete<T extends { id: string }>(ordered: T[], removedId: string): string | null {
  const i = ordered.findIndex((c) => c.id === removedId);
  if (i === -1) return ordered[0]?.id ?? null;
  return ordered[i + 1]?.id ?? ordered[i - 1]?.id ?? null;
}

/** Conversations whose title contains every word of `query` (case and accents ignored). An empty query keeps all. */
export function filterConversations<T extends { title: string }>(conversations: T[], query: string): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return conversations;
  return conversations.filter((c) => {
    const t = fold(c.title);
    return words.every((w) => t.includes(w));
  });
}
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** The index a key moves to in a list of `count` rows, or null for other keys. Does not wrap. */
export function moveIndex(key: string, current: number, count: number): number | null {
  if (!count) return null;
  if (key === "ArrowDown") return Math.min(count - 1, current + 1);
  if (key === "ArrowUp") return Math.max(0, current - 1);
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}
