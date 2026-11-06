/** @registry part-of="agent-graph" */
import type { Actor } from "@/registry/knowns/lib/knowns/types";
import { rootAgent } from "@/registry/knowns/lib/knowns/status";

export type Tree = {
  parent: Map<string, string | null>;
  children: Map<string, string[]>;
  roots: string[];
  /** Deepest level, root = 0. */
  depth: number;
};

/**
 * Human on top → root agent → agents (through agent↔agent links) → tools under the
 * specialist agent that first talked to them. Parents are chosen by first-seen link
 * order (`seq`) so the tree does not reshuffle while spans stream in.
 */
export function buildTree(actors: Actor[], neighbors: Map<string, Set<string>>, seq: (a: string, b: string) => number): Tree {
  const byId = new Map(actors.map((a) => [a.id, a]));
  const parent = new Map<string, string | null>();
  const lead = rootAgent(actors);
  const human = actors.find((a) => a.type === "human");
  const agents = actors.filter((a) => a.type === "agent");

  const sorted = (from: string, pred: (a: Actor) => boolean) =>
    [...(neighbors.get(from) ?? [])]
      .filter((id) => byId.has(id) && pred(byId.get(id)!))
      .sort((x, y) => seq(from, x) - seq(from, y));

  if (human) parent.set(human.id, null);
  if (lead) parent.set(lead.id, human ? human.id : null);

  if (lead) {
    const queue = [lead.id];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const id of sorted(cur, (a) => a.type === "agent")) {
        if (parent.has(id)) continue;
        parent.set(id, cur);
        queue.push(id);
      }
    }
  }
  for (const a of agents) if (!parent.has(a.id)) parent.set(a.id, lead?.id ?? human?.id ?? null);

  for (const a of actors) {
    if (parent.has(a.id)) continue;
    const candidates = [...(neighbors.get(a.id) ?? [])].filter((id) => byId.get(id)?.type === "agent");
    const specialists = candidates.filter((id) => id !== lead?.id);
    const pool = specialists.length ? specialists : candidates;
    pool.sort((x, y) => seq(a.id, x) - seq(a.id, y));
    parent.set(a.id, pool[0] ?? lead?.id ?? human?.id ?? null);
  }

  const children = new Map<string, string[]>();
  const roots: string[] = [];
  for (const a of actors) {
    const p = parent.get(a.id) ?? null;
    if (p === null) roots.push(a.id);
    else {
      if (!children.has(p)) children.set(p, []);
      children.get(p)!.push(a.id);
    }
  }

  let depth = 0;
  const walk = (id: string, d: number) => {
    depth = Math.max(depth, d);
    for (const c of children.get(id) ?? []) walk(c, d + 1);
  };
  roots.forEach((r) => walk(r, 0));
  return { parent, children, roots, depth };
}
