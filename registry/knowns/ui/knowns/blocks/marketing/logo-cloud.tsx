"use client";
/** @registry name="logo-cloud" type="block" title="Logo cloud" description="A grid of logos, grey until hover or focus, with light and dark variants and a wordmark fallback when there is no logo." deps="marketing-core" */

/**
 * LogoCloud: a calm grid of logos, grey until hovered. Each logo can have a dark-theme version; without
 * an image the name is set as a wordmark. Keep the claim honest: say "Works with" for integrations and
 * only call companies customers when they are.
 */
import type { ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";

export interface Logo {
  /** Company or product name: the accessible name, and the wordmark when there is no logo. */
  name: string;
  /** A full logo (wordmark or lockup): an <img> or inline SVG, drawn 28px tall at its own width. */
  logo?: ReactNode;
  /**
   * A square icon, e.g. one of our brand icons (toolIcon("Slack")), shown in a 24px box beside the name.
   * Use it when you only have the symbol, not the full logo. Ignored when `logo` is set.
   */
  mark?: ReactNode;
  /** Shown instead of `logo` in dark mode. */
  logoDark?: ReactNode;
  href?: string;
}

export interface LogoCloudProps {
  logos: Logo[];
  /** A line above, e.g. "Works with the tools you already use". */
  title?: ReactNode;
  /** Columns from 640px. Default 6 (3 on phones). */
  columns?: 4 | 5 | 6 | 8;
  /** Keep colour instead of grey until hover. */
  color?: boolean;
  className?: string;
}

/**
 * 4 columns stay at 2 until 1024px, then 4: a 3-column step would leave an orphan row. 8 is one row at
 * 1024px and 4 x 2 from 640px; its names may wrap to two lines rather than be cut.
 */
const COLS: Record<NonNullable<LogoCloudProps["columns"]>, string> = { 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6", // 8 is the dense row for wordmarks: a natural-width row spread edge to edge at lg (short and long names share
  // the space by their own width, so all 8 fit on one line), 4x2 from sm, 2 per row on phones; never wraps a name.
  8: "sm:grid-cols-4 lg:flex lg:flex-nowrap lg:justify-between lg:gap-x-6" };

/** One logo cell: image (light/dark) or wordmark, grey until hover. Shared with LogoMarquee. */
export function LogoMark({ logo, color, dense, className }: { logo: Logo; color?: boolean; dense?: boolean; className?: string }) {
  // Every logo gets an explicit box: 28px tall by 128px wide, contents fit inside (object-contain), so
  // no SVG or image ever renders at its intrinsic size. Marks get a 24px square.
  const box = "h-7 w-32 items-center justify-center [&>*]:max-h-full [&>*]:max-w-full [&>img]:size-full [&>img]:object-contain [&>svg]:size-full";
  const word = (
    <span className={cn("min-w-0 text-center text-[14px] leading-tight font-semibold", dense ? "whitespace-nowrap" : "text-balance sm:text-[15px]")}>{logo.name}</span>
  );
  const art = logo.logo ? (
    <>
      <span className={cn("flex", box, logo.logoDark && "dark:hidden")}>{logo.logo}</span>
      {logo.logoDark && <span className={cn("hidden dark:flex", box)}>{logo.logoDark}</span>}
    </>
  ) : logo.mark ? (
    <>
      <span aria-hidden="true" className="grid size-6 flex-none place-items-center overflow-hidden [&>*]:size-full [&_img]:size-full [&_img]:object-contain [&_svg]:size-full">
        {logo.mark}
      </span>
      {word}
    </>
  ) : (
    word
  );
  const look = cn(
    "flex min-w-0 items-center justify-center gap-2 px-2 text-foreground transition-[filter,opacity] duration-200 ease-out motion-reduce:transition-none",
    dense ? "h-10 sm:h-16" : "h-16",
    !color && "opacity-60 grayscale hover:opacity-100 hover:grayscale-0 focus-visible:opacity-100 focus-visible:grayscale-0",
    className,
  );
  if (logo.href)
    return (
      <a href={logo.href} target="_blank" rel="noreferrer" aria-label={logo.name} className={cn(look, "rounded-lg", focusRing)}>
        {art}
      </a>
    );
  return (
    <span role={logo.logo ? "img" : undefined} aria-label={logo.logo ? logo.name : undefined} className={look}>
      {art}
    </span>
  );
}

export function LogoCloud({ logos, title, columns = 6, color, className }: LogoCloudProps) {
  return (
    <section data-slot="logo-cloud" aria-label={typeof title === "string" ? title : "Logos"} className={cn("mx-auto w-full max-w-6xl px-4 py-16 sm:px-6", className)}>
      {title && <p className="mb-8 text-center text-[14px] text-muted-foreground">{title}</p>}
      <ul className={cn("grid grid-cols-2 gap-x-3 sm:gap-x-8", columns === 8 ? "gap-y-1 sm:gap-y-6" : "gap-y-6", columns !== 4 && columns !== 8 && "sm:grid-cols-3", COLS[columns])}>
        {logos.map((l) => (
          <li key={l.name}>
            <LogoMark logo={l} color={color} dense={columns === 8} />
          </li>
        ))}
      </ul>
    </section>
  );
}
