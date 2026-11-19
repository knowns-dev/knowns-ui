/**
 * Shared pieces of the marketing footers: a link, a column of links, a text-only social row and the legal row.
 * No platform marks: a social link is its name in words, and `icon` takes your own glyph.
 */
import type { MouseEvent, ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";

export interface FooterLinkItem {
  label: string;
  href: string;
  /** Opens in a new tab and says so to a screen reader. */
  external?: boolean;
  /** Your own 16px glyph, shown before the label. */
  icon?: ReactNode;
}

export interface FooterLinkColumn {
  title: string;
  links: FooterLinkItem[];
}

export type FooterNavigate = (href: string, e: MouseEvent<HTMLAnchorElement>) => void;

export const footerLinkClass = cn("rounded-[6px] text-[13.5px] text-muted-foreground transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:text-foreground", focusRing);

export function FooterLink({ link, onNavigate, className }: { link: FooterLinkItem; onNavigate?: FooterNavigate; className?: string }) {
  return (
    <a
      href={link.href}
      target={link.external ? "_blank" : undefined}
      rel={link.external ? "noreferrer" : undefined}
      onClick={(e) => onNavigate?.(link.href, e)}
      className={cn(footerLinkClass, link.icon && "inline-flex items-center gap-1.5", className)}
    >
      {link.icon && <span aria-hidden className="grid flex-none place-items-center [&_svg]:size-4">{link.icon}</span>}
      {link.label}
      {link.external && <span className="sr-only"> (opens in a new tab)</span>}
    </a>
  );
}

/** A titled list of links. Two columns of these fit a 390px screen side by side. */
export function FooterColumn({ column, onNavigate }: { column: FooterLinkColumn; onNavigate?: FooterNavigate }) {
  return (
    <nav aria-label={column.title} className="min-w-0">
      <p className="mb-3 text-[13px] font-medium">{column.title}</p>
      <ul className="flex flex-col gap-2.5">
        {column.links.map((l) => (
          <li key={l.href + l.label}>
            <FooterLink link={l} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Social links as words. Each is a link with its own name, so there is nothing to guess from a mark. */
export function FooterSocials({ socials, onNavigate, className }: { socials: FooterLinkItem[]; onNavigate?: FooterNavigate; className?: string }) {
  if (!socials.length) return null;
  return (
    <ul aria-label="Social links" className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>
      {socials.map((s) => (
        <li key={s.href + s.label}>
          <FooterLink link={{ external: true, ...s }} onNavigate={onNavigate} className="text-[13px]" />
        </li>
      ))}
    </ul>
  );
}

/** Copyright on one side, legal links on the other; stacked, legal first, on a phone. */
export function FooterLegal({ copyright, legal = [], onNavigate, className }: { copyright?: ReactNode; legal?: FooterLinkItem[]; onNavigate?: FooterNavigate; className?: string }) {
  if (!copyright && !legal.length) return null;
  return (
    <div className={cn("flex flex-col-reverse gap-3 text-[12.5px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between", className)}>
      {copyright && <p>{copyright}</p>}
      {legal.length > 0 && (
        <ul aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-2">
          {legal.map((l) => (
            <li key={l.href + l.label}>
              <FooterLink link={l} onNavigate={onNavigate} className="text-[12.5px]" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The brand as a link. */
export function FooterBrand({ brand, href = "/", label, onNavigate, className }: { brand: ReactNode; href?: string; label?: string; onNavigate?: FooterNavigate; className?: string }) {
  return (
    <a href={href} aria-label={label} onClick={(e) => onNavigate?.(href, e)} className={cn("flex w-fit items-center gap-2 rounded-[8px] text-[15px] font-semibold tracking-tight", focusRing, className)}>
      {brand}
    </a>
  );
}

/** Pixel-free sizing for a word that should span its container: font-size as a share of the container width. */
export function wordmarkSize(word: string, fill = 1): string {
  const chars = Math.max(1, Array.from(word.trim()).length);
  // An average glyph in a bold sans is about 0.62em wide; `fill` of 1 spans the full width.
  return `${((100 * fill) / (chars * 0.62)).toFixed(2)}cqw`;
}
