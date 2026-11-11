"use client";
/** @registry name="team-grid" type="block" title="Team grid" description="The people behind the product as cards or compact tiles: photo or initials, name, role, location, a clamped bio that opens in place, and labelled social links. The list layout is a Pro variant that builds on it." deps="marketing-2b-core" */

/**
 * The people behind the product: a grid of cards (avatar or initials, name, role, a short bio and
 * social links) or compact tiles for larger teams. Long bios are clamped; "Read more" opens them in place. Exports Socials and TeamSection for the
 * Pro list layout in ./team-list.
 */
import { useState, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { socialOf, type SocialKind } from "@/registry/knowns/lib/knowns/social";
import { Avatar } from "../../avatar";
import { SectionHeading } from "./section-heading";

export type { SocialKind };

export interface TeamMember {
  name: string;
  role: string;
  bio?: string;
  /** Photo URL. Initials are used without one. */
  avatar?: string;
  /** Location or team, shown small under the role. */
  meta?: string;
  /** Only href is needed: the platform (Discord, X, GitHub...) is detected from the URL. kind and label override. */
  links?: { href: string; kind?: SocialKind; label?: string }[];
}

/** The section around the people: heading, then the people, then a footer. Shared by every layout. */
export interface TeamSectionProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  lead?: ReactNode;
  align?: "start" | "center";
  /** Section padding: "default" 64 / 96px (phone / desktop), "tight" 40 / 56px for use inside a page or a frame. */
  spacing?: "default" | "tight";
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

/** Accessible name for a social link, e.g. "Ada Park on GitHub". The platform is detected from the URL unless kind is set. */
export const socialLabel = (name: string, l: { href?: string; kind?: SocialKind; label?: string }) => l.label ?? `${name} on ${socialOf(l.href ?? "", l.kind).label}`;

export function Socials({ m, className }: { m: TeamMember; className?: string }) {
  if (!m.links?.length) return null;
  return (
    <ul className={cn("flex items-center gap-1", className)}>
      {m.links.map((l) => {
        const s = socialOf(l.href, l.kind);
        const mail = s.kind === "email";
        return (
          <li key={s.kind + l.href}>
            <a
              href={mail && !/^mailto:/i.test(l.href) ? `mailto:${l.href}` : l.href}
              target={mail ? undefined : "_blank"}
              rel={mail ? undefined : "noreferrer"}
              aria-label={socialLabel(m.name, l)}
              title={s.label}
              className={cn("grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground", focusRing)}
            >
              {s.icon}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** Bios longer than this get the clamp and the "Read more" toggle. */
export const BIO_CLAMP = 120;

function Card({ m }: { m: TeamMember }) {
  const [open, setOpen] = useState(false);
  const long = (m.bio?.length ?? 0) > BIO_CLAMP;
  return (
    <li className="flex h-full flex-col gap-4 rounded-2xl border bg-card p-5">
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
          <p className={cn("text-[14px] leading-relaxed text-muted-foreground", long && !open && "line-clamp-3")}>{m.bio}</p>
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
export function TeamSection({ eyebrow, title = "The team", lead, align = "center", spacing = "default", footer, className, layout = "grid", children }: TeamSectionProps & { layout?: string; children?: ReactNode }) {
  return (
    <section data-slot="team-grid" data-variant={layout} className={cn("@container mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 sm:px-6", spacing === "tight" ? "py-10 sm:py-14" : "py-16 sm:py-24", className)}>
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
        <ul className={cn("grid items-stretch gap-4", COLS[columns])}>
          {members.map((m) => (
            <Card key={m.name} m={m} />
          ))}
        </ul>
      )}
    </TeamSection>
  );
}

export default TeamGrid;
