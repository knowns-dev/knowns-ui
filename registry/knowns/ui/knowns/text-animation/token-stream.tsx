"use client";
/** @registry name="token-stream" type="ui" title="Token stream" description="Text arriving token by token with a caret, like a model's reply; or follow a real stream." */

import { useEffect, useMemo, useRef, useState } from "react";
import { Caret, EASE, hash01, TextShell, useLive, useStep } from "./text-core";

export interface TokenStreamProps {
  text: string;
  /**
   * true (default): the component plays the text out token by token.
   * false: you stream `text` yourself (append as chunks arrive); new tokens fade in and the caret shows
   * while `streaming`.
   */
  simulate?: boolean;
  /** With simulate=false: the reply is still arriving (shows the caret). */
  streaming?: boolean;
  /** Tokens per second when simulating. Default 32. */
  speed?: number;
  /** Ms before starting when simulating. Default 300. */
  delay?: number;
  /** Replay after this many ms once done (simulate only). */
  loop?: number;
  /** Show a caret while tokens arrive. Default true. */
  caret?: boolean;
  onDone?: () => void;
  paused?: boolean;
  className?: string;
}

/**
 * Split text into LLM-like tokens: a word keeps its leading space, long words break into 3–4 character
 * pieces. Joining the tokens gives the text back exactly.
 */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\s*\S+|\s+/g)) {
    const chunk = m[0];
    const lead = chunk.match(/^\s*/)![0];
    const word = chunk.slice(lead.length);
    if (word.length <= 6) {
      out.push(chunk);
      continue;
    }
    let i = 0;
    let first = true;
    while (i < word.length) {
      const len = first ? 4 : i % 2 ? 3 : 4;
      out.push((first ? lead : "") + word.slice(i, i + len));
      i += len;
      first = false;
    }
  }
  return out;
}

/** How many tokens of `next` are already shown, given `shown` tokens of `prev` were visible. */
export function keptTokens(prev: string, next: string, shown: number): number {
  const p = tokenize(prev).slice(0, shown).join("");
  return next.startsWith(p) ? tokenize(p).length : 0;
}

const CSS = `
[data-kn-text="token-stream"] [data-tok] { animation: kntx-in 280ms ${EASE} both; }
`;

/**
 * Text arriving token by token with a caret, like a model's reply. Plays itself, or follows a real
 * stream (simulate={false}). Screen readers get the whole text; reduced motion shows it at once.
 * Pauses offscreen and in hidden tabs.
 */
export function TokenStream({ text, simulate = true, streaming, speed = 32, delay = 300, loop, caret = true, onDone, paused, className }: TokenStreamProps) {
  const root = useRef<HTMLSpanElement>(null);
  const { live, reduced } = useLive(root, paused);
  const tokens = useMemo(() => tokenize(text), [text]);
  const [n, setN] = useState(simulate ? 0 : tokens.length);
  const [cycle, setCycle] = useState(0);

  // Keep what is already shown when the text grows (a stream) or restart when it changes.
  const prevText = useRef(text);
  useEffect(() => {
    if (prevText.current === text) return;
    const kept = keptTokens(prevText.current, text, n);
    prevText.current = text;
    if (simulate) setN(kept);
    else setN(tokenize(text).length);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!simulate) setN(tokens.length);
  }, [simulate, tokens.length]);

  const done = n >= tokens.length;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (simulate && done && tokens.length) doneRef.current?.();
  }, [simulate, done, tokens.length, cycle]);

  // Each token waits about 1/speed, with a little jitter and a longer beat after punctuation.
  const base = 1000 / Math.max(1, speed);
  const prevTok = tokens[n - 1] ?? "";
  const wait = n === 0 ? delay : base * (0.55 + hash01(n, cycle) * 0.9) * (/[.!?:]$/.test(prevTok) ? 4 : /,$/.test(prevTok) ? 2 : 1);
  useStep(live && simulate, done ? (loop !== undefined ? loop : null) : wait, () => {
    if (done) {
      setN(0);
      setCycle((c) => c + 1);
    } else {
      // Sometimes two tokens land in one frame, like a real stream.
      setN((k) => Math.min(tokens.length, k + (hash01(k, 7) > 0.8 ? 2 : 1)));
    }
  }, `${n}:${cycle}`);

  const shown = reduced ? tokens.length : n;
  const showCaret = caret && !reduced && (simulate ? !done : !!streaming);

  return (
    <TextShell kind="token-stream" label={text} live={live} css={CSS} rootRef={root} className={className}>
      <span className="whitespace-pre-wrap">
        {tokens.slice(0, shown).map((t, i) => (
          <span key={`${cycle}-${i}`} data-tok="">
            {t}
          </span>
        ))}
        {showCaret && <Caret blink={false} className="opacity-70" />}
      </span>
    </TextShell>
  );
}

export default TokenStream;
