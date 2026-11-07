"use client";
/** @registry name="site-header" type="block" title="Site header" description="Sticky site header with a blur and hairline on scroll, links, dropdowns and a mega panel with a featured card, active indicator, search trigger, theme toggle, account or Sign in, and CTA. Includes a mobile drawer: a modal dialog with accordion groups and scroll lock. Marketing and minimal variants." */

/**
 * SiteHeader: the top bar of a marketing site or app. Brand, primary links, dropdowns and a mega panel
 * (grouped links with icons and descriptions plus a featured card), and on the right a search trigger,
 * a theme toggle, the account (UserMenu) or Sign in, and a call to action.
 *
 * - Sticky: transparent at the top, a blurred background and a hairline once the page scrolls.
 * - The link for the current page gets an indicator and aria-current.
 * - Panels follow the disclosure pattern: buttons with aria-expanded, ← → between top items, ↓ into a
 *   panel, ↑ ↓ through its links, Escape closes and returns focus. Hover opens them on a mouse.
 * - Below 768px the links move into a drawer: a modal <dialog> (focus stays inside, Escape closes),
 *   groups as accordions, page scroll locked.
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Button } from "../../button";
import { Kbd } from "../../kbd";
import { ThemeToggle } from "../../theme-toggle";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../accordion";
import {
  activeEntry,
  entryKind,
  isActiveHref,
  isScrolled,
  lockScroll,
  panelStep,
  stepIndex,
  topNavKey,
  type NavEntry,
  type NavMegaItem,
} from "./site-utils";

export type { NavEntry, NavLink, NavMegaGroup, NavMegaItem } from "./site-utils";

export interface SiteHeaderProps {
  /** Before the brand, e.g. a SidebarTrigger that opens the docs navigation on small screens. */
  leading?: ReactNode;
  /** Logo and name. Wrapped in a link to brandHref. */
  brand: ReactNode;
  brandHref?: string;
  /** Accessible name of the brand link when the brand is only a mark. */
  brandLabel?: string;
  nav?: NavEntry[];
  /** The current path, for the active indicator and aria-current. */
  currentHref?: string;
  /** Called for every link click inside the header; call e.preventDefault() for client-side routing. */
  onNavigate?: (href: string, e: MouseEvent<HTMLAnchorElement>) => void;
  /** Shows a search button (⌘K hint from 1024px). Open your CommandMenu here. */
  search?: { onOpen: () => void; label?: string; shortcut?: string[] };
  /** Shows a light/dark toggle: our ThemeToggle, revealing the new theme with a circle from the click. */
  theme?: { value: "light" | "dark"; onChange: (value: "light" | "dark") => void };
  /** Signed in: your UserMenu (or any avatar button). */
  account?: ReactNode;
  /** Signed out: a Sign in link. Ignored when account is set. */
  signIn?: { label?: string; href?: string; onClick?: () => void };
  /** The call to action on the right. */
  cta?: { label: string; href?: string; onClick?: () => void };
  /** "marketing": 64px, links centred, primary CTA. "minimal": 52px, links next to the brand, quieter. */
  variant?: "marketing" | "minimal";
  /** Stick to the top. Default true. */
  sticky?: boolean;
  /** Always show the background and hairline, not only once the page scrolls (app and docs layouts). */
  solid?: boolean;
  /** The element that scrolls, when it is not the window (an app shell, a docs preview). */
  scrollRoot?: HTMLElement | null;
  /** Content width. Default "max-w-6xl". */
  containerClassName?: string;
  className?: string;
}

/* ── Small parts ── */

const Chevron = ({ open }: { open?: boolean }) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={cn("size-3.5 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")}
  >
    <path d="M4.5 6.5 8 10l3.5-3.5" />
  </svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" className="size-4">
    <circle cx="7.25" cy="7.25" r="4.5" />
    <path d="m10.75 10.75 3 3" />
  </svg>
);

const iconButton = cn(
  "grid size-8 flex-none cursor-pointer place-items-center rounded-[9px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground pointer-coarse:size-11",
  focusRing,
);

function LinkOrButton({
  href,
  onClick,
  onNavigate,
  className,
  children,
}: {
  href?: string;
  onClick?: () => void;
  onNavigate?: SiteHeaderProps["onNavigate"];
  className?: string;
  children: ReactNode;
}) {
  if (href)
    return (
      <a href={href} className={className} onClick={(e) => (onNavigate?.(href, e), onClick?.())}>
        {children}
      </a>
    );
  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}

function SearchButton({ search, wide }: { search: NonNullable<SiteHeaderProps["search"]>; wide?: boolean }) {
  const keys = search.shortcut ?? ["⌘", "K"];
  const label = search.label ?? "Search";
  if (!wide)
    return (
      <button type="button" aria-label={label} onClick={search.onOpen} className={iconButton}>
        <SearchIcon />
      </button>
    );
  return (
    <button
      type="button"
      onClick={search.onOpen}
      className={cn(
        "inline-flex h-8 w-44 cursor-pointer items-center gap-2 rounded-[9px] bg-card px-2.5 text-[13px] text-muted-foreground shadow-[0_0_0_1px_var(--border)] transition-colors duration-150 hover:text-foreground",
        focusRing,
      )}
    >
      <SearchIcon />
      <span className="flex-1 text-left">{label}</span>
      <span className="flex gap-0.5" aria-hidden="true">
        {keys.map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
      </span>
    </button>
  );
}

/* ── Panels ── */

function MegaLink({ item, onNavigate, current, onPick }: { item: NavMegaItem; onNavigate?: SiteHeaderProps["onNavigate"]; current?: string; onPick: () => void }) {
  const here = isActiveHref(item.href, current) && item.href.replace(/\/+$/, "") === (current ?? "").replace(/[?#].*$/, "").replace(/\/+$/, "");
  return (
    <a
      href={item.href}
      data-panel-link=""
      aria-current={here ? "page" : undefined}
      target={item.external ? "_blank" : undefined}
      rel={item.external ? "noreferrer" : undefined}
      onClick={(e) => {
        onNavigate?.(item.href, e);
        onPick();
      }}
      className={cn("group/link flex gap-3 rounded-[10px] p-2.5 transition-colors duration-150 hover:bg-muted", focusRing, here && "bg-muted/60")}
    >
      {item.icon && (
        <span aria-hidden="true" className="grid size-8 flex-none place-items-center rounded-[8px] bg-card text-muted-foreground shadow-[0_0_0_1px_var(--border)] transition-colors group-hover/link:text-foreground [&_svg]:size-4">
          {item.icon}
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-foreground">{item.label}</span>
        {item.description && <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">{item.description}</span>}
      </span>
    </a>
  );
}

/* ── Header ── */

export function SiteHeader({
  leading,
  brand,
  brandHref = "/",
  brandLabel,
  nav = [],
  currentHref,
  onNavigate,
  search,
  theme,
  account,
  signIn,
  cta,
  variant = "marketing",
  sticky = true,
  solid = false,
  scrollRoot,
  containerClassName = "max-w-6xl",
  className,
}: SiteHeaderProps) {
  const uid = useId();
  const [open, setOpen] = useState(-1);
  const [drawer, setDrawer] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLUListElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const active = activeEntry(nav, currentHref);
  const minimal = variant === "minimal";

  // Sticky look: blurred background + hairline once scrolled.
  useEffect(() => {
    if (!sticky) return;
    const target: HTMLElement | Window = scrollRoot ?? window;
    const read = () => setScrolled(isScrolled(scrollRoot ? scrollRoot.scrollTop : window.scrollY));
    read();
    target.addEventListener("scroll", read, { passive: true });
    return () => target.removeEventListener("scroll", read);
  }, [sticky, scrollRoot]);

  // Close an open panel on an outside press.
  useEffect(() => {
    if (open < 0) return;
    const onDown = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpen(-1);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  const tops = () => [...(navRef.current?.querySelectorAll<HTMLElement>("[data-top]") ?? [])];
  const panelLinks = (i: number) => [...(navRef.current?.querySelectorAll<HTMLElement>(`[data-panel="${i}"] [data-panel-link]`) ?? [])];
  const focusTop = (i: number) => tops()[i]?.focus();

  const close = useCallback((focusBack?: number) => {
    setOpen(-1);
    if (focusBack !== undefined && focusBack >= 0) requestAnimationFrame(() => focusTop(focusBack));
  }, []);

  const onTopKey = (i: number, hasPanel: boolean) => (e: KeyboardEvent<HTMLElement>) => {
    const k = topNavKey(e.key);
    if (!k) return;
    const n = nav.length;
    if (k === "next" || k === "prev") {
      e.preventDefault();
      const j = stepIndex(i, n, k === "next" ? 1 : -1);
      if (open >= 0) setOpen(entryKind(nav[j]) === "link" ? -1 : j);
      focusTop(j);
    } else if (k === "first" || k === "last") {
      e.preventDefault();
      focusTop(k === "first" ? 0 : n - 1);
    } else if (k === "open" && hasPanel) {
      e.preventDefault();
      setOpen(i);
      requestAnimationFrame(() => panelLinks(i)[0]?.focus());
    } else if (k === "close" && open >= 0) {
      e.preventDefault();
      close(i);
    }
  };

  const onPanelKey = (i: number) => (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close(i);
      return;
    }
    const links = panelLinks(i);
    const at = links.indexOf(document.activeElement as HTMLElement);
    const next = panelStep(at, links.length, e.key);
    if (next === null) return;
    e.preventDefault();
    if (next < 0) focusTop(i);
    else links[next]?.focus();
  };

  // Hover intent on a mouse: open after a short pause, close after leaving.
  const hover = (i: number) => (e: ReactPointerEvent) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpen(i), open >= 0 ? 0 : 90);
  };
  const leave = (e: ReactPointerEvent) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpen(-1), 160);
  };

  const topClass = (on: boolean, isActive: boolean) =>
    cn(
      "relative inline-flex h-8 cursor-pointer items-center gap-1 rounded-[8px] px-3 text-[13.5px] whitespace-nowrap transition-colors duration-150",
      on || isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      on && "bg-muted",
      focusRing,
    );

  const indicator = (isActive: boolean) => (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-3 rounded-full bg-foreground transition-[opacity,transform] duration-200 motion-reduce:transition-none",
        minimal ? "-bottom-[9px] h-0.5" : "-bottom-[15px] h-0.5",
        isActive ? "scale-x-100 opacity-100" : "scale-x-50 opacity-0",
      )}
    />
  );

  // Rhythm: 8px between the icon buttons (search, theme), 12px around the account and before the CTA. Hidden
  // children (e.g. a CTA a paid user doesn't see) take no gap with them, so there is never a hole.
  const right = (
    <div className="flex flex-none items-center gap-0.5 sm:gap-2">
      {search && (
        <>
          <span className="hidden lg:inline-flex">
            <SearchButton search={search} wide />
          </span>
          <span className="lg:hidden">
            <SearchButton search={search} />
          </span>
        </>
      )}
      {theme && (
        <ThemeToggle theme={theme.value} onThemeChange={(t) => theme.onChange(t === "dark" ? "dark" : "light")} size="md" className="pointer-coarse:min-h-11 pointer-coarse:min-w-11" />
      )}
      {account ? (
        <span className="flex items-center gap-3 sm:ml-1">{account}</span>
      ) : (
        signIn && (
          <LinkOrButton
            href={signIn.href}
            onClick={signIn.onClick}
            onNavigate={onNavigate}
            className={cn("hidden h-8 cursor-pointer items-center rounded-[9px] px-3 text-[13.5px] text-muted-foreground transition-colors hover:text-foreground sm:inline-flex", focusRing)}
          >
            {signIn.label ?? "Sign in"}
          </LinkOrButton>
        )
      )}
      {cta && (
        <span className="hidden sm:ml-1 sm:inline-flex">
          {cta.href ? (
            <a href={cta.href} onClick={(e) => (onNavigate?.(cta.href!, e), cta.onClick?.())} className={cn(buttonLook(minimal ? "secondary" : "primary"))}>
              {cta.label}
            </a>
          ) : (
            <Button size="sm" variant={minimal ? "secondary" : "primary"} onClick={cta.onClick}>
              {cta.label}
            </Button>
          )}
        </span>
      )}
      {nav.length > 0 && (
        <button
          type="button"
          aria-label="Open menu"
          aria-haspopup="dialog"
          aria-expanded={drawer}
          aria-controls={`${uid}-drawer`}
          onClick={() => setDrawer(true)}
          className={cn(iconButton, "md:hidden")}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" className="size-4">
            <path d="M2.75 5h10.5M2.75 8h10.5M2.75 11h10.5" />
          </svg>
        </button>
      )}
    </div>
  );

  return (
    <header
      data-slot="site-header"
      data-scrolled={scrolled || undefined}
      className={cn(
        "z-40 w-full transition-[background-color,box-shadow,backdrop-filter] duration-200 ease-out motion-reduce:transition-none",
        sticky && "sticky top-0",
        scrolled || !sticky || solid
          ? "bg-[color-mix(in_srgb,var(--background)_78%,transparent)] shadow-[0_1px_0_var(--border)] backdrop-blur-md backdrop-saturate-150"
          : "bg-transparent shadow-[0_1px_0_transparent]",
        className,
      )}
    >
      <div className={cn("relative mx-auto flex w-full items-center gap-2 px-4 sm:gap-4 sm:px-6", minimal ? "h-[52px]" : "h-16", containerClassName)}>
        {leading}
        <a
          href={brandHref}
          aria-label={brandLabel}
          onClick={(e) => onNavigate?.(brandHref, e)}
          className={cn("flex flex-none items-center gap-2 rounded-[8px] text-[15px] font-semibold tracking-tight", focusRing)}
        >
          {brand}
        </a>

        {nav.length > 0 && (
          <nav aria-label="Main" className={cn("hidden min-w-0 md:flex", minimal ? "ml-2" : "flex-1 justify-center")}>
            <ul ref={navRef} className="flex items-center gap-0.5" onPointerLeave={leave}>
              {nav.map((entry, i) => {
                const kind = entryKind(entry);
                const isActive = i === active;
                if (entry.kind !== "dropdown" && entry.kind !== "mega") {
                  const here = isActiveHref(entry.href, currentHref) && entry.href === currentHref;
                  return (
                    <li key={entry.label} onPointerEnter={(e) => e.pointerType === "mouse" && open >= 0 && hover(-1)(e)}>
                      <a
                        href={entry.href}
                        data-top=""
                        aria-current={here ? "page" : undefined}
                        target={entry.external ? "_blank" : undefined}
                        rel={entry.external ? "noreferrer" : undefined}
                        onKeyDown={onTopKey(i, false)}
                        onClick={(e) => onNavigate?.(entry.href, e)}
                        className={topClass(false, isActive)}
                      >
                        {entry.label}
                        {indicator(isActive)}
                      </a>
                    </li>
                  );
                }
                const on = open === i;
                const panelId = `${uid}-panel-${i}`;
                return (
                  <li key={entry.label} className={kind === "dropdown" ? "relative" : undefined} onPointerEnter={hover(i)}>
                    <button
                      type="button"
                      data-top=""
                      aria-expanded={on}
                      aria-controls={panelId}
                      onClick={() => setOpen(on ? -1 : i)}
                      onKeyDown={onTopKey(i, true)}
                      className={topClass(on, isActive)}
                    >
                      {entry.label}
                      <Chevron open={on} />
                      {indicator(isActive)}
                    </button>
                    <div
                      id={panelId}
                      data-panel={i}
                      inert={!on}
                      onKeyDown={onPanelKey(i)}
                      onBlur={(e) => {
                        if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) setOpen((o) => (o === i ? -1 : o));
                      }}
                      className={cn(
                        "absolute top-full z-50 pt-3 transition-[opacity,translate] duration-150 ease-out motion-reduce:transition-none",
                        kind === "mega" ? "left-1/2 w-[min(760px,calc(100%-2rem))] -translate-x-1/2" : "left-0 w-72",
                        on ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0",
                      )}
                    >
                      <div className="rounded-2xl border bg-popover p-2 text-popover-foreground shadow-[0_18px_48px_-16px_rgb(0_0_0/0.28)]">
                        {entry.kind === "mega" ? (
                          <div className={cn("grid gap-2", entry.featured ? "grid-cols-[1fr_240px]" : "grid-cols-1")}>
                            <div className={cn("grid gap-x-2 gap-y-3", entry.groups.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                              {entry.groups.map((g) => (
                                <div key={g.title}>
                                  <p className="px-2.5 pb-1 pt-1.5 text-[11.5px] font-medium tracking-wide text-muted-foreground uppercase">{g.title}</p>
                                  <ul>
                                    {g.items.map((item) => (
                                      <li key={item.href + item.label}>
                                        <MegaLink item={item} onNavigate={onNavigate} current={currentHref} onPick={() => setOpen(-1)} />
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                            {entry.featured && <div className="min-w-0 rounded-[12px] bg-muted/50 p-1">{entry.featured}</div>}
                          </div>
                        ) : (
                          <ul>
                            {entry.items.map((item) => (
                              <li key={item.href + item.label}>
                                <MegaLink item={item} onNavigate={onNavigate} current={currentHref} onPick={() => setOpen(-1)} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        <div className={cn(minimal || nav.length === 0 ? "ml-auto" : "ml-auto md:ml-0")}>{right}</div>
      </div>

      {nav.length > 0 && (
        <SiteDrawer
          id={`${uid}-drawer`}
          open={drawer}
          onClose={() => setDrawer(false)}
          brand={brand}
          nav={nav}
          currentHref={currentHref}
          onNavigate={onNavigate}
          search={search}
          signIn={account ? undefined : signIn}
          cta={cta}
        />
      )}
    </header>
  );
}

function buttonLook(variant: "primary" | "secondary") {
  return cn(
    "inline-flex h-7 items-center rounded-[8px] px-3 text-[12.5px] font-medium whitespace-nowrap transition-[background-color,box-shadow] duration-150 pointer-coarse:h-9",
    variant === "primary" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-card text-foreground shadow-[0_0_0_1px_var(--border)] hover:bg-muted",
    focusRing,
  );
}

/* ── Mobile drawer ── */

export interface SiteDrawerProps {
  id?: string;
  open: boolean;
  onClose: () => void;
  brand: ReactNode;
  nav: NavEntry[];
  currentHref?: string;
  onNavigate?: SiteHeaderProps["onNavigate"];
  search?: SiteHeaderProps["search"];
  signIn?: SiteHeaderProps["signIn"];
  cta?: SiteHeaderProps["cta"];
}

/** The small-screen menu: a modal side sheet on <dialog>, links grouped in accordions. */
export function SiteDrawer({ id, open, onClose, brand, nav, currentHref, onNavigate, search, signIn, cta }: SiteDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const unlock = lockScroll();
    // Growing past the breakpoint (rotation, resize) closes the drawer.
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => mq.matches && onClose();
    mq.addEventListener("change", onChange);
    return () => {
      unlock();
      mq.removeEventListener("change", onChange);
    };
  }, [open, onClose]);

  const pick = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    onNavigate?.(href, e);
    onClose();
  };
  const activeIdx = activeEntry(nav, currentHref);
  const linkClass = (on: boolean) =>
    cn("flex min-h-11 items-center rounded-[10px] px-3 text-[15px] transition-colors hover:bg-muted", on ? "font-medium text-foreground" : "text-foreground/85", focusRing);

  return (
    <dialog
      ref={ref}
      id={id}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={cn(
        "fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[min(360px,100vw)] max-w-none border-l bg-background p-0 text-foreground",
        "backdrop:bg-black/40 backdrop:backdrop-blur-[2px]",
        "transition-[translate] duration-300 ease-[cubic-bezier(.22,1,.36,1)] starting:open:translate-x-full motion-reduce:transition-none",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 flex-none items-center justify-between border-b px-4">
          <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">{brand}</span>
          <h2 id={titleId} className="sr-only">
            Menu
          </h2>
          <button type="button" data-autofocus="" aria-label="Close menu" onClick={onClose} className={iconButton}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" className="size-4">
              <path d="m4 4 8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3">
          {search && (
            <button
              type="button"
              onClick={() => {
                onClose();
                search.onOpen();
              }}
              className={cn("mb-3 flex h-10 w-full items-center gap-2 rounded-[10px] bg-card px-3 text-[14px] text-muted-foreground shadow-[0_0_0_1px_var(--border)]", focusRing)}
            >
              <SearchIcon />
              {search.label ?? "Search"}
            </button>
          )}
          <Accordion type="multiple" defaultValue={activeIdx >= 0 ? [String(activeIdx)] : []}>
            {nav.map((entry, i) => {
              if (entry.kind !== "dropdown" && entry.kind !== "mega") {
                const here = entry.href === currentHref;
                return (
                  <a key={entry.label} href={entry.href} aria-current={here ? "page" : undefined} onClick={pick(entry.href)} className={linkClass(i === activeIdx)}>
                    {entry.label}
                  </a>
                );
              }
              const items = entry.kind === "mega" ? entry.groups.flatMap((g) => g.items) : entry.items;
              return (
                <AccordionItem key={entry.label} value={String(i)} className="border-b-0">
                  <AccordionTrigger className="min-h-11 rounded-[10px] px-3 py-0 text-[15px] font-normal hover:bg-muted">{entry.label}</AccordionTrigger>
                  <AccordionContent className="pb-2 text-[14px]">
                    <ul className="ml-3 border-l pl-2">
                      {items.map((item) => (
                        <li key={item.href + item.label}>
                          <a
                            href={item.href}
                            aria-current={item.href === currentHref ? "page" : undefined}
                            onClick={pick(item.href)}
                            className={cn("flex min-h-10 flex-col justify-center rounded-[8px] px-3 py-1.5 transition-colors hover:bg-muted", focusRing)}
                          >
                            <span className={cn(item.href === currentHref ? "font-medium text-foreground" : "text-foreground/85")}>{item.label}</span>
                            {item.description && <span className="text-[12.5px] leading-snug text-muted-foreground">{item.description}</span>}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </nav>

        {(signIn || cta) && (
          <div className="flex flex-none flex-col gap-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {cta &&
              (cta.href ? (
                <a href={cta.href} onClick={(e) => (pick(cta.href!)(e), cta.onClick?.())} className={cn(buttonLook("primary"), "h-10 justify-center text-[14px]")}>
                  {cta.label}
                </a>
              ) : (
                <Button onClick={() => (onClose(), cta.onClick?.())} className="h-10 w-full">
                  {cta.label}
                </Button>
              ))}
            {signIn &&
              (signIn.href ? (
                <a href={signIn.href} onClick={(e) => (pick(signIn.href!)(e), signIn.onClick?.())} className={cn(buttonLook("secondary"), "h-10 justify-center text-[14px]")}>
                  {signIn.label ?? "Sign in"}
                </a>
              ) : (
                <Button variant="secondary" onClick={() => (onClose(), signIn.onClick?.())} className="h-10 w-full">
                  {signIn.label ?? "Sign in"}
                </Button>
              ))}
          </div>
        )}
      </div>
    </dialog>
  );
}

