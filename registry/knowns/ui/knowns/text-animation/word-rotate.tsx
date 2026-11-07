"use client";
/** @registry name="word-rotate" type="ui" title="Word rotate" description="One word in a headline that changes in place, keeping its width." */

import { useRef, useState, type CSSProperties } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { EASE, TextShell, useLive, useStep } from "./text-core";

export interface WordRotateProps {
  /** Words that take turns in place, e.g. ["work", "plan", "ship"]. */
  words: string[];
  /** Ms each word stays. Default 2200. */
  interval?: number;
  /** Line them up at the start (default) or centre them in the widest word's space. */
  align?: "start" | "center";
  /** How a word hands over: "rise" (default) lifts the old one away; "morph" blurs it into the next. */
  transition?: "rise" | "morph";
  /** Classes for the words, e.g. a gradient or accent colour. */
  wordClassName?: string;
  /** Screen reader text. Default the words as a list ("work, plan, or ship"). */
  label?: string;
  paused?: boolean;
  className?: string;
}

/** "work, plan or ship" (locale-aware where Intl.ListFormat exists). */
export function listWords(words: string[], locale = "en"): string {
  try {
    return new Intl.ListFormat(locale, { type: "disjunction" }).format(words);
  } catch {
    return words.join(", ");
  }
}

/** Where word `i` sits when `cur` is showing and `prev` just left. */
export function wordPlace(i: number, cur: number, prev: number | null): "in" | "out" | "wait" {
  if (i === cur) return "in";
  if (i === prev) return "out";
  return "wait";
}

/** Morph: the outgoing word blurs and fades while the incoming one sharpens, overlapping in the same slot. */
export function morphStyle(place: "in" | "out" | "wait"): CSSProperties {
  const on = place === "in";
  return {
    opacity: on ? 1 : 0,
    filter: on ? "blur(0)" : "blur(.28em)",
    transform: on ? "none" : "scale(.96)",
    transition: place === "wait" ? "none" : `opacity 600ms ${EASE}, filter 600ms ${EASE}, transform 600ms ${EASE}`,
  };
}

/**
 * One word in a sentence that changes in place: the old word lifts away as the next rises in.
 * Use it inline, e.g. "Show your agents while they <WordRotate words={…} />". The slot keeps the
 * widest word's width so the line never jumps. Screen readers hear all the words; reduced motion
 * shows the first. Pauses offscreen and in hidden tabs.
 */
export function WordRotate({ words, interval = 2200, align = "start", transition = "rise", wordClassName, label, paused, className }: WordRotateProps) {
  const root = useRef<HTMLSpanElement>(null);
  const { live, reduced } = useLive(root, paused);
  const [{ cur, prev }, set] = useState<{ cur: number; prev: number | null }>({ cur: 0, prev: null });
  const n = words.length;
  useStep(live && n > 1, interval, () => set(({ cur: c }) => ({ cur: (c + 1) % n, prev: c })), `${cur}:${n}`);
  const morph = transition === "morph";
  const at = reduced ? 0 : Math.min(cur, Math.max(0, n - 1));

  return (
    <TextShell kind="word-rotate" label={label ?? listWords(words)} live={live} rootRef={root} className={cn("inline-block", className)}>
      {/*
        All words share one grid cell: the cell is the widest word, the clip hides the travel. The clip reaches
        .3em past the line box (padding, cancelled by a negative margin, so layout never shifts) so ascenders
        and descenders survive tight display leading.
      */}
      <span className={cn("inline-grid overflow-hidden py-[.3em] -my-[.3em] align-bottom", morph && "px-[.2em] -mx-[.2em]")}>
        {words.map((w, i) => {
          const place = reduced ? (i === 0 ? "in" : "wait") : wordPlace(i, at, prev);
          return (
            <span
              key={`${i}-${w}`}
              className={cn("[grid-area:1/1] whitespace-nowrap", align === "center" && "text-center", wordClassName)}
              style={morph ? morphStyle(place) : {
                opacity: place === "in" ? 1 : 0,
                transform: place === "in" ? "none" : place === "out" ? "translateY(-.5em)" : "translateY(.5em)",
                // A clean hand-over: the outgoing word is mostly gone (fast fade) before the incoming one, which
                // waits a beat, becomes legible. Waiting words snap back below without being seen.
                transition:
                  place === "wait"
                    ? "none"
                    : place === "out"
                      ? `transform 360ms ${EASE}, opacity 200ms ${EASE}`
                      : `transform 520ms ${EASE} 160ms, opacity 360ms ${EASE} 180ms`,
              }}
            >
              {w}
            </span>
          );
        })}
      </span>
    </TextShell>
  );
}

export default WordRotate;
