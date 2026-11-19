/** @registry part-of="chat-composer" */
import { useCallback, useRef, useState } from "react";

/** "820 B", "14 KB", "2.4 MB". Empty for a missing or negative size. */
export function formatBytes(bytes?: number): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let n = bytes / 1024;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u++;
  }
  return `${n < 10 ? n.toFixed(1).replace(/\.0$/, "") : Math.round(n)} ${units[u]}`;
}

/** Something worth sending: non-blank text or at least one attachment. */
export function canSend(text: string, attachments: number): boolean {
  return text.trim().length > 0 || attachments > 0;
}

/**
 * Whether a keydown in the textarea should send. Enter sends, Shift+Enter is a newline,
 * ⌘/Ctrl+Enter also sends; never while an IME is composing (Japanese, Chinese, Korean…).
 */
export function isSubmitKey(e: { key: string; shiftKey: boolean; altKey?: boolean; isComposing?: boolean; keyCode?: number }): boolean {
  if (e.key !== "Enter") return false;
  if (e.isComposing || e.keyCode === 229) return false;
  return !e.shiftKey && !e.altKey;
}

/**
 * The text after picking a skill chip: a leading command is swapped ("/trace foo" then "/rollback"
 * gives "/rollback foo"), otherwise the command goes in front of what was typed.
 */
export function insertSkill(text: string, id: string): string {
  return `/${id} ` + text.replace(/^\s*(\/[\w-]*)?\s*/, "");
}

/**
 * How wide a wrapping row of chips should be so its rows come out even. Greedy wrapping at `avail` fills the first
 * rows and leaves a stray chip on the last; this finds the fewest rows that fit, then the narrowest width that
 * still holds the chips in that many rows (the partition with the shortest longest row). Set it as the row's
 * max-width and ordinary flex wrapping gives balanced rows. `widths` are the chips' widths in px, `gap` the space
 * between them.
 */
export function balancedWidth(widths: number[], gap: number, avail: number): number {
  const n = widths.length;
  if (n === 0 || avail <= 0) return avail;
  const row = (i: number, j: number) => {
    let w = gap * (j - i - 1);
    for (let k = i; k < j; k++) w += widths[k] as number;
    return w;
  };
  let rows = 1;
  let cur = 0;
  for (const w of widths) {
    if (cur > 0 && cur + gap + w > avail) {
      rows++;
      cur = w;
    } else cur += (cur > 0 ? gap : 0) + w;
  }
  if (rows === 1) return avail;
  // best[k][j]: the shortest longest row when the first j chips sit in k rows.
  let prev = Array.from({ length: n + 1 }, (_, j) => (j === 0 ? 0 : row(0, j)));
  for (let k = 2; k <= rows; k++) {
    const next = new Array<number>(n + 1).fill(Infinity);
    for (let j = 1; j <= n; j++) for (let i = 1; i < j; i++) next[j] = Math.min(next[j] as number, Math.max(prev[i] as number, row(i, j)));
    prev = next;
  }
  return Math.min(avail, Math.ceil(prev[n] as number) + 1);
}

/** Add `id` if missing, drop it if present; keeps the original order. */
export function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/**
 * Bar heights (0.2…1) for the dictation waveform at time `t` (seconds). A few slow sines
 * per bar, offset by index, so it breathes like speech without random jitter.
 */
export function waveHeights(t: number, bars: number): number[] {
  return Array.from({ length: bars }, (_, i) => {
    const a = Math.sin(t * 5.1 + i * 1.7) * 0.5 + 0.5;
    const b = Math.sin(t * 8.3 + i * 2.9) * 0.5 + 0.5;
    const c = Math.sin(t * 2.3 + i * 0.6) * 0.5 + 0.5;
    return 0.2 + 0.8 * (a * 0.45 + b * 0.3 + c * 0.25);
  });
}

/**
 * Controlled-or-uncontrolled state: the prop wins whenever it is defined (null counts as a
 * value). The setter always calls `onChange`, and only updates local state when uncontrolled.
 */
export function useControllable<T>(prop: T | undefined, initial: T, onChange?: (v: T) => void): [T, (v: T) => void] {
  const [local, setLocal] = useState<T>(initial);
  const controlled = prop !== undefined;
  const value = controlled ? (prop as T) : local;
  const cb = useRef(onChange);
  cb.current = onChange;
  const set = useCallback(
    (v: T) => {
      if (!controlled) setLocal(v);
      cb.current?.(v);
    },
    [controlled],
  );
  return [value, set];
}
