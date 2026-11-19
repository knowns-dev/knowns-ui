/** @registry name="footer-minimal" type="block" title="Footer minimal" description="One-line marketing footer: brand, a few links and the copyright. Wraps to a centred stack on a phone. For a landing page that ends at a call to action." */

/**
 * FooterMinimal: the least a page needs at its end. One row from 768px (brand left, links centre, copyright
 * right); below that a centred stack with comfortable tap targets.
 */
import type { ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { FooterBrand, FooterLink, type FooterLinkItem, type FooterNavigate } from "./footer-parts";

export interface FooterMinimalProps {
  brand: ReactNode;
  brandHref?: string;
  brandLabel?: string;
  links?: FooterLinkItem[];
  copyright?: ReactNode;
  onNavigate?: FooterNavigate;
  className?: string;
}

export function FooterMinimal({ brand, brandHref, brandLabel, links = [], copyright, onNavigate, className }: FooterMinimalProps) {
  return (
    <footer data-slot="footer-minimal" className={cn("border-t bg-background", className)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-4 py-8 text-center sm:px-6 md:flex-row md:justify-between md:gap-8 md:text-left">
        <FooterBrand brand={brand} href={brandHref} label={brandLabel} onNavigate={onNavigate} />
        {links.length > 0 && (
          <nav aria-label="Footer">
            <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
              {links.map((l) => (
                <li key={l.href + l.label}>
                  <FooterLink link={l} onNavigate={onNavigate} className="flex min-h-10 items-center md:min-h-0" />
                </li>
              ))}
            </ul>
          </nav>
        )}
        {copyright && <p className="text-[12.5px] text-muted-foreground">{copyright}</p>}
      </div>
    </footer>
  );
}

export default FooterMinimal;
