"use client";
/** @registry name="password-strength" type="ui" title="Password strength" description="Segmented strength meter with a text label, a live configurable rules checklist, a generate-and-copy strong password button and polite announcements. Exports pure scorePassword, passwordRules, checkPassword and generatePassword helpers." */

/**
 * PasswordStrength: a segmented meter with a text label, a live checklist of rules, and an optional
 * "Generate strong password" button. Pair it with PasswordField on sign-up and change-password forms.
 *
 * The scoring is a small pure helper (scorePassword): an entropy estimate from length and character
 * classes, with penalties for repeats, sequences, a short list of very common passwords and the
 * user's own name or email. It is a guide for people, not a security check: enforce your real
 * policy on the server.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn, writeClipboard } from "@/registry/knowns/lib/knowns/utils";
import { Button } from "./button";

/* ── Scoring (pure) ── */

export type StrengthScore = 0 | 1 | 2 | 3 | 4;

export const STRENGTH_LABELS: Record<StrengthScore, string> = {
  0: "Too weak",
  1: "Weak",
  2: "Okay",
  3: "Strong",
  4: "Very strong",
};

/** Very common choices; matched after lower-casing, undoing look-alike swaps and dropping trailing digits and symbols. */
const COMMON = new Set(
  (
    "password passw0rd pass passwd secret letmein welcome admin administrator login root master qwerty qwertyuiop asdf asdfgh asdfghjkl " +
    "zxcvbn zxcvbnm azerty iloveyou loveyou princess sunshine shadow monkey dragon football baseball soccer hockey batman superman " +
    "starwars pokemon trustno1 whatever freedom hello hellothere charlie michael jordan jennifer thomas daniel buster tigger summer " +
    "winter spring autumn flower cookie cheese chocolate computer internet google facebook instagram twitter youtube samsung apple " +
    "abc abcd abcde abcdef abcdefg abcdefgh abc123 a1b2c3 123 1234 12345 123456 1234567 12345678 123456789 1234567890 0987654321 " +
    "111111 000000 121212 123123 654321 666666 696969 7777777 88888888 987654321 qazwsx 1q2w3e4r 1qaz2wsx zaq12wsx changeme default " +
    "guest test tester testing user username temp temppassword access access14 matrix killer hunter ranger ninja mustang harley " +
    "corvette ferrari banana orange purple silver golden diamond angel angels blessed jesus love lovely family forever friend friends"
  ).split(" "),
);

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i" };

/** The password with look-alikes undone and trailing digits and symbols dropped: "P@ssw0rd2024!" → "password". */
export function baseWord(pw: string) {
  const lower = pw.toLowerCase();
  const trimmed = lower.replace(/[^a-z]+$/, "") || lower;
  return [...trimmed].map((c) => LEET[c] ?? c).join("");
}

export function isCommonPassword(pw: string) {
  if (!pw) return false;
  const lower = pw.toLowerCase();
  return COMMON.has(lower) || COMMON.has(baseWord(pw)) || COMMON.has(lower.replace(/[^a-z0-9]+$/, ""));
}

/** Words of the user's own details worth checking: "ana.seed@mail.com", "Ana Seed" → ["ana", "seed", "mail"]. */
export function personalWords(userInputs: readonly string[] = []) {
  const words = new Set<string>();
  for (const input of userInputs) {
    for (const w of input.toLowerCase().split(/[^a-z0-9]+/)) if (w.length >= 3 && !["com", "net", "org", "www"].includes(w)) words.add(w);
  }
  return [...words];
}

export function containsPersonal(pw: string, userInputs: readonly string[] = []) {
  const lower = pw.toLowerCase();
  const base = baseWord(pw);
  return personalWords(userInputs).some((w) => lower.includes(w) || base.includes(w));
}

/** Character pool size from the classes present. */
export function poolSize(pw: string) {
  let n = 0;
  if (/[a-z]/.test(pw)) n += 26;
  if (/[A-Z]/.test(pw)) n += 26;
  if (/[0-9]/.test(pw)) n += 10;
  if (/[\x20-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/.test(pw)) n += 33;
  if (/[^\x00-\x7f]/.test(pw)) n += 100;
  return Math.max(n, 1);
}

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];

/** Two neighbours on a keyboard row or in the alphabet / digits, in either direction. */
function stepOf(a: string, b: string): number | null {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (/[a-z0-9]/.test(x) && /[a-z0-9]/.test(y)) {
    const d = y.charCodeAt(0) - x.charCodeAt(0);
    if (d === 1 || d === -1) return d;
  }
  for (const row of ROWS) {
    const i = row.indexOf(x);
    const j = row.indexOf(y);
    if (i >= 0 && j >= 0 && Math.abs(j - i) === 1) return (j - i) * 10;
  }
  return null;
}

/**
 * Length after discounting predictable characters: the third and later character of a repeat ("aaa")
 * or a run ("abcd", "4321", "qwer") count a quarter each.
 */
export function effectiveLength(pw: string) {
  const chars = [...pw];
  let len = 0;
  let run = 1;
  let lastStep: number | null | "same" = null;
  for (let i = 0; i < chars.length; i++) {
    if (i === 0) {
      len += 1;
      continue;
    }
    const step: number | null | "same" = chars[i] === chars[i - 1] ? "same" : stepOf(chars[i - 1], chars[i]);
    run = step !== null && step === lastStep ? run + 1 : step !== null ? 2 : 1;
    lastStep = step;
    len += run >= 3 ? 0.25 : 1;
  }
  return len;
}

export interface StrengthResult {
  score: StrengthScore;
  label: string;
  /** Rough entropy estimate in bits, after penalties. */
  bits: number;
  /** Short, plain reasons the score is held back. */
  warnings: string[];
}

export interface ScoreOptions {
  /** The user's name, email and similar: a password containing them scores lower. */
  userInputs?: readonly string[];
}

/** Score a password from 0 (too weak) to 4 (very strong). Pure, no dictionary dependency. */
export function scorePassword(pw: string, { userInputs = [] }: ScoreOptions = {}): StrengthResult {
  if (!pw) return { score: 0, label: STRENGTH_LABELS[0], bits: 0, warnings: [] };
  const warnings: string[] = [];
  let len = effectiveLength(pw);
  if (len < [...pw].length - 1) warnings.push("Avoid repeats and runs like aaa, abc or 123.");

  const personal = personalWords(userInputs).filter((w) => pw.toLowerCase().includes(w) || baseWord(pw).includes(w));
  if (personal.length) {
    warnings.push("Leave out your name and email.");
    for (const w of personal) len -= w.length - 1;
  }

  let bits = Math.max(0, len) * Math.log2(poolSize(pw));
  const common = isCommonPassword(pw);
  if (common) {
    warnings.unshift("This is a very common password.");
    bits = Math.min(bits, 10);
  }

  let score: StrengthScore = bits < 28 ? 0 : bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  if ([...pw].length < 8 && score > 1) score = 1;
  if (personal.length && score > 1) score = 1;
  if (!common && score < 3 && [...pw].length < 12) warnings.push("Longer is stronger: aim for 12 characters or more.");
  return { score, label: STRENGTH_LABELS[score], bits: Math.round(bits), warnings };
}

/* ── Rules (pure) ── */

export interface RuleContext {
  userInputs: readonly string[];
}

export interface PasswordRule {
  id: string;
  label: string;
  test: (pw: string, ctx: RuleContext) => boolean;
}

export interface PasswordRuleOptions {
  /** Minimum length; 0 leaves the rule out. Default 12. */
  minLength?: number;
  /** Both upper and lower case letters. Default true. */
  mixedCase?: boolean;
  /** At least one digit. Default true. */
  number?: boolean;
  /** At least one symbol. Default false: length helps more than symbols. */
  symbol?: boolean;
  /** Not in the built-in list of very common passwords. Default true. */
  notCommon?: boolean;
  /** Doesn't contain the user's name or email (pass userInputs). Default true. */
  notPersonal?: boolean;
}

/** Build the checklist rules. Add your own { id, label, test } to the array for anything else. */
export function passwordRules({ minLength = 12, mixedCase = true, number = true, symbol = false, notCommon = true, notPersonal = true }: PasswordRuleOptions = {}): PasswordRule[] {
  const rules: PasswordRule[] = [];
  if (minLength > 0) rules.push({ id: "length", label: `At least ${minLength} characters`, test: (pw) => [...pw].length >= minLength });
  if (mixedCase) rules.push({ id: "case", label: "Upper and lower case letters", test: (pw) => /\p{Ll}/u.test(pw) && /\p{Lu}/u.test(pw) });
  if (number) rules.push({ id: "number", label: "A number", test: (pw) => /\d/.test(pw) });
  if (symbol) rules.push({ id: "symbol", label: "A symbol, such as ! or #", test: (pw) => /[^\p{L}\p{N}]/u.test(pw) });
  if (notCommon) rules.push({ id: "common", label: "Not a common password", test: (pw) => pw.length > 0 && !isCommonPassword(pw) });
  if (notPersonal) rules.push({ id: "personal", label: "Not your name or email", test: (pw, ctx) => pw.length > 0 && !containsPersonal(pw, ctx.userInputs) });
  return rules;
}

export interface RuleResult {
  id: string;
  label: string;
  met: boolean;
}

export function checkPassword(pw: string, rules: readonly PasswordRule[], ctx: Partial<RuleContext> = {}): RuleResult[] {
  const c: RuleContext = { userInputs: ctx.userInputs ?? [] };
  return rules.map((r) => ({ id: r.id, label: r.label, met: r.test(pw, c) }));
}

/* ── Generating (pure, given a random source) ── */

const SETS = {
  lower: "abcdefghijkmnopqrstuvwxyz", // no l
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ", // no I, O
  digits: "23456789", // no 0, 1
  symbols: "!#$%&*+-=?@^_~",
};

/** A uniform integer in [0, n) from crypto.getRandomValues, without modulo bias. */
export function cryptoRandom(n: number) {
  const max = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0] < max) return buf[0] % n;
  }
}

export interface GenerateOptions {
  /** Default 20. */
  length?: number;
  /** Include symbols. Default true. */
  symbols?: boolean;
  /** Random integer in [0, n). Defaults to crypto.getRandomValues. */
  random?: (n: number) => number;
}

/** A random password with every class present and no look-alike characters (0/O, 1/l/I). */
export function generatePassword({ length = 20, symbols = true, random = cryptoRandom }: GenerateOptions = {}) {
  const sets = [SETS.lower, SETS.upper, SETS.digits, ...(symbols ? [SETS.symbols] : [])];
  const n = Math.max(length, sets.length);
  const all = sets.join("");
  const out = sets.map((s) => s[random(s.length)]);
  while (out.length < n) out.push(all[random(all.length)]);
  // Fisher-Yates, so the guaranteed characters are not always first.
  for (let i = out.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join("");
}

/* ── Component ── */

/** Filled segments for a score: an empty value fills none, any value fills at least one. */
export function filledSegments(score: StrengthScore, segments: 4 | 5, empty: boolean) {
  if (empty) return 0;
  return segments === 5 ? score + 1 : Math.max(1, score);
}

/**
 * Per-segment transition delay for a level change from `from` to `to` filled segments: the newly
 * filled ones grow left to right one after another, emptied ones shrink right to left.
 */
export function segmentDelay(i: number, from: number, to: number, step = 40) {
  if (to > from) return i >= from && i < to ? (i - from) * step : 0;
  if (to < from) return i >= to && i < from ? (from - 1 - i) * step : 0;
  return 0;
}

/** Scores the meter steps through when a generated password lands: current + 1 ... target. */
export function rampSteps(from: StrengthScore, to: StrengthScore): StrengthScore[] {
  const out: StrengthScore[] = [];
  for (let s = from + 1; s <= to; s++) out.push(s as StrengthScore);
  return out;
}

/** Bar tone per level, applied through one CSS variable so every filled segment shifts together. */
const TONE_COLOR: Record<StrengthScore, string> = { 0: "#ef4444", 1: "#f97316", 2: "#f59e0b", 3: "#10b981", 4: "#059669" };
const TONE_TEXT: Record<StrengthScore, string> = {
  0: "text-red-700 dark:text-red-400",
  1: "text-orange-700 dark:text-orange-400",
  2: "text-amber-700 dark:text-amber-300",
  3: "text-emerald-700 dark:text-emerald-400",
  4: "text-emerald-700 dark:text-emerald-300",
};

const EASE_OUT = "cubic-bezier(.22,1,.36,1)";
const OVERSHOOT = "cubic-bezier(.34,1.56,.64,1)";

function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Empty ring that turns into a filled check: the disc scales up with a slight overshoot, the tick draws. */
const Tick = ({ on }: { on: boolean }) => (
  <span aria-hidden="true" className="relative grid size-3.5 flex-none place-items-center">
    <svg viewBox="0 0 16 16" fill="none" className="absolute inset-0 size-full">
      <circle cx="8" cy="8" r="6.25" strokeWidth="1.25" className="stroke-[color-mix(in_srgb,var(--foreground)_28%,transparent)]" />
    </svg>
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={cn(
        "absolute inset-0 size-full transition-[transform,opacity] motion-reduce:transition-none",
        on ? "scale-100 opacity-100 duration-200" : "scale-[.6] opacity-0 duration-150",
      )}
      style={{ transitionTimingFunction: on ? OVERSHOOT : "ease-out" }}
    >
      <circle cx="8" cy="8" r="7" className="fill-emerald-500 dark:fill-emerald-400" />
      <path
        d="M5.25 8.25 7.1 10l3.65-4"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray="1"
        className={cn(
          "stroke-white transition-[stroke-dashoffset] motion-reduce:transition-none dark:stroke-emerald-950",
          on ? "[stroke-dashoffset:0] delay-75 duration-200 motion-reduce:delay-0" : "[stroke-dashoffset:1] duration-100",
        )}
      />
    </svg>
  </span>
);

const LABEL_SLOTS = ["Strength", ...([0, 1, 2, 3, 4] as const).map((s) => STRENGTH_LABELS[s])];

/** All labels stacked in one grid cell: the slot is as wide as the longest, the active one crossfades in with a 6px slide. */
function StrengthLabel({ level, score }: { level: number; score: StrengthScore | null }) {
  return (
    <span aria-hidden="true" className="grid min-w-0 justify-items-end text-[12.5px] font-medium">
      {LABEL_SLOTS.map((text, i) => {
        const at = i - 1; // -1 = "Strength" (empty)
        const active = at === level;
        return (
          <span
            key={text}
            className={cn(
              "col-start-1 row-start-1 whitespace-nowrap transition-[opacity,transform,color] duration-[180ms] motion-reduce:transition-none",
              at === -1 ? "text-muted-foreground" : TONE_TEXT[(score ?? 0) as StrengthScore],
              active ? "translate-y-0 opacity-100" : at < level ? "-translate-y-1.5 opacity-0" : "translate-y-1.5 opacity-0",
            )}
            style={{ transitionTimingFunction: EASE_OUT }}
          >
            {text}
          </span>
        );
      })}
    </span>
  );
}

export interface PasswordStrengthProps {
  /** The password being typed. */
  value: string;
  /** The user's name, email and similar, for the "not personal" rule and the score. */
  userInputs?: readonly string[];
  /** Checklist rules. Default passwordRules(): 12+ characters, mixed case, a number, not common, not personal. */
  rules?: readonly PasswordRule[];
  /** Hide the checklist (meter and label only). */
  checklist?: boolean;
  /** 4 or 5 meter segments. Default 4. */
  segments?: 4 | 5;
  /** Show "Generate strong password"; called with the new password. Fill the field and reveal it there. */
  onGenerate?: (password: string) => void;
  /** Options for the generated password. */
  generate?: Omit<GenerateOptions, "random">;
  /** Wait this long after typing stops before announcing the strength to screen readers. Default 700ms. */
  announceDelay?: number;
  /** Your own scoring, e.g. a server-side estimate. Defaults to scorePassword. */
  score?: (value: string, opts: ScoreOptions) => StrengthResult;
  id?: string;
  className?: string;
}

export function PasswordStrength({
  value,
  userInputs = [],
  rules,
  checklist = true,
  segments = 4,
  onGenerate,
  generate,
  announceDelay = 700,
  score: scoreFn = scorePassword,
  id,
  className,
}: PasswordStrengthProps) {
  const autoId = useId();
  const baseId = id ?? autoId;
  const inputsKey = userInputs.join("\n");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const result = useMemo(() => scoreFn(value, { userInputs }), [value, inputsKey, scoreFn]);
  const ruleList = useMemo(() => rules ?? passwordRules(), [rules]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checks = useMemo(() => checkPassword(value, ruleList, { userInputs }), [value, ruleList, inputsKey]);
  const empty = value.length === 0;
  const met = checks.filter((c) => c.met).length;

  // After "Generate", the meter climbs one level at a time to the new score instead of jumping.
  const [ramp, setRamp] = useState<StrengthScore | null>(null);
  const rampTimer = useRef<ReturnType<typeof setInterval>>(undefined);
  useEffect(() => () => clearInterval(rampTimer.current), []);
  const shownScore: StrengthScore = ramp ?? result.score;

  // Level = filled segments. Remember the previous one so only a level change animates, with a stagger.
  const level = filledSegments(shownScore, segments, empty && ramp === null);
  const prevLevel = useRef(level);
  const fromLevel = prevLevel.current;
  useEffect(() => {
    prevLevel.current = level;
  }, [level]);

  // A single shimmer across the bar when Very strong is reached.
  const barRef = useRef<HTMLDivElement>(null);
  const prevScore = useRef<StrengthScore | null>(null);
  const top = !empty && shownScore === 4;
  useEffect(() => {
    const was = prevScore.current;
    prevScore.current = empty ? null : shownScore;
    if (!top || was === 4 || was === null || prefersReducedMotion()) return;
    const sheen = barRef.current?.querySelector<HTMLElement>("[data-sheen]");
    sheen?.animate?.(
      [
        { transform: "translateX(-100%)", opacity: 0 },
        { opacity: 1, offset: 0.25 },
        { transform: "translateX(100%)", opacity: 0 },
      ],
      { duration: 900, delay: 180, easing: "cubic-bezier(.4,0,.2,1)" },
    );
  }, [top, shownScore, empty]);

  // Polite, debounced announcement: once typing pauses, and only when the message changes.
  const message = empty ? "" : `Password strength: ${result.label}.${checklist && checks.length ? ` ${met} of ${checks.length} requirements met.` : ""}`;
  const [announced, setAnnounced] = useState("");
  useEffect(() => {
    if (!message) {
      setAnnounced("");
      return;
    }
    const t = setTimeout(() => setAnnounced(message), announceDelay);
    return () => clearTimeout(t);
  }, [message, announceDelay]);

  // The hint keeps its line: the text fades, nothing below moves. The last text stays while it fades out.
  const hint = !empty && result.score < 3 ? result.warnings[0] : undefined;
  const lastHint = useRef(hint);
  if (hint) lastHint.current = hint;

  // Generate + copy.
  const [generated, setGenerated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  const canCopy = generated !== null && generated === value && ramp === null;

  const onGenerateClick = () => {
    const pw = generatePassword(generate);
    const target = scoreFn(pw, { userInputs }).score;
    const steps = rampSteps(empty ? 0 : result.score, target);
    setGenerated(pw);
    setCopied(false);
    clearInterval(rampTimer.current);
    if (steps.length > 1 && !prefersReducedMotion()) {
      setRamp(empty ? 0 : result.score);
      let i = 0;
      rampTimer.current = setInterval(() => {
        const next = steps[i++];
        if (next === undefined) {
          clearInterval(rampTimer.current);
          setRamp(null);
        } else setRamp(next);
      }, 110);
    } else setRamp(null);
    onGenerate?.(pw);
  };

  const onCopy = async () => {
    try {
      await writeClipboard(value);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div data-slot="password-strength" className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex items-center gap-3">
        <div
          ref={barRef}
          role="meter"
          aria-label="Password strength"
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={empty ? 0 : result.score}
          aria-valuetext={empty ? "No password yet" : result.label}
          className="relative grid flex-1 gap-1"
          style={{ gridTemplateColumns: `repeat(${segments}, minmax(0, 1fr))`, ["--kn-pw-tone" as string]: TONE_COLOR[shownScore] }}
        >
          {Array.from({ length: segments }, (_, i) => (
            <span key={i} className="relative h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
              <span
                className={cn(
                  "absolute inset-0 origin-left rounded-full bg-[var(--kn-pw-tone)] motion-reduce:transition-none",
                  i < level ? "scale-x-100" : "scale-x-0",
                )}
                style={{
                  transitionProperty: "transform, background-color",
                  transitionDuration: "220ms, 250ms",
                  transitionTimingFunction: `${EASE_OUT}, ease-out`,
                  transitionDelay: `${segmentDelay(i, fromLevel, level)}ms, 0ms`,
                }}
              />
            </span>
          ))}
          {/* One sweep of light when Very strong is reached (never with reduced motion). */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
            <span data-sheen className="absolute inset-y-0 left-0 w-full bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.75),transparent)] opacity-0 dark:bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.45),transparent)]" />
          </span>
        </div>
        <StrengthLabel level={empty && ramp === null ? -1 : shownScore} score={shownScore} />
      </div>

      {checklist && checks.length > 0 && (
        <ul aria-label="Password requirements" className="grid gap-1.5 sm:grid-cols-2">
          {checks.map((c) => (
            <li
              key={c.id}
              className={cn("flex items-center gap-2 text-[12.5px] transition-colors duration-200 motion-reduce:transition-none", c.met ? "text-foreground" : "text-muted-foreground")}
            >
              <Tick on={c.met} />
              <span>
                <span className="sr-only">{c.met ? "Done: " : "Not yet: "}</span>
                {c.label}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Reserved line: appears and disappears by opacity only. */}
      <p
        aria-hidden={!hint || undefined}
        className={cn(
          "min-h-[1lh] truncate text-[12px] leading-[18px] text-muted-foreground transition-opacity duration-200 motion-reduce:transition-none",
          hint ? "opacity-100" : "opacity-0",
        )}
      >
        {hint ?? lastHint.current ?? " "}
      </p>

      {onGenerate && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onGenerateClick}
            icon={
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M13.25 8a5.25 5.25 0 1 1-1.54-3.71" />
                <path d="M13.25 2.75v2.5h-2.5" />
              </svg>
            }
          >
            {generated ? "Generate another" : "Generate strong password"}
          </Button>
          <span className={cn("transition-opacity duration-200 motion-reduce:transition-none", canCopy ? "opacity-100" : "pointer-events-none opacity-0")} aria-hidden={!canCopy || undefined}>
            <Button type="button" size="sm" variant="ghost" onClick={onCopy} tabIndex={canCopy ? undefined : -1}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </span>
        </div>
      )}

      <span id={`${baseId}-status`} role="status" className="sr-only">
        {announced}
      </span>
    </div>
  );
}
