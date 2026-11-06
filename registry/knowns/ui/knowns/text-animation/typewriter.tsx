"use client";
/** @registry name="typewriter" type="ui" title="Typewriter" description="Types, makes a mistake, deletes and retypes; or cycles phrases." */

import { useMemo, useRef, useState } from "react";
import { Caret, hash01, TextShell, useLive, useStep } from "./text-core";

/** A typing script: text to type, a number of characters to delete, a pause, or clear the line. */
export type TypeStep = string | { back: number } | { pause: number } | { clear: true };

export interface TypewriterProps {
  /** Types, deletes and retypes in order, e.g. ["Ship agnets", { back: 4 }, "ents"]. */
  script?: TypeStep[];
  /** Or phrases: types each one, holds, deletes it, types the next. Loops by default. */
  phrases?: string[];
  /** Ms per typed character. Default 55 (with human jitter). */
  typeSpeed?: number;
  /** Ms per deleted character. Default 28. */
  deleteSpeed?: number;
  /** Ms a finished phrase stays before it is deleted. Default 1600. */
  hold?: number;
  /** Start again when the script ends. Default true for phrases, false for a script. */
  loop?: boolean;
  caret?: boolean;
  /** Screen reader text. Default the script's final text, or the phrases. */
  label?: string;
  paused?: boolean;
  className?: string;
}

export interface TypeFrame {
  text: string;
  /** Ms to wait before showing this frame. */
  wait: number;
}

/** Turn phrases into a script: type, hold, delete, short gap, next. */
export function phrasesScript(phrases: string[], hold = 1600): TypeStep[] {
  return phrases.flatMap((p, i) => [p, { pause: hold }, { back: p.length }, ...(i < phrases.length - 1 ? [{ pause: 280 }] : [])]);
}

/** Every visible state of a script, with the wait before each. Typing has a deterministic human jitter. */
export function typeFrames(script: TypeStep[], typeSpeed = 55, deleteSpeed = 28): TypeFrame[] {
  const frames: TypeFrame[] = [];
  let text = "";
  let pending = 0;
  let k = 0;
  for (const step of script) {
    if (typeof step === "string") {
      for (const ch of Array.from(step)) {
        text += ch;
        // Faster inside a word, a beat after spaces and punctuation.
        const beat = ch === " " ? 1.6 : /[.,!?]/.test(ch) ? 2.4 : 1;
        frames.push({ text, wait: pending + typeSpeed * (0.6 + hash01(k++, 3) * 0.8) * beat });
        pending = 0;
      }
    } else if ("back" in step) {
      const chars = Array.from(text);
      for (let i = 0; i < Math.min(step.back, chars.length); i++) {
        chars.pop();
        text = chars.join("");
        // A short hesitation before the first delete, as if noticing the typo.
        frames.push({ text, wait: pending + (i === 0 ? deleteSpeed * 6 : deleteSpeed) });
        pending = 0;
      }
    } else if ("pause" in step) {
      pending += step.pause;
    } else if ("clear" in step) {
      text = "";
      frames.push({ text, wait: pending + deleteSpeed });
      pending = 0;
    }
  }
  if (pending && frames.length) frames.push({ text, wait: pending });
  return frames;
}

/** The text after the whole script ran. */
export function finalText(script: TypeStep[]): string {
  const f = typeFrames(script, 1, 1);
  return f.length ? f[f.length - 1].text : "";
}

/**
 * A typewriter that makes and fixes mistakes: types, deletes, retypes, with a blinking caret. Give it
 * a script, or phrases to cycle through. Screen readers get the final text; reduced motion shows it.
 * Pauses offscreen and in hidden tabs.
 */
export function Typewriter({ script, phrases, typeSpeed = 55, deleteSpeed = 28, hold = 1600, loop, caret = true, label, paused, className }: TypewriterProps) {
  const root = useRef<HTMLSpanElement>(null);
  const { live, reduced } = useLive(root, paused);
  const steps = useMemo(() => script ?? phrasesScript(phrases ?? [], hold), [script, phrases, hold]);
  const frames = useMemo(() => typeFrames(steps, typeSpeed, deleteSpeed), [steps, typeSpeed, deleteSpeed]);
  const loops = loop ?? (!script && !!phrases);
  const [i, setI] = useState(-1);
  const done = i >= frames.length - 1;

  useStep(live, done ? (loops ? 900 : null) : frames[i + 1]?.wait ?? null, () => setI((k) => (k >= frames.length - 1 ? -1 : k + 1)), `${i}:${frames.length}`);

  const still = phrases && !script ? phrases[0] ?? "" : finalText(steps);
  const text = reduced ? still : i < 0 ? "" : frames[i].text;
  const spoken = label ?? (phrases && !script ? phrases.join(", ") : still);

  return (
    <TextShell kind="typewriter" label={spoken} live={live} rootRef={root} className={className}>
      <span className="whitespace-pre-wrap">{text}</span>
      {/* Solid while typing, blinking while it rests. */}
      {caret && <Caret blink={done || i < 0 || reduced || (frames[i + 1]?.wait ?? 0) > 500} />}
    </TextShell>
  );
}

export default Typewriter;
