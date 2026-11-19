"use client";
/** @registry name="question-card" type="ui" title="Question Card" description="One quiz question to answer: single choice, multiple choice, true or false or a typed answer. Keys 1 to 9 pick a choice, Enter submits, and a verdict with the explanation opens when the answer is checked. Right and wrong are announced to screen readers." */

import { useCallback, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CheckGlyph, CrossGlyph } from "@/registry/knowns/lib/knowns/quiz-glyphs";
import { choicesOf, gradeQuestion, isAnswered, pointsOf, type Grade, type QuizQuestion } from "@/registry/knowns/lib/knowns/quiz";
import { Fold } from "@/registry/knowns/lib/knowns/motion";
import { cn } from "@/registry/knowns/lib/knowns/utils";

/** idle: nothing answered yet. answered: an answer is picked, or it is locked in without a verdict. correct, wrong: the verdict is showing. */
export type QuestionState = "idle" | "answered" | "correct" | "wrong";

export interface QuestionCardProps {
  question: QuizQuestion;
  /** Choice ids, or the typed text as the first item for a short question. Controlled. */
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** Whether the answer has been handed in (it is then locked). Controlled. */
  submitted?: boolean;
  defaultSubmitted?: boolean;
  /** Called when the answer is handed in, with its grade. */
  onSubmit?: (value: string[], grade: Grade) => void;
  /** Show right and wrong once submitted. Pass false for a quiz that reveals at the end: the answer locks, no verdict. Default true. */
  reveal?: boolean;
  /** Shown above the prompt as "Question 3". */
  number?: number;
  /** Show the 1 to 9 key on each choice. Default true. */
  showKeys?: boolean;
  /** Label of the submit button. Default "Check answer". */
  submitLabel?: string;
  /** Focus the card's first control on mount. */
  autoFocus?: boolean;
  /** Extra content in the footer, next to the submit button (for example a Next button). */
  actions?: ReactNode;
  disabled?: boolean;
  className?: string;
}

const KIND_LABEL: Record<QuizQuestion["kind"], string> = { single: "Pick one", multi: "Pick all that apply", truefalse: "True or false", short: "Type the answer" };

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const labelOf = (q: QuizQuestion, id: string) => choicesOf(q).find((c) => c.id === id)?.label ?? id;

/** The state a card is in for a value, a submit and a verdict. Exported for the player's review. */
export function questionState(q: QuizQuestion, value: readonly string[] | undefined, submitted: boolean, reveal: boolean): QuestionState {
  if (submitted && reveal) return gradeQuestion(q, value).correct ? "correct" : "wrong";
  return submitted || isAnswered(q, value) ? "answered" : "idle";
}

/**
 * One question to answer, keyboard first. The choices are native radio buttons or checkboxes, so arrow keys, Space and
 * the screen reader's own role words just work; on top of that the keys 1 to 9 pick a choice and Enter hands the answer
 * in (Enter in the text box of a short question too). When the answer is checked, the right choices turn green, a wrong
 * pick turns red with a cross (never colour alone), and a verdict with the explanation opens below. A polite live region
 * says "Correct" or "Not quite" and what the answer was.
 */
export function QuestionCard({ question: q, value, defaultValue, onValueChange, submitted, defaultSubmitted, onSubmit, reveal = true, number, showKeys = true, submitLabel = "Check answer", autoFocus, actions, disabled, className }: QuestionCardProps) {
  const uid = useId();
  const root = useRef<HTMLElement>(null);
  const [innerValue, setInnerValue] = useState<string[]>(defaultValue ?? []);
  const [innerDone, setInnerDone] = useState(defaultSubmitted ?? false);
  const val = value ?? innerValue;
  const done = submitted ?? innerDone;
  const choices = choicesOf(q);
  const multi = q.kind === "multi";
  const isShort = q.kind === "short";
  const grade = gradeQuestion(q, val);
  const state = questionState(q, val, done, reveal);
  const locked = done || disabled;
  const canSubmit = !locked && isAnswered(q, val);
  const shown = done && reveal;

  const set = useCallback(
    (next: string[]) => {
      if (value === undefined) setInnerValue(next);
      onValueChange?.(next);
    },
    [value, onValueChange],
  );
  const submit = useCallback(() => {
    if (!canSubmit) return;
    if (submitted === undefined) setInnerDone(true);
    onSubmit?.(val, gradeQuestion(q, val));
  }, [canSubmit, submitted, onSubmit, val, q]);

  const pick = (id: string) => {
    if (locked) return;
    if (multi) set(val.includes(id) ? val.filter((v) => v !== id) : [...val, id]);
    else set([id]);
  };

  // Keys 1 to 9 pick, T and F answer a true or false question, Enter submits. Typing in the text box is left alone.
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement;
    const typing = t instanceof HTMLInputElement && t.type === "text";
    if (e.key === "Enter") {
      if (t instanceof HTMLButtonElement || done) return;
      if (canSubmit) {
        e.preventDefault();
        submit();
      }
      return;
    }
    if (typing || locked) return;
    let index = /^[1-9]$/.test(e.key) ? Number(e.key) - 1 : -1;
    if (q.kind === "truefalse" && index < 0) index = e.key.toLowerCase() === "t" ? 0 : e.key.toLowerCase() === "f" ? 1 : -1;
    const c = choices[index];
    if (!c) return;
    e.preventDefault();
    pick(c.id);
    root.current?.querySelector<HTMLInputElement>(`input[data-choice="${CSS.escape(c.id)}"]`)?.focus();
  };

  const rightText = q.answer.map((a) => labelOf(q, a)).join(", ");
  const verdict = shown ? (grade.correct ? "Correct" : grade.fraction > 0 ? `Partly right, ${plural(grade.hits.length, "choice")} of ${q.answer.length}` : "Not quite") : "";
  const announce = shown ? `${verdict}.${grade.correct ? "" : ` ${isShort ? "An accepted answer is" : q.answer.length > 1 ? "The right answers are" : "The right answer is"} ${rightText}.`}` : done ? "Answer locked in." : "";

  return (
    <section
      ref={root}
      data-slot="question-card"
      data-state={state}
      data-kind={q.kind}
      aria-labelledby={`${uid}-q`}
      onKeyDown={onKeyDown}
      className={cn("w-full rounded-xl border bg-card p-5 text-card-foreground sm:p-6", className)}
    >
      <div className="flex items-center justify-between gap-3 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
        <span>{number !== undefined ? `Question ${number}` : "Question"}</span>
        <span>
          {KIND_LABEL[q.kind]}
          {q.points !== undefined || q.kind === "multi" ? <span className="ml-2 text-foreground/60">{plural(pointsOf(q), "pt")}</span> : null}
        </span>
      </div>
      <p id={`${uid}-q`} className="mt-3 text-[17px] leading-snug font-semibold text-balance">
        {q.prompt}
      </p>

      {isShort ? (
        <div className="mt-4">
          <input
            type="text"
            value={val[0] ?? ""}
            onChange={(e) => set(e.target.value === "" ? [] : [e.target.value])}
            readOnly={locked}
            autoFocus={autoFocus}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-labelledby={`${uid}-q`}
            aria-describedby={`${uid}-live`}
            aria-invalid={shown && !grade.correct ? true : undefined}
            placeholder="Your answer"
            data-result={shown ? (grade.correct ? "correct" : "wrong") : undefined}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 read-only:bg-muted/40 data-[result=correct]:border-emerald-500 data-[result=wrong]:border-red-500"
          />
        </div>
      ) : (
        <fieldset className="mt-4 grid gap-2 border-0 p-0" disabled={disabled}>
          <legend className="sr-only">
            {q.prompt} ({KIND_LABEL[q.kind]})
          </legend>
          {choices.map((c, i) => {
            const on = val.includes(c.id);
            const right = q.answer.includes(c.id);
            const mark = shown ? (right ? "right" : on ? "wrong" : undefined) : undefined;
            return (
              <label
                key={c.id}
                data-choice-row
                data-selected={on || undefined}
                data-mark={mark}
                className={cn(
                  "group/choice relative flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-background px-3 py-2 text-sm transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out)",
                  "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                  !locked && "hover:bg-accent/60",
                  locked && "cursor-default",
                  "data-[selected]:border-foreground/50 data-[selected]:bg-accent",
                  "data-[mark=right]:border-emerald-500 data-[mark=right]:bg-emerald-500/10 data-[mark=wrong]:border-red-500 data-[mark=wrong]:bg-red-500/10",
                )}
              >
                <input
                  type={multi ? "checkbox" : "radio"}
                  name={`${uid}-c`}
                  value={c.id}
                  data-choice={c.id}
                  checked={on}
                  onChange={() => pick(c.id)}
                  disabled={locked}
                  autoFocus={autoFocus && i === 0}
                  className="peer sr-only"
                />
                {showKeys && i < 9 ? (
                  <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-md border bg-muted/50 font-mono text-[11px] text-muted-foreground transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) group-data-[selected]/choice:border-foreground/40 group-data-[selected]/choice:text-foreground">
                    {i + 1}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 leading-snug">{c.label}</span>
                {mark === "right" ? <CheckGlyph className="shrink-0 text-emerald-600 dark:text-emerald-400" /> : null}
                {mark === "wrong" ? <CrossGlyph className="shrink-0 text-red-600 dark:text-red-400" /> : null}
                {mark ? <span className="sr-only">{mark === "right" ? (on ? "Your answer, correct" : "Correct answer, not picked") : "Your answer, wrong"}</span> : null}
              </label>
            );
          })}
        </fieldset>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!done ? (
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-[opacity,transform] duration-(--kn-dur-fast) ease-(--kn-ease-out) outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[.97] disabled:pointer-events-none disabled:opacity-50"
          >
            {submitLabel}
          </button>
        ) : null}
        {actions}
        {!done && showKeys ? (
          <span className="hidden text-xs text-muted-foreground sm:inline">{isShort ? "Enter to check" : q.kind === "truefalse" ? "Press 1, 2, T or F, then Enter" : `Press ${choices.length > 1 ? `1 to ${Math.min(choices.length, 9)}` : "1"}, then Enter`}</span>
        ) : null}
      </div>

      <div id={`${uid}-live`} role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
      <Fold open={shown}>
        <div data-slot="question-verdict" data-result={grade.correct ? "correct" : "wrong"} className="mt-4 border-t pt-4 text-sm">
          <p className={cn("flex items-center gap-2 font-medium", grade.correct ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
            {grade.correct ? <CheckGlyph /> : <CrossGlyph />}
            <span>{verdict}</span>
            <span className="font-mono text-xs font-normal text-muted-foreground">
              {Math.round(grade.points * 100) / 100} / {grade.max} pt
            </span>
          </p>
          {!grade.correct ? (
            <p className="mt-1.5 text-muted-foreground">
              {isShort ? "An accepted answer: " : q.answer.length > 1 ? "Right answers: " : "Right answer: "}
              <span className="text-foreground">{rightText}</span>
            </p>
          ) : null}
          {q.explanation ? <p className="mt-2 text-pretty text-muted-foreground">{q.explanation}</p> : null}
        </div>
      </Fold>
    </section>
  );
}
