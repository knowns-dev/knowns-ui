"use client";
/** @registry name="hero" type="block" title="Hero" description="Landing page hero, centred: eyebrow chip, rotating headline word, two CTAs, an install command chip, optional facts row and a background slot. align=\"start\" for a left-aligned version. Reduced motion keeps it still. Pro variants: hero-split, hero-product, hero-statement." */

/**
 * Hero sections. Plain by default: a headline, a lead and your actions on the page background. Eyebrow,
 * rotating words, a command chip, facts and a background are opt-in, so each page picks only what it needs.
 *
 * HeroCentered: centred, or left-aligned with `align="start"`; an optional row of facts under the actions.
 * The parts (Eyebrow, Title, Lead, Actions, Facts, Backdrop) are exported for the other hero layouts:
 * hero-split, hero-product and hero-statement (Knowns UI Pro), which build on this file.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn, focusRing, writeClipboard } from "@/registry/knowns/lib/knowns/utils";
import { WordRotate } from "../../text-animation/word-rotate";
import { ActionButton, type MediaFrameProps } from "./section-heading";
import { commandText, type MarketingAction } from "./marketing-utils";

export type { MarketingAction } from "./marketing-utils";
export { MediaFrame } from "./section-heading";

export interface HeroFact {
  value: string;
  label: string;
}

export interface HeroCopy {
  /** A short line above the headline, e.g. "Changelog: run replays". With href it is a link; badge is a word in the accent. */
  eyebrow?: { label: ReactNode; href?: string; badge?: string };
  title: ReactNode;
  /** The headline's element. Default "h1"; use "h2" when the hero is not the page's main heading (a demo, a section). */
  as?: "h1" | "h2" | "h3";
  /** Words for the end of the headline. The first one shows still; set `rotateAuto` to cycle through them. */
  rotate?: string[];
  /** Cycle `rotate` on its own. Off by default: a headline that keeps changing is read less, not more. */
  rotateAuto?: boolean;
  lead?: ReactNode;
  primary?: MarketingAction;
  /** Shown as a quiet text link next to the primary button. */
  secondary?: MarketingAction;
  /** An install or CLI command in a chip with a Copy button (developer products). */
  command?: string;
  /** The command types through a list of names (see CommandCycle). `command` is the static fallback and the first frame. */
  commandCycle?: CommandCycle;
  /** Up to 4 short facts under the actions, e.g. { value: "EU", label: "data residency" }. */
  facts?: HeroFact[];
}

/** Opt-in layer behind the section: one of our Backgrounds. */
export function Backdrop({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 [&>*]:size-full">
      {children}
    </div>
  );
}

export const isFrameProps = (m: unknown): m is MediaFrameProps =>
  !!m && typeof m === "object" && !("$$typeof" in (m as object)) && ("src" in (m as object) || "video" in (m as object));

/* ── Parts ── */

export function Eyebrow({ eyebrow }: { eyebrow: NonNullable<HeroCopy["eyebrow"]> }) {
  const inner = (
    <>
      {eyebrow.badge && <span className="text-indigo-600 dark:text-indigo-400">{eyebrow.badge}</span>}
      {eyebrow.badge && (
        <span aria-hidden="true" className="text-border">
          |
        </span>
      )}
      <span>{eyebrow.label}</span>
      {eyebrow.href && (
        <span aria-hidden="true" className="text-muted-foreground transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) group-hover/eyebrow:text-foreground">
          →
        </span>
      )}
    </>
  );
  const cls = "group/eyebrow inline-flex items-center gap-2 text-[14px] font-semibold text-foreground";
  return eyebrow.href ? (
    <a href={eyebrow.href} className={cn(cls, "rounded-lg", focusRing)}>
      {inner}
    </a>
  ) : (
    <p className={cls}>{inner}</p>
  );
}

/** A command whose last part types through a list of names: `prefix` + name + `suffix`. */
export interface CommandCycle {
  prefix: string;
  names: string[];
  suffix?: string;
}

/**
 * Types each name in turn, one character at a time (linear), holds it, erases it faster and moves on.
 * Text only, and the box is sized for the longest name, so nothing shifts. The first name is the state at
 * render: the server HTML and reduced motion show one static command. Pauses on pointer or focus, while
 * the tab is hidden and after a copy. Timers only, so it never blocks input.
 */
function useTyping(names: string[], paused: boolean) {
  const [idx, setIdx] = useState(0);
  const [len, setLen] = useState(names[0]?.length ?? 0);
  const [phase, setPhase] = useState<"hold" | "erase" | "type">("hold");
  const [live, setLive] = useState(false);
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const on = () => setShown(!document.hidden);
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  useEffect(() => {
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setLive(!reduced && names.length > 1);
  }, [names.length]);
  useEffect(() => {
    if (!live || paused || !shown) return;
    let wait = 64;
    let step: () => void = () => {};
    if (phase === "hold") {
      wait = 2200;
      step = () => setPhase("erase");
    } else if (phase === "erase") {
      wait = len > 0 ? 26 : 240;
      step = () => {
        if (len > 0) return setLen(len - 1);
        setIdx((idx + 1) % names.length);
        setPhase("type");
      };
    } else {
      step = () => {
        setLen(len + 1);
        if (len + 1 >= (names[idx] ?? "").length) setPhase("hold");
      };
    }
    const t = window.setTimeout(step, wait);
    return () => window.clearTimeout(t);
  }, [live, paused, shown, idx, len, phase, names]);
  return { idx, len, live };
}

export function CommandChip({ command, cycle, onCopy, className }: { command: string; cycle?: CommandCycle; onCopy?: () => void; className?: string }) {
  const [copied, setCopied] = useState(false);
  const [hover, setHover] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const names = cycle?.names ?? [];
  const typing = useTyping(names, hover || copied);
  const nameNow = cycle ? (names[typing.idx] ?? "") : "";
  const full = cycle ? `${cycle.prefix}${nameNow}${cycle.suffix ?? ""}` : command;
  const longest = cycle ? cycle.prefix.length + Math.max(0, ...names.map((n) => n.length)) + (cycle.suffix?.length ?? 0) : 0;
  const copy = async () => {
    try {
      await writeClipboard(commandText(full));
      setCopied(true);
      onCopy?.();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };
  return (
    <div
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      className={cn("inline-flex h-10 max-w-full items-center gap-2 rounded-lg border bg-card pr-1 pl-3 font-mono text-[13px]", className)}
    >
      <span aria-hidden="true" className="text-muted-foreground select-none">
        $
      </span>
      {/* Long commands fade out at the edge (the fade sits on the padding when the command fits). */}
      <button type="button" onClick={copy} title={commandText(full)} className={cn("min-w-0 cursor-pointer overflow-hidden rounded text-left", focusRing)}>
        <code className="block overflow-hidden pr-5 whitespace-nowrap [mask-image:linear-gradient(90deg,#000_calc(100%-1.25rem),transparent)]" style={cycle ? { minWidth: `${longest}ch` } : undefined}>
          {cycle ? (
            <>
              <span className="sr-only">{commandText(full)}</span>
              <span aria-hidden="true">
                {cycle.prefix}
                {nameNow.slice(0, typing.len)}
                {typing.live && <span className="ml-px inline-block h-[1.1em] w-[2px] translate-y-[2px] bg-foreground/60" />}
                {typing.len >= nameNow.length ? cycle.suffix : ""}
              </span>
            </>
          ) : (
            commandText(command)
          )}
        </code>
      </button>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy command"}
        className={cn("grid size-8 flex-none cursor-pointer place-items-center rounded-lg text-muted-foreground transition-[color,background-color,transform] duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:bg-muted hover:text-foreground active:scale-[0.97]", focusRing)}
      >
        {copied ? (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4 animate-[kn-pop_var(--kn-dur)_var(--kn-ease-out)_both] motion-reduce:animate-none">
            <path d="m3.5 8.5 3 3 6-7" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true" className="size-4">
            <rect x="5.25" y="5.25" width="8" height="8" rx="1.75" />
            <path d="M10.75 5.25v-1.5a1.5 1.5 0 0 0-1.5-1.5h-5a1.5 1.5 0 0 0-1.5 1.5v5a1.5 1.5 0 0 0 1.5 1.5h1.5" />
          </svg>
        )}
      </button>
      <span role="status" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </div>
  );
}

/** Display type: 48 / 56 / 64, the only place with tight tracking. */
export const DISPLAY = "text-[48px] leading-[1.04] sm:text-[56px] lg:text-[64px]";

export function Title({ title, rotate, rotateAuto = false, as: H = "h1", className }: { title: ReactNode; rotate?: string[]; rotateAuto?: boolean; as?: "h1" | "h2" | "h3"; className?: string }) {
  return (
    <H className={cn("text-balance font-semibold tracking-[-0.035em]", className)}>
      {title}
      {rotate && rotate.length > 0 && (
        <>
          {" "}
          <WordRotate words={rotate} paused={!rotateAuto} wordClassName="text-muted-foreground" />
        </>
      )}
    </H>
  );
}

/** `balance`: even line lengths (a centred lead); otherwise pretty wrapping, which only avoids a lone last word. */
export const Lead = ({ children, balance, className }: { children?: ReactNode; balance?: boolean; className?: string }) =>
  children ? <p className={cn("max-w-2xl text-[16px] leading-7 text-muted-foreground", balance ? "text-balance" : "text-pretty", className)}>{children}</p> : null;

export function Actions({ primary, secondary, center }: { primary?: MarketingAction; secondary?: MarketingAction; center?: boolean }) {
  if (!primary && !secondary) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-3", center && "justify-center")}>
      {/* data-hero-action: a page can react to the CTAs (hover, focus) by delegation, without wrapping them. */}
      {primary && (
        <span data-hero-action="primary" className="contents">
          <ActionButton action={primary} />
        </span>
      )}
      {secondary && (
        <span data-hero-action="secondary" className="contents">
          <TextAction action={secondary} />
        </span>
      )}
    </div>
  );
}

function TextAction({ action }: { action: MarketingAction }) {
  const cls = cn("group/sec inline-flex h-10 items-center gap-1 rounded-lg text-[15px] font-semibold text-foreground", focusRing);
  const inner = (
    <>
      {action.label}
      <span aria-hidden="true" className="text-muted-foreground transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) group-hover/sec:text-foreground">
        →
      </span>
    </>
  );
  return action.href ? (
    <a href={action.href} onClick={action.onClick} target={action.external ? "_blank" : undefined} rel={action.external ? "noreferrer" : undefined} className={cls}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={action.onClick} className={cn(cls, "cursor-pointer")}>
      {inner}
    </button>
  );
}

export function Facts({ facts, center }: { facts?: HeroFact[]; center?: boolean }) {
  if (!facts?.length) return null;
  return (
    <dl className={cn("grid w-full max-w-2xl grid-cols-2 gap-x-8 gap-y-4 border-t pt-6 sm:grid-cols-4", center ? "text-center" : "text-left")}>
      {facts.slice(0, 4).map((f) => (
        <div key={f.label} className="flex flex-col gap-1">
          <dt className="order-2 text-[13px] text-muted-foreground">{f.label}</dt>
          <dd className="order-1 text-[16px] font-semibold">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ── Centered / left-aligned ── */

export interface HeroCenteredProps extends HeroCopy {
  /** Centred (default) or left-aligned. */
  align?: "center" | "start";
  /** Opt-in: behind everything, one of our Backgrounds sized to fill. */
  background?: ReactNode;
  /** Anything under the actions: a screenshot, logos, a live component. */
  children?: ReactNode;
  /**
   * Vertical padding: "default" 64/96px (phone/desktop), "tight" 48/64px when the next section should show
   * sooner, "snug" 24/32px on top (48/64px below) when a `figure` already gives the top its weight.
   */
  spacing?: "default" | "tight" | "snug";
  /** A visual above the eyebrow, e.g. a character or a mark. Give it a fixed size so nothing shifts when it loads. */
  figure?: ReactNode;
  /** Called after the install command is copied. */
  onCommandCopy?: () => void;
  className?: string;
}

export function HeroCentered({ eyebrow, title, rotate, rotateAuto, as, lead, primary, secondary, command, commandCycle, facts, align = "center", background, spacing = "default", figure, onCommandCopy, children, className }: HeroCenteredProps) {
  const center = align === "center";
  return (
    <section data-slot="hero" data-variant={center ? "centered" : "start"} className={cn("relative isolate overflow-hidden", className)}>
      <Backdrop>{background}</Backdrop>
      <div className={cn("mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6", spacing === "snug" ? "pt-6 pb-12 sm:pt-8 sm:pb-16" : spacing === "tight" ? "py-12 sm:py-16" : "py-16 sm:py-24", center ? "items-center text-center" : "items-start text-left")}>
        {figure}
        {eyebrow && <Eyebrow eyebrow={eyebrow} />}
        <Title title={title} rotate={rotate} rotateAuto={rotateAuto} as={as} className={cn(DISPLAY, "max-w-4xl")} />
        <Lead balance={center}>{lead}</Lead>
        <div className={cn("mt-2 flex w-full min-w-0 flex-col gap-6", center ? "items-center" : "items-start")}>
          <Actions primary={primary} secondary={secondary} center={center} />
          {command && <CommandChip command={command} cycle={commandCycle} onCopy={onCommandCopy} />}
        </div>
        {facts && (
          <div className={cn("mt-6 flex w-full", center && "justify-center")}>
            <Facts facts={facts} center={center} />
          </div>
        )}
        {children && <div className="mt-8 w-full">{children}</div>}
      </div>
    </section>
  );
}
