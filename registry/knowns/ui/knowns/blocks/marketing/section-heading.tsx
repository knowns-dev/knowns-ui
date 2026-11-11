"use client";
/** @registry name="marketing-core" type="ui" title="Marketing core" description="Shared pieces for the marketing sections: section heading, action buttons and arrow links, a fixed-aspect media frame (lazy image, dark variant, click-to-load video, live content), and pure helpers for tilt, marquee timing, bento spans and row sides." */

/**
 * The heading every marketing section shares: an optional eyebrow, a title and a lead, left or centred.
 * Also the small action link/button and the media frame used across the blocks.
 *
 * Type follows the scale: h2 32/36, body 16, small 14. Two weights only (400, 600).
 */
import { useState, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { buttonClass } from "../../button";
import type { MarketingAction } from "./marketing-utils";

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "center",
  as: Tag = "h2",
  className,
}: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  lead?: ReactNode;
  align?: "start" | "center";
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  if (!eyebrow && !title && !lead) return null;
  return (
    <div className={cn("flex max-w-2xl flex-col gap-4", align === "center" ? "mx-auto items-center text-center" : "items-start text-left", className)}>
      {eyebrow && <p className="text-[14px] font-semibold text-indigo-600 dark:text-indigo-400">{eyebrow}</p>}
      {title && <Tag className="text-balance text-[32px] leading-10 font-semibold sm:text-[36px] sm:leading-[44px]">{title}</Tag>}
      {lead && <p className="text-pretty text-[16px] leading-7 text-muted-foreground">{lead}</p>}
    </div>
  );
}

/** A CTA as a link (href) or a button, in our Button look. */
export function ActionButton({
  action,
  variant = "primary",
  size = "lg",
  className,
}: {
  action: MarketingAction;
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "lg";
  className?: string;
}) {
  const cls = buttonClass(variant, size, false, className);
  if (action.href)
    return (
      <a href={action.href} onClick={action.onClick} target={action.external ? "_blank" : undefined} rel={action.external ? "noreferrer" : undefined} className={cls}>
        {action.label}
      </a>
    );
  return (
    <button type="button" onClick={action.onClick} className={cls}>
      {action.label}
    </button>
  );
}

/** A text link with an arrow, for "Learn more" under a feature. */
export function ArrowLink({ action, className }: { action: MarketingAction; className?: string }) {
  return (
    <a
      href={action.href}
      onClick={action.onClick}
      target={action.external ? "_blank" : undefined}
      rel={action.external ? "noreferrer" : undefined}
      className={cn("group/arrow inline-flex w-fit items-center gap-1 rounded-lg text-[14px] font-semibold text-foreground", focusRing, className)}
    >
      {action.label}
      <span aria-hidden="true" className="text-muted-foreground transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) group-hover/arrow:text-foreground">
        →
      </span>
    </a>
  );
}

export interface MediaFrameProps {
  /** An image: lazy, async-decoded, in a box of the given aspect so nothing shifts when it loads. */
  src?: string;
  /** Dark-theme image, swapped with the .dark class. */
  srcDark?: string;
  alt?: string;
  /** "16/10" by default; any CSS aspect-ratio. */
  aspect?: string;
  /** A video: shows the poster with a play button, loads the video only when played. */
  video?: { src: string; poster: string; label?: string };
  /** Or any live content (a component, a demo), sized by the same frame. */
  children?: ReactNode;
  /** Window chrome (three dots) on top. */
  chrome?: boolean;
  className?: string;
}

/** The framed box for screenshots, videos and live components. Fixed aspect, so no layout shift. */
export function MediaFrame({ src, srcDark, alt = "", aspect = "16/10", video, children, chrome, className }: MediaFrameProps) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      {chrome && (
        <div aria-hidden="true" className="flex h-8 items-center gap-2 border-b px-3">
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
        </div>
      )}
      <div className="relative w-full" style={{ aspectRatio: aspect }}>
        {children ? (
          <div className="absolute inset-0 overflow-hidden">{children}</div>
        ) : video ? (
          playing ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={video.src} poster={video.poster} autoPlay controls playsInline className="absolute inset-0 size-full object-cover" />
          ) : (
            <button type="button" onClick={() => setPlaying(true)} aria-label={video.label ?? "Play video"} className={cn("group/play absolute inset-0 size-full cursor-pointer", focusRing)}>
              <img src={video.poster} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid size-14 place-items-center rounded-full bg-background text-foreground shadow-sm transition-transform duration-200 ease-out group-hover/play:scale-105 motion-reduce:transition-none">
                  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="ml-0.5 size-5">
                    <path d="M5 3.5v9l7.5-4.5z" />
                  </svg>
                </span>
              </span>
            </button>
          )
        ) : src ? (
          <>
            <img src={src} alt={alt} loading="lazy" decoding="async" className={cn("absolute inset-0 size-full object-cover", srcDark && "dark:hidden")} />
            {srcDark && <img src={srcDark} alt={alt} loading="lazy" decoding="async" className="absolute inset-0 hidden size-full object-cover dark:block" />}
          </>
        ) : null}
      </div>
    </div>
  );
}
