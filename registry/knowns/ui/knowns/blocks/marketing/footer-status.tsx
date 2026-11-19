"use client";
/** @registry name="footer-status" type="block" title="Footer status" description="Marketing footer with a live system status pill (a still dot, a label and a link to your status page), an optional 30-day uptime strip, link columns and the legal row. Status comes from your data; the footer never fetches." */

/**
 * FooterStatus: brand and blurb, a status pill and an optional uptime strip, then link columns. The pill is a
 * link to your status page. A dot that says everything is fine does not pulse; only a problem does.
 */
import type { ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { StatusDot } from "../../status-dot";
import { UptimeBar, type UptimeDay } from "../../uptime-bar/uptime-bar";
import { FooterBrand, FooterColumn, FooterLegal, FooterSocials, type FooterLinkColumn, type FooterLinkItem, type FooterNavigate } from "./footer-parts";

export type FooterSystemState = "operational" | "degraded" | "outage";

export interface FooterStatusProps {
  brand: ReactNode;
  brandHref?: string;
  brandLabel?: string;
  blurb?: ReactNode;
  /** Two or three read best. */
  columns: FooterLinkColumn[];
  status: {
    state?: FooterSystemState;
    /** Default by state: "All systems operational", "Some systems degraded", "Service disruption". */
    label?: ReactNode;
    /** A muted line after the label, e.g. "Updated 2 min ago". */
    detail?: ReactNode;
    /** Your status page. Without it the pill is a plain label. */
    href?: string;
  };
  /** Daily status for the strip under the pill, oldest first. Thirty is the design. Left out, no strip. */
  uptime?: UptimeDay[];
  /** Name of the strip, e.g. "API". Default "Uptime". */
  uptimeLabel?: string;
  socials?: FooterLinkItem[];
  copyright?: ReactNode;
  legal?: FooterLinkItem[];
  onNavigate?: FooterNavigate;
  className?: string;
}

const STATE: Record<FooterSystemState, { tone: "success" | "warning" | "danger"; dot: "finished" | "blocked"; label: string }> = {
  operational: { tone: "success", dot: "finished", label: "All systems operational" },
  degraded: { tone: "warning", dot: "blocked", label: "Some systems degraded" },
  outage: { tone: "danger", dot: "blocked", label: "Service disruption" },
};

export function FooterStatus({ brand, brandHref, brandLabel, blurb, columns, status, uptime, uptimeLabel = "Uptime", socials = [], copyright, legal = [], onNavigate, className }: FooterStatusProps) {
  const s = STATE[status.state ?? "operational"];
  const inner = (
    <>
      <StatusDot state={s.dot} tone={s.tone} label={false} pulse={status.state === "degraded" || status.state === "outage"} />
      <span className="font-medium text-foreground">{status.label ?? s.label}</span>
      {status.detail && <span className="hidden text-muted-foreground sm:inline">{status.detail}</span>}
    </>
  );
  const pill = "inline-flex w-fit max-w-full items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-[13px]";
  return (
    <footer data-slot="footer-status" className={cn("border-t bg-background", className)}>
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-16">
          <div className="flex max-w-md flex-col gap-4">
            <FooterBrand brand={brand} href={brandHref} label={brandLabel} onNavigate={onNavigate} />
            {blurb && <p className="text-[13.5px] leading-relaxed text-muted-foreground">{blurb}</p>}
            {status.href ? (
              <a
                href={status.href}
                onClick={(e) => onNavigate?.(status.href!, e)}
                className={cn(pill, "transition-[transform,background-color] duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:-translate-y-px hover:bg-muted", focusRing)}
              >
                {inner}
                <span className="sr-only">. Open the status page.</span>
              </a>
            ) : (
              <p role="status" className={pill}>
                {inner}
              </p>
            )}
            {uptime && uptime.length > 0 && <UptimeBar days={uptime} label={uptimeLabel} sublabel={`${uptime.length} days`} size="sm" quiet startLabel={`${uptime.length} days ago`} className="mt-1" />}
          </div>
          <div className={cn("grid grid-cols-2 gap-x-6 gap-y-10", columns.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            {columns.map((c) => (
              <FooterColumn key={c.title} column={c} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-5 border-t pt-6">
          <FooterSocials socials={socials} onNavigate={onNavigate} />
          <FooterLegal copyright={copyright} legal={legal} onNavigate={onNavigate} />
        </div>
      </div>
    </footer>
  );
}

export default FooterStatus;
