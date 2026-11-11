"use client";
/** @registry name="ai-answer" type="ui" title="AI answer" description="Streamed answer with steps, sources, numbered citations that preview their source, copy, regenerate, feedback and follow-ups." */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn, focusRing, writeClipboard } from "@/registry/knowns/lib/knowns/utils";
import { Button } from "../button";
import { Spinner } from "../spinner";
import { Tooltip } from "../tooltip";
import { countWords, parseAnswer, toPlainText, trimPartialCite, wordPrefix, type Inline } from "./answer-text";

export interface AnswerSource {
  title: string;
  /** Short name of where it comes from, e.g. "Notion" or "linear.app". */
  site: string;
  url?: string;
  /** Logo shown on the source pill and in previews. */
  icon?: ReactNode;
  /** A line or two from the source, shown in the preview. */
  excerpt?: string;
}

export interface AnswerStep {
  label: string;
  state: "done" | "active" | "pending";
}

export type AnswerStatus = "thinking" | "streaming" | "done" | "stopped" | "error";

export interface AiAnswerProps {
  question?: string;
  sources?: AnswerSource[];
  /**
   * The answer. Blank lines make paragraphs, "- " lines a list; **bold**, `code`, and
   * [1] or [1, 3] cite sources (1-based). It may grow while streaming; a text that no
   * longer starts with what was shown starts over (e.g. after regenerate).
   */
  text: string;
  /** thinking: still searching · streaming: text is coming · done · stopped · error. */
  status?: AnswerStatus;
  /** What the assistant did, e.g. "Searched the web", "Read 5 sources". Collapsible. */
  steps?: AnswerStep[];
  /** Reveal text word by word. Default true. */
  reveal?: boolean;
  /** Reveal speed. Default 42. */
  wordsPerSecond?: number;
  suggestions?: string[];
  onSuggestion?: (q: string) => void;
  onRegenerate?: () => void;
  /** Shows a Stop button while thinking or streaming. */
  onStop?: () => void;
  onCopy?: (plainText: string) => void;
  onFeedback?: (rating: "good" | "bad", reason?: string) => void;
  feedbackReasons?: string[];
  /** Small text at the end of the action row, e.g. "Answered in 3.4s". */
  meta?: ReactNode;
  /** Put the answer on its own card. Off, it blends into the thread around it. Default true. */
  card?: boolean;
  error?: ReactNode;
  className?: string;
}

const icon = {
  copy: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.8" />
      <path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  ),
  redo: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v3h-3" />
    </svg>
  ),
  up: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M5 7l2.5-4.5c.9 0 1.5.7 1.5 1.5v2h3.2c.8 0 1.4.8 1.2 1.6l-1 4.2c-.2.7-.8 1.2-1.5 1.2H5zM5 7H2.8v6.5H5" />
    </svg>
  ),
  down: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M11 9l-2.5 4.5c-.9 0-1.5-.7-1.5-1.5v-2H3.8c-.8 0-1.4-.8-1.2-1.6l1-4.2c.2-.7.8-1.2 1.5-1.2H11zM11 9h2.2V2.5H11" />
    </svg>
  ),
  stop: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <rect x="4" y="4" width="8" height="8" rx="1.5" />
    </svg>
  ),
  spark: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1.5l1.4 4.1 4.1 1.4-4.1 1.4L8 12.5 6.6 8.4 2.5 7l4.1-1.4z" />
    </svg>
  ),
  chevron: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4l4 4-4 4" />
    </svg>
  ),
};

const DEFAULT_REASONS = ["Inaccurate", "Missing a source", "Too long", "Outdated"];

/** Streamed answer with sources, numbered citations that preview their source, and actions. */
export function AiAnswer({
  question,
  sources = [],
  text,
  status = "done",
  steps,
  reveal = true,
  wordsPerSecond = 42,
  suggestions,
  onSuggestion,
  onRegenerate,
  onStop,
  onCopy,
  onFeedback,
  feedbackReasons = DEFAULT_REASONS,
  meta,
  card = true,
  error,
  className,
}: AiAnswerProps) {
  const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animate = reveal && !reduce;

  /* Word-by-word reveal: catch up with `text` at wordsPerSecond. */
  const total = countWords(text);
  const [shown, setShown] = useState(animate ? 0 : total);
  const prevText = useRef("");
  useEffect(() => {
    // A text that no longer continues the old one (regenerate, new question) starts over.
    if (!text.startsWith(prevText.current.slice(0, Math.max(0, prevText.current.length - 12)))) setShown(0);
    prevText.current = text;
  }, [text]);
  useEffect(() => {
    if (!animate) {
      setShown(total);
      return;
    }
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const tick = (t: number) => {
      acc += ((t - last) / 1000) * wordsPerSecond;
      last = t;
      const add = Math.floor(acc);
      if (add > 0) {
        acc -= add;
        setShown((s) => Math.min(total, s + add));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animate, total, wordsPerSecond]);

  const visible = trimPartialCite(shown >= total ? text : wordPrefix(text, shown));
  const writing = status === "streaming" || shown < total;
  const finished = !writing && (status === "done" || status === "stopped");
  const blocks = useMemo(() => parseAnswer(visible), [visible]);

  /* Linked highlight between citations and source pills. */
  const [hot, setHot] = useState<number[]>([]);
  const [allSources, setAllSources] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<"good" | "bad" | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    setRating(null);
    setReason(null);
  }, [question]);

  const maxPills = 3;
  const pills = allSources ? sources : sources.slice(0, maxPills);
  const more = sources.length - maxPills;

  const copy = async () => {
    const plain = toPlainText(text, sources);
    await writeClipboard(plain);
    onCopy?.(plain);
    setCopied(true);
    setAnnounce("Answer copied");
    setTimeout(() => setCopied(false), 1400);
  };

  const rate = (r: "good" | "bad") => {
    const next = rating === r ? null : r;
    setRating(next);
    setReason(null);
    if (next === "good") {
      onFeedback?.("good");
      setAnnounce("Thanks for the feedback");
    }
  };

  // Words get stable keys (block + index) so only new ones mount - and fade in.
  let wordIndex = 0;
  const words = (s: string, keyBase: string) =>
    (s.match(/\S+\s*|\s+/g) ?? []).map((w) => (
      <span key={`${keyBase}-${wordIndex++}`} className={animate ? "animate-[kn-word_320ms_ease-out_both]" : undefined}>
        {w}
      </span>
    ));

  const caret = writing && status !== "thinking" && (
    <span aria-hidden="true" className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] rounded-full bg-indigo-500 motion-safe:animate-pulse" />
  );

  const renderInline = (parts: Inline[], keyBase: string, last = false) => [
    ...parts.map((p, i) => {
      if (p.kind === "cite") {
        return (
          <span key={`${keyBase}-c${i}`} className="mx-0.5 inline-flex translate-y-[-1px] gap-0.5 align-middle">
            {p.refs.map((n) => (
              <Citation key={n} n={n} source={sources[n - 1]} hot={hot.includes(n)} onHot={(on) => setHot(on ? [n] : [])} animate={animate} />
            ))}
          </span>
        );
      }
      if (p.kind === "code")
        return (
          <code key={`${keyBase}-k${i}`} className="rounded-[5px] bg-muted px-1 py-px font-mono text-[0.9em]">
            {p.text}
          </code>
        );
      if (p.kind === "bold")
        return (
          <strong key={`${keyBase}-b${i}`} className="font-semibold text-foreground">
            {words(p.text, `${keyBase}-b${i}`)}
          </strong>
        );
      return <span key={`${keyBase}-t${i}`}>{words(p.text, `${keyBase}-t${i}`)}</span>;
    }),
    last ? <span key="caret">{caret}</span> : null,
  ];

  return (
    <article
      aria-label={question ? `Answer: ${question}` : "Answer"}
      className={cn("@container text-[14px] text-foreground", card && "rounded-2xl border bg-card p-5 shadow-xs", className)}
    >
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>

      {question && <h3 className="text-[16px] font-semibold leading-snug tracking-tight">{question}</h3>}

      {/* Steps */}
      {steps && steps.length > 0 && (
        <div className={cn(question && "mt-3")}>
          <button
            type="button"
            aria-expanded={stepsOpen}
            onClick={() => setStepsOpen((o) => !o)}
            className={cn("inline-flex items-center gap-1.5 rounded-md py-0.5 text-[12.5px] text-muted-foreground hover:text-foreground", focusRing)}
          >
            {steps.some((s) => s.state === "active") ? <Spinner className="size-3" label="" /> : <span className="size-3 text-emerald-600 dark:text-emerald-400 [&>svg]:size-full">{icon.check}</span>}
            {steps.find((s) => s.state === "active")?.label ?? steps.filter((s) => s.state === "done").map((s) => s.label).join(" · ")}
            <span className={cn("size-3 transition-transform [&>svg]:size-full", stepsOpen && "rotate-90")}>{icon.chevron}</span>
          </button>
          {stepsOpen && (
            <ol className="mt-1.5 ml-1.5 flex flex-col gap-1 border-l pl-3.5 text-[12.5px]">
              {steps.map((s, i) => (
                <li key={i} className={cn("flex items-center gap-2", s.state === "pending" ? "text-muted-foreground" : s.state === "active" ? "text-foreground" : "text-muted-foreground")}>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "-ml-[19px] size-2 rounded-full ring-2 ring-card",
                      s.state === "done" ? "bg-emerald-500" : s.state === "active" ? "bg-indigo-500 motion-safe:animate-pulse" : "bg-muted-foreground/30",
                    )}
                  />
                  {s.label}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <div className={cn("mt-3.5", !question && !steps?.length && "mt-0")}>
          <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
            {status === "thinking" ? (
              <>
                <Spinner className="size-3" label="" /> Reading {sources.length} {sources.length === 1 ? "source" : "sources"}
              </>
            ) : (
              <>{sources.length} {sources.length === 1 ? "source" : "sources"}</>
            )}
          </div>
          <ul className="grid grid-cols-1 gap-2 @[420px]:grid-cols-2 @[540px]:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
            {pills.map((s, i) => {
              const n = i + 1;
              const lit = hot.includes(n);
              const body = (
                <>
                  <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                    {s.icon && <span className="grid size-3.5 place-items-center [&>svg]:size-full [&>span]:size-full">{s.icon}</span>}
                    <span className="truncate">{s.site}</span>
                    <span className="ml-auto tabular-nums">{n}</span>
                  </span>
                  <span className="mt-1 line-clamp-2 text-[12.5px] font-medium leading-snug text-foreground">{s.title}</span>
                </>
              );
              const cls = cn(
                "flex h-full flex-col rounded-xl px-3 py-2.5 text-left transition-[box-shadow,background-color] duration-150",
                "shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_10%,transparent)] hover:bg-muted/40",
                lit && "bg-indigo-500/[0.06] shadow-[0_0_0_1.5px_rgb(99_102_241/0.55)]",
                status === "thinking" && animate && "animate-[kn-rise_260ms_ease-out_both]",
                focusRing,
              );
              return (
                <li key={n} style={status === "thinking" && animate ? { animationDelay: `${i * 90}ms` } : undefined} onPointerEnter={() => setHot([n])} onPointerLeave={() => setHot([])}>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer" className={cls} onFocus={() => setHot([n])} onBlur={() => setHot([])}>
                      {body}
                    </a>
                  ) : (
                    <div className={cls}>{body}</div>
                  )}
                </li>
              );
            })}
            {more > 0 && (
              <li>
                <button
                  type="button"
                  aria-expanded={allSources}
                  onClick={() => setAllSources((v) => !v)}
                  className={cn(
                    "flex h-full min-h-14 w-full flex-col items-start justify-between rounded-xl px-3 py-2.5 text-left text-[12px] text-muted-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_10%,transparent)] hover:bg-muted/40 hover:text-foreground",
                    hot.some((n) => n > maxPills) && !allSources && "shadow-[0_0_0_1.5px_rgb(99_102_241/0.55)]",
                    focusRing,
                  )}
                >
                  {allSources ? (
                    "Show fewer"
                  ) : (
                    <>
                      <span className="flex -space-x-1">
                        {sources.slice(maxPills, maxPills + 3).map((s, i) => (
                          <span key={i} className="grid size-4 place-items-center rounded-full bg-card ring-2 ring-card [&>svg]:size-3 [&>span]:size-3">
                            {s.icon}
                          </span>
                        ))}
                      </span>
                      <span className="font-medium">+{more} more</span>
                    </>
                  )}
                </button>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Answer */}
      <div className="mt-4">
        <div aria-busy={writing || status === "thinking"} className="flex flex-col gap-2.5 leading-[1.65] text-foreground/90">
          {status === "thinking" && !visible ? (
            <div role="img" className="flex flex-col gap-2 py-1" aria-label="Thinking">
              {[92, 78, 64].map((w, i) => (
                <span key={i} style={{ width: `${w}%` }} className="h-3 rounded-full bg-muted motion-safe:animate-pulse" />
              ))}
            </div>
          ) : (
            blocks.length === 0 ? (
              <p>{caret}</p>
            ) : (
              blocks.map((b, bi) => {
                const lastBlock = bi === blocks.length - 1;
                return b.kind === "p" ? (
                  <p key={bi}>{renderInline(b.inline, `p${bi}`, lastBlock)}</p>
                ) : (
                  <ul key={bi} className="flex flex-col gap-1.5 pl-1">
                    {b.items.map((it, ii) => (
                      <li key={ii} className="flex gap-2.5">
                        <span aria-hidden="true" className="mt-[0.7em] size-1 flex-none rounded-full bg-muted-foreground/60" />
                        <span>{renderInline(it, `l${bi}-${ii}`, lastBlock && ii === b.items.length - 1)}</span>
                      </li>
                    ))}
                  </ul>
                );
              })
            )
          )}
          {status === "stopped" && !writing && <p className="text-[12.5px] text-muted-foreground">Stopped.</p>}
          {status === "error" && <p className="text-[13px] text-red-600 dark:text-red-400">{error ?? "Something went wrong while answering."}</p>}
        </div>
      </div>

      {/* Suggestions */}
      {finished && suggestions && suggestions.length > 0 && (
        <div className="mt-4 animate-[kn-rise_220ms_ease-out_both]">
          <div className="mb-1 text-[11.5px] font-medium tracking-wide text-muted-foreground uppercase">Ask next</div>
          <ul className="divide-y">
            {suggestions.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => onSuggestion?.(q)}
                  className={cn("group flex w-full items-center justify-between gap-3 rounded-md py-2 text-left text-[13.5px] text-foreground/90 hover:text-foreground", focusRing)}
                >
                  {q}
                  <span className="size-3.5 flex-none text-muted-foreground transition-transform group-hover:translate-x-0.5 [&>svg]:size-full">{icon.chevron}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className={cn("mt-3 flex flex-wrap items-center gap-1", card && "-mx-1.5")}>
        {(status === "thinking" || writing) && onStop ? (
          <Button size="sm" variant="secondary" icon={icon.stop} onClick={onStop}>
            Stop
          </Button>
        ) : (
          finished && (
            <>
              <Tooltip content={copied ? "Copied" : "Copy answer"}>
                <Button size="sm" variant="ghost" aria-label="Copy answer" icon={copied ? icon.check : icon.copy} onClick={copy} />
              </Tooltip>
              {onRegenerate && (
                <Tooltip content="Regenerate">
                  <Button size="sm" variant="ghost" aria-label="Regenerate" icon={icon.redo} onClick={onRegenerate} />
                </Tooltip>
              )}
              {onFeedback && (
                <>
                  <Tooltip content="Good answer">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Good answer"
                      aria-pressed={rating === "good"}
                      icon={icon.up}
                      onClick={() => rate("good")}
                      className={cn(rating === "good" && "text-emerald-600 dark:text-emerald-400")}
                    />
                  </Tooltip>
                  <Tooltip content="Bad answer">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Bad answer"
                      aria-pressed={rating === "bad"}
                      icon={icon.down}
                      onClick={() => rate("bad")}
                      className={cn(rating === "bad" && "text-red-600 dark:text-red-400")}
                    />
                  </Tooltip>
                </>
              )}
            </>
          )
        )}
        {meta && !writing && <span className="ml-auto pr-1.5 text-[12px] tabular-nums text-muted-foreground">{meta}</span>}
      </div>

      {rating === "bad" && finished && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 animate-[kn-rise_180ms_ease-out_both]" role="group" aria-label="What was wrong?">
          <span className="mr-1 text-[12.5px] text-muted-foreground">{reason ? "Thanks - noted." : "What was wrong?"}</span>
          {!reason &&
            feedbackReasons.map((r) => (
              <Button
                key={r}
                size="xs"
                variant="secondary"
                onClick={() => {
                  setReason(r);
                  onFeedback?.("bad", r);
                  setAnnounce("Thanks for the feedback");
                }}
              >
                {r}
              </Button>
            ))}
        </div>
      )}
    </article>
  );
}

/** Numbered citation chip; hovering or focusing it previews the source. */
function Citation({ n, source, hot, onHot, animate }: { n: number; source?: AnswerSource; hot: boolean; onHot: (on: boolean) => void; animate: boolean }) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const chip = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Rendered in a portal on <body>, fixed to the viewport: no ancestor transform, stacking
  // context or overflow-hidden container (like the gliding answer) can cover or clip it.
  const place = () => {
    const r = chip.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.min(Math.max(r.left + r.width / 2, 140), window.innerWidth - 140);
    const below = r.top < 190;
    setAt({ x, y: below ? r.bottom + 8 : r.top - 8, below });
  };
  const show = () => {
    clearTimeout(timer.current);
    onHot(true);
    timer.current = setTimeout(() => {
      place();
      setOpen(true);
    }, 180);
  };
  const hide = () => {
    clearTimeout(timer.current);
    onHot(false);
    timer.current = setTimeout(() => setOpen(false), 120);
  };
  return (
    <span className="relative inline-flex" onPointerEnter={show} onPointerLeave={hide}>
      <button
        ref={chip}
        type="button"
        aria-label={source ? `Source ${n}: ${source.title}, ${source.site}` : `Source ${n}`}
        aria-describedby={open ? `kn-cite-${n}` : undefined}
        onFocus={show}
        onBlur={hide}
        onClick={() => {
          place();
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className={cn(
          "inline-flex h-[18px] min-w-[18px] items-center justify-center gap-1 rounded-[5px] px-1 text-[10.5px] font-semibold tabular-nums leading-none",
          "bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] text-muted-foreground transition-colors hover:text-foreground",
          hot && "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
          animate && "animate-[kn-pop_220ms_var(--kn-ease-out,cubic-bezier(.22,1,.36,1))_both]",
          focusRing,
        )}
      >
        {source?.icon && <span className="grid size-2.5 place-items-center [&>svg]:size-full [&>span]:size-full">{source.icon}</span>}
        {n}
      </button>
      {open &&
        source &&
        at &&
        createPortal(
        <span
          onPointerEnter={() => {
            clearTimeout(timer.current);
            onHot(true);
          }}
          onPointerLeave={hide}
          id={`kn-cite-${n}`}
          role="tooltip"
          style={{ left: at.x, top: at.y }}
          className={cn(
            "fixed z-[60] w-64 -translate-x-1/2 rounded-xl border bg-popover p-3 text-left text-[12.5px] leading-snug text-popover-foreground",
            "shadow-[0_12px_32px_-12px_rgb(0_0_0/0.3)] animate-[kn-rise_150ms_ease-out_both]",
            !at.below && "-translate-y-full",
          )}
        >
          <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            {source.icon && <span className="grid size-3.5 place-items-center [&>svg]:size-full [&>span]:size-full">{source.icon}</span>}
            {source.site}
          </span>
          <span className="mt-1 block font-medium">{source.title}</span>
          {source.excerpt && <span className="mt-1 block text-muted-foreground">{source.excerpt}</span>}
          {source.url && (
            <a href={source.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[12px] font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Open source ↗
            </a>
          )}
        </span>,
        document.body,
      )}
    </span>
  );
}

export default AiAnswer;
