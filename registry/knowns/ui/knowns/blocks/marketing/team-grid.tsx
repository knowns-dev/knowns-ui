"use client";
/** @registry name="team-grid" type="block" title="Team grid" description="The people behind the product as cards or compact tiles: photo or initials, name, role, location, a clamped bio that opens in place, and labelled social links. The list layout is a Pro variant that builds on it." deps="marketing-2b-core" */

/**
 * The people behind the product: a grid of cards (avatar or initials, name, role, a short bio and
 * social links) or compact tiles for larger teams. Long bios are clamped; "Read more" opens them in place,
 * and on devices with a mouse, hovering a card opens its bio too. Exports Socials and TeamSection for the
 * Pro list layout in ./team-list.
 */
import { useState, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Avatar } from "../../avatar";
import { SectionHeading } from "./section-heading";

export type SocialKind = "x" | "github" | "linkedin" | "site" | "email";

export interface TeamMember {
  name: string;
  role: string;
  bio?: string;
  /** Photo URL. Initials are used without one. */
  avatar?: string;
  /** Location or team, shown small under the role. */
  meta?: string;
  links?: { kind: SocialKind; href: string; label?: string }[];
}

/** The section around the people: heading, then the people, then a footer. Shared by every layout. */
export interface TeamSectionProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  lead?: ReactNode;
  align?: "start" | "center";
  /** Shown after the people, e.g. a "We're hiring" link. */
  footer?: ReactNode;
  className?: string;
}

export interface TeamGridProps extends TeamSectionProps {
  members: TeamMember[];
  /** "grid": cards with bio and links (default). "compact": centred photo, name and role tiles for larger teams. */
  variant?: "grid" | "compact";
  /** Columns at full width (grid). Default 3. */
  columns?: 2 | 3 | 4;
}

const KIND_LABEL: Record<SocialKind, string> = { x: "X", github: "GitHub", linkedin: "LinkedIn", site: "Website", email: "Email" };

const ICONS: Record<SocialKind, ReactNode> = {
  x: <path d="M3.5 3h3.2l3.1 4.3L13.4 3h1.6l-4.5 5.3L15.5 15h-3.2L9 10.5 5.1 15H3.5l4.8-5.6z" fill="currentColor" stroke="none" />,
  github: <path d="M9 2.5a6.5 6.5 0 0 0-2 12.7c.3 0 .4-.2.4-.4v-1.3c-1.8.4-2.2-.8-2.2-.8-.3-.7-.7-.9-.7-.9-.6-.4 0-.4 0-.4.7 0 1 .7 1 .7.6 1 1.6.7 2 .6 0-.4.2-.7.4-.9-1.4-.2-3-.7-3-3.2 0-.7.3-1.3.7-1.8-.1-.2-.3-.8 0-1.7 0 0 .6-.2 1.8.7a6 6 0 0 1 3.2 0c1.2-.9 1.8-.7 1.8-.7.3.9.1 1.5 0 1.7.4.5.7 1.1.7 1.8 0 2.5-1.6 3-3 3.2.2.2.4.6.4 1.2v1.8c0 .2.1.4.4.4A6.5 6.5 0 0 0 9 2.5z" fill="currentColor" stroke="none" />,
  linkedin: (
    <>
      <rect x="2.5" y="2.5" width="13" height="13" rx="2" />
      <path d="M6 8v4.5M6 5.6v.1M8.8 12.5V8m0 2.2c0-1.3.9-2.2 2-2.2s1.7.8 1.7 2v2.5" />
    </>
  ),
  site: (
    <>
      <circle cx="9" cy="9" r="6.5" />
      <path d="M2.5 9h13M9 2.5c1.8 1.8 2.6 4 2.6 6.5S10.8 13.7 9 15.5C7.2 13.7 6.4 11.5 6.4 9S7.2 4.3 9 2.5z" />
    </>
  ),
  email: (
    <>
      <rect x="2.5" y="4" width="13" height="10" rx="1.8" />
      <path d="m3 5 6 4.8L15 5" />
    </>
  ),
};

/** Accessible name for a social link, e.g. "Ada Park on GitHub". */
export const socialLabel = (name: string, l: { kind: SocialKind; label?: string }) => l.label ?? `${name} on ${KIND_LABEL[l.kind]}`;

export function Socials({ m, className }: { m: TeamMember; className?: string }) {
  if (!m.links?.length) return null;
  return (
    <ul className={cn("flex items-center gap-1", className)}>
      {m.links.map((l) => (
        <li key={l.kind + l.href}>
          <a
            href={l.kind === "email" && !l.href.startsWith("mailto:") ? `mailto:${l.href}` : l.href}
            target={l.kind === "email" ? undefined : "_blank"}
            rel={l.kind === "email" ? undefined : "noreferrer"}
            aria-label={socialLabel(m.name, l)}
            title={KIND_LABEL[l.kind]}
            className={cn("grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground", focusRing)}
          >
            <svg viewBox="0 0 18 18" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {ICONS[l.kind]}
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Bios longer than this get the clamp and the "Read more" toggle. */
export const BIO_CLAMP = 120;

function Card({ m }: { m: TeamMember }) {
  const [open, setOpen] = useState(false);
  const long = (m.bio?.length ?? 0) > BIO_CLAMP;
  return (
    <li className="group/member flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-4">
        <Avatar label={m.name} src={m.avatar} size="xl" shape="circle" decorative />
        <div className="min-w-0">
          <h3 className="truncate text-[16px] font-medium">{m.name}</h3>
          <p className="truncate text-[14px] text-muted-foreground">{m.role}</p>
          {m.meta && <p className="truncate text-[13px] text-muted-foreground">{m.meta}</p>}
        </div>
      </div>
      {m.bio && (
        <div className="flex flex-col items-start gap-1">
          <p className={cn("text-[14px] leading-relaxed text-muted-foreground", long && !open && "line-clamp-3 pointer-fine:group-hover/member:line-clamp-none")}>{m.bio}</p>
          {long && (
            <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={cn("rounded-sm text-[13px] font-medium text-foreground underline-offset-2 hover:underline", focusRing)}>
              {open ? "Show less" : "Read more"}
              <span className="sr-only"> about {m.name}</span>
            </button>
          )}
        </div>
      )}
      <Socials m={m} className="mt-auto -ml-2" />
    </li>
  );
}

const COLS = { 2: "@[640px]:grid-cols-2", 3: "@[560px]:grid-cols-2 @[880px]:grid-cols-3", 4: "@[560px]:grid-cols-2 @[880px]:grid-cols-3 @[1100px]:grid-cols-4" } as const;

/** The section shell every team layout shares. `layout` lands on data-variant for styling hooks. */
export function TeamSection({ eyebrow, title = "The team", lead, align = "center", footer, className, layout = "grid", children }: TeamSectionProps & { layout?: string; children?: ReactNode }) {
  return (
    <section data-slot="team-grid" data-variant={layout} className={cn("@container mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-16 sm:px-6 sm:py-24", className)}>
      <SectionHeading eyebrow={eyebrow} title={title} lead={lead} align={align} />
      {children}
      {footer && <div className={cn("text-[14px] text-muted-foreground", align === "center" && "text-center")}>{footer}</div>}
    </section>
  );
}

export function TeamGrid({ members, variant = "grid", columns = 3, ...section }: TeamGridProps) {
  return (
    <TeamSection {...section} layout={variant}>
      {variant === "compact" ? (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 @[560px]:grid-cols-3 @[880px]:grid-cols-4 @[1100px]:grid-cols-6">
          {members.map((m) => (
            <li key={m.name} className="flex flex-col items-center gap-3 text-center">
              <Avatar label={m.name} src={m.avatar} size="2xl" shape="circle" decorative />
              <div className="min-w-0 max-w-full">
                <p className="truncate text-[15px] font-medium">{m.name}</p>
                <p className="truncate text-[14px] text-muted-foreground">{m.role}</p>
              </div>
              <Socials m={m} className="-mt-1" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className={cn("grid gap-4", COLS[columns])}>
          {members.map((m) => (
            <Card key={m.name} m={m} />
          ))}
        </ul>
      )}
    </TeamSection>
  );
}

export default TeamGrid;
