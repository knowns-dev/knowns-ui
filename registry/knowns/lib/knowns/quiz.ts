/** @registry name="quiz" type="lib" title="Quiz model" description="Shared quiz types (QuizQuestion, QuizResponse) and grading: gradeQuestion with partial credit for multiple choice, scoreQuiz, and validateQuestion. Pure functions, no React." */

/** One choice of a single or multi question. `id` is what answers and responses refer to. */
export type QuizChoice = { id: string; label: string };

export type QuizKind = "single" | "multi" | "truefalse" | "short";

/**
 * One question.
 * - single: `choices` has two or more, `answer` is the id of the right one.
 * - multi: `answer` holds the id of every right choice.
 * - truefalse: no `choices` needed; `answer` is ["true"] or ["false"] (see TRUE_FALSE).
 * - short: `answer` lists every accepted text; a response matches one when it is equal after trimming,
 *   collapsing spaces and ignoring case.
 */
export type QuizQuestion = {
  id: string;
  kind: QuizKind;
  prompt: string;
  choices?: QuizChoice[];
  answer: string[];
  explanation?: string;
  /** Points for a full answer. Defaults to 1. */
  points?: number;
  timeLimitSec?: number;
};

/** What one student sent for one question: choice ids (single, multi, truefalse) or the typed text as `value[0]` (short). */
export type QuizResponse = { questionId: string; studentId: string; value: string[]; atMs: number };

/** A quiz as the player and the builder pass it around. */
export type Quiz = { id: string; title: string; questions: QuizQuestion[] };

/** The two fixed choices of a truefalse question. */
export const TRUE_FALSE: QuizChoice[] = [
  { id: "true", label: "True" },
  { id: "false", label: "False" },
];

/** The choices to show for a question: its own, or True and False. Short questions have none. */
export function choicesOf(q: QuizQuestion): QuizChoice[] {
  if (q.kind === "truefalse") return q.choices?.length ? q.choices : TRUE_FALSE;
  if (q.kind === "short") return [];
  return q.choices ?? [];
}

export const pointsOf = (q: QuizQuestion): number => (q.points !== undefined && q.points >= 0 ? q.points : 1);

/** Lower case, trimmed, runs of white space collapsed to one space. */
export const normalizeText = (s: string): string => s.trim().replace(/\s+/g, " ").toLowerCase();

/** True when the response holds something to grade (a choice, or non-blank text). */
export function isAnswered(q: QuizQuestion, value: readonly string[] | undefined): boolean {
  if (!value || value.length === 0) return false;
  return q.kind === "short" ? normalizeText(value[0] ?? "") !== "" : true;
}

export type Grade = {
  /** Exactly right. */
  correct: boolean;
  /** Share of the points earned, 0 to 1. Only a multi question can land between. */
  fraction: number;
  /** Points earned: fraction times the question's points. */
  points: number;
  max: number;
  /** Right choices picked, wrong ones picked, and right ones left out (multi). */
  hits: string[];
  extras: string[];
  misses: string[];
};

/**
 * Grade one response.
 * Multi earns partial credit: (right picked - wrong picked) over the number of right choices, never below 0, and only
 * the exact set is `correct`. Pass `{ partial: false }` for all or nothing. Every other kind is right or wrong.
 */
export function gradeQuestion(q: QuizQuestion, value: readonly string[] | undefined, opts: { partial?: boolean } = {}): Grade {
  const max = pointsOf(q);
  const done = (fraction: number, hits: string[], extras: string[], misses: string[]): Grade => ({
    correct: fraction === 1,
    fraction,
    points: Math.round(fraction * max * 1000) / 1000,
    max,
    hits,
    extras,
    misses,
  });
  const given = [...new Set(value ?? [])];
  if (!isAnswered(q, given)) return done(0, [], [], q.kind === "short" ? [] : [...q.answer]);

  if (q.kind === "short") {
    const said = normalizeText(given[0] ?? "");
    const ok = q.answer.some((a) => normalizeText(a) === said);
    return done(ok ? 1 : 0, ok ? [given[0]!] : [], ok ? [] : [given[0]!], []);
  }
  if (q.kind === "multi") {
    const want = new Set(q.answer);
    const hits = given.filter((v) => want.has(v));
    const extras = given.filter((v) => !want.has(v));
    const misses = q.answer.filter((v) => !given.includes(v));
    if (want.size === 0) return done(0, hits, extras, misses);
    if (extras.length === 0 && misses.length === 0) return done(1, hits, extras, misses);
    const part = opts.partial === false ? 0 : Math.max(0, (hits.length - extras.length) / want.size);
    return done(Math.min(part, 0.999), hits, extras, misses);
  }
  // single and truefalse: one id, and it has to be the answer
  const ok = given.length === 1 && q.answer.length === 1 && given[0] === q.answer[0];
  return done(ok ? 1 : 0, ok ? given : [], ok ? [] : given, ok ? [] : [...q.answer]);
}

/** The newest response of each question, optionally for one student. */
export function latestResponses(responses: readonly QuizResponse[], studentId?: string): Map<string, QuizResponse> {
  const out = new Map<string, QuizResponse>();
  for (const r of responses) {
    if (studentId !== undefined && r.studentId !== studentId) continue;
    const prev = out.get(r.questionId);
    if (!prev || r.atMs >= prev.atMs) out.set(r.questionId, r);
  }
  return out;
}

export type QuizScore = {
  points: number;
  max: number;
  /** 0 to 100, rounded. 0 for a quiz worth no points. */
  percent: number;
  /** Questions answered exactly right, answered at all, and in total. */
  correct: number;
  answered: number;
  total: number;
  perQuestion: Record<string, Grade>;
};

/** Score a quiz from a map of question id to value, or from responses (the newest per question counts). */
export function scoreQuiz(questions: readonly QuizQuestion[], answers: Record<string, readonly string[]> | readonly QuizResponse[], opts: { partial?: boolean } = {}): QuizScore {
  const byId: Record<string, readonly string[] | undefined> = Array.isArray(answers)
    ? Object.fromEntries([...latestResponses(answers as readonly QuizResponse[])].map(([id, r]) => [id, r.value]))
    : (answers as Record<string, readonly string[]>);
  const perQuestion: Record<string, Grade> = {};
  let points = 0;
  let max = 0;
  let correct = 0;
  let answered = 0;
  for (const q of questions) {
    const v = byId[q.id];
    const g = gradeQuestion(q, v, opts);
    perQuestion[q.id] = g;
    points += g.points;
    max += g.max;
    if (g.correct) correct++;
    if (isAnswered(q, v)) answered++;
  }
  points = Math.round(points * 1000) / 1000;
  return { points, max, percent: max > 0 ? Math.round((points / max) * 100) : 0, correct, answered, total: questions.length, perQuestion };
}

/** Problems that would stop a question from being asked or graded; an empty list means it is fine. */
export function validateQuestion(q: QuizQuestion): string[] {
  const out: string[] = [];
  if (!q.prompt.trim()) out.push("Write the question.");
  if (q.points !== undefined && !(q.points >= 0)) out.push("Points can not be negative.");
  if (q.timeLimitSec !== undefined && !(q.timeLimitSec > 0)) out.push("A time limit must be more than 0 seconds.");
  if (q.kind === "short") {
    if (!q.answer.some((a) => normalizeText(a) !== "")) out.push("Add at least one accepted answer.");
    return out;
  }
  const choices = choicesOf(q);
  if (q.kind !== "truefalse") {
    if (choices.length < 2) out.push("Add at least two choices.");
    if (choices.some((c) => !c.label.trim())) out.push("Every choice needs a label.");
    if (new Set(choices.map((c) => c.id)).size !== choices.length) out.push("Choice ids must be unique.");
  }
  const ids = new Set(choices.map((c) => c.id));
  if (q.answer.length === 0) out.push(q.kind === "multi" ? "Mark at least one right choice." : "Mark the right choice.");
  else if (q.kind !== "multi" && q.answer.length > 1) out.push("Only one choice can be right.");
  if (q.answer.some((a) => !ids.has(a))) out.push("The answer points at a choice that does not exist.");
  return out;
}

/** Problems with the question list as a whole (empty list, repeated ids), then each question's own, prefixed with its number. */
export function validateQuiz(questions: readonly QuizQuestion[]): string[] {
  const out: string[] = [];
  if (questions.length === 0) out.push("Add at least one question.");
  if (new Set(questions.map((q) => q.id)).size !== questions.length) out.push("Question ids must be unique.");
  questions.forEach((q, i) => validateQuestion(q).forEach((m) => out.push(`Question ${i + 1}: ${m}`)));
  return out;
}
