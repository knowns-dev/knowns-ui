"use client";
/** @registry name="answer-pad" type="ui" title="Answer pad" description="The student's phone view of a live question: big tap targets for the choices, locked after one answer, with waiting, right and wrong states. The answer shows at once and is sent in the background; if sending fails it stays saved and goes again when the phone is back online." */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { choicesOf, gradeQuestion, isAnswered, type QuizQuestion } from "@/registry/knowns/lib/knowns/quiz";

export type AnswerPadStatus = "choosing" | "sending" | "queued" | "waiting" | "correct" | "wrong" | "closed";

export interface AnswerPadProps {
  question: QuizQuestion;
  /** Called once with the choice ids (or the typed text in `[0]`). The pad locks at once; a rejected promise keeps the answer and retries. */
  onSubmit?: (value: string[]) => void | Promise<void>;
  /** The teacher revealed the answer: show right or wrong and mark the right choices. */
  revealed?: boolean;
  /** Time is up and this student did not answer. */
  closed?: boolean;
  /** Seconds left, shown top right. Leave out for no clock. */
  secondsLeft?: number;
  /** An answer already sent (for example after a reload). The pad opens locked. */
  sent?: string[];
  className?: string;
}

const S = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const CheckGlyph = () => <svg {...S}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
const CrossGlyph = () => <svg {...S}><path d="M6 6l12 12M18 6 6 18" /></svg>;
const LETTERS = "ABCDEFGH";
const HINT: Record<QuizQuestion["kind"], string> = { single: "Pick one", multi: "Pick all that apply", truefalse: "True or false", short: "Type your answer" };

/** The phone view of one live question. Remounts per question, so a new question starts clean. */
export function AnswerPad(props: AnswerPadProps) {
  return <Pad key={props.question.id} {...props} />;
}

function Pad({ question: q, onSubmit, revealed, closed, secondsLeft, sent: initial, className }: AnswerPadProps) {
  const [picked, setPicked] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [sent, setSent] = useState<string[] | null>(initial ?? null);
  const [net, setNet] = useState<"sending" | "ok" | "queued">("ok");
  const tries = useRef(0);
  const choices = choicesOf(q);

  const push = async (value: string[]) => {
    const n = ++tries.current;
    setNet("sending");
    try {
      await onSubmit?.(value);
      if (n === tries.current) setNet("ok");
    } catch {
      if (n === tries.current) setNet("queued");
    }
  };
  const send = (value: string[]) => {
    if (sent || !isAnswered(q, value)) return;
    setSent(value);
    void push(value);
  };
  // Saved on the phone, sent when it is back online.
  useEffect(() => {
    if (net !== "queued" || !sent) return;
    const again = () => void push(sent);
    window.addEventListener("online", again);
    return () => window.removeEventListener("online", again);
  }, [net, sent]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = sent ?? picked;
  const grade = revealed ? gradeQuestion(q, sent ?? undefined) : null;
  const status: AnswerPadStatus = revealed ? (grade?.correct ? "correct" : sent ? "wrong" : "closed") : closed && !sent ? "closed" : sent ? (net === "sending" ? "sending" : net === "queued" ? "queued" : "waiting") : "choosing";
  const locked = status !== "choosing";

  const tap = (id: string) => {
    if (locked) return;
    if (q.kind === "multi") setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    else send([id]);
  };

  const message: Record<AnswerPadStatus, ReactNode> = {
    choosing: "",
    sending: "Sending your answer",
    queued: (
      <>
        Saved on this phone. It sends when you are back online.{" "}
        <button type="button" onClick={() => sent && void push(sent)} className={cn("rounded font-medium underline underline-offset-2", focusRing)}>
          Try now
        </button>
      </>
    ),
    waiting: "Answer sent. Waiting for the others",
    correct: q.points && q.points > 1 ? `Right. +${grade?.points ?? 0} points` : "Right",
    wrong: grade && grade.fraction > 0 ? `Partly right. ${Math.round(grade.fraction * 100)}% of the points` : "Not this time",
    closed: revealed ? "No answer sent" : "Time is up",
  };

  const tone = status === "correct" ? "text-emerald-600 dark:text-emerald-400" : status === "wrong" ? "text-red-600 dark:text-red-400" : "text-muted-foreground";

  return (
    <section aria-label="Answer pad" className={cn("mx-auto flex w-full max-w-[420px] flex-col gap-4 rounded-3xl border bg-card p-4 text-card-foreground", className)}>
      <header className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
        <span>{HINT[q.kind]}</span>
        {secondsLeft !== undefined && <span className="tabular-nums" aria-label={`${secondsLeft} seconds left`}>{secondsLeft}s</span>}
      </header>
      <h2 className="text-[19px] leading-snug font-semibold tracking-[-0.01em] text-balance">{q.prompt}</h2>

      {q.kind === "short" ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            send([text.trim()]);
          }}
        >
          <input
            value={sent ? sent[0] : text}
            onChange={(e) => setText(e.target.value)}
            disabled={locked}
            aria-label="Your answer"
            autoComplete="off"
            className={cn("h-14 rounded-2xl border bg-background px-4 text-[17px] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-80", status === "correct" && "border-emerald-500", status === "wrong" && "border-red-500")}
          />
          {!locked && <Lock disabled={!text.trim()} />}
          {revealed && status === "wrong" && <p className="text-[13px] text-muted-foreground">Accepted: {q.answer.join(", ")}</p>}
        </form>
      ) : (
        <div role={q.kind === "multi" ? "group" : "radiogroup"} aria-label="Choices" className={cn("grid gap-3", choices.length <= 4 && choices.every((c) => c.label.length <= 22) ? "grid-cols-2" : "grid-cols-1")}>
          {choices.map((c, i) => {
            const on = shown.includes(c.id);
            const right = revealed && q.answer.includes(c.id);
            const wrong = revealed && on && !q.answer.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                role={q.kind === "multi" ? "checkbox" : "radio"}
                aria-checked={on}
                disabled={locked}
                onClick={() => tap(c.id)}
                className={cn(
                  "relative flex min-h-24 flex-col items-start justify-between gap-2 rounded-2xl border p-3.5 text-left text-[16px] leading-tight font-medium outline-none transition-[background-color,border-color,opacity,transform] duration-(--kn-dur-fast) ease-(--kn-ease-out) motion-reduce:transition-none",
                  focusRing,
                  !locked && "active:scale-[.97]",
                  on && !revealed ? "border-foreground bg-foreground text-background" : "bg-background",
                  locked && !on && !right && "opacity-55",
                  right && "border-emerald-500 bg-emerald-500/12",
                  wrong && "border-red-500 bg-red-500/12",
                )}
              >
                <span className={cn("grid size-7 place-items-center rounded-lg font-mono text-[13px]", on && !revealed ? "bg-background/20" : "bg-muted text-muted-foreground")}>{LETTERS[i]}</span>
                <span>{c.label}</span>
                {right && <span className="absolute top-3 right-3 size-5 text-emerald-600 dark:text-emerald-400"><CheckGlyph /></span>}
                {wrong && <span className="absolute top-3 right-3 size-5 text-red-600 dark:text-red-400"><CrossGlyph /></span>}
              </button>
            );
          })}
        </div>
      )}

      {q.kind === "multi" && !locked && <Lock disabled={picked.length === 0} onClick={() => send(picked)} />}

      <p role="status" aria-live="polite" className={cn("min-h-6 text-center text-[14px]", tone)}>
        {message[status]}
      </p>
      {revealed && q.explanation && <p className="border-t pt-3 text-[13.5px] leading-relaxed text-muted-foreground">{q.explanation}</p>}
    </section>
  );
}

function Lock({ disabled, onClick }: { disabled: boolean; onClick?: () => void }) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      disabled={disabled}
      onClick={onClick}
      className={cn("h-14 rounded-2xl bg-foreground text-[16px] font-medium text-background transition-[opacity,transform] duration-(--kn-dur-fast) ease-(--kn-ease-out) not-disabled:active:scale-[.97] disabled:opacity-40 motion-reduce:transition-none", focusRing)}
    >
      Lock in
    </button>
  );
}

export default AnswerPad;
