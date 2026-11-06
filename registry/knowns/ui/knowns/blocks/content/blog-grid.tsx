"use client";
/** @registry name="blog-grid" type="block" title="Blog grid" description="A blog index: a featured post and a grid of cards with cover, tags, title, excerpt, author, date and reading time, tag filter chips, Load more or pages, and an empty state." */

import { useMemo, useState, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Button } from "../../button";
import { Pagination } from "../../pagination";
import { Toggle } from "../../toggle-group";
import { filterByTags, formatDate, pageOf, readingLabel, tagCounts } from "./content-utils";
import { AuthorChip, Cover, type ContentAuthor } from "./prose";

export interface BlogPostSummary {
  id: string;
  title: string;
  excerpt?: string;
  /** Link to the post. Without it the card is a button that calls onSelect. */
  href?: string;
  tags?: string[];
  author: ContentAuthor;
  /** ISO date (2026-11-06), ms or Date. */
  date: string | number | Date;
  /** Reading time in minutes. */
  minutes?: number;
  cover?: { src?: string; alt?: string; hue?: number };
  /** Show this one as the large featured card. Default: the first post. */
  featured?: boolean;
}

export interface BlogGridProps {
  posts: BlogPostSummary[];
  title?: ReactNode;
  description?: ReactNode;
  /** The first (or the `featured`) post as a large card above the grid. Default true. */
  featured?: boolean;
  /** Tag chips above the grid. Default true. */
  filter?: boolean;
  /** Posts per page. Default 6. */
  pageSize?: number;
  /** "grid": a featured card and a grid of cards. "list": compact rows with a small cover, for archives. Default "grid". */
  layout?: "grid" | "list";
  /** Numbered pages or a Load more button. Default "load-more". */
  paging?: "pagination" | "load-more";
  /** Called when a card without href is chosen. */
  onSelect?: (post: BlogPostSummary) => void;
  /** Shown when a filter leaves nothing. */
  empty?: ReactNode;
  locale?: string;
  className?: string;
}

function Meta({ post, locale }: { post: BlogPostSummary; locale?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
      <AuthorChip author={post.author} />
      <span aria-hidden="true">·</span>
      <time dateTime={new Date(typeof post.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(post.date) ? `${post.date}T12:00:00` : post.date).toISOString()} className="shrink-0">
        {formatDate(post.date, locale)}
      </time>
      {post.minutes !== undefined && (
        <>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{readingLabel(post.minutes)}</span>
        </>
      )}
    </span>
  );
}

function Tags({ tags }: { tags?: string[] }) {
  if (!tags?.length) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t} className="rounded-full bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] px-2 py-px text-[13px] text-foreground/75">
          {t}
        </span>
      ))}
    </span>
  );
}

/** One post card. The whole card is the link (or button); the title is its accessible name. */
export function PostCard({ post, onSelect, size = "md", locale }: { post: BlogPostSummary; onSelect?: (post: BlogPostSummary) => void; size?: "md" | "lg" | "row"; locale?: string }) {
  const lg = size === "lg";
  if (size === "row") {
    const row = (
      <>
        <span className="hidden w-40 shrink-0 @[520px]:block">
          <Cover src={post.cover?.src} alt={post.cover?.alt ?? ""} hue={post.cover?.hue} ratio={16 / 10} rounded />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-[16px] leading-snug font-semibold text-foreground">{post.title}</span>
          {post.excerpt && <span className="line-clamp-2 text-[14px] leading-relaxed text-muted-foreground">{post.excerpt}</span>}
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Meta post={post} locale={locale} />
            <Tags tags={post.tags} />
          </span>
        </span>
      </>
    );
    const rowCls = cn("group flex w-full min-w-0 items-start gap-5 rounded-[12px] py-5 text-left", focusRing);
    return post.href ? (
      <a href={post.href} className={rowCls} onClick={onSelect ? () => onSelect(post) : undefined}>
        {row}
      </a>
    ) : (
      <button type="button" className={rowCls} onClick={() => onSelect?.(post)}>
        {row}
      </button>
    );
  }
  const body = (
    <>
      <Cover src={post.cover?.src} alt={post.cover?.alt ?? ""} hue={post.cover?.hue} ratio={lg ? 16 / 8 : 16 / 10} className={cn("transition-transform duration-300 ease-out group-hover:scale-[1.015]", lg && "@[720px]:aspect-auto @[720px]:h-full")} />
      <span className={cn("flex min-w-0 flex-col gap-2.5", lg ? "@[720px]:justify-center @[720px]:py-2" : "")}>
        <Tags tags={post.tags} />
        <span className={cn("font-semibold text-foreground", lg ? "text-[24px] leading-tight" : "text-[16px] leading-snug")}>{post.title}</span>
        {post.excerpt && <span className={cn("text-muted-foreground", lg ? "text-[15px] leading-relaxed" : "line-clamp-2 text-[14px] leading-relaxed")}>{post.excerpt}</span>}
        <Meta post={post} locale={locale} />
      </span>
    </>
  );
  const cls = cn("group flex w-full min-w-0 flex-col gap-4 rounded-[12px] text-left", lg && "@[720px]:grid @[720px]:grid-cols-[1.25fr_1fr] @[720px]:gap-8", focusRing);
  return post.href ? (
    <a href={post.href} className={cls} onClick={onSelect ? () => onSelect(post) : undefined}>
      {body}
    </a>
  ) : (
    <button type="button" className={cls} onClick={() => onSelect?.(post)}>
      {body}
    </button>
  );
}

/**
 * A blog index: a featured post, then a grid of cards with cover, tags, title, excerpt, author, date and
 * reading time. Tag chips filter it; Load more or numbered pages page through it.
 */
export function BlogGrid({
  posts,
  title,
  description,
  featured = true,
  filter = true,
  pageSize = 6,
  paging = "load-more",
  layout = "grid",
  onSelect,
  empty,
  locale,
  className,
}: BlogGridProps) {
  const [tag, setTag] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const tags = useMemo(() => tagCounts(posts), [posts]);
  const list = useMemo(() => filterByTags(posts, tag ? [tag] : []), [posts, tag]);
  const lead = featured && !tag && layout === "grid" ? (list.find((p) => p.featured) ?? list[0]) : undefined;
  const rest = lead ? list.filter((p) => p !== lead) : list;
  const shown = paging === "pagination" ? pageOf(rest, page, pageSize) : { items: rest.slice(0, page * pageSize), page, pages: Math.ceil(rest.length / pageSize) };
  const pick = (t: string | null) => {
    setTag(t);
    setPage(1);
  };

  return (
    <section aria-label={typeof title === "string" ? title : "Blog"} className={cn("@container w-full", className)}>
      {(title || description) && (
        <header className="mb-8 max-w-2xl">
          {title && <h2 className="text-[32px] leading-tight font-semibold text-foreground">{title}</h2>}
          {description && <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
        </header>
      )}
      {filter && tags.length > 1 && (
        <div role="group" aria-label="Filter by tag" className="mb-8 flex flex-wrap gap-1.5">
          <Toggle size="sm" variant="outline" pressed={tag === null} onPressedChange={() => pick(null)}>
            All <span className="text-muted-foreground tabular-nums">{posts.length}</span>
          </Toggle>
          {tags.map((t) => (
            <Toggle key={t.tag} size="sm" variant="outline" pressed={tag === t.tag} onPressedChange={(on) => pick(on ? t.tag : null)}>
              {t.tag} <span className="text-muted-foreground tabular-nums">{t.count}</span>
            </Toggle>
          ))}
        </div>
      )}

      {lead && (
        <div className="mb-10">
          <PostCard post={lead} onSelect={onSelect} size="lg" locale={locale} />
        </div>
      )}

      {list.length === 0 ? (
        <div className="grid place-items-center rounded-[12px] bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] px-6 py-14 text-center">
          {empty ?? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-[15px] font-semibold text-foreground">No posts with this tag yet</p>
              <Button size="sm" variant="secondary" onClick={() => pick(null)}>
                Show all posts
              </Button>
            </div>
          )}
        </div>
      ) : (
        layout === "list" ? (
          <ul className="flex flex-col divide-y divide-[color-mix(in_srgb,var(--foreground)_8%,transparent)]">
            {shown.items.map((p) => (
              <li key={p.id} className="flex">
                <PostCard post={p} onSelect={onSelect} size="row" locale={locale} />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="grid grid-cols-1 gap-x-6 gap-y-10 @[560px]:grid-cols-2 @[900px]:grid-cols-3">
            {shown.items.map((p) => (
              <li key={p.id} className="flex">
                <PostCard post={p} onSelect={onSelect} locale={locale} />
              </li>
            ))}
          </ul>
        )
      )}

      {rest.length > pageSize && (
        <div className="mt-10 flex justify-center">
          {paging === "pagination" ? (
            <Pagination page={shown.page} onPageChange={setPage} total={rest.length} pageSize={pageSize} noun="posts" />
          ) : shown.items.length < rest.length ? (
            <Button variant="secondary" onClick={() => setPage((p) => p + 1)}>
              Load more
            </Button>
          ) : null}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {tag ? `${list.length} ${list.length === 1 ? "post" : "posts"} tagged ${tag}` : ""}
      </p>
    </section>
  );
}

export default BlogGrid;
