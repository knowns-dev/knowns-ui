/** @registry name="class-core" type="ui" title="Class core" description="Shared pure helpers for the class blocks (class-roster, gradebook, student-progress): students, assignments and a score book, averages, typed score parsing, quiz scores from responses, topic mastery, attendance counts and a safe CSV export. No React." */
import { scoreQuiz, type QuizQuestion, type QuizResponse } from "@/registry/knowns/lib/knowns/quiz";

export type ClassStudent = { id: string; name: string; email?: string };

/** One graded piece of work. `max` is its full marks; `topic` groups it for mastery; `at` is a date such as "2026-10-03" for the progress chart. */
export type Assignment = { id: string; title: string; max: number; topic?: string; at?: string };

/** Points per student per assignment. A missing or null entry is "not graded", never a zero. */
export type ScoreBook = Record<string, Record<string, number | null | undefined>>;

export type Attendance = "present" | "late" | "absent" | "excused";
export const ATTENDANCE: readonly Attendance[] = ["present", "late", "absent", "excused"];
export const ATTENDANCE_LABEL: Record<Attendance, string> = { present: "Present", late: "Late", absent: "Absent", excused: "Excused" };

/** The next status when the status chip is pressed. */
export const nextAttendance = (a: Attendance | undefined): Attendance => a ? (ATTENDANCE[(ATTENDANCE.indexOf(a) + 1) % ATTENDANCE.length] ?? "present") : "present";

/** Counts per status, plus the students with none set. Present and late both count as in the room. */
export function attendanceCounts(students: readonly ClassStudent[], today: Record<string, Attendance | undefined>): Record<Attendance, number> & { unmarked: number; inRoom: number } {
  const out = { present: 0, late: 0, absent: 0, excused: 0, unmarked: 0, inRoom: 0 };
  for (const s of students) {
    const a = today[s.id];
    if (!a) out.unmarked++;
    else out[a]++;
  }
  out.inRoom = out.present + out.late;
  return out;
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Mean of the numbers in the list, ignoring missing ones. Null when there is nothing to average. */
export function mean(values: readonly (number | null | undefined)[]): number | null {
  const xs = values.filter(finite);
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null;
}

export const round1 = (n: number): number => Math.round(n * 10) / 10;

/** A score as a percent of full marks, 0 to 100 (more for extra credit). Null for a missing score or no marks. */
export function percentOf(points: number | null | undefined, max: number): number | null {
  return finite(points) && max > 0 ? (points / max) * 100 : null;
}

/** One student's average percent over the assignments they have a score for. Each assignment counts by its percent, so a 5-mark quiz weighs the same as a 50-mark exam. */
export function studentAverage(book: ScoreBook, studentId: string, assignments: readonly Assignment[]): number | null {
  return mean(assignments.map((a) => percentOf(book[studentId]?.[a.id], a.max)));
}

/** The class's average percent on one assignment, over the students who have a score. */
export function assignmentAverage(book: ScoreBook, students: readonly ClassStudent[], assignment: Assignment): number | null {
  return mean(students.map((s) => percentOf(book[s.id]?.[assignment.id], assignment.max)));
}

/** How many students have a score for an assignment. */
export const gradedCount = (book: ScoreBook, students: readonly ClassStudent[], assignment: Assignment): number => students.filter((s) => finite(book[s.id]?.[assignment.id])).length;

export type Parsed = { ok: true; value: number | null } | { ok: false; reason: string };

/**
 * Reads what was typed in a cell. Empty clears it. A plain number is points ("8.5"); a number with % is a percent of
 * `max` ("85%"). Negative numbers and anything above `cap` times the marks are refused. A comma is a decimal comma.
 */
export function parseScore(text: string, max: number, cap = 1.5): Parsed {
  const t = text.trim().replace(",", ".");
  if (t === "") return { ok: true, value: null };
  const pct = t.endsWith("%");
  const n = Number(pct ? t.slice(0, -1).trim() : t);
  if (!Number.isFinite(n) || /[a-z]/i.test(t.replace("%", ""))) return { ok: false, reason: "Type a number" };
  if (n < 0) return { ok: false, reason: "Cannot be below 0" };
  const points = pct ? (n / 100) * max : n;
  if (points > max * cap) return { ok: false, reason: `Cannot be above ${Math.round(max * cap * 100) / 100}` };
  return { ok: true, value: Math.round(points * 100) / 100 };
}

/** How a score reads in a cell: "8.5". */
export const formatPoints = (n: number | null | undefined): string => (finite(n) ? String(Math.round(n * 100) / 100) : "");

/** How an average reads: "84%". Em dash free: a dash for none. */
export const formatPercent = (n: number | null | undefined): string => (finite(n) ? `${Math.round(n)}%` : "-");

/** A student's score on a quiz, from the responses of the class: points, full marks and percent, via `scoreQuiz`. */
export function quizPoints(questions: readonly QuizQuestion[], responses: readonly QuizResponse[], studentId: string, opts: { partial?: boolean } = {}): { points: number; max: number; percent: number } {
  const mine = responses.filter((r) => r.studentId === studentId);
  const s = scoreQuiz(questions, mine, opts);
  return { points: s.points, max: s.max, percent: s.percent };
}

/** Fills one column of the score book from a quiz: every student who answered at least one question gets their points; the others stay not graded. */
export function bookFromQuiz(book: ScoreBook, students: readonly ClassStudent[], assignmentId: string, questions: readonly QuizQuestion[], responses: readonly QuizResponse[], opts: { partial?: boolean } = {}): ScoreBook {
  const answered = new Set(responses.map((r) => r.studentId));
  const next: ScoreBook = { ...book };
  for (const s of students) {
    if (!answered.has(s.id)) continue;
    next[s.id] = { ...next[s.id], [assignmentId]: quizPoints(questions, responses, s.id, opts).points };
  }
  return next;
}

/** One topic's mastery: the mean percent over the assignments of that topic with a score. */
export type TopicMastery = { topic: string; percent: number | null; graded: number };

/** Mastery per topic for one student, in order of first appearance. Assignments without a topic fall under "General". */
export function masteryByTopic(book: ScoreBook, studentId: string, assignments: readonly Assignment[]): TopicMastery[] {
  const order: string[] = [];
  const by = new Map<string, (number | null)[]>();
  for (const a of assignments) {
    const t = a.topic ?? "General";
    if (!by.has(t)) (by.set(t, []), order.push(t));
    by.get(t)!.push(percentOf(book[studentId]?.[a.id], a.max));
  }
  return order.map((topic) => {
    const ps = by.get(topic)!;
    return { topic, percent: mean(ps), graded: ps.filter(finite).length };
  });
}

/** True when a score is under the pass mark (a percent). A missing score is not low, it is missing. */
export function isLow(points: number | null | undefined, max: number, passMark: number): boolean {
  const p = percentOf(points, max);
  return p !== null && p < passMark;
}

/** The score as a text a screen reader says: "Ada, Quiz 2: 8 of 10, 80 percent", with ", below the pass mark" when it is under `passMark`, or "no score". */
export function describeScore(student: string, assignment: Assignment, points: number | null | undefined, passMark?: number): string {
  if (!finite(points)) return `${student}, ${assignment.title}: no score`;
  const low = passMark !== undefined && isLow(points, assignment.max, passMark) ? ", below the pass mark" : "";
  return `${student}, ${assignment.title}: ${formatPoints(points)} of ${assignment.max}, ${Math.round((points / Math.max(1, assignment.max)) * 100)} percent${low}`;
}

/** A cell that a spreadsheet could read as a formula is made plain text, so an exported name cannot run anything. */
export function csvSafe(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function csvCell(text: string): string {
  const t = csvSafe(text);
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** The score book as CSV: a Student column, one column per assignment (points), then Average (percent). Not graded is an empty cell. */
export function toCsv(students: readonly ClassStudent[], assignments: readonly Assignment[], book: ScoreBook): string {
  const head = ["Student", ...assignments.map((a) => `${a.title} (/${a.max})`), "Average %"];
  const rows = students.map((s) => {
    const avg = studentAverage(book, s.id, assignments);
    return [s.name, ...assignments.map((a) => formatPoints(book[s.id]?.[a.id])), avg === null ? "" : String(round1(avg))];
  });
  const foot = ["Class average %", ...assignments.map((a) => { const v = assignmentAverage(book, students, a); return v === null ? "" : String(round1(v)); }), ""];
  return [head, ...rows, foot].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** "2 hours ago" style text for a timestamp, against `now`. A date in the future reads as now. */
export function ago(atMs: number | undefined, now: number): string {
  if (!finite(atMs)) return "Never";
  const s = Math.max(0, Math.round((now - atMs) / 1000));
  if (s < 60) return "Just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "Yesterday" : `${d} days ago`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Oct 3" for "2026-10-03"; the text as it is when it is not a date. */
export function shortDate(at: string | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(at ?? "");
  return m ? `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}` : (at ?? "");
}

/** Assignments in date order (the order given when they have no date). */
export function byDate(assignments: readonly Assignment[]): Assignment[] {
  return assignments.map((a, i) => ({ a, i })).sort((x, y) => (x.a.at ?? "").localeCompare(y.a.at ?? "") || x.i - y.i).map((x) => x.a);
}

/** One row per graded assignment in date order, labelled by its date ("Sep 26", or the title when it has none): the student's percent and the class average, for a line chart. Assignments the student has no score for are left out. */
export function progressSeries(book: ScoreBook, students: readonly ClassStudent[], studentId: string, assignments: readonly Assignment[]): { id: string; label: string; student: number; class: number | null }[] {
  const out: { id: string; label: string; student: number; class: number | null }[] = [];
  for (const a of byDate(assignments)) {
    const p = percentOf(book[studentId]?.[a.id], a.max);
    if (p === null) continue;
    const c = assignmentAverage(book, students, a);
    out.push({ id: a.id, label: a.at ? shortDate(a.at) : a.title, student: Math.round(p * 10) / 10, class: c === null ? null : Math.round(c * 10) / 10 });
  }
  return out;
}

/** Topics by month for a heatmap: the mean percent of the student's graded assignments of that topic in that month, null where there are none. Assignments without a date fall in one "All" column. */
export function masteryGrid(book: ScoreBook, studentId: string, assignments: readonly Assignment[]): { topics: string[]; months: string[]; values: (number | null)[][] } {
  const topics: string[] = [];
  const keys = new Set<string>();
  const cell = new Map<string, (number | null)[]>();
  for (const a of assignments) {
    const t = a.topic ?? "General";
    if (!topics.includes(t)) topics.push(t);
    const k = /^\d{4}-\d{2}/.exec(a.at ?? "")?.[0] ?? "All";
    keys.add(k);
    const key = `${t}|${k}`;
    if (!cell.has(key)) cell.set(key, []);
    cell.get(key)!.push(percentOf(book[studentId]?.[a.id], a.max));
  }
  const ordered = [...keys].sort();
  const label = (k: string) => (k === "All" ? k : (MONTHS[Number(k.slice(5)) - 1] ?? k));
  return {
    topics,
    months: ordered.map(label),
    values: topics.map((t) => ordered.map((k) => { const v = mean(cell.get(`${t}|${k}`) ?? []); return v === null ? null : Math.round(v); })),
  };
}
