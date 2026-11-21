"use client";
/** @registry name="record-header" type="block" title="Record header" description="The top of a contact or company record: initials or logo, name, role and company, stage, owner, tags, email, call and note actions and a row of key facts." */

/**
 * RecordHeader: what sits above one CRM record. A picture or initials, the name, the line under it (role at company),
 * a stage badge, tags, quick actions (email and call are links, note is a callback) and a row of key facts with the
 * owner first. It holds no data and fetches nothing: every value comes in as a prop and every action goes out as a
 * callback or a link. Email and call buttons are drawn only when the address or number is valid, so a half-filled
 * record never shows a dead button.
 */
import type { ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Avatar } from "../../avatar";
import { Badge, type BadgeTone } from "../../badge";
import { Button, buttonClass } from "../../button";
import { Tag } from "../../tag";
import { Tooltip } from "../../tooltip";
import { initialsOf, mailtoHref, safeHref, subtitleOf, telHref, visibleFacts, type Fact, type RecordKind } from "./record-header-utils";

export { initialsOf, mailtoHref, safeHref, subtitleOf, telHref, visibleFacts };
export type { Fact, RecordKind };

export interface RecordOwner {
  name: string;
  src?: string;
}

export interface RecordHeaderProps {
  kind?: RecordKind;
  name: string;
  /** Contact: the role. Joined with `company` as "Role at Company". */
  role?: string;
  company?: string;
  /** Replaces the line under the name (a company's industry and city, say). */
  line?: string;
  /** A photo or logo. Without it the avatar shows initials. */
  image?: string;
  stage?: { label: string; tone?: BadgeTone };
  owner?: RecordOwner;
  tags?: string[];
  email?: string;
  phone?: string;
  /** Shows the Note button; the click opens your composer. */
  onNote?: () => void;
  /** Extra buttons after the quick actions (Edit, More). */
  actions?: ReactNode;
  /** Key facts under the header: last touch, deal value, source. At most `maxFacts` show, the rest sit in a tooltip. */
  facts?: Fact[];
  maxFacts?: number;
  /** Heading level of the name. Default h1, since a record page is about one record. */
  as?: "h1" | "h2" | "h3";
  className?: string;
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-4">
    <path d={d} />
  </svg>
);
const MAIL = "M2.5 4.5h11v7h-11zM2.5 5l5.5 4 5.5-4";
const PHONE = "M4 2.5h2l1 3-1.5 1a7 7 0 0 0 3 3l1-1.5 3 1v2a1.5 1.5 0 0 1-1.5 1.5A10 10 0 0 1 2.5 4 1.5 1.5 0 0 1 4 2.5z";
const NOTE = "M3 3h10v7.5H8L5 13v-2.5H3zM5.5 6h5M5.5 8h3";

export function RecordHeader({ kind = "contact", name, role, company, line, image, stage, owner, tags, email, phone, onNote, actions, facts, maxFacts = 5, as: Heading = "h1", className }: RecordHeaderProps) {
  const sub = subtitleOf(kind, { role, company, line });
  const mail = mailtoHref(email);
  const tel = telHref(phone);
  const { shown, hidden } = visibleFacts(facts, maxFacts);
  const hasActions = Boolean(mail || tel || onNote || actions);
  const hasFacts = Boolean(owner || shown.length);

  return (
    <header className={cn("rounded-2xl border bg-card text-card-foreground shadow-xs", className)}>
      <div className="flex flex-col gap-4 px-5 pt-5 pb-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar label={name} src={image} initials={initialsOf(name, kind)} size="xl" shape={kind === "company" ? "square" : "circle"} decorative />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <Heading className="min-w-0 text-[19px] leading-tight font-semibold tracking-tight break-words">{name}</Heading>
              {stage && (
                <Badge tone={stage.tone ?? "accent"} size="md" shape="pill">
                  {stage.label}
                </Badge>
              )}
            </div>
            {sub && <p className="mt-1 text-[13px] text-muted-foreground">{sub}</p>}
            {tags && tags.length > 0 && (
              <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Tags">
                {tags.map((t) => (
                  <li key={t}>
                    <Tag size="sm">{t}</Tag>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {hasActions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2" role="group" aria-label={`Actions for ${name}`}>
            {mail && (
              <a href={mail} className={buttonClass("secondary", "sm")}>
                <Icon d={MAIL} />
                Email
              </a>
            )}
            {tel && (
              <a href={tel} className={buttonClass("secondary", "sm")}>
                <Icon d={PHONE} />
                Call
              </a>
            )}
            {onNote && (
              <Button variant="secondary" size="sm" icon={<Icon d={NOTE} />} onClick={onNote}>
                Note
              </Button>
            )}
            {actions}
          </div>
        )}
      </div>

      {hasFacts && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t px-5 py-3.5 sm:grid-cols-3 lg:flex lg:flex-wrap lg:gap-x-10">
          {owner && (
            <div className="min-w-0">
              <dt className="text-[11.5px] text-muted-foreground">Owner</dt>
              <dd className="mt-1 flex items-center gap-2 text-[13px] font-medium">
                <Avatar label={owner.name} src={owner.src} size="xs" decorative />
                <span className="truncate">{owner.name}</span>
              </dd>
            </div>
          )}
          {shown.map((f) => {
            const href = safeHref(f.href);
            return (
              <div key={f.label} className="min-w-0">
                <dt className="text-[11.5px] text-muted-foreground">{f.label}</dt>
                <dd className="mt-1 truncate text-[13px] font-medium">
                  {href ? (
                    <a href={href} className={cn("rounded-sm underline-offset-2 hover:underline", focusRing)}>
                      {f.value}
                    </a>
                  ) : (
                    f.value
                  )}
                </dd>
              </div>
            );
          })}
          {hidden.length > 0 && (
            <div className="min-w-0">
              <dt className="sr-only">More facts</dt>
              <dd className="mt-[18px] text-[13px] text-muted-foreground">
                <Tooltip content={hidden.map((f) => `${f.label}: ${f.value}`).join(", ")}>
                  <span tabIndex={0} className={cn("rounded-sm", focusRing)}>
                    +{hidden.length} more
                  </span>
                </Tooltip>
              </dd>
            </div>
          )}
        </dl>
      )}
    </header>
  );
}

export default RecordHeader;
