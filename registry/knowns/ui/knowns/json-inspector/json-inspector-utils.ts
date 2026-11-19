/** @registry part-of="json-inspector" */

/* ── Types ── */

export type JsonType = "object" | "array" | "string" | "number" | "boolean" | "null";

/** One step of a path: an object key or an array index. */
export type PathPart = string | number;

/** One visible line of the tree. A container that is open also gets a closing row (`close: true`). */
export interface JsonRow {
  /** Stable id: the path joined with a separator that cannot appear in a part. */
  id: string;
  path: PathPart[];
  depth: number;
  /** The key or index this value sits under; undefined for the root. */
  name?: PathPart;
  type: JsonType;
  value: unknown;
  /** Number of keys or items for a container, 0 otherwise. */
  size: number;
  /** True for a container that is open. */
  open: boolean;
  /** The closing `}` or `]` row of an open container. */
  close?: boolean;
  /** Last child of its parent: no trailing comma. */
  last: boolean;
}

export type JsonParse = { ok: true; value: unknown } | { ok: false; error: JsonError };

export interface JsonError {
  message: string;
  /** 0-based offset into the text. */
  offset: number;
  /** 1-based. */
  line: number;
  /** 1-based. */
  column: number;
}

/* ── Types and ids ── */

export function typeOf(v: unknown): JsonType {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return "array";
  const t = typeof v;
  if (t === "object") return "object";
  if (t === "string") return "string";
  if (t === "number" || t === "bigint") return "number";
  if (t === "boolean") return "boolean";
  return "string";
}

export const isContainer = (t: JsonType) => t === "object" || t === "array";

const SEP = "\u001f";
/** "" for the root, then the parts joined with a unit separator. */
export const pathId = (path: readonly PathPart[]) => path.map((p) => (typeof p === "number" ? `#${p}` : `.${p}`)).join(SEP);

export function entries(v: unknown): [PathPart, unknown][] {
  if (Array.isArray(v)) return v.map((x, i) => [i, x]);
  if (v && typeof v === "object") return Object.entries(v as Record<string, unknown>);
  return [];
}

export const sizeOf = (v: unknown) => (Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : 0);

/* ── Paths ── */

const IDENT = /^[A-Za-z_$][\w$]*$/;

/**
 * A path as code would write it: `data.items[0].id`, with odd keys quoted (`headers["content-type"]`).
 * `root` is put in front ("$" gives `$.data.items[0]`); the root itself is `root` or "(root)".
 */
export function formatPath(path: readonly PathPart[], root = ""): string {
  let out = root;
  for (const p of path) {
    if (typeof p === "number") out += `[${p}]`;
    else if (IDENT.test(p)) out += out ? `.${p}` : p;
    else out += `[${JSON.stringify(p)}]`;
  }
  return out || "(root)";
}

/** The value at a path, or undefined. */
export function valueAt(root: unknown, path: readonly PathPart[]): unknown {
  let v: unknown = root;
  for (const p of path) {
    if (v === null || typeof v !== "object") return undefined;
    v = (v as Record<string | number, unknown>)[p];
  }
  return v;
}

/** Text to copy for a value: strings as they are (no quotes), everything else as pretty JSON. */
export function copyText(v: unknown, indent = 2): string {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, indent) ?? String(v);
  } catch {
    return String(v);
  }
}

/* ── Previews ── */

/** The one-line form of a scalar as JSON would print it. */
export function scalarText(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "bigint") return v.toString();
  return String(v);
}

/** "3 keys", "1 key", "12 items", "empty". */
export function sizeText(type: JsonType, size: number): string {
  if (!size) return "empty";
  if (type === "array") return `${size} ${size === 1 ? "item" : "items"}`;
  return `${size} ${size === 1 ? "key" : "keys"}`;
}

/* ── Expansion ── */

/** Every container id down to `depth` levels (0 = only the root is shut, 1 = the root is open, ...). */
export function expandedTo(value: unknown, depth: number): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown, path: PathPart[], d: number) => {
    if (!isContainer(typeOf(v)) || d >= depth) return;
    out.add(pathId(path));
    for (const [k, c] of entries(v)) walk(c, [...path, k], d + 1);
  };
  walk(value, [], 0);
  return out;
}

/** Every container id. */
export const expandedAll = (value: unknown) => expandedTo(value, Infinity);

/** The ids of every ancestor of a path (the root included), so the path becomes visible. */
export function ancestorIds(path: readonly PathPart[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < path.length; i++) out.push(pathId(path.slice(0, i)));
  return out;
}

/* ── Flatten ── */

/** The rows to show, top to bottom, for a value and the set of open container ids. */
export function flatten(value: unknown, expanded: ReadonlySet<string>): JsonRow[] {
  const rows: JsonRow[] = [];
  const walk = (v: unknown, path: PathPart[], depth: number, name: PathPart | undefined, last: boolean) => {
    const type = typeOf(v);
    const id = pathId(path);
    const size = sizeOf(v);
    const open = isContainer(type) && size > 0 && expanded.has(id);
    rows.push({ id, path, depth, name, type, value: v, size, open, last });
    if (!open) return;
    const kids = entries(v);
    kids.forEach(([k, c], i) => walk(c, [...path, k], depth + 1, k, i === kids.length - 1));
    rows.push({ id: `${id}${SEP}}`, path, depth, name, type, value: v, size, open, close: true, last });
  };
  walk(value, [], 0, undefined, true);
  return rows;
}

/* ── Search ── */

export interface SearchHit {
  path: PathPart[];
  id: string;
  /** Matched the key, the value, or both. */
  on: "key" | "value" | "both";
}

/**
 * Every node whose key or scalar value contains `query` (case-insensitive), in document order. Searches the whole
 * value, not only what is open. Containers match on their key only. A query of only spaces finds nothing.
 */
export function search(value: unknown, query: string, limit = 5000): SearchHit[] {
  const q = query.trim().toLowerCase();
  const hits: SearchHit[] = [];
  if (!q) return hits;
  const walk = (v: unknown, path: PathPart[], name: PathPart | undefined) => {
    if (hits.length >= limit) return;
    const type = typeOf(v);
    const onKey = name !== undefined && String(name).toLowerCase().includes(q);
    const onValue = !isContainer(type) && (typeof v === "string" ? v : scalarText(v)).toLowerCase().includes(q);
    if (onKey || onValue) hits.push({ path, id: pathId(path), on: onKey && onValue ? "both" : onKey ? "key" : "value" });
    for (const [k, c] of entries(v)) walk(c, [...path, k], k);
  };
  walk(value, [], undefined);
  return hits;
}

/** `expanded` plus every ancestor of the hits, so each hit has a row. Returns the same set when nothing is added. */
export function openFor(expanded: ReadonlySet<string>, paths: readonly (readonly PathPart[])[]): Set<string> {
  let out: Set<string> | null = null;
  for (const p of paths)
    for (const a of ancestorIds(p))
      if (!expanded.has(a)) {
        out ??= new Set(expanded);
        out.add(a);
      }
  return (out ?? expanded) as Set<string>;
}

/** Split text around every case-insensitive occurrence of `query`, for marking matches. */
export function splitMatch(text: string, query: string): { text: string; hit: boolean }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const out: { text: string; hit: boolean }[] = [];
  let at = 0;
  for (let i = lower.indexOf(q); i !== -1; i = lower.indexOf(q, i + q.length)) {
    if (i > at) out.push({ text: text.slice(at, i), hit: false });
    out.push({ text: text.slice(i, i + q.length), hit: true });
    at = i + q.length;
  }
  if (at < text.length) out.push({ text: text.slice(at), hit: false });
  return out.length ? out : [{ text, hit: false }];
}

/** Next or previous index in a ring of `n`, from `i` (-1 means none yet). */
export function cycle(i: number, n: number, dir: 1 | -1): number {
  if (n <= 0) return -1;
  if (i < 0) return dir === 1 ? 0 : n - 1;
  return (i + dir + n) % n;
}

/* ── Keyboard ── */

/** Where focus goes for a tree key: the row index to focus, a container to toggle, or nothing. */
export function treeKey(rows: readonly JsonRow[], at: number, key: string): { focus?: number; toggle?: string } {
  const row = rows[at];
  if (!row) return rows.length ? { focus: 0 } : {};
  const last = rows.length - 1;
  switch (key) {
    case "ArrowDown":
      return { focus: Math.min(last, at + 1) };
    case "ArrowUp":
      return { focus: Math.max(0, at - 1) };
    case "Home":
      return { focus: 0 };
    case "End":
      return { focus: last };
    case "PageDown":
      return { focus: Math.min(last, at + 10) };
    case "PageUp":
      return { focus: Math.max(0, at - 10) };
    case "ArrowRight":
      if (row.close) return {};
      if (isContainer(row.type) && row.size > 0) return row.open ? { focus: at + 1 } : { toggle: row.id };
      return {};
    case "ArrowLeft": {
      if (row.close) return { focus: rows.findIndex((r) => r.id === row.id.slice(0, row.id.lastIndexOf(SEP))) };
      if (row.open) return { toggle: row.id };
      if (!row.path.length) return {};
      const parent = pathId(row.path.slice(0, -1));
      const i = rows.findIndex((r) => r.id === parent);
      return i >= 0 ? { focus: i } : {};
    }
    case "Enter":
    case " ":
      if (row.close) return { toggle: row.id.slice(0, row.id.lastIndexOf(SEP)) };
      return isContainer(row.type) && row.size > 0 ? { toggle: row.id } : {};
    default:
      return {};
  }
}

/** The row a closing bracket row belongs to, or the row itself. */
export const ownerId = (row: Pick<JsonRow, "id" | "close">) => (row.close ? row.id.slice(0, row.id.lastIndexOf(SEP)) : row.id);

/* ── Parse with a located error ── */

/** 1-based line and column for an offset. */
export function lineCol(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let start = 0;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++)
    if (text.charCodeAt(i) === 10) {
      line++;
      start = i + 1;
    }
  return { line, column: end - start + 1 };
}

/**
 * Parse JSON text. A failure comes back with a plain message and where it is (offset, line, column), found by a
 * small strict scanner, so the message is the same in every browser.
 */
export function parseJson(text: string): JsonParse {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    const at = locate(text);
    return { ok: false, error: { ...at, ...lineCol(text, at.offset) } };
  }
}

const show = (ch: string | undefined) => (ch === undefined ? "the end" : ch === "\n" ? "a line break" : `"${ch}"`);

/** Walk the text as strict JSON and return the first problem. Never throws. */
export function locate(text: string): { message: string; offset: number } {
  let i = 0;
  const n = text.length;
  class Stop extends Error {
    constructor(
      public msg: string,
      public at: number,
    ) {
      super(msg);
    }
  }
  const fail = (msg: string, at = i): never => {
    throw new Stop(msg, at);
  };
  const ws = () => {
    while (i < n) {
      const c = text[i];
      if (c === " " || c === "\t" || c === "\n" || c === "\r") i++;
      else if (c === "/" && (text[i + 1] === "/" || text[i + 1] === "*")) fail("Comments are not allowed in JSON");
      else break;
    }
  };
  const str = () => {
    const start = i;
    i++;
    while (i < n) {
      const c = text[i];
      if (c === '"') {
        i++;
        return;
      }
      if (c === "\n") fail("This string is not closed before the line ends", start);
      if (c === "\\") {
        const e = text[i + 1];
        if (e === "u") {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) fail("A \\u escape needs four hex digits");
          i += 6;
          continue;
        }
        if (e === undefined || !'"\\/bfnrt'.includes(e)) fail(`Unknown escape \\${e ?? ""}`);
        i += 2;
        continue;
      }
      if (c !== undefined && c.charCodeAt(0) < 0x20) fail("Control characters must be escaped in a string");
      i++;
    }
    fail("This string is not closed", start);
  };
  const num = () => {
    const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i));
    if (!m || !m[0] || m[0] === "-") fail("This number is not valid");
    i += m![0].length;
    if (/[\w.]/.test(text[i] ?? "")) fail("This number is not valid");
  };
  const word = () => {
    for (const w of ["true", "false", "null"])
      if (text.startsWith(w, i)) {
        i += w.length;
        return;
      }
    if (text[i] === "'") fail("Strings need double quotes");
    if (text.startsWith("undefined", i) || text.startsWith("NaN", i) || text.startsWith("Infinity", i)) fail(`${/^\w+/.exec(text.slice(i))![0]} is not a JSON value`);
    fail(`Expected a value, found ${show(text[i])}`);
  };
  const value = (): void => {
    ws();
    const c = text[i];
    if (c === undefined) fail("The text ends where a value should be");
    if (c === "{") return obj();
    if (c === "[") return arr();
    if (c === '"') return str();
    if (c === "-" || (c! >= "0" && c! <= "9")) return num();
    return word();
  };
  const obj = () => {
    const open = i;
    i++;
    ws();
    if (text[i] === "}") {
      i++;
      return;
    }
    for (;;) {
      ws();
      if (text[i] === "}") fail("Trailing comma before }", lastComma);
      if (text[i] === "'") fail("Keys need double quotes");
      if (text[i] !== '"') fail(i >= n ? "The object opened here is not closed" : `Expected a key in double quotes, found ${show(text[i])}`, i >= n ? open : i);
      str();
      ws();
      if (text[i] !== ":") fail(`Expected a colon after the key, found ${show(text[i])}`);
      i++;
      value();
      ws();
      if (text[i] === ",") {
        lastComma = i;
        i++;
        continue;
      }
      if (text[i] === "}") {
        i++;
        return;
      }
      if (i >= n) fail("The object opened here is not closed", open);
      if (text[i] === '"') fail("Missing a comma before this key");
      fail(`Expected a comma or }, found ${show(text[i])}`);
    }
  };
  let lastComma = 0;
  const arr = () => {
    const open = i;
    i++;
    ws();
    if (text[i] === "]") {
      i++;
      return;
    }
    for (;;) {
      ws();
      if (text[i] === "]") fail("Trailing comma before ]", lastComma);
      value();
      ws();
      if (text[i] === ",") {
        lastComma = i;
        i++;
        continue;
      }
      if (text[i] === "]") {
        i++;
        return;
      }
      if (i >= n) fail("The array opened here is not closed", open);
      if (/["\[{\d-]/.test(text[i] ?? "")) fail("Missing a comma before this item");
      fail(`Expected a comma or ], found ${show(text[i])}`);
    }
  };
  try {
    ws();
    if (i >= n) return { message: "There is no JSON here", offset: 0 };
    value();
    ws();
    if (i < n) fail(`Unexpected ${show(text[i])} after the end of the value`);
    return { message: "This is not valid JSON", offset: 0 };
  } catch (e) {
    if (e instanceof Stop) return { message: e.msg, offset: Math.max(0, Math.min(e.at, n)) };
    return { message: "This is not valid JSON", offset: 0 };
  }
}

/** The lines around an error, numbered, for the broken state. */
export function excerpt(text: string, line: number, around = 2): { no: number; text: string }[] {
  const lines = text.split("\n");
  const from = Math.max(1, line - around);
  const to = Math.min(lines.length, line + around);
  const out: { no: number; text: string }[] = [];
  for (let no = from; no <= to; no++) out.push({ no, text: (lines[no - 1] ?? "").replace(/\r$/, "") });
  return out;
}

/* ── Windowing ── */

/** Which rows to render for a scroll position: [start, end) with an overscan on both sides. */
export function windowRange(count: number, rowH: number, scrollTop: number, viewH: number, overscan = 8): [number, number] {
  if (count <= 0) return [0, 0];
  const start = Math.max(0, Math.floor(scrollTop / rowH) - overscan);
  const end = Math.min(count, Math.ceil((scrollTop + viewH) / rowH) + overscan);
  return [start, Math.max(start, end)];
}

/** The scrollTop that brings row `i` into view with the least movement, or null when it is already in view. */
export function scrollToRow(i: number, rowH: number, scrollTop: number, viewH: number): number | null {
  const top = i * rowH;
  if (top < scrollTop) return top;
  if (top + rowH > scrollTop + viewH) return top + rowH - viewH;
  return null;
}
