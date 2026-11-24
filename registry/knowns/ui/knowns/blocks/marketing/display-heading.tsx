/** @registry name="display-heading" type="block" title="Display heading" description="A display headline at 72 to 96px with tight tracking and one accent device (a marker, one coloured word or a coloured full stop), plus an intro layout with the headline on the left and the paragraph and buttons on the right." */

/**
 * DisplayHeading and DisplayIntro. The headline is big and tight: 48px on a phone growing to 72, 88 or 96px, tracking
 * -0.035em, two short lines. One accent device per page, named by `accent`: a marker highlight behind a word, the word
 * in the accent colour, or a coloured full stop. DisplayIntro puts the headline left and a short paragraph with the
 * buttons right from 1024px, stacked below that.
 */
import type { ElementType, ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { splitAccent, stripStop, type AccentDevice } from "./display-heading-utils";

export interface DisplayHeadingProps {
  /** The headline text. Keep it to two short lines. */
  children: string;
  /** The accent device: a marker behind the word, the word coloured, a coloured full stop after the headline, or none. Default "none". */
  accent?: AccentDevice;
  /** The word the marker or colour goes on (the first match). Not needed for "stop" or "none". */
  highlight?: string;
  /** "md" tops out at 72px, "lg" at 88px (default), "xl" at 96px, "2xl" at 124px (a poster hero, 60px on a phone). */
  size?: "md" | "lg" | "xl" | "2xl";
  as?: ElementType;
  className?: string;
}

const SIZE = {
  md: "text-[44px] sm:text-[56px] lg:text-[72px]",
  lg: "text-[48px] sm:text-[68px] lg:text-[88px]",
  xl: "text-[52px] sm:text-[76px] lg:text-[96px]",
  "2xl": "text-[60px] sm:text-[84px] lg:text-[124px] tracking-[-0.04em]",
} as const;

/** The font follows `--kn-display-font` when a page sets it (a serif, say), and inherits otherwise. The marker takes `--kn-marker` when set (a solid highlighter), else the accent at 38%. */
const BASE = "font-[family-name:var(--kn-display-font,inherit)] text-balance font-semibold [line-height:0.96] tracking-[-0.035em]";

export function DisplayHeading({ children, accent = "none", highlight, size = "lg", as: Tag = "h1", className }: DisplayHeadingProps) {
  let body: ReactNode = children;
  if (accent === "stop") {
    body = (
      <>
        {stripStop(children)}
        <span className="text-primary">.</span>
      </>
    );
  } else if (accent === "marker" || accent === "word") {
    const [a, m, z] = splitAccent(children, highlight);
    if (m) {
      body = (
        <>
          {a}
          {accent === "marker" ? (
            <mark className="rounded-[0.08em] bg-transparent px-[0.06em] text-inherit [background-image:linear-gradient(transparent_58%,var(--kn-marker,color-mix(in_srgb,var(--primary)_38%,transparent))_58%,var(--kn-marker,color-mix(in_srgb,var(--primary)_38%,transparent))_92%,transparent_92%)] [-webkit-box-decoration-break:clone] [box-decoration-break:clone]">{m}</mark>
          ) : (
            <span className="text-primary">{m}</span>
          )}
          {z}
        </>
      );
    }
  }
  return <Tag className={cn(BASE, SIZE[size], className)}>{body}</Tag>;
}

export interface DisplayIntroProps extends Omit<DisplayHeadingProps, "className"> {
  /** The short paragraph on the right. 15 to 16px, muted. */
  lead?: ReactNode;
  /** Buttons or links under the paragraph. */
  actions?: ReactNode;
  /** A small line above the headline. */
  eyebrow?: ReactNode;
  className?: string;
  headingClassName?: string;
}

/** Headline left, paragraph and buttons right (bottom-aligned from 1024px); stacked on a phone. */
export function DisplayIntro({ lead, actions, eyebrow, className, headingClassName, ...heading }: DisplayIntroProps) {
  return (
    <div className={cn("grid items-end gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-14", className)}>
      <div className="flex min-w-0 flex-col gap-5">
        {eyebrow ? <p className="text-[13px] font-medium text-muted-foreground">{eyebrow}</p> : null}
        <DisplayHeading {...heading} className={headingClassName} />
      </div>
      {lead || actions ? (
        <div className="flex min-w-0 flex-col gap-6 lg:pb-2">
          {lead ? <p className="max-w-md text-[15px] leading-7 text-muted-foreground sm:text-[16px]">{lead}</p> : null}
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
