/** Pure rules for RecordHeader: the line under the name, the key facts that fit, and the link behind a quick action. */

export type RecordKind = "contact" | "company";

/** "Head of Ops at Marlow Freight": role and company joined, whichever exist. A company shows its own line instead. */
export function subtitleOf(kind: RecordKind, o: { role?: string; company?: string; line?: string }): string {
  if (o.line?.trim()) return o.line.trim();
  if (kind === "company") return "";
  const role = o.role?.trim() ?? "";
  const company = o.company?.trim() ?? "";
  if (role && company) return `${role} at ${company}`;
  return role || company;
}

/** Initials for a name with no picture: first letters of the first two words, a company keeps one. */
export function initialsOf(name: string, kind: RecordKind): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const letters = kind === "company" ? [words[0]!] : words.slice(0, 2);
  return letters.map((w) => Array.from(w)[0]!.toUpperCase()).join("");
}

/** mailto: and tel: links. A value that is not shaped like an address or a number gives no link, so the button is not drawn. */
export function mailtoHref(email?: string): string | null {
  const v = email?.trim() ?? "";
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v) ? `mailto:${v}` : null;
}
export function telHref(phone?: string): string | null {
  const v = phone?.trim() ?? "";
  const digits = v.replace(/[^\d+]/g, "");
  return /^\+?\d{5,15}$/.test(digits) && /^[\d\s()+.-]+$/.test(v) ? `tel:${digits}` : null;
}

export interface Fact {
  label: string;
  value: string;
  href?: string;
}

/** Facts with a value, at most `max`; the rest are counted so the row can say "+2 more" in a tooltip. */
export function visibleFacts(facts: Fact[] | undefined, max = 5): { shown: Fact[]; hidden: Fact[] } {
  const all = (facts ?? []).filter((f) => f.label.trim() && f.value.trim());
  return { shown: all.slice(0, Math.max(0, max)), hidden: all.slice(Math.max(0, max)) };
}

/** Only web and mail links are followed from a fact: anything else (javascript:, data:) is shown as plain text. */
export function safeHref(href?: string): string | undefined {
  const v = href?.trim();
  return v && /^(https?:\/\/|mailto:|tel:|\/)/i.test(v) && !v.startsWith("//") ? v : undefined;
}
