"use client";
/** @registry name="footer-columns" type="block" title="Footer columns" description="Marketing footer with the brand and a blurb, the Newsletter block as its sign-up, two to four link columns that stay two across on a phone, text-only social links and the legal row." */

/**
 * FooterColumns: brand, blurb and the Newsletter sign-up on one side, link columns on the other. On a phone
 * the columns sit two across (no accordions), the sign-up comes first and nothing scrolls sideways.
 */
import type { ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { Newsletter, type NewsletterProps } from "./newsletter";
import { FooterBrand, FooterColumn, FooterLegal, FooterSocials, type FooterLinkColumn, type FooterLinkItem, type FooterNavigate } from "./footer-parts";

export interface FooterColumnsProps {
  brand: ReactNode;
  brandHref?: string;
  brandLabel?: string;
  blurb?: ReactNode;
  /** Two to four read best. */
  columns: FooterLinkColumn[];
  /** The sign-up. Left out, the footer has no form. */
  newsletter?: Pick<NewsletterProps, "onSubscribe" | "title" | "text" | "placeholder" | "submitLabel" | "note" | "successText">;
  socials?: FooterLinkItem[];
  copyright?: ReactNode;
  legal?: FooterLinkItem[];
  onNavigate?: FooterNavigate;
  className?: string;
}

export function FooterColumns({ brand, brandHref, brandLabel, blurb, columns, newsletter, socials = [], copyright, legal = [], onNavigate, className }: FooterColumnsProps) {
  return (
    <footer data-slot="footer-columns" className={cn("border-t bg-background", className)}>
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-16">
          <div className="flex max-w-md flex-col gap-4">
            <FooterBrand brand={brand} href={brandHref} label={brandLabel} onNavigate={onNavigate} />
            {blurb && <p className="text-[13.5px] leading-relaxed text-muted-foreground">{blurb}</p>}
            {newsletter && (
              <div className="mt-2">
                <Newsletter variant="plain" {...newsletter} title={newsletter.title ?? "Get product updates"} text={newsletter.text ?? null} />
              </div>
            )}
          </div>
          <div className={cn("grid grid-cols-2 gap-x-6 gap-y-10", columns.length >= 4 ? "sm:grid-cols-4" : columns.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
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

export default FooterColumns;
