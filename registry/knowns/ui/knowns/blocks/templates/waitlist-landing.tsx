"use client";
/** @registry name="template-waitlist-landing" type="block" title="Waitlist landing page" description="A one-screen launch page: an announcement pill, a headline over an aurora, a countdown to the launch day, an email field that returns the person's place on the list, and a line of faces and a count as proof." */

/**
 * WaitlistLandingTemplate: one screen for a product that is about to launch, built only from the Free blocks. The
 * look is its own: a deep plum night, a slow aurora behind the headline and a row of big tabular digits. The
 * palette is a handful of CSS variables on the root (PALETTE).
 *
 * Joining is a callback: `onJoin(email)` resolves with the person's place on the list, and the page says it. The
 * countdown counts to `launchAt` on the visitor's clock and shows dashes until the page is on screen, so the
 * server and the browser agree.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { AnnouncementPill } from "../site/announcement-pill";
import { Newsletter } from "../marketing/newsletter";
import { Aurora } from "../backgrounds/aurora";
import { Avatar, AvatarGroup } from "../../avatar";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { countdownParts, pad2, positionLine } from "./waitlist-landing-utils";

export interface WaitlistLandingTemplateProps {
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
const PALETTE = {
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
  colorScheme: "dark",
} as const;

const DEFAULT_LAUNCH = Date.UTC(2026, 11, 9, 15, 0, 0);

const FACES = [
  { name: "Mira Alvarez", hue: "oklch(0.7 0.14 20)" },
  { name: "Tomas Berg", hue: "oklch(0.7 0.12 150)" },
  { name: "Imani Okoye", hue: "oklch(0.7 0.14 250)" },
  { name: "Ravi Patel", hue: "oklch(0.72 0.13 80)" },
  { name: "Lena Fischer", hue: "oklch(0.7 0.14 330)" },
];

const LABELS = ["Days", "Hours", "Minutes", "Seconds"] as const;

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
        <div key={label} className="flex flex-col items-center gap-1.5 rounded-2xl bg-card/70 px-2 py-3 ring-1 ring-border backdrop-blur-sm sm:py-4">
          <span aria-hidden className="text-[clamp(1.8rem,5vw,2.8rem)] leading-none font-semibold tracking-tight tabular-nums">{values ? pad2(values[i] ?? 0) : "--"}</span>
          <span className="text-[12px] text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}

export function WaitlistLandingTemplate({ brand = "Fennel", accent = "oklch(0.74 0.17 350)", launchAt = DEFAULT_LAUNCH, onJoin, className }: WaitlistLandingTemplateProps) {
  const target = typeof launchAt === "number" ? launchAt : launchAt.getTime();
  const [place, setPlace] = useState<number | null>(null);
  const join = async (email: string) => {
    const n = await (onJoin ? onJoin(email) : 1204);
    setPlace(n);
    return undefined;
  };
  return (
    <div className={cn("relative isolate flex min-h-[max(100svh,760px)] w-full flex-col overflow-x-clip bg-background text-foreground", className)} style={{ ...PALETTE, "--kn-accent": accent, "--primary": accent, "--primary-foreground": "oklch(0.2 0.04 350)" } as CSSProperties}>
      <Aurora className="absolute inset-0 -z-10" color={[accent, "oklch(0.6 0.2 300)", "oklch(0.55 0.15 260)"]} mask="radial" />
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <span className="inline-flex items-center gap-2 text-[16px] font-semibold tracking-tight">
          <svg viewBox="0 0 16 16" aria-hidden className="size-5 text-(--kn-accent)" fill="currentColor">
            <path d="M8 1.5c2.6 2 4.2 4.2 4.2 6.5A4.2 4.2 0 0 1 8 12.2 4.2 4.2 0 0 1 3.8 8C3.8 5.7 5.4 3.5 8 1.5zM8 12.5v2" />
          </svg>
          {brand}
        </span>
        <span className="text-[13px] text-muted-foreground">Launching 9 December</span>
      </header>
      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col items-center justify-center gap-6 px-4 pt-6 pb-14 text-center sm:px-6 sm:pt-10">
        <AnnouncementPill
          label="New"
          text="Follow-ups that write themselves"
          card={{ title: "Meeting notes that send the follow-up", description: `${brand} listens to the call, drafts the follow-up and waits for your OK before it sends.`, items: ["Drafts in your voice", "Never sends without a yes", "Works with any call link"] }}
        />
        <h1 className="text-[clamp(2.3rem,6vw,4rem)] leading-[1.02] font-semibold tracking-tight text-balance">The meeting ends. The follow-up is already written.</h1>
        <p className="max-w-[46ch] text-[17px] leading-relaxed text-pretty text-muted-foreground">{brand} turns every call into a clear summary and a ready-to-send follow-up. Join the list for the first week of access.</p>
        <Countdown launchAt={target} />
        <div className="w-full">
          {place === null ? (
            <Newsletter variant="plain" title="Get your place" text="Put in your work email and see where you are on the list." placeholder="you@company.com" submitLabel="Join the waitlist" note="One email when your invite is ready. Nothing else." onSubscribe={join} />
          ) : (
            <p role="status" className="rounded-2xl bg-card/70 px-5 py-4 text-[16px] font-medium ring-1 ring-border backdrop-blur-sm">
              {positionLine(place)}. Invites go out in order, starting on launch day.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 text-[13.5px] text-muted-foreground">
          <AvatarGroup decorative size="md">
            {FACES.map((f) => (
              <Avatar key={f.name} label={f.name} initials={f.name.slice(0, 1)} hue={f.hue} decorative />
            ))}
          </AvatarGroup>
          <span>
            <span className="font-medium text-foreground tabular-nums">3,860</span> people are already on the list
          </span>
        </div>
      </main>
    </div>
  );
}
