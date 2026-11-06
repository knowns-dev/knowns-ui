"use client";
/** @registry name="error-pages" type="block" title="Error Pages" description="404 with search and popular links, 500 with retry, a status link and a copyable error ID, and Maintenance with a live ETA and a notify-me form. Each takes an illustration." */

/**
 * Error pages: 404 (a search box and popular links), 500 (retry, a status link, a copyable error id)
 * and Maintenance (an ETA that counts down and a subscribe form). Each takes an illustration in `art`,
 * e.g. one of the Empty States drawings. Centred on the page, readable at 360px.
 */
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { cn, writeClipboard } from "@/registry/knowns/lib/knowns/utils";
import { Button } from "../../button";
import { Input } from "../../input";
import { errorReport, etaClock, etaText, isEmail, searchUrl } from "./error-utils";

export interface ErrorLink {
  label: string;
  href: string;
  description?: string;
}

/* ── Frame ── */

export interface ErrorLayoutProps {
  /** A small code above the title, e.g. "404". */
  code?: ReactNode;
  /** An illustration, about 160px tall. */
  art?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** The main actions, under the description. */
  children?: ReactNode;
  /** Under everything, e.g. a status link or the error id. */
  footer?: ReactNode;
  /** Fill the viewport height (default) or only the parent. */
  fullHeight?: boolean;
  className?: string;
}

/** The shared frame: art, code, title, description, actions and a footer line, centred. */
export function ErrorLayout({ code, art, title, description, children, footer, fullHeight = true, className }: ErrorLayoutProps) {
  return (
    <section className={cn("grid place-items-center px-4 py-16 sm:px-6", fullHeight && "min-h-[calc(100dvh-4rem)]", className)}>
      <div className="flex w-full max-w-md flex-col items-center text-center">
        {art && <div className="mb-6 flex h-40 w-full items-center justify-center [&>*]:max-h-full">{art}</div>}
        {code && <p className="mb-2 font-mono text-[12.5px] font-medium tracking-wide text-muted-foreground">{code}</p>}
        <h1 className="text-balance text-[26px] font-semibold tracking-[-0.02em] sm:text-[30px]">{title}</h1>
        {description && <p className="mt-2.5 max-w-sm text-pretty text-[14.5px] leading-relaxed text-muted-foreground">{description}</p>}
        {children && <div className="mt-6 flex w-full flex-col items-center gap-4">{children}</div>}
        {footer && <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">{footer}</div>}
      </div>
    </section>
  );
}

const SearchGlyph = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L13.5 13.5" />
  </svg>
);

const linkClass = "rounded-sm underline decoration-border underline-offset-4 outline-none hover:text-foreground hover:decoration-foreground/40 focus-visible:ring-2 focus-visible:ring-ring/50";

/* ── 404 ── */

export interface NotFoundPageProps extends Partial<Pick<ErrorLayoutProps, "art" | "fullHeight" | "className">> {
  title?: ReactNode;
  description?: ReactNode;
  /** A search box. With `action` it submits to `${action}?q=…`; with onSearch you handle it. */
  search?: { action?: string; onSearch?: (query: string) => void; placeholder?: string; label?: string };
  /** Popular destinations, 3 to 6 read best. */
  links?: ErrorLink[];
  home?: { label?: string; href: string };
}

export function NotFoundPage({
  title = "This page doesn't exist",
  description = "The link may be old, or the page moved. Search for it, or start from one of these.",
  search,
  links = [],
  home = { href: "/" },
  art,
  fullHeight,
  className,
}: NotFoundPageProps) {
  const [q, setQ] = useState("");
  const id = useId();
  const submit = (e: FormEvent) => {
    if (search?.onSearch) {
      e.preventDefault();
      if (q.trim()) search.onSearch(q.trim());
      return;
    }
    const url = search?.action && searchUrl(search.action, q);
    e.preventDefault();
    if (url) window.location.assign(url);
  };
  return (
    <ErrorLayout code="404" art={art} title={title} description={description} fullHeight={fullHeight} className={className}>
      {search && (
        <form role="search" onSubmit={submit} className="flex w-full max-w-sm gap-2">
          <label htmlFor={`${id}-q`} className="sr-only">
            {search.label ?? "Search"}
          </label>
          <Input id={`${id}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={search.placeholder ?? "Search"} icon={<SearchGlyph />} className="flex-1" />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
      )}
      {links.length > 0 && (
        <nav aria-label="Popular pages" className="w-full max-w-sm">
          <ul className="flex flex-col divide-y rounded-xl border text-left">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="group flex items-center gap-3 px-4 py-3 outline-none first:rounded-t-xl last:rounded-b-xl hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[13.5px] font-medium">{l.label}</span>
                    {l.description && <span className="truncate text-[12.5px] text-muted-foreground">{l.description}</span>}
                  </span>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none">
                    <path d="M6 4l4 4-4 4" />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <a href={home.href} className={cn("text-[13.5px] text-muted-foreground", linkClass)}>
        {home.label ?? "Back to home"}
      </a>
    </ErrorLayout>
  );
}

/* ── 500 ── */

export interface ServerErrorPageProps extends Partial<Pick<ErrorLayoutProps, "art" | "fullHeight" | "className">> {
  title?: ReactNode;
  description?: ReactNode;
  /** Try again. A returned promise shows a spinner until it settles. */
  onRetry?: () => unknown;
  /** Your status page. */
  statusHref?: string;
  /** Shown with a copy button, for support requests. */
  errorId?: string;
  /** Contact support (mailto: or a form). */
  supportHref?: string;
  home?: { label?: string; href: string };
}

export function ServerErrorPage({
  title = "Something went wrong on our side",
  description = "It's not you. Try again in a moment; if it keeps happening, check the status page or send us the error ID.",
  onRetry,
  statusHref,
  errorId,
  supportHref,
  home = { href: "/" },
  art,
  fullHeight,
  className,
}: ServerErrorPageProps) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const retry = async () => {
    if (!onRetry) return;
    setBusy(true);
    try {
      await onRetry();
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (!errorId) return;
    try {
      await writeClipboard(errorReport(errorId, typeof location !== "undefined" ? location.pathname : undefined));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the id is still selectable */
    }
  };
  return (
    <ErrorLayout
      code="500"
      art={art}
      title={title}
      description={description}
      fullHeight={fullHeight}
      className={className}
      footer={
        (errorId || statusHref || supportHref) && (
          <>
            {errorId && (
              <span className="flex items-center gap-1.5">
                Error ID <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground select-all">{errorId}</code>
                <button type="button" onClick={copy} className={cn("text-[12.5px]", linkClass)}>
                  {copied ? "Copied" : "Copy"}
                </button>
                <span className="sr-only" aria-live="polite">
                  {copied ? "Error details copied" : ""}
                </span>
              </span>
            )}
            {statusHref && (
              <a href={statusHref} className={linkClass}>
                System status
              </a>
            )}
            {supportHref && (
              <a href={supportHref} className={linkClass}>
                Contact support
              </a>
            )}
          </>
        )
      }
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <Button onClick={retry} loading={busy}>
            Try again
          </Button>
        )}
        <a href={home.href} className="inline-flex h-9 items-center rounded-[10px] px-3.5 text-[13.5px] font-medium text-foreground shadow-[0_0_0_1px_var(--border)] outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 pointer-coarse:h-11">
          {home.label ?? "Back to home"}
        </a>
      </div>
    </ErrorLayout>
  );
}

/* ── Maintenance ── */

export interface MaintenancePageProps extends Partial<Pick<ErrorLayoutProps, "art" | "fullHeight" | "className">> {
  title?: ReactNode;
  description?: ReactNode;
  /** When you expect to be back. Shown as a clock time and "in about 40 minutes", updated every minute. */
  eta?: Date | string | number;
  statusHref?: string;
  /** "Tell me when it's back": an email form. Throw to show an error under the field. */
  subscribe?: { onSubscribe: (email: string) => Promise<unknown> | unknown; placeholder?: string; button?: string; thanks?: ReactNode };
  locale?: string;
}

export function MaintenancePage({
  title = "We'll be right back",
  description = "We're upgrading things behind the scenes. Your data is safe, and nothing you saved is lost.",
  eta,
  statusHref,
  subscribe,
  locale,
  art,
  fullHeight,
  className,
}: MaintenancePageProps) {
  // The relative time renders after mount (the server's clock and timezone would not match).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const rel = eta != null && now != null ? etaText(eta, now) : null;
  const clock = eta != null && now != null ? etaClock(eta, locale) : null;

  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!subscribe) return;
    if (!isEmail(email)) {
      setError("Enter an email address like name@example.com.");
      return;
    }
    setError(null);
    setState("busy");
    try {
      await subscribe.onSubscribe(email.trim());
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
      setState("idle");
    }
  };

  return (
    <ErrorLayout
      code="Maintenance"
      art={art}
      title={title}
      description={description}
      fullHeight={fullHeight}
      className={className}
      footer={
        statusHref && (
          <a href={statusHref} className={linkClass}>
            Follow progress on the status page
          </a>
        )
      }
    >
      {eta != null && (
        <p className="flex min-h-9 items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-[13px]" aria-live="polite">
          <span aria-hidden="true" className="relative flex size-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-amber-500/60 motion-reduce:hidden" />
            <span className="relative size-2 rounded-full bg-amber-500" />
          </span>
          {rel && clock ? (
            <span>
              Back {rel}, <span className="whitespace-nowrap">around <span className="font-medium tabular-nums">{clock}</span></span>
            </span>
          ) : now != null ? (
            <span>Finishing up. Refresh in a moment.</span>
          ) : (
            <span>Checking the time…</span>
          )}
        </p>
      )}
      {subscribe &&
        (state === "done" ? (
          <p role="status" className="text-[13.5px] text-muted-foreground">
            {subscribe.thanks ?? "Thanks. We'll email you as soon as we're back."}
          </p>
        ) : (
          <form onSubmit={submit} noValidate className="flex w-full max-w-sm flex-col gap-1.5 text-left">
            <label htmlFor={`${id}-email`} className="text-[12.5px] font-medium">
              Tell me when it's back
            </label>
            <div className="flex gap-2">
              <Input
                id={`${id}-email`}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={subscribe.placeholder ?? "you@example.com"}
                invalid={Boolean(error)}
                aria-describedby={error ? `${id}-err` : undefined}
                className="flex-1"
              />
              <Button type="submit" loading={state === "busy"}>
                {subscribe.button ?? "Notify me"}
              </Button>
            </div>
            {error && (
              <p id={`${id}-err`} role="alert" className="text-[12.5px] text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </form>
        ))}
    </ErrorLayout>
  );
}
