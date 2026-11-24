"use client";
/** @registry name="template-waitlist-landing" type="block" title="Waitlist landing page" description="A launch page that shows the product working: a finished call turns into a summary and a follow-up beside the headline (thinking, a streamed answer, message actions), then an email field that returns the person's place on the list, a countdown to the launch day and a line of faces as proof." */

/**
 * WaitlistLandingTemplate: one screen for a product that is about to launch, built only from the Free blocks. The
 * look is its own: a deep plum night, a slow aurora behind the headline and a row of big tabular digits. The
 * palette is a handful of CSS variables on the root (LIGHT and DARK).
 *
 * Joining is a callback: `onJoin(email)` resolves with the person's place on the list, and the page says it. The
 * countdown counts to `launchAt` on the visitor's clock and shows dashes until the page is on screen, so the
 * server and the browser agree.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { SiteHeader } from "../site/site-header";
import { Newsletter } from "../marketing/newsletter";
import { ThinkingState, type ThinkingStep } from "../../thinking-state/thinking-state";
import { AiAnswer } from "../../ai-answer/ai-answer";
import { MessageActions } from "../../message-actions/message-actions";
import { Aurora } from "../backgrounds/aurora";
import { Avatar, AvatarGroup } from "../../avatar";
import { cn, paletteCss, type PaletteVars } from "@/registry/knowns/lib/knowns/utils";
import { countdownParts, pad2, positionLine } from "./waitlist-landing-utils";

export interface WaitlistLandingTemplateProps {
  /** "auto" (default) follows the host page's theme; "light" or "dark" keeps one. */
  theme?: "auto" | "light" | "dark";
  /** Product name in the header and the copy. Default "Fennel". */
  brand?: string;
  /** The one accent colour, any CSS colour. Default a warm pink. */
  accent?: string;
  /** Launch time, as a Date or a timestamp in ms. Default 9 December 2026, 15:00 UTC. */
  launchAt?: Date | number;
  /** Save the address. Resolve with the person's place on the list. Default: a stand-in that returns 1,204. */
  onJoin?: (email: string) => Promise<number> | number;
  className?: string;
}

/** The whole look in one place. */
/**
 * The whole look in one place: a light and a dark palette. The page follows the host theme (theme="auto"), or keeps one
 * with theme="light" or "dark". `--accent-ink` is the accent as text, darkened or lightened so it reads on either ground.
 */
const LIGHT = {
  "--background": "oklch(0.985 0.008 320)",
  "--foreground": "oklch(0.2 0.03 305)",
  "--card": "oklch(1 0 0)",
  "--card-foreground": "oklch(0.2 0.03 305)",
  "--popover": "oklch(1 0 0)",
  "--popover-foreground": "oklch(0.2 0.03 305)",
  "--muted": "oklch(0.95 0.015 315)",
  "--muted-foreground": "oklch(0.47 0.03 310)",
  "--border": "oklch(0.2 0.03 305 / 0.12)",
  "--input": "oklch(0.2 0.03 305 / 0.16)",
  "--secondary": "oklch(0.95 0.015 315)",
  "--secondary-foreground": "oklch(0.2 0.03 305)",
  "--accent": "oklch(0.94 0.015 315)",
  "--accent-foreground": "oklch(0.2 0.03 305)",
  "--accent-ink": "color-mix(in oklab, var(--kn-accent) 45%, black)",
} satisfies PaletteVars;

const DARK = {
  "--background": "oklch(0.15 0.03 305)",
  "--foreground": "oklch(0.97 0.01 320)",
  "--card": "oklch(0.2 0.035 305)",
  "--card-foreground": "oklch(0.97 0.01 320)",
  "--popover": "oklch(0.2 0.035 305)",
  "--popover-foreground": "oklch(0.97 0.01 320)",
  "--muted": "oklch(0.25 0.035 305)",
  "--muted-foreground": "oklch(0.74 0.03 310)",
  "--border": "oklch(1 0 0 / 0.12)",
  "--input": "oklch(1 0 0 / 0.16)",
  "--secondary": "oklch(0.25 0.035 305)",
  "--secondary-foreground": "oklch(0.97 0.01 320)",
  "--accent": "oklch(0.27 0.04 305)",
  "--accent-foreground": "oklch(0.97 0.01 320)",
  "--accent-ink": "var(--kn-accent)",
} satisfies PaletteVars;

const PALETTE_CSS = paletteCss("waitlist-landing", LIGHT, DARK);

/** The hero backdrop: the accent plus two cooler lights, behind the hero only (the one background this page opts into). */
const AURORA = ["oklch(0.6 0.2 300)", "oklch(0.55 0.15 260)"];

const DEFAULT_LAUNCH = Date.UTC(2026, 11, 9, 15, 0, 0);

const FACES = [
  { name: "Mira Alvarez", hue: "oklch(0.7 0.14 20)" },
  { name: "Tomas Berg", hue: "oklch(0.7 0.12 150)" },
  { name: "Imani Okoye", hue: "oklch(0.7 0.14 250)" },
  { name: "Ravi Patel", hue: "oklch(0.72 0.13 80)" },
  { name: "Lena Fischer", hue: "oklch(0.7 0.14 330)" },
];

const LABELS = ["Days", "Hours", "Minutes", "Seconds"] as const;

/* ── The product, working: one finished call becomes a summary and a follow-up ── */

const CALL_STEPS: ThinkingStep[] = [
  { id: "listen", kind: "read", title: "Listening to the call", detail: "Renewal sync with Harbor Dental, 32 min, 4 people" },
  { id: "summary", kind: "think", title: "Writing the summary" },
  { id: "draft", kind: "step", title: "Writing the follow-up" },
];

const SUMMARY = `They renew for 12 months if the reminder texts go live before 1 January.

- **Maya** sends the revised quote by Friday
- **Theo** turns on reminder texts for the two clinics
- **You** book the onboarding call for the week of 6 January`;

const FOLLOW_UP = `Hi Dana, thanks for the time today. As agreed: the revised quote comes by Friday, reminder texts go live for both clinics before 1 January, and we will book onboarding for the week of 6 January. Reply here if anything is off.`;

/** Whether the page asked for a still frame (?still=1) or the reader for less motion. */
function stillWanted() {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  return new URLSearchParams(window.location.search).get("still") === "1";
}

/**
 * The demo beside the headline: listening, then the summary streams in with three action items, then the follow-up is
 * ready with its actions. It loops only while on screen; a still frame (?still=1) or reduced motion shows the end.
 */
function CallDemo({ brand }: { brand: string }) {
  const root = useRef<HTMLDivElement>(null);
  // 0 listening, 1 summary streaming, 2 follow-up ready. The server and a still frame show the end.
  const [phase, setPhase] = useState(2);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (stillWanted()) return;
    const el = root.current;
    let timer = 0;
    let p = 0;
    const tick = () => {
      p = (p + 1) % 3;
      if (p === 0) setRound((r) => r + 1);
      setPhase(p);
      timer = window.setTimeout(tick, p === 2 ? 5200 : 3200);
    };
    const start = () => {
      if (timer) return;
      p = 0;
      setPhase(0);
      setRound((r) => r + 1);
      timer = window.setTimeout(tick, 3200);
    };
    const stop = () => {
      window.clearTimeout(timer);
      timer = 0;
      setPhase(2);
    };
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => (es.some((e) => e.isIntersecting) ? start() : stop()));
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, []);
  return (
    <div ref={root} aria-label={`${brand} turning a call into a follow-up`} className="flex w-full flex-col gap-3 text-left">
      <ThinkingState
        key={`t${round}`}
        steps={phase === 0 ? [{ ...CALL_STEPS[0]!, status: "running" }] : CALL_STEPS.map((st) => ({ ...st, status: "done" as const }))}
        status={phase === 0 ? "thinking" : "done"}
        elapsed={phase === 0 ? 4 : 11}
        variant="panel"
        endedLabel={() => "Call wrapped up in 11 s"}
        defaultOpen={phase === 0}
        collapseOnDone
      />
      {phase >= 1 && <AiAnswer key={`a${round}`} question="What did we agree?" text={SUMMARY} status={phase === 1 ? "streaming" : "done"} reveal={phase === 1} wordsPerSecond={30} />}
      {phase >= 2 && (
        <div className="rounded-2xl border bg-card p-4 shadow-xs">
          <div className="flex items-baseline justify-between gap-3 text-[12.5px] text-muted-foreground">
            <span>
              To <span className="font-medium text-foreground">Dana, Maya, Theo</span>
            </span>
            <span>Draft</span>
          </div>
          <p className="mt-1 text-[14px] font-medium">Next steps from today&apos;s renewal call</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{FOLLOW_UP}</p>
          <MessageActions text={FOLLOW_UP} className="mt-2 -ml-1.5" />
        </div>
      )}
    </div>
  );
}

function Countdown({ launchAt }: { launchAt: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const p = now === null ? null : countdownParts(launchAt, now);
  const values = p ? [p.days, p.hours, p.minutes, p.seconds] : null;
  return (
    <div role="timer" aria-label={p ? (p.done ? "Launched" : `${p.days} days, ${p.hours} hours and ${p.minutes} minutes to launch`) : "Time to launch"} className="grid grid-cols-4 gap-2 sm:gap-3">
      {LABELS.map((label, i) => (
        <div key={label} className="flex flex-col items-center gap-1 rounded-xl bg-card px-2 py-2.5 ring-1 ring-border">
          <span aria-hidden className="text-[26px] leading-none font-semibold tracking-tight tabular-nums">{values ? pad2(values[i] ?? 0) : "--"}</span>
          <span className="text-[12px] text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}

export function WaitlistLandingTemplate({ brand = "Fennel", accent = "oklch(0.74 0.17 350)", launchAt = DEFAULT_LAUNCH, onJoin, theme = "auto", className }: WaitlistLandingTemplateProps) {
  const target = typeof launchAt === "number" ? launchAt : launchAt.getTime();
  const [place, setPlace] = useState<number | null>(null);
  const join = async (email: string) => {
    const n = await (onJoin ? onJoin(email) : 1204);
    setPlace(n);
    return undefined;
  };
  return (
    <div data-palette="waitlist-landing" data-theme={theme === "auto" ? undefined : theme} className={cn("relative isolate flex min-h-[max(100svh,760px)] w-full flex-col overflow-x-clip bg-background text-foreground", theme === "dark" && "dark", className)} style={{ "--kn-accent": accent, "--primary": accent, "--primary-foreground": "oklch(0.2 0.04 350)" } as CSSProperties}>
      <style href="kn-palette-waitlist-landing" precedence="default">{PALETTE_CSS}</style>
      <Aurora className="absolute inset-0 -z-10" color={[accent, ...AURORA]} mask="radial" />
      <SiteHeader
        variant="minimal"
        sticky={false}
        brand={
          <span className="inline-flex items-center gap-2">
            <svg viewBox="0 0 16 16" aria-hidden className="size-5 text-(--accent-ink)" fill="currentColor">
              <path d="M8 1.5c2.6 2 4.2 4.2 4.2 6.5A4.2 4.2 0 0 1 8 12.2 4.2 4.2 0 0 1 3.8 8C3.8 5.7 5.4 3.5 8 1.5zM8 12.5v2" />
            </svg>
            {brand}
          </span>
        }
        cta={{ label: "Join the list", href: "#join" }}
      />
      {/* The headline and the list on the left, the product working on the right; stacked on a phone. */}
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 pt-8 pb-14 sm:px-6 lg:grid-cols-[1fr_440px] lg:gap-14 lg:pt-12">
        <div className="flex flex-col items-start gap-6">
          <p className="text-[13px] font-medium text-(--accent-ink)">Launching 9 December</p>
          <h1 className="text-[clamp(2.3rem,5.5vw,3.8rem)] leading-[1.04] font-semibold tracking-tight text-balance">The meeting ends. The follow-up is already written.</h1>
          <p className="max-w-[46ch] text-[17px] leading-relaxed text-pretty text-muted-foreground">{brand} turns every call into a clear summary and a ready-to-send follow-up, and waits for your OK before it sends. Join the list for the first week of access.</p>
          <div id="join" className="w-full max-w-[460px] scroll-mt-20">
            {place === null ? (
              <Newsletter variant="plain" title="Get your place" text="Your work email, and you see where you are on the list." placeholder="you@company.com" submitLabel="Join the waitlist" note="One email when your invite is ready. Nothing else." onSubscribe={join} />
            ) : (
              <p role="status" className="rounded-2xl bg-card px-5 py-4 text-[16px] font-medium ring-1 ring-border">
                {positionLine(place)}. Invites go out in order, starting on launch day.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <Countdown launchAt={target} />
            <div className="flex items-center gap-3 text-[13.5px] text-muted-foreground">
              <AvatarGroup decorative size="md">
                {FACES.map((f) => (
                  <Avatar key={f.name} label={f.name} initials={f.name.slice(0, 1)} hue={f.hue} decorative />
                ))}
              </AvatarGroup>
              <span>
                <span className="font-medium text-foreground tabular-nums">3,860</span> people on the list
              </span>
            </div>
          </div>
        </div>
        <CallDemo brand={brand} />
      </main>
    </div>
  );
}
