"use client";
/** @registry name="blog-post" type="block" title="Blog post" description="A blog post page: header, article typography, a sticky table of contents that follows the reader, a reading-progress bar, Copy link and share, previous / next and related posts." */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn, focusRing, writeClipboard } from "@/registry/knowns/lib/knowns/utils";
import { Button } from "../../button";
import { activeHeading, formatDate, readingLabel, readingMinutes, readingProgress, type TocItem } from "./content-utils";
import { AuthorChip, Cover, Prose, ProseBlocks, blocksText, tocOf, type ContentAuthor, type ProseBlock } from "./prose";
import { PostCard, type BlogPostSummary } from "./blog-grid";

export interface PostLink {
  title: string;
  href?: string;
  onClick?: () => void;
}

export interface BlogPostProps {
  title: string;
  /** One or two lines under the title. */
  lead?: ReactNode;
  author: ContentAuthor;
  date: string | number | Date;
  /** Reading time in minutes. Default: worked out from `blocks`. */
  minutes?: number;
  tags?: string[];
  cover?: { src?: string; alt?: string; hue?: number };
  /** The article as content blocks; the table of contents comes from its headings. */
  blocks?: ProseBlock[];
  /** Or your own content (MDX…), wrapped in the article typography. Pass `toc` for it. */
  children?: ReactNode;
  toc?: TocItem[];
  /** The post's address, for Copy link and the share links. Default: the current page. */
  url?: string;
  /** Show share links (X, LinkedIn) next to Copy link. Default true. */
  shareLinks?: boolean;
  prev?: PostLink;
  next?: PostLink;
  related?: BlogPostSummary[];
  onSelectRelated?: (post: BlogPostSummary) => void;
  /** A link back to the index, e.g. { title: "Blog", href: "/blog" }. */
  back?: PostLink;
  locale?: string;
  className?: string;
}

function LinkOrButton({ link, className, children }: { link: PostLink; className?: string; children: ReactNode }) {
  return link.href ? (
    <a href={link.href} onClick={link.onClick} className={cn(className, focusRing)}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={link.onClick} className={cn(className, focusRing)}>
      {children}
    </button>
  );
}

/** Copy link, the system share sheet where there is one, and share links. */
function Share({ url, links, title }: { url?: string; links: boolean; title: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);
  const href = () => url ?? (typeof location !== "undefined" ? location.href : "");
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        size="sm"
        variant="secondary"
        onClick={() =>
          void writeClipboard(href()).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          })
        }
      >
        <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
      </Button>
      {canShare && (
        <Button size="sm" variant="ghost" onClick={() => void navigator.share({ title, url: href() }).catch(() => {})}>
          Share
        </Button>
      )}
      {links && url && (
        <>
          <a className={cn("rounded-[8px] px-2 py-1 text-[13px] text-muted-foreground hover:text-foreground", focusRing)} href={`https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`} target="_blank" rel="noopener noreferrer">
            Post on X
          </a>
          <a className={cn("rounded-[8px] px-2 py-1 text-[13px] text-muted-foreground hover:text-foreground", focusRing)} href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
            Share on LinkedIn
          </a>
        </>
      )}
    </div>
  );
}

/**
 * A blog post page: header with author, date, reading time, tags and cover; the article with our prose
 * styles; a sticky table of contents that follows the reader; a reading-progress bar; share buttons;
 * previous / next and related posts.
 */
export function BlogPost({
  title,
  lead,
  author,
  date,
  minutes,
  tags,
  cover,
  blocks,
  children,
  toc: tocProp,
  url,
  shareLinks = true,
  prev,
  next,
  related,
  onSelectRelated,
  back,
  locale,
  className,
}: BlogPostProps) {
  const article = useRef<HTMLDivElement>(null);
  const toc = useMemo(() => tocProp ?? (blocks ? tocOf(blocks) : []), [tocProp, blocks]);
  const mins = minutes ?? (blocks ? readingMinutes(blocksText(blocks)) : undefined);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState<string | undefined>(toc[0]?.id);

  // Reading progress and the active heading, once per frame while scrolling.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = article.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setProgress(readingProgress(r.top, r.height, window.innerHeight));
      const tops = toc.map((t) => ({ id: t.id, top: document.getElementById(t.id)?.getBoundingClientRect().top ?? Infinity }));
      setActive(activeHeading(tops));
    };
    const on = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [toc]);

  return (
    <div className={cn("@container w-full", className)}>
      {/* Reading progress: sticks to the top of the viewport while the post scrolls. */}
      <div
        role="progressbar"
        aria-label="Reading progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className="sticky top-0 z-20 h-[2px] w-full bg-transparent"
      >
        <div className="h-full w-full origin-left bg-foreground/70 transition-transform duration-150 ease-out motion-reduce:transition-none" style={{ transform: `scaleX(${progress})` }} />
      </div>

      <header className="mx-auto max-w-3xl pt-6 pb-8">
        {back && (
          <LinkOrButton link={back} className="mb-6 inline-flex items-center gap-1 rounded-[8px] text-[13px] text-muted-foreground hover:text-foreground">
            <span aria-hidden="true">←</span> {back.title}
          </LinkOrButton>
        )}
        {tags && tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="rounded-full bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] px-2 py-px text-[13px] text-foreground/75">
                {t}
              </span>
            ))}
          </div>
        )}
        <h1 className="text-[32px] leading-[1.15] font-semibold text-foreground @[640px]:text-[48px] @[640px]:tracking-tight">{title}</h1>
        {lead && <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground">{lead}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <span className="flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
            <AuthorChip author={author} size="md" />
            <span aria-hidden="true">·</span>
            <span>{formatDate(date, locale)}</span>
            {mins !== undefined && (
              <>
                <span aria-hidden="true">·</span>
                <span>{readingLabel(mins)}</span>
              </>
            )}
          </span>
          <Share url={url} links={shareLinks} title={title} />
        </div>
      </header>

      {cover && <Cover src={cover.src} alt={cover.alt ?? ""} hue={cover.hue} ratio={21 / 9} className="mx-auto mb-10 max-w-5xl" />}

      <div className={cn("mx-auto grid max-w-5xl gap-10", toc.length > 1 && "@[960px]:grid-cols-[minmax(0,1fr)_200px]")}>
        <div ref={article} className="mx-auto w-full max-w-3xl min-w-0">
          {blocks ? <ProseBlocks blocks={blocks} /> : <Prose>{children}</Prose>}
        </div>
        {toc.length > 1 && (
          <nav aria-label="On this page" className="hidden @[960px]:block">
            <div className="sticky top-8">
              <p className="mb-3 text-[13px] text-muted-foreground">On this page</p>
              <ul className="flex flex-col gap-1 border-l border-[color-mix(in_srgb,var(--foreground)_9%,transparent)] text-[13px]">
                {toc.map((t) => (
                  <li key={t.id}>
                    <a
                      href={`#${t.id}`}
                      aria-current={active === t.id ? "location" : undefined}
                      className={cn(
                        "-ml-px block border-l py-1 transition-colors duration-150",
                        t.level === 3 ? "pl-6" : "pl-3",
                        active === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                        focusRing,
                      )}
                    >
                      {t.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        )}
      </div>

      {(prev || next) && (
        <nav aria-label="More posts" className="mx-auto mt-14 grid max-w-3xl gap-3 border-t border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] pt-8 @[560px]:grid-cols-2">
          {prev ? (
            <LinkOrButton link={prev} className="flex flex-col gap-1 rounded-[12px] p-3 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)]">
              <span className="text-[13px] text-muted-foreground">← Previous</span>
              <span className="text-[14px] font-semibold text-foreground">{prev.title}</span>
            </LinkOrButton>
          ) : (
            <span />
          )}
          {next && (
            <LinkOrButton link={next} className="flex flex-col gap-1 rounded-[12px] p-3 text-right transition-colors hover:bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)]">
              <span className="text-[13px] text-muted-foreground">Next →</span>
              <span className="text-[14px] font-semibold text-foreground">{next.title}</span>
            </LinkOrButton>
          )}
        </nav>
      )}

      {related && related.length > 0 && (
        <section aria-labelledby="kncn-related" className="mx-auto mt-14 max-w-5xl">
          <h2 id="kncn-related" className="mb-6 text-[20px] font-semibold text-foreground">
            Related posts
          </h2>
          <ul className="grid gap-8 @[560px]:grid-cols-2 @[900px]:grid-cols-3">
            {related.slice(0, 3).map((p) => (
              <li key={p.id} className="flex">
                <PostCard post={p} onSelect={onSelectRelated} locale={locale} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default BlogPost;
