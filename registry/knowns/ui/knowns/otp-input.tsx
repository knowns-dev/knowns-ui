"use client";
/** @registry name="otp-input" type="ui" title="OTP input" description="One-time code in N slots: paste fills all, auto-advance and backspace, numeric or alphanumeric, masked, error state, onComplete. Characters drop into place, one focus tint slides to the active slot, and with onVerify the slots merge into one pill that turns green with Verified, or shakes and splits back." */

import { useEffect, useId, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { MOTION } from "@/registry/knowns/lib/knowns/motion-utils";

export type OtpMode = "numeric" | "alphanumeric";

/* ── Pure helpers (exported for tests) ── */

/** Keeps only the characters a slot accepts: digits, or letters and digits (upper-cased). */
export function sanitizeOtp(text: string, mode: OtpMode = "numeric"): string {
  return mode === "numeric" ? text.replace(/\D/g, "") : text.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

/**
 * Writes `text` into the slots from `index` on (a paste or a fast typist) and returns the new slots
 * and the slot to focus next. A paste as long as the whole code always fills from the first slot.
 */
export function fillSlots(slots: string[], index: number, text: string, mode: OtpMode = "numeric"): { slots: string[]; focus: number } {
  const chars = sanitizeOtp(text, mode);
  if (!chars) return { slots, focus: index };
  const start = chars.length >= slots.length ? 0 : index;
  const next = [...slots];
  let i = start;
  for (const c of chars) {
    if (i >= next.length) break;
    next[i++] = c;
  }
  return { slots: next, focus: Math.min(i, next.length - 1) };
}

/** Backspace: clear this slot, or if it is already empty, clear the one before and move there. */
export function backspaceSlots(slots: string[], index: number): { slots: string[]; focus: number } {
  const next = [...slots];
  if (next[index]) {
    next[index] = "";
    return { slots: next, focus: index };
  }
  const prev = Math.max(0, index - 1);
  next[prev] = "";
  return { slots: next, focus: prev };
}

const toSlots = (value: string, length: number) => Array.from({ length }, (_, i) => value[i] ?? "");

/**
 * How far each slot moves to close the gaps: the slots end up side by side, centred where the row was. `lefts` and
 * `widths` are the slots' boxes in the row's px; the result is each slot's x offset, and the merged pill's left and width.
 */
export function mergeOffsets(lefts: number[], widths: number[]): { dx: number[]; left: number; width: number } {
  if (!lefts.length) return { dx: [], left: 0, width: 0 };
  const total = widths.reduce((a, b) => a + b, 0);
  const first = lefts[0] ?? 0;
  const last = (lefts.at(-1) ?? 0) + (widths.at(-1) ?? 0);
  const left = (first + last) / 2 - total / 2;
  let x = left;
  const dx = lefts.map((l, i) => {
    const d = x - l;
    x += widths[i] ?? 0;
    return +d.toFixed(2);
  });
  return { dx, left: +left.toFixed(2), width: total };
}

export type OtpStatus = "idle" | "verifying" | "verified" | "error";

/* ── Component ── */

export interface OtpInputProps {
  /** Number of slots. Default 6. */
  length?: number;
  /** The code so far (controlled). */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Called once every slot is filled. */
  onComplete?: (code: string) => void;
  /**
   * Checks a complete code. While it runs the slots merge into one pill; true turns it green with a check and
   * `verifiedLabel`; false (or a throw) shakes it once and splits it back with the code cleared. The signal aborts when
   * the code changes or the input unmounts, and a late answer is dropped.
   */
  onVerify?: (code: string, signal: AbortSignal) => boolean | Promise<boolean>;
  /** The verify state, controlled. Without it, onVerify drives it. */
  status?: OtpStatus;
  onStatusChange?: (status: OtpStatus) => void;
  /** Words in the green pill. Default "Verified". */
  verifiedLabel?: string;
  mode?: OtpMode;
  /** Shows dots instead of the characters (the value is unchanged). */
  mask?: boolean;
  /** Draws a gap after these slot counts, e.g. [3] for "123 456". */
  groups?: number[];
  invalid?: boolean;
  disabled?: boolean;
  size?: "md" | "lg";
  autoFocus?: boolean;
  /** id of the first slot, for a Field label. */
  id?: string;
  name?: string;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
}

const SLOT = {
  md: "h-10 w-10 rounded-[10px] text-[16px] pointer-coarse:h-11 pointer-coarse:w-11",
  lg: "h-12 w-12 rounded-[12px] text-[20px]",
};

/*
 * Motion (frequent tier, tokens only; reduced motion: everything instant, the caret steady):
 * - a typed character drops 6px into its slot (--kn-dur, ease-out); a paste drops all of them at once;
 * - one focus tint slides to the active slot (--kn-dur-fast, ease-out) instead of each slot lighting up on its own;
 * - a caret blinks in the empty active slot, like the native one;
 * - verifying, the slots slide together and square their inner corners over one pill (--kn-dur, ease-out); verified,
 *   the pill tints green and the check and label rise in; an error shakes it once (--kn-dur-slow) and splits it back.
 */
const CSS = `
@keyframes kn-otp-drop{from{opacity:0;translate:0 -6px}}
@keyframes kn-otp-caret{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes kn-otp-rise{from{opacity:0;translate:0 6px}}
@keyframes kn-otp-shake{0%,100%{translate:0}20%{translate:-6px}45%{translate:5px}70%{translate:-2px}}
[data-kn-otp] .kn-otp-drop{animation:kn-otp-drop var(--kn-dur,180ms) var(--kn-ease-out,cubic-bezier(.22,1,.36,1)) both}
[data-kn-otp] .kn-otp-rise{animation:kn-otp-rise var(--kn-dur,180ms) var(--kn-ease-out,cubic-bezier(.22,1,.36,1)) both}
[data-kn-otp] .kn-otp-caret{animation:kn-otp-caret 1s step-end infinite}
[data-kn-otp][data-shake] .kn-otp-row{animation:kn-otp-shake var(--kn-dur-slow,280ms) var(--kn-ease-out,cubic-bezier(.22,1,.36,1))}
@media (prefers-reduced-motion:reduce){[data-kn-otp] .kn-otp-drop,[data-kn-otp] .kn-otp-rise,[data-kn-otp][data-shake] .kn-otp-row{animation:none}[data-kn-otp] .kn-otp-caret{animation:none}}
`;

/** One-time code in separate slots: type, paste the whole code, Backspace and arrows move between slots. */
export function OtpInput({
  length = 6,
  value: valueProp,
  defaultValue = "",
  onValueChange,
  onComplete,
  onVerify,
  status: statusProp,
  onStatusChange,
  verifiedLabel = "Verified",
  mode = "numeric",
  mask = false,
  groups,
  invalid,
  disabled,
  size = "md",
  autoFocus,
  id,
  name,
  className,
  "aria-label": label = "One-time code",
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": required,
}: OtpInputProps) {
  const [own, setOwn] = useState(defaultValue);
  const value = valueProp ?? own;
  const slots = toSlots(value, length);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const boxes = useRef<(HTMLSpanElement | null)[]>([]);
  const row = useRef<HTMLDivElement>(null);
  const auto = useId();
  const firstId = id ?? auto;
  const [ownStatus, setOwnStatus] = useState<OtpStatus>("idle");
  const status = statusProp ?? ownStatus;
  const setStatus = (s: OtpStatus) => {
    if (statusProp === undefined) setOwnStatus(s);
    onStatusChange?.(s);
  };
  // A code that failed stays marked until the next character.
  const [failed, setFailed] = useState(false);
  const bad = invalid || ariaInvalid || failed;
  const merged = status === "verifying" || status === "verified" || status === "error";
  const [focus, setFocus] = useState<number | null>(null);
  // Slots typed into since mount drop in; the first render and a reset draw them in place.
  const [typed, setTyped] = useState<Record<number, number>>({});
  const verifying = useRef<AbortController | null>(null);

  const commit = (next: string[], to: number, changed?: number[]) => {
    const code = next.join("");
    if (valueProp === undefined) setOwn(code);
    if (code !== value) {
      onValueChange?.(code);
      setFailed(false);
      verifying.current?.abort();
      if (changed?.length) setTyped((t) => Object.fromEntries([...Object.entries(t), ...changed.map((i) => [i, (t[i] ?? 0) + 1])]));
    }
    if (code.length === length && !next.includes("") && code !== value) {
      onComplete?.(code);
      if (onVerify) verify(code);
    }
    const el = refs.current[to];
    el?.focus();
    el?.select();
  };

  const verify = (code: string) => {
    verifying.current?.abort();
    const ac = new AbortController();
    verifying.current = ac;
    setStatus("verifying");
    Promise.resolve()
      .then(() => onVerify!(code, ac.signal))
      .then(
        (ok) => !ac.signal.aborted && setStatus(ok ? "verified" : "error"),
        () => !ac.signal.aborted && setStatus("error"),
      );
  };
  useEffect(() => () => verifying.current?.abort(), []);

  // Error: shake the merged pill once, then split back with the code cleared and the first slot focused.
  const [shake, setShake] = useState(false);
  useEffect(() => {
    if (status !== "error") return;
    const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    setShake(!still);
    const t = window.setTimeout(() => {
      setShake(false);
      setFailed(true);
      if (valueProp === undefined) setOwn("");
      onValueChange?.("");
      setTyped({});
      setStatus("idle");
      refs.current[0]?.focus();
    }, still ? 0 : MOTION.slow + 20);
    return () => window.clearTimeout(t);
    // Runs once per error; the callbacks are read fresh when it fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Geometry for the focus tint and the merge, measured from the slots in the row's px.
  const [geo, setGeo] = useState<{ lefts: number[]; widths: number[]; h: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const els = boxes.current.slice(0, length);
      if (!els.every(Boolean)) return;
      const lefts = els.map((e) => e!.offsetLeft);
      const widths = els.map((e) => e!.offsetWidth);
      const h = els[0]!.offsetHeight;
      setGeo((g) => (g && g.h === h && g.lefts.join() === lefts.join() && g.widths.join() === widths.join() ? g : { lefts, widths, h }));
    };
    measure();
    if (typeof ResizeObserver === "undefined" || !row.current) return;
    const ro = new ResizeObserver(measure);
    ro.observe(row.current);
    return () => ro.disconnect();
  }, [length, size, groups?.join()]);
  const m = geo ? mergeOffsets(geo.lefts, geo.widths) : null;

  const onInput = (i: number, raw: string) => {
    if (merged) return;
    // Some mobile keyboards delete with an input event instead of a Backspace key.
    if (raw === "") {
      const next = [...slots];
      next[i] = "";
      return commit(next, i);
    }
    // The slot already holds a character; the new one is whichever differs (caret may be either side).
    const chars = raw.length > 1 && slots[i] ? raw.replace(slots[i], "") || raw.slice(-1) : raw;
    const { slots: next, focus: to } = fillSlots(slots, i, chars, mode);
    if (next === slots) return;
    commit(next, chars.length === 1 ? Math.min(i + 1, length - 1) : to, next.map((c, k) => (c !== slots[k] && c ? k : -1)).filter((k) => k >= 0));
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    const move = (to: number) => {
      e.preventDefault();
      const el = refs.current[Math.min(Math.max(0, to), length - 1)];
      el?.focus();
      el?.select();
    };
    if (merged) {
      if (e.key !== "Tab") e.preventDefault();
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      const { slots: next, focus: to } = backspaceSlots(slots, i);
      commit(next, to);
    } else if (e.key === "Delete") {
      e.preventDefault();
      const next = [...slots];
      next[i] = "";
      commit(next, i);
    } else if (e.key === "ArrowLeft") move(i - 1);
    else if (e.key === "ArrowRight") move(i + 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(length - 1);
  };

  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (merged) return;
    const { slots: next, focus: to } = fillSlots(slots, i, e.clipboardData.getData("text"), mode);
    if (next !== slots) commit(next, to, next.map((c, k) => (c !== slots[k] && c ? k : -1)).filter((k) => k >= 0));
  };

  const verified = status === "verified";
  const tintAt = focus != null && geo && !merged ? focus : null;
  const radius = size === "lg" ? 12 : 10;
  const announce = status === "verifying" ? "Checking the code" : verified ? verifiedLabel : failed ? "That code did not match" : "";

  return (
    <div data-kn-otp="" data-status={status} data-shake={shake || undefined} className="relative max-w-full">
      <style href="kn-otp-input" precedence="default">{CSS}</style>
      <div ref={row} role="group" aria-label={label} aria-describedby={describedBy} aria-busy={status === "verifying" || undefined} className={cn("kn-otp-row relative flex max-w-full items-center gap-1.5 sm:gap-2", className)}>
        {/* One pill behind the merged slots: neutral while checking, green once verified, red on an error. */}
        {m && (
          <span
            aria-hidden="true"
            data-slot="otp-pill"
            className={cn(
              "pointer-events-none absolute top-0 transition-[opacity,background-color,box-shadow] duration-(--kn-dur) ease-(--kn-ease-out) motion-reduce:transition-none",
              merged ? "opacity-100" : "opacity-0",
              verified ? "bg-emerald-500/12 shadow-[0_0_0_1.5px_rgb(16_185_129/0.55)]" : status === "error" ? "bg-red-500/10 shadow-[0_0_0_1.5px_rgb(239_68_68/0.6)]" : "bg-card shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_18%,transparent)] dark:bg-[color-mix(in_srgb,var(--muted)_35%,var(--card))]",
            )}
            style={{ left: m.left, width: m.width, height: geo!.h, borderRadius: radius }}
          />
        )}
        {/* The one focus tint: it slides to the active slot. It sits under the slots (no z-index, earlier in the order), so
            its ring shows around the active slot and never crosses the characters it passes on the way. */}
        {geo && (
          <span
            aria-hidden="true"
            data-slot="otp-focus"
            className={cn(
              "pointer-events-none absolute top-0 left-0 transition-[translate,opacity] duration-(--kn-dur-fast) ease-(--kn-ease-out) motion-reduce:transition-none",
              tintAt != null ? "opacity-100" : "opacity-0",
              bad ? "shadow-[0_0_0_1.5px_rgb(239_68_68/0.8),0_0_0_4px_rgb(239_68_68/0.16)]" : "shadow-[0_0_0_1.5px_color-mix(in_srgb,var(--ring)_90%,transparent),0_0_0_4px_color-mix(in_srgb,var(--ring)_22%,transparent)]",
            )}
            style={{ width: geo.widths[tintAt ?? 0], height: geo.h, borderRadius: radius, translate: `${geo.lefts[tintAt ?? 0] ?? 0}px 0` }}
          />
        )}
        {slots.map((c, i) => {
          const first = i === 0;
          const last = i === length - 1;
          return (
            <span key={i} className="contents">
              {groups?.includes(i) && i > 0 && <span aria-hidden="true" className={cn("mx-0.5 h-px w-2.5 flex-none bg-muted-foreground/50 transition-opacity duration-(--kn-dur-fast) ease-(--kn-ease-out) motion-reduce:transition-none", merged && "opacity-0")} />}
              <span
                ref={(el) => {
                  boxes.current[i] = el;
                }}
                className="relative flex min-w-0 shrink transition-[translate] duration-(--kn-dur) ease-(--kn-ease-out) motion-reduce:transition-none"
                style={{ translate: merged && m ? `${m.dx[i] ?? 0}px 0` : undefined }}
              >
                <input
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  id={first ? firstId : undefined}
                  type={mask ? "password" : "text"}
                  inputMode={mode === "numeric" ? "numeric" : "text"}
                  autoComplete={first ? "one-time-code" : "off"}
                  autoCapitalize={mode === "alphanumeric" ? "characters" : "off"}
                  spellCheck={false}
                  autoFocus={autoFocus && first}
                  disabled={disabled}
                  readOnly={merged || undefined}
                  value={c}
                  aria-label={`Character ${i + 1} of ${length}`}
                  aria-invalid={bad || undefined}
                  aria-required={required || undefined}
                  onChange={(e) => onInput(i, e.target.value)}
                  onKeyDown={(e) => onKeyDown(i, e)}
                  onPaste={(e) => onPaste(i, e)}
                  onFocus={(e) => {
                    setFocus(i);
                    e.target.select();
                  }}
                  onBlur={() => setFocus((f) => (f === i ? null : f))}
                  className={cn(
                    SLOT[size],
                    // Slots keep their height and narrow (never past their size) when the row is tight, e.g. 8 slots on a phone.
                    // The characters are drawn by the layer above (so they can drop in); the field's own text and caret stay invisible.
                    "min-w-0 shrink bg-card text-center font-medium tabular-nums text-transparent caret-transparent outline-none selection:bg-transparent",
                    "shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_14%,transparent),0_1px_2px_rgb(0_0_0/0.04)] transition-[box-shadow,border-radius,background-color] duration-(--kn-dur) ease-(--kn-ease-out) motion-reduce:transition-none dark:bg-[color-mix(in_srgb,var(--muted)_35%,var(--card))]",
                    bad && "shadow-[0_0_0_1px_rgb(239_68_68/0.6),0_0_0_4px_rgb(239_68_68/0.12)]",
                    // Merged: the slots sit on the pill, square their inner corners and drop their own rings.
                    merged && "bg-transparent shadow-none dark:bg-transparent",
                    merged && !first && "rounded-l-none",
                    merged && !last && "rounded-r-none",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                />
                <span aria-hidden="true" className={cn("pointer-events-none absolute inset-0 grid place-items-center font-medium tabular-nums", size === "lg" ? "text-[20px]" : "text-[16px]", disabled && "opacity-50", "transition-opacity duration-(--kn-dur-fast) ease-(--kn-ease-out) motion-reduce:transition-none", verified && "opacity-0")}>
                  {c ? (
                    <span key={typed[i] ?? 0} className={typed[i] ? "kn-otp-drop" : undefined}>
                      {mask ? "•" : c}
                    </span>
                  ) : focus === i && !merged && !disabled ? (
                    <span data-slot="otp-caret" className="kn-otp-caret block h-[1.1em] w-[1.5px] rounded-full bg-foreground" />
                  ) : null}
                </span>
              </span>
            </span>
          );
        })}
        {/* Verified: the check and the label rise into the pill as the characters fade. */}
        {verified && m && (
          <span aria-hidden="true" className="pointer-events-none absolute top-0 z-[2] flex items-center justify-center gap-1.5 text-[14px] font-medium text-emerald-700 dark:text-emerald-300" style={{ left: m.left, width: m.width, height: geo!.h }}>
            <span className="kn-otp-rise flex items-center gap-1.5">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                <path d="M3.5 8.5 6.5 11.5 12.5 5" />
              </svg>
              {verifiedLabel}
            </span>
          </span>
        )}
      </div>
      <span role="status" className="sr-only">
        {announce}
      </span>
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
