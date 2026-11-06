"use client";
/** @registry name="site-footer" type="block" title="Site footer" description="Site footer with brand and blurb, 3 to 5 link columns (accordions on phones), a newsletter mini-form with a callback, social links, a status line, a theme switch and the legal row." */

/**
 * SiteFooter: brand and blurb, 3 to 5 link columns, a newsletter mini-form (you handle the submit),
 * social links, a status line, a theme switch and the legal row. Below 640px the columns fold into
 * accordions so the footer stays short.
 */
import { useId, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Button } from "../../button";
import { Input } from "../../input";
import { SegmentedControl } from "../../segmented-control";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../accordion";
import type { NavLink } from "./site-utils";

export interface FooterColumn {
  title: string;
  links: NavLink[];
}

export interface FooterSocial {
  /** Accessible name, e.g. "GitHub". */
  label: string;
  href: string;
  /** A 16px icon. */
  icon: ReactNode;
}

export type FooterStatus = "operational" | "degraded" | "outage";

export interface SiteFooterProps {
  brand: ReactNode;
  brandHref?: string;
  brandLabel?: string;
  /** One or two sentences under the brand. */
  blurb?: ReactNode;
  /** 3 to 5 read best. */
  columns: FooterColumn[];
  /** Shows the newsletter form. Resolve to show the thanks line; throw (or reject) with a message to show it. */
  newsletter?: {
    onSubscribe: (email: string) => void | Promise<void>;
    title?: ReactNode;
    description?: ReactNode;
    placeholder?: string;
    button?: string;
    thanks?: ReactNode;
  };
  socials?: FooterSocial[];
  /** Status line, e.g. linked to your status page. */
  status?: { state?: FooterStatus; label?: ReactNode; href?: string };
  /** Shows a Light / Dark / System switch. */
  theme?: { value: "light" | "dark" | "system"; onChange: (value: "light" | "dark" | "system") => void };
  /** "© 2026 Acme Inc." */
  copyright?: ReactNode;
  /** Privacy, Terms, Cookies... */
  legal?: NavLink[];
  onNavigate?: (href: string, e: MouseEvent<HTMLAnchorElement>) => void;
  containerClassName?: string;
  className?: string;
}

const STATUS: Record<FooterStatus, { dot: string; label: string }> = {
  operational: { dot: "bg-emerald-500", label: "All systems normal" },
  degraded: { dot: "bg-amber-500", label: "Some systems degraded" },
  outage: { dot: "bg-red-500", label: "Service disruption" },
};

/** A plain email check for the mini-form; your backend has the final say. */
export function looksLikeEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
}

const linkClass = cn("rounded-[6px] text-[13.5px] text-muted-foreground transition-colors duration-150 hover:text-foreground", focusRing);

function FooterLink({ link, onNavigate, className }: { link: NavLink; onNavigate?: SiteFooterProps["onNavigate"]; className?: string }) {
  return (
    <a
      href={link.href}
      target={link.external ? "_blank" : undefined}
      rel={link.external ? "noreferrer" : undefined}
      onClick={(e) => onNavigate?.(link.href, e)}
      className={cn(linkClass, className)}
    >
      {link.label}
      {link.external && <span className="sr-only"> (opens in a new tab)</span>}
    </a>
  );
}

function Newsletter({ cfg }: { cfg: NonNullable<SiteFooterProps["newsletter"]> }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!looksLikeEmail(email)) {
      setState("error");
      setError("Enter an email address like name@example.com.");
      return;
    }
    setState("busy");
    setError(null);
    try {
      await cfg.onSubscribe(email.trim());
      setState("done");
    } catch (err) {
      setState("error");
      setError(err instanceof Error && err.message ? err.message : "That didn't work. Try again in a moment.");
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2" aria-labelledby={`${id}-t`}>
      <p id={`${id}-t`} className="text-[13.5px] font-medium">
        {cfg.title ?? "Get product updates"}
      </p>
      {cfg.description && <p className="text-[13px] text-muted-foreground">{cfg.description}</p>}
      {state === "done" ? (
        <p role="status" className="flex h-8 items-center text-[13px] text-emerald-700 dark:text-emerald-400">
          {cfg.thanks ?? "Thanks. Check your inbox to confirm."}
        </p>
      ) : (
        <div className="flex gap-2">
          <label htmlFor={`${id}-e`} className="sr-only">
            Email address
          </label>
          <Input
            id={`${id}-e`}
            type="email"
            autoComplete="email"
            placeholder={cfg.placeholder ?? "you@company.com"}
            value={email}
            invalid={state === "error"}
            aria-describedby={error ? `${id}-err` : undefined}
            onChange={(e) => {
              setEmail(e.target.value);
              if (state === "error") setState("idle");
            }}
            className="min-w-0 flex-1"
          />
          <Button type="submit" size="md" variant="secondary" loading={state === "busy"}>
            {cfg.button ?? "Subscribe"}
          </Button>
        </div>
      )}
      <p id={`${id}-err`} role="alert" className={cn("min-h-[1lh] text-[12px] text-red-600 dark:text-red-400", !error && "invisible")}>
        {error ?? " "}
      </p>
    </form>
  );
}

export function SiteFooter({
  brand,
  brandHref = "/",
  brandLabel,
  blurb,
  columns,
  newsletter,
  socials = [],
  status,
  theme,
  copyright,
  legal = [],
  onNavigate,
  containerClassName = "max-w-6xl",
  className,
}: SiteFooterProps) {
  const st = status ? STATUS[status.state ?? "operational"] : null;
  const statusInner = st && (
    <>
      <span aria-hidden="true" className="relative inline-flex size-2">
        <span className={cn("absolute inset-0 rounded-full opacity-50 motion-safe:animate-ping [animation-duration:2.4s]", st.dot)} />
        <span className={cn("relative size-2 rounded-full", st.dot)} />
      </span>
      {status?.label ?? st.label}
    </>
  );

  return (
    <footer data-slot="site-footer" className={cn("border-t bg-background", className)}>
      <div className={cn("mx-auto w-full px-4 py-12 sm:px-6 sm:py-14", containerClassName)}>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
          <div className="flex max-w-sm flex-col gap-4">
            <a
              href={brandHref}
              aria-label={brandLabel}
              onClick={(e) => onNavigate?.(brandHref, e)}
              className={cn("flex w-fit items-center gap-2 rounded-[8px] text-[15px] font-semibold tracking-tight", focusRing)}
            >
              {brand}
            </a>
            {blurb && <p className="text-[13.5px] leading-relaxed text-muted-foreground">{blurb}</p>}
            {newsletter && <Newsletter cfg={newsletter} />}
          </div>

          {/* Columns from 640px; accordions below. */}
          <div className={cn("hidden gap-8 sm:grid", columns.length >= 5 ? "sm:grid-cols-3 lg:grid-cols-5" : columns.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
            {columns.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <p className="mb-3 text-[13px] font-medium">{col.title}</p>
                <ul className="flex flex-col gap-2.5">
                  {col.links.map((l) => (
                    <li key={l.href + l.label}>
                      <FooterLink link={l} onNavigate={onNavigate} />
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div className="sm:hidden">
            <Accordion type="multiple" className="border-t">
              {columns.map((col) => (
                <AccordionItem key={col.title} value={col.title}>
                  <AccordionTrigger className="min-h-11 py-3 text-[14px]">{col.title}</AccordionTrigger>
                  <AccordionContent className="pb-3">
                    <nav aria-label={col.title}>
                      <ul className="flex flex-col">
                        {col.links.map((l) => (
                          <li key={l.href + l.label}>
                            <FooterLink link={l} onNavigate={onNavigate} className="flex min-h-10 items-center text-[14px]" />
                          </li>
                        ))}
                      </ul>
                    </nav>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-5 border-t pt-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            {st &&
              (status?.href ? (
                <a href={status.href} onClick={(e) => onNavigate?.(status.href!, e)} className={cn("inline-flex items-center gap-2 rounded-[6px] text-[13px] text-muted-foreground hover:text-foreground", focusRing)}>
                  {statusInner}
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">{statusInner}</span>
              ))}
            {socials.length > 0 && (
              <ul aria-label="Social links" className="flex items-center gap-1">
                {socials.map((s) => (
                  <li key={s.href}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={s.label}
                      className={cn("grid size-8 place-items-center rounded-[8px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground pointer-coarse:size-10 [&_svg]:size-4", focusRing)}
                    >
                      {s.icon}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {theme && (
            <SegmentedControl
              size="sm"
              aria-label="Theme"
              value={theme.value}
              onValueChange={(v) => theme.onChange(v as "light" | "dark" | "system")}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
              className="w-fit"
            />
          )}
        </div>

        {(copyright || legal.length > 0) && (
          <div className="mt-5 flex flex-col-reverse gap-3 text-[12.5px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
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
        )}
      </div>
    </footer>
  );
}
