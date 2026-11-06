/**
 * A small, forgiving parser for model answers: paragraphs (blank lines), "- " lists,
 * **bold**, `code` and citations like [1] or [1, 3]. It copes with half-streamed text:
 * an unclosed ** or ` runs to the end, and a citation still being typed is hidden.
 */

export type Inline =
  | { kind: "text" | "bold" | "code"; text: string }
  | { kind: "cite"; refs: number[] };

export type Block = { kind: "p"; inline: Inline[] } | { kind: "ul"; items: Inline[][] };

const INLINE = /\*\*([^*]*)(?:\*\*)?|`([^`]*)`?|\[(\d+(?:\s*,\s*\d+)*)\]/g;

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of s.matchAll(INLINE)) {
    if (m.index > last) out.push({ kind: "text", text: s.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ kind: "bold", text: m[1] });
    else if (m[2] !== undefined) out.push({ kind: "code", text: m[2] });
    else out.push({ kind: "cite", refs: m[3].split(",").map((n) => Number(n.trim())) });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ kind: "text", text: s.slice(last) });
  return out;
}

export function parseAnswer(text: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of text.split(/\n\s*\n/)) {
    const lines = chunk.split("\n").filter((l) => l.trim());
    let para: string[] = [];
    let list: string[] = [];
    const flushPara = () => {
      if (para.length) blocks.push({ kind: "p", inline: parseInline(para.join(" ")) });
      para = [];
    };
    const flushList = () => {
      if (list.length) blocks.push({ kind: "ul", items: list.map(parseInline) });
      list = [];
    };
    for (const l of lines) {
      if (/^\s*[-*•]\s+/.test(l)) {
        flushPara();
        list.push(l.replace(/^\s*[-*•]\s+/, ""));
      } else {
        flushList();
        para.push(l.trim());
      }
    }
    flushPara();
    flushList();
  }
  return blocks;
}

/** Character offset where the first `n` words end (citations count as one word). */
export function wordPrefix(text: string, n: number): string {
  if (n <= 0) return "";
  let count = 0;
  for (const m of text.matchAll(/\[[\d,\s]+\]|\S+\s*/g)) {
    count++;
    if (count === n) return text.slice(0, m.index + m[0].length);
  }
  return text;
}

export const countWords = (text: string) => (text.match(/\[[\d,\s]+\]|\S+\s*/g) ?? []).length;

/** Hide a citation that is still being typed, e.g. a trailing "[1" or "[1, ". */
export const trimPartialCite = (s: string) => s.replace(/\[[\d,\s]*$/, "");

/** Plain text for the clipboard: no markup, citations kept as [n], then a numbered source list. */
export function toPlainText(text: string, sources: { title: string; site: string; url?: string }[]) {
  const body = text.replace(/\*\*([^*]*)\*\*/g, "$1").replace(/`([^`]*)`/g, "$1").trim();
  if (!sources.length) return body;
  const list = sources.map((s, i) => `${i + 1}. ${s.title} - ${s.site}${s.url ? ` (${s.url})` : ""}`).join("\n");
  return `${body}\n\nSources:\n${list}`;
}
