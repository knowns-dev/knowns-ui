/* Pure helpers behind activity-feed: filters, the types a feed has, and the diff line. */

export type ActivityWho = "all" | "people" | "agents";

export interface ActivityLike {
  id: string;
  at: number;
  type: string;
  actor: { name: string; agent?: boolean };
}

/** Filter by who did it and by type. An empty `types` means every type. */
export function filterActivity<T extends ActivityLike>(items: readonly T[], who: ActivityWho, types: readonly string[] = []): T[] {
  return items
    .filter((i) => (who === "all" ? true : who === "agents" ? !!i.actor.agent : !i.actor.agent) && (types.length === 0 || types.includes(i.type)))
    .sort((a, b) => b.at - a.at);
}

/** The distinct types in a feed, most frequent first, then alphabetical. */
export function activityTypes(items: readonly { type: string }[]): string[] {
  const n = new Map<string, number>();
  for (const i of items) n.set(i.type, (n.get(i.type) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

/** "3 files, +42 -7" (zero sides left out). */
export function diffSummary(d: { files: number; added: number; removed: number }): string {
  const files = `${d.files} file${d.files === 1 ? "" : "s"}`;
  const lines = [d.added ? `+${d.added}` : "", d.removed ? `-${d.removed}` : ""].filter(Boolean).join(" ");
  return lines ? `${files}, ${lines}` : files;
}

/** Ids that arrived (not in `seen`) and are newer than everything seen: these are what the "N new" pill counts. */
export function newerThanSeen(items: readonly { id: string; at: number }[], seen: ReadonlySet<string>): string[] {
  let top = 0;
  for (const i of items) if (seen.has(i.id)) top = Math.max(top, i.at);
  return items.filter((i) => !seen.has(i.id) && i.at >= top).map((i) => i.id);
}

export function newPillText(count: number): string {
  return `${count} new`;
}
