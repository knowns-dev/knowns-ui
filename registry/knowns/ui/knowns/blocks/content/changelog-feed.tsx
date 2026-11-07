"use client";
/** @registry name="changelog-feed" type="block" title="Changelog feed" description="Dated version entries tagged New / Improved / Fixed / Breaking with rich content, media and links, a tag filter, an RSS link, and a compact What's new list with unread dots." */

import { useMemo, useState, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Toggle } from "../../toggle-group";
import { formatDate } from "./content-utils";
import { Cover, ProseBlocks, type ProseBlock } from "./prose";

export type ChangeTag = "new" | "improved" | "fixed" | "breaking";
export const CHANGE_TAGS: ChangeTag[] = ["new", "improved", "fixed", "breaking"];

export interface ChangelogEntry {
  id: string;
  /** e.g. "2.4.0". */
  version?: string;
  date: string | number | Date;
  title: string;
  /** A small mark after the title, e.g. a plan badge or an icon. Give it an accessible name. */
  badge?: ReactNode;
  tags: ChangeTag[];
  /** One line, shown in the compact view and above the details. */
  summary?: ReactNode;
  /** Details as content blocks… */
  blocks?: ProseBlock[];
  /** …or your own content. */
  body?: ReactNode;
  media?: { src?: string; alt: string; hue?: number; caption?: ReactNode };
  links?: { label: string; href: string }[];
  /** Link to the entry's own page (used by the compact view). */
  href?: string;
  /** A note under the text, e.g. what to change when upgrading. Shown as a quiet callout. */
  note?: { title?: string; text: ReactNode };
  /** Extra labels the releases view can filter by, e.g. ["pro"] (see ChangelogReleases' flags). */
  flags?: string[];
}

const TAG: Record<ChangeTag, { label: string; cls: string }> = {
  new: { label: "New", cls: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300" },
  improved: { label: "Improved", cls: "bg-sky-500/12 text-sky-700 dark:text-sky-300" },
  fixed: { label: "Fixed", cls: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" },
  breaking: { label: "Breaking", cls: "bg-red-500/12 text-red-700 dark:text-red-300" },
};

export const changeTagLabel = (t: ChangeTag) => TAG[t].label;
/** The pill colours of a tag (soft fill, tone text), shared with the timeline view. */
export const changeTagClass = (t: ChangeTag) => TAG[t].cls;

/** Entries with the tag (null: all). */
export const filterChanges = (entries: ChangelogEntry[], tag: ChangeTag | null) => (tag ? entries.filter((e) => e.tags.includes(tag)) : entries);

/** How many entries came after the one the reader last saw (by id, newest first). Unknown id: all of them. */
export function unreadCount(entries: ChangelogEntry[], seenId?: string): number {
  if (!seenId) return entries.length;
  const i = entries.findIndex((e) => e.id === seenId);
  return i === -1 ? entries.length : i;
}

function TagPill({ tag }: { tag: ChangeTag }) {
  return <span className={cn("rounded-full px-2 py-px text-[13px]", TAG[tag].cls)}>{TAG[tag].label}</span>;
}

const RssGlyph = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" className="size-3.5">
    <path d="M3 3.5a9.5 9.5 0 0 1 9.5 9.5M3 7.5A5.5 5.5 0 0 1 8.5 13" />
    <circle cx="3.75" cy="12.25" r=".9" fill="currentColor" stroke="none" />
  </svg>
);

export interface ChangelogFeedProps {
  /** Newest first. */
  entries: ChangelogEntry[];
  title?: ReactNode;
  description?: ReactNode;
  /** Tag chips (New / Improved / Fixed / Breaking). Default true. */
  filter?: boolean;
  /** An RSS or Atom feed link in the header. */
  rssHref?: string;
  /** Anything else for the header's end, e.g. a Subscribe form. */
  actions?: ReactNode;
  locale?: string;
  className?: string;
}

/** A changelog: dated version entries tagged New / Improved / Fixed / Breaking, with rich content, media and links. */
export function ChangelogFeed({ entries, title = "Changelog", description, filter = true, rssHref, actions, locale, className }: ChangelogFeedProps) {
  const [tag, setTag] = useState<ChangeTag | null>(null);
  const list = useMemo(() => filterChanges(entries, tag), [entries, tag]);
  const used = CHANGE_TAGS.filter((t) => entries.some((e) => e.tags.includes(t)));
  return (
    <section aria-label={typeof title === "string" ? title : "Changelog"} className={cn("@container w-full", className)}>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          {title && <h2 className="text-[32px] leading-tight font-semibold text-foreground">{title}</h2>}
          {description && <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {rssHref && (
            <a href={rssHref} className={cn("inline-flex items-center gap-1.5 rounded-[8px] px-2 py-1 text-[13px] text-muted-foreground hover:text-foreground", focusRing)}>
              <RssGlyph /> RSS
            </a>
          )}
        </div>
      </header>
      {filter && used.length > 1 && (
        <div role="group" aria-label="Filter by type of change" className="mb-8 flex flex-wrap gap-1.5">
          <Toggle size="sm" variant="outline" pressed={tag === null} onPressedChange={() => setTag(null)}>
            All <span className="tabular-nums text-muted-foreground">{entries.length}</span>
          </Toggle>
          {used.map((t) => (
            <Toggle key={t} size="sm" variant="outline" pressed={tag === t} onPressedChange={(on) => setTag(on ? t : null)}>
              {TAG[t].label} <span className="tabular-nums text-muted-foreground">{entries.filter((e) => e.tags.includes(t)).length}</span>
            </Toggle>
          ))}
        </div>
      )}
      <ol className="flex flex-col">
        {list.map((e, i) => {
          // Entries of one release (same version, one after another) share its date and version: shown once.
          const cont = !!e.version && list[i - 1]?.version === e.version;
          return (
          <li
            key={e.id}
            id={e.id}
            data-release-continued={cont ? "" : undefined}
            className={cn(
              "grid scroll-mt-24 gap-3 py-8 first:pt-0 @[720px]:grid-cols-[160px_minmax(0,1fr)] @[720px]:gap-8",
              cont ? "pt-2" : "border-t border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] first:border-t-0",
            )}
          >
            <div className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-1 @[720px]:sticky @[720px]:top-8 @[720px]:flex-col @[720px]:self-start", cont && "hidden @[720px]:block")}>
              {!cont && (
                <>
                  <time className="text-[13px] text-muted-foreground">{formatDate(e.date, locale)}</time>
                  {e.version && <span className="font-mono text-[12.5px] text-foreground/80">{`v${e.version}`}</span>}
                </>
              )}
            </div>
            <article aria-labelledby={`${e.id}-title`} className="min-w-0">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {e.tags.map((t) => (
                  <TagPill key={t} tag={t} />
                ))}
              </div>
              <h3 id={`${e.id}-title`} className="text-[20px] leading-snug font-semibold text-balance text-foreground">
                {e.title}
                {e.badge && <span className="ml-2 inline-flex translate-y-[-0.08em] align-middle">{e.badge}</span>}
              </h3>
              {e.summary && <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{e.summary}</p>}
              {e.media && (
                <figure className="mt-5">
                  <Cover src={e.media.src} alt={e.media.alt} hue={e.media.hue} ratio={16 / 8} />
                  {e.media.caption && <figcaption className="mt-2 text-[13px] text-muted-foreground">{e.media.caption}</figcaption>}
                </figure>
              )}
              {e.blocks ? <ProseBlocks blocks={e.blocks} className="mt-4 text-[15px]" /> : e.body ? <div className="mt-4 text-[15px] leading-relaxed text-foreground/85">{e.body}</div> : null}
              {e.links && e.links.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
                  {e.links.map((l) => (
                    <a key={l.href} href={l.href} className={cn("rounded-[4px] text-[14px] text-foreground underline decoration-foreground/25 underline-offset-[3px] hover:decoration-foreground/60", focusRing)}>
                      {l.label}
                    </a>
                  ))}
                </div>
              )}
            </article>
          </li>
          );
        })}
      </ol>
      {list.length === 0 && <p className="py-10 text-center text-[14px] text-muted-foreground">No {tag ? TAG[tag].label.toLowerCase() : ""} changes yet.</p>}
      <p className="sr-only" aria-live="polite">
        {tag ? `${list.length} ${TAG[tag].label} ${list.length === 1 ? "entry" : "entries"}` : ""}
      </p>
    </section>
  );
}

export interface ChangelogCompactProps {
  entries: ChangelogEntry[];
  /** How many to list. Default 4. */
  max?: number;
  /** The id of the newest entry the reader has seen; newer ones get a dot. */
  seenId?: string;
  title?: ReactNode;
  /** "View all" link. */
  allHref?: string;
  onSelect?: (entry: ChangelogEntry) => void;
  locale?: string;
  className?: string;
}

/** "What's new": the latest entries in a small list for a popover or a sidebar, with unread dots. */
export function ChangelogCompact({ entries, max = 4, seenId, title = "What's new", allHref, onSelect, locale, className }: ChangelogCompactProps) {
  const unread = unreadCount(entries, seenId);
  return (
    <div className={cn("w-full min-w-[260px] text-[13px]", className)}>
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <span className="font-semibold text-foreground">
          {title}
          {unread > 0 && <span className="ml-2 rounded-full bg-indigo-500/12 px-1.5 py-px text-[13px] text-indigo-700 tabular-nums dark:text-indigo-300">{`${unread} new`}</span>}
        </span>
        {allHref && (
          <a href={allHref} className={cn("rounded-[4px] text-[13px] text-muted-foreground hover:text-foreground", focusRing)}>
            View all
          </a>
        )}
      </div>
      <ul className="flex flex-col">
        {entries.slice(0, max).map((e, i) => {
          const isNew = i < unread;
          const inner = (
            <>
              <span aria-hidden="true" className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", isNew ? "bg-indigo-500" : "bg-transparent")} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <span className="truncate">{e.title}</span>
                  {e.badge && <span className="inline-flex shrink-0">{e.badge}</span>}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  {e.tags[0] && <span>{TAG[e.tags[0]].label}</span>}
                  <span aria-hidden="true">·</span>
                  <span>{formatDate(e.date, locale)}</span>
                  {isNew && <span className="sr-only">, new</span>}
                </span>
              </span>
            </>
          );
          const cls = cn("flex w-full gap-2.5 rounded-[8px] px-1.5 py-2 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)]", focusRing);
          return (
            <li key={e.id}>
              {e.href ? (
                <a href={e.href} onClick={onSelect ? () => onSelect(e) : undefined} className={cls}>
                  {inner}
                </a>
              ) : (
                <button type="button" onClick={() => onSelect?.(e)} className={cls}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── Releases: the release as the unit ── */

export interface ChangelogRelease {
  /** e.g. "0.9.0". Also the anchor: #v0.9.0. */
  version: string;
  date: string | number | Date;
  /** A short name, e.g. "Early access". */
  title?: string;
  /** One or two sentences about the release as a whole. */
  summary?: ReactNode;
  /** The release's changes. Each is grouped under its first tag; `links` show as a quiet list of names. */
  entries: ChangelogEntry[];
}

export interface ChangelogReleasesProps {
  /** Newest first. */
  releases: ChangelogRelease[];
  title?: ReactNode;
  description?: ReactNode;
  /** Filter chips: All, the tags in use, then these flags (entries carry them in `flags`). Default true. */
  filter?: boolean;
  /** Extra chips that match entries by flag, e.g. [{ flag: "pro", label: "Pro" }]. */
  flags?: { flag: string; label: string }[];
  /** How many names an entry lists before "and N more". Default 6. */
  maxLinks?: number;
  rssHref?: string;
  /** Anything else for the chip row's end. */
  actions?: ReactNode;
  locale?: string;
  className?: string;
}

/** Group order inside a release. */
const GROUP_ORDER: ChangeTag[] = ["breaking", "new", "improved", "fixed"];

type ChipPick = { kind: "tag"; value: ChangeTag } | { kind: "flag"; value: string } | null;
const matches = (e: ChangelogEntry, p: ChipPick) => !p || (p.kind === "tag" ? e.tags.includes(p.value) : !!e.flags?.includes(p.value));

/** An entry's names: up to `max`, then a button for the rest. */
function NameList({ links, max }: { links: { label: string; href: string }[]; max: number }) {
  const [open, setOpen] = useState(false);
  const shown = open ? links : links.slice(0, max);
  const rest = links.length - shown.length;
  return (
    <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
      {shown.map((l, i) => (
        <span key={l.href}>
          {i > 0 && ", "}
          <a href={l.href} className={cn("rounded-[3px] underline-offset-[3px] hover:text-foreground hover:underline", focusRing)}>
            {l.label}
          </a>
        </span>
      ))}
      {rest > 0 && (
        <>
          {" and "}
          <button type="button" onClick={() => setOpen(true)} className={cn("rounded-[3px] text-foreground/80 underline-offset-[3px] hover:text-foreground hover:underline", focusRing)}>
            {`${rest} more`}
          </button>
        </>
      )}
    </p>
  );
}

function ReleaseEntryRow({ e, maxLinks }: { e: ChangelogEntry; maxLinks: number }) {
  return (
    <li id={e.id} className="scroll-mt-24">
      <h4 className="text-[15px] leading-snug font-semibold text-foreground">
        {e.title}
        {e.badge && <span className="ml-1.5 inline-flex translate-y-[-0.06em] align-middle">{e.badge}</span>}
      </h4>
      {e.summary && <p className="mt-1 text-[14px] leading-relaxed text-pretty text-muted-foreground">{e.summary}</p>}
      {e.note && (
        <div role="note" aria-label={e.note.title ?? "Note"} className="mt-3 rounded-[8px] bg-[color-mix(in_oklab,var(--foreground)_3.5%,transparent)] px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-[inset_2px_0_0_color-mix(in_oklab,var(--foreground)_30%,transparent)]">
          {e.note.title && <strong className="mb-0.5 block text-[13px] font-semibold text-foreground">{e.note.title}</strong>}
          <span className="text-foreground/80">{e.note.text}</span>
        </div>
      )}
      {e.links && e.links.length > 0 && <NameList links={e.links} max={maxLinks} />}
    </li>
  );
}

/**
 * A changelog with the release as the unit: a header per release (version, date, title, summary), and its
 * changes grouped by type under small headings, each a compact row. On wide containers the release header is a
 * sticky rail beside its changes, so it stays in view while you scroll that release.
 */
export function ChangelogReleases({ releases, title = "Changelog", description, filter = true, flags = [], maxLinks = 6, rssHref, actions, locale, className }: ChangelogReleasesProps) {
  const [pick, setPick] = useState<ChipPick>(null);
  const all = releases.flatMap((r) => r.entries);
  const usedTags = GROUP_ORDER.filter((t) => all.some((e) => e.tags[0] === t));
  const usedFlags = flags.filter((f) => all.some((e) => e.flags?.includes(f.flag)));
  const shown = releases.map((r) => ({ ...r, entries: r.entries.filter((e) => matches(e, pick)) })).filter((r) => r.entries.length);
  const count = shown.reduce((n, r) => n + r.entries.length, 0);
  const label = pick ? (pick.kind === "tag" ? TAG[pick.value].label : usedFlags.find((f) => f.flag === pick.value)?.label) : "";
  const same = (a: ChipPick, b: ChipPick) => a?.kind === b?.kind && a?.value === b?.value;
  const chip = (p: ChipPick, text: string) => (
    <Toggle key={p ? `${p.kind}:${p.value}` : "all"} size="sm" variant="outline" pressed={same(pick, p)} onPressedChange={(on) => setPick(on ? p : null)}>
      {text}
    </Toggle>
  );
  return (
    <section aria-label={typeof title === "string" ? title : "Changelog"} className={cn("@container w-full", className)}>
      <header className="mb-14">
        {title && <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.02em] text-foreground">{title}</h1>}
        {description && <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          {filter && usedTags.length + usedFlags.length > 1 ? (
            <div role="group" aria-label="Filter changes" className="flex flex-wrap gap-1.5">
              {chip(null, "All")}
              {usedTags.map((t) => chip({ kind: "tag", value: t }, TAG[t].label))}
              {usedFlags.map((f) => chip({ kind: "flag", value: f.flag }, f.label))}
            </div>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {actions}
            {rssHref && (
              <a href={rssHref} className={cn("inline-flex items-center gap-1.5 rounded-[8px] px-2 py-1 text-[13px] text-muted-foreground hover:text-foreground", focusRing)}>
                <RssGlyph /> RSS
              </a>
            )}
          </div>
        </div>
      </header>
      <div className="flex flex-col gap-24">
        {shown.map((r) => {
          const id = `v${r.version}`;
          return (
            <section key={r.version} id={id} aria-labelledby={`${id}-h`} className="grid scroll-mt-24 gap-5 @[880px]:grid-cols-[168px_minmax(0,720px)] @[880px]:gap-14">
              <header className="@[880px]:sticky @[880px]:top-24 @[880px]:self-start">
                <h2 id={`${id}-h`} className="text-[28px] leading-none font-semibold tracking-[-0.02em] text-foreground tabular-nums">
                  {r.version}
                </h2>
                <p className="mt-2 flex flex-wrap gap-x-2 text-[13px] text-muted-foreground @[880px]:flex-col">
                  <time dateTime={new Date(r.date).toISOString().slice(0, 10)}>{formatDate(r.date, locale)}</time>
                  {r.title && <span className="text-foreground/80">{r.title}</span>}
                </p>
              </header>
              <div className="min-w-0">
                {r.summary && <p className="mb-10 max-w-[65ch] text-[15px] leading-relaxed text-pretty text-foreground/85">{r.summary}</p>}
                <div className="flex flex-col gap-10">
                  {GROUP_ORDER.map((t) => {
                    const list = r.entries.filter((e) => e.tags[0] === t);
                    if (!list.length) return null;
                    return (
                      <div key={t}>
                        <h3 className="mb-4 text-[13px] text-muted-foreground">{TAG[t].label}</h3>
                        <ul className="flex flex-col gap-6">
                          {list.map((e) => (
                            <ReleaseEntryRow key={e.id} e={e} maxLinks={maxLinks} />
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </div>
      {count === 0 && <p className="py-10 text-center text-[14px] text-muted-foreground">No {label?.toLowerCase()} changes yet.</p>}
      <p className="sr-only" aria-live="polite">
        {pick ? `${count} ${label} ${count === 1 ? "change" : "changes"}` : ""}
      </p>
    </section>
  );
}

export default ChangelogFeed;
