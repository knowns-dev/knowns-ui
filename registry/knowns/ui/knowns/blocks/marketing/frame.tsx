/** @registry name="frame" type="block" title="Frame" description="The structure of a crafted landing page: a centred frame with hairline rules down both sides, sections cut by hairline rows, hairline-boxed grid cells that share their borders, tick marks where rules cross and one full-bleed band that breaks the frame." */

/**
 * Frame: FrameRoot, FrameSection, FrameGrid and FrameCell. The page sits in a centred frame whose two vertical rules run
 * the full height. Each FrameSection adds a hairline row, and may take a tone (default, muted, accent, dark) or break the
 * frame for the full width (`bleed`). A FrameGrid lays its FrameCells out in 1 to 4 columns, one column on a phone; the cells
 * draw only the lines they share, so no line is doubled. Every line is the border token, there are no shadows, and all the
 * sides are logical, so it mirrors in right-to-left.
 */
import { Children, createContext, useContext, type CSSProperties, type ElementType, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { cellClasses, gridClass, hasTick, type GridAt } from "./frame-utils";

export type FrameTone = "default" | "muted" | "accent" | "dark";

/** A tone's colours and the rule colour inside it. `--muted-foreground` and `--border` follow, so parts placed inside read right on it. */
const TONE: Record<FrameTone, string> = {
  default: "",
  muted: "bg-muted/40",
  accent: "bg-primary text-primary-foreground [--frame-rule:color-mix(in_srgb,var(--primary-foreground)_28%,transparent)] [--border:var(--frame-rule)] [--muted-foreground:color-mix(in_srgb,currentColor_72%,transparent)]",
  dark: "bg-foreground text-background dark:bg-[color-mix(in_srgb,var(--background)_70%,#000)] dark:text-foreground [--frame-rule:color-mix(in_srgb,var(--background)_26%,transparent)] dark:[--frame-rule:color-mix(in_srgb,var(--foreground)_16%,transparent)] [--border:var(--frame-rule)] [--muted-foreground:color-mix(in_srgb,currentColor_70%,transparent)]",
};

const RULE = "border-[color:var(--frame-rule,var(--border))]";

/** A small plus where two rules cross, centred on the corner it is placed in. */
function Tick({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute z-10 size-[9px] text-[color:color-mix(in_srgb,currentColor_55%,transparent)] before:absolute before:inset-x-0 before:top-1/2 before:h-px before:-translate-y-1/2 before:bg-current after:absolute after:inset-y-0 after:start-1/2 after:w-px after:-translate-x-1/2 after:bg-current rtl:after:translate-x-1/2", className)}
    />
  );
}

export interface FrameRootProps {
  children: ReactNode;
  /** The frame's width, any CSS length. Default "1200px". Bleed sections keep their content to this width. */
  maxWidth?: string;
  /** Stretch to the height of the parent, so the side rules run to the bottom even on a short page. */
  fill?: boolean;
  as?: ElementType;
  className?: string;
}

/** The frame: centred, with a hairline rule down each side. Put FrameSections inside. */
export function FrameRoot({ children, maxWidth = "1200px", fill, as: Tag = "div", className }: FrameRootProps) {
  return (
    <div className={cn("w-full [overflow-x:clip] px-3 sm:px-6", fill && "h-full")}>
      <Tag data-frame style={{ "--frame-w": maxWidth, "--frame-rule": "var(--border)" } as CSSProperties} className={cn("mx-auto w-full max-w-(--frame-w) border-x", RULE, fill && "min-h-full", className)}>
        {children}
      </Tag>
    </div>
  );
}

export interface FrameSectionProps {
  children: ReactNode;
  /** The background: default, muted, accent or dark. Parts placed inside follow its text and rule colours. */
  tone?: FrameTone;
  /** Break out of the frame for the full width of the page. The content keeps the frame's width. Use it once, for the key moment. */
  bleed?: boolean;
  /** Draw ticks where this row's top rule meets the frame rules. */
  ticks?: boolean;
  /** Padding inside the section. "none" for a grid that should touch the rules. Default "lg". */
  pad?: "none" | "md" | "lg";
  as?: ElementType;
  id?: string;
  className?: string;
}

const PAD = { none: "", md: "px-4 py-10 sm:px-10 sm:py-14", lg: "px-4 py-14 sm:px-10 sm:py-24" } as const;

/** A row of the frame, cut from the one above by a hairline. */
export function FrameSection({ children, tone = "default", bleed, ticks, pad = "lg", as: Tag = "section", id, className }: FrameSectionProps) {
  const row = cn("relative border-t first:border-t-0", RULE, TONE[tone]);
  if (bleed) {
    return (
      <Tag id={id} className={cn(row, "z-[1] [margin-inline:calc(50%-50vw)]", tone === "default" && "bg-background", className)}>
        <div className={cn("mx-auto w-full max-w-(--frame-w)", PAD[pad])}>{children}</div>
      </Tag>
    );
  }
  return (
    <Tag id={id} className={cn(row, PAD[pad], className)}>
      {ticks ? (
        <>
          <Tick className="start-0 top-0 -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2" />
          <Tick className="end-0 top-0 translate-x-1/2 -translate-y-1/2 rtl:-translate-x-1/2" />
        </>
      ) : null}
      {children}
    </Tag>
  );
}

interface CellContext {
  index: number;
  count: number;
  cols: number;
  at: GridAt;
  ticks: boolean;
}
const CellCtx = createContext<CellContext | null>(null);

export interface FrameGridProps {
  children: ReactNode;
  /** Columns from the breakpoint up, 1 to 4. One column on a phone whatever this is. Default 3. */
  cols?: 1 | 2 | 3 | 4;
  /** Where the columns start: "md" (768px, default) or "lg" (1024px, for wide cells). */
  at?: GridAt;
  /** Draw a tick where two lines inside the grid cross. */
  ticks?: boolean;
  className?: string;
}

/** Cells in a grid whose hairlines are shared: the lines between cells, none around the outside (the frame and the rows draw those). */
export function FrameGrid({ children, cols = 3, at = "md", ticks, className }: FrameGridProps) {
  const items = Children.toArray(children);
  return (
    <div className={cn("grid grid-cols-1", gridClass(cols, at), className)}>
      {items.map((child, i) => (
        <CellCtx.Provider key={i} value={{ index: i, count: items.length, cols, at, ticks: !!ticks }}>
          {child}
        </CellCtx.Provider>
      ))}
    </div>
  );
}

export interface FrameCellProps {
  children: ReactNode;
  /** Padding inside the cell. Default "md". */
  pad?: "none" | "md" | "lg";
  /** Columns this cell spans from the breakpoint up. Its lines are worked out for one cell, so spans suit a last cell that fills a row. */
  className?: string;
}

const CELL_PAD = { none: "", md: "p-6 sm:p-8", lg: "p-8 sm:p-12" } as const;

/** One cell of a FrameGrid. Outside a grid it is a plain padded box. */
export function FrameCell({ children, pad = "md", className }: FrameCellProps) {
  const ctx = useContext(CellCtx);
  const lines = ctx ? cellClasses(ctx.index, ctx.count, ctx.cols, ctx.at) : "";
  const tick = ctx && ctx.ticks && ctx.cols > 1 && hasTick(ctx.index, ctx.count, ctx.cols);
  return (
    <div className={cn("relative min-w-0", RULE, lines, CELL_PAD[pad], className)}>
      {children}
      {tick ? <Tick className={cn("bottom-0 end-0 translate-x-1/2 translate-y-1/2 rtl:-translate-x-1/2", ctx.at === "lg" ? "max-lg:hidden" : "max-md:hidden")} /> : null}
    </div>
  );
}
