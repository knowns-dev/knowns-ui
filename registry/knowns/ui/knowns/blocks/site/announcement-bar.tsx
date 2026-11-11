"use client";
/** @registry name="announcement-bar" type="block" title="Announcement bar" description="Dismissible announcement bar above the header: a link or CTA, an optional countdown, tone variants, dismissal remembered per id in localStorage, and a smooth height collapse with no layout jump." */

/**
 * AnnouncementBar: one line above the header for a launch, an event or a notice. A link or CTA, an
 * optional countdown, tone variants, and a dismiss button remembered per id in localStorage.
 *
 * No layout jump: the bar renders open (most visitors have not dismissed it) and is hidden before
 * paint when it was dismissed earlier; dismissing collapses its height smoothly, so a sticky header
 * below slides up instead of snapping.
 */
import { useEffect, useLayoutEffect, useState, type MouseEvent, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { countdownLabel, countdownParts, countdownText, isDismissed, rememberDismissed } from "./site-utils";

export type AnnouncementTone = "neutral" | "inverted" | "accent" | "warning" | "success";

export interface AnnouncementBarProps {
  /** Remembers the dismissal under this id; change it for a new announcement. */
  id: string;
  children: ReactNode;
  /** A link or button after the message. */
  action?: { label: string; href?: string; onClick?: () => void };
  /** Counts down to `end`. */
  countdown?: { end: number | Date | string; label?: string; onEnd?: () => void; hideWhenDone?: boolean };
  tone?: AnnouncementTone;
  /** A small mark before the message. */
  icon?: ReactNode;
  /** Show the close button. Default true. */
  dismissible?: boolean;
  /** Remember the dismissal in localStorage. Default true. */
  persist?: boolean;
  onDismiss?: () => void;
  onNavigate?: (href: string, e: MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
}

const TONE: Record<AnnouncementTone, { bar: string; action: string; close: string }> = {
  neutral: { bar: "bg-muted text-foreground", action: "text-foreground", close: "hover:bg-foreground/8" },
  inverted: { bar: "bg-foreground text-background", action: "text-background", close: "hover:bg-background/15" },
  accent: { bar: "bg-indigo-600 text-white dark:bg-indigo-500", action: "text-white", close: "hover:bg-white/15" },
  warning: { bar: "bg-amber-100 text-amber-950 dark:bg-amber-500/15 dark:text-amber-200", action: "text-amber-950 dark:text-amber-100", close: "hover:bg-amber-950/10 dark:hover:bg-amber-200/10" },
  success: { bar: "bg-emerald-100 text-emerald-950 dark:bg-emerald-500/15 dark:text-emerald-200", action: "text-emerald-950 dark:text-emerald-100", close: "hover:bg-emerald-950/10 dark:hover:bg-emerald-200/10" },
};

// Layout effect on the client, plain effect on the server (no warning).
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function Countdown({ end, label, onDone }: { end: number | Date | string; label?: string; onDone: () => void }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const parts = countdownParts(end, now ?? Date.now());
  useEffect(() => {
    if (now !== null && parts.done) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts.done, now]);
  if (parts.done) return null;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {label && <span className="opacity-80">{label}</span>}
      {/* Ticking digits are hidden from screen readers; the minute-level text is read instead. */}
      <span aria-hidden="true" className="rounded-[6px] bg-current/10 px-1.5 py-px font-mono text-[12px] tabular-nums" suppressHydrationWarning>
        {now === null ? "--:--" : countdownText(parts)}
      </span>
      <span className="sr-only">{countdownLabel(parts)}</span>
    </span>
  );
}

export function AnnouncementBar({
  id,
  children,
  action,
  countdown,
  tone = "inverted",
  icon,
  dismissible = true,
  persist = true,
  onDismiss,
  onNavigate,
  className,
}: AnnouncementBarProps) {
  const [open, setOpen] = useState(true);
  const [instant, setInstant] = useState(false);
  const t = TONE[tone];

  // Hidden before paint when dismissed earlier: no animation, no flash.
  useIsoLayoutEffect(() => {
    if (persist && isDismissed(id)) {
      setInstant(true);
      setOpen(false);
    } else {
      setInstant(false);
      setOpen(true);
    }
  }, [id, persist]);

  const dismiss = () => {
    setInstant(false);
    setOpen(false);
    if (persist) rememberDismissed(id);
    onDismiss?.();
  };

  return (
    <div
      data-slot="announcement-bar"
      data-open={open || undefined}
      inert={!open}
      className={cn(
        "grid w-full",
        !instant && "transition-[grid-template-rows] duration-300 ease-(--kn-ease-out) motion-reduce:transition-none",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        className,
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div role="region" aria-label="Announcement" className={cn("relative", t.bar)}>
          <div className={cn("mx-auto flex min-h-10 max-w-6xl items-center justify-center gap-x-3 gap-y-1 py-2 text-center text-[13px] leading-snug", dismissible ? "pl-4 pr-12" : "px-4")}>
            <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              {icon && (
                <span aria-hidden="true" className="inline-grid [&_svg]:size-4">
                  {icon}
                </span>
              )}
              <span>{children}</span>
              {countdown && (
                <Countdown
                  end={countdown.end}
                  label={countdown.label}
                  onDone={() => {
                    countdown.onEnd?.();
                    if (countdown.hideWhenDone) setOpen(false);
                  }}
                />
              )}
              {action &&
                (action.href ? (
                  <a
                    href={action.href}
                    onClick={(e) => (onNavigate?.(action.href!, e), action.onClick?.())}
                    className={cn("inline-flex items-center gap-1 rounded-[6px] font-medium underline decoration-current/40 underline-offset-[3px] hover:decoration-current", t.action, focusRing)}
                  >
                    {action.label}
                    <span aria-hidden="true">→</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={action.onClick}
                    className={cn("inline-flex cursor-pointer items-center gap-1 rounded-[6px] font-medium underline decoration-current/40 underline-offset-[3px] hover:decoration-current", t.action, focusRing)}
                  >
                    {action.label}
                  </button>
                ))}
            </p>
          </div>
          {dismissible && (
            <button
              type="button"
              aria-label="Dismiss announcement"
              onClick={dismiss}
              className={cn("absolute top-1/2 right-2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-[8px] opacity-80 transition-[background-color,opacity] ease-(--kn-ease-out) hover:opacity-100", t.close, focusRing)}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" className="size-3.5">
                <path d="m4 4 8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
