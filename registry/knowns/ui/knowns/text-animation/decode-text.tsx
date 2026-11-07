"use client";
/** @registry name="decode-text" type="ui" title="Decode text" description="Text that resolves out of noise into its final value, without layout shift." */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { hash01, TextShell, useLive } from "./text-core";

export type DecodeCharset = "alnum" | "hex" | "binary" | "symbols" | (string & {});

export interface DecodeTextProps {
  text: string;
  /** Ms from noise to the final text. Default 1100. */
  duration?: number;
  /** Ms before starting. Default 0. */
  delay?: number;
  /** Glyphs used for the noise: a preset or your own string. Default "alnum". */
  charset?: DecodeCharset;
  /** Replay every this many ms. */
  loop?: number;
  /** Render the noise and the text in the mono font. Default false. */
  mono?: boolean;
  /** Start with the final text (the finished state), then decode again on `loop`. For posters and previews. */
  startComplete?: boolean;
  onDone?: () => void;
  paused?: boolean;
  className?: string;
}

const SETS: Record<string, string> = {
  alnum: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  hex: "0123456789abcdef",
  binary: "01",
  symbols: "<>/\\[]{}=+*#%&$@!?~^",
};

/**
 * The text at `progress` (0–1) of a decode: characters lock in roughly left to right (with a little
 * scatter); unlocked ones show noise from `set`. Spaces stay spaces. `tick` changes the noise.
 * Returns the frame and how many characters are locked.
 */
export function decodeFrame(text: string, progress: number, set: string, tick: number, seed = 0): { frame: string; locked: boolean[] } {
  const chars = Array.from(text);
  const n = chars.length;
  const locked = chars.map((c, i) => /\s/.test(c) || progress >= 1 || progress >= (i / Math.max(1, n)) * 0.72 + hash01(i, seed) * 0.28);
  const frame = chars.map((c, i) => (locked[i] ? c : set[Math.floor(hash01(i * 31 + tick, seed + 1) * set.length)] ?? c)).join("");
  return { frame, locked };
}

/**
 * Text that decodes out of noise into its final value, like a model resolving an answer or a key
 * being revealed. Replays when `text` changes. The layout holds the final text's size, so nothing
 * shifts. Screen readers get the text; reduced motion shows it at once. Pauses offscreen.
 */
export function DecodeText({ text, duration = 1100, delay = 0, charset = "alnum", loop, mono, startComplete, onDone, paused, className }: DecodeTextProps) {
  const root = useRef<HTMLSpanElement>(null);
  const { live, reduced } = useLive(root, paused);
  const set = SETS[charset] ?? charset;
  // progress < 0: not started; 1: done.
  const [state, setState] = useState({ progress: startComplete ? 1 : -1, tick: 0, run: 0 });
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // Restart when the text changes (not on mount: a start-complete text is already final).
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      if (startComplete) return;
    }
    setState((s) => ({ progress: -1, tick: 0, run: s.run + 1 }));
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!live) return;
    if (state.progress >= 1) {
      if (loop === undefined) return;
      const t = setTimeout(() => setState((s) => ({ progress: -1, tick: 0, run: s.run + 1 })), loop);
      return () => clearTimeout(t);
    }
    // Resume from where a pause left off.
    let raf = 0;
    let last = 0;
    const startAt = performance.now() - Math.max(0, state.progress) * duration + (state.progress < 0 ? delay : 0);
    const tick = (now: number) => {
      if (now - last >= 45) {
        last = now;
        const p = Math.min(1, Math.max(0, (now - startAt) / duration));
        setState((s) => ({ ...s, progress: p, tick: s.tick + 1 }));
        if (p >= 1) {
          doneRef.current?.();
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live, state.run, state.progress >= 1, duration, delay, loop]); // eslint-disable-line react-hooks/exhaustive-deps

  const settled = reduced || state.progress >= 1;
  const { frame, locked } = settled ? { frame: text, locked: [] as boolean[] } : decodeFrame(text, Math.max(0, state.progress), set, state.tick, state.run);
  const chars = Array.from(frame);

  return (
    <TextShell kind="decode" label={text} live={live} rootRef={root} className={cn("inline-grid", mono && "font-mono", className)}>
      {/* The final text holds the size; the frame is laid over it and clipped to it. */}
      <span className={cn("[grid-area:1/1] whitespace-pre", !settled && "invisible")}>{text}</span>
      {!settled && (
        <span className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre [font-variant-numeric:tabular-nums]">
          {chars.map((c, i) => (
            <span key={i} className={locked[i] ? undefined : "opacity-45"}>
              {c}
            </span>
          ))}
        </span>
      )}
    </TextShell>
  );
}

export default DecodeText;
