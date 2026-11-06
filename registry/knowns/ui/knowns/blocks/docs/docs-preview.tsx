"use client";
/** @registry name="docs-preview" type="block" title="Docs preview" description="Preview / Code card with a toolbar: phone, tablet and full widths, zoom, a preview-only theme, Replay and Full screen, plus a named-example heading with a badge slot." */
/**
 * Docs preview card: Preview / Code tabs and a toolbar (viewport width, zoom, preview-only theme,
 * Replay, Fullscreen). The live preview renders inline; picking a phone or tablet width
 * or the other theme loads it in an iframe from `frame`, so media queries and the theme really apply.
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn, writeClipboard } from "@/registry/knowns/lib/knowns/utils";
import { Tooltip } from "../../tooltip";
import { fitScale, VIEWPORT_WIDTH, type PreviewViewport } from "./docs-utils";

export type PreviewTheme = "light" | "dark";

export interface DocsPreviewFrameOptions {
  viewport: PreviewViewport;
  theme: PreviewTheme;
}

export interface DocsPreviewProps {
  /** The live preview. */
  children: ReactNode;
  /** Source shown on the Code tab. Without it there are no tabs. */
  code?: string;
  lang?: string;
  /** Renders the code (e.g. with a highlighter). Default: a plain <pre>. */
  renderCode?: (code: string, lang: string) => ReactNode;
  /**
   * The Code tab's content while there is no `code`: e.g. a license gate, or a skeleton while the code
   * loads on demand. The tabs show when either is set.
   */
  codePanel?: ReactNode;
  /** Called when the reader switches tabs, e.g. to load the code the first time Code opens. */
  onTabChange?: (tab: "preview" | "code") => void;
  /** Demo controls under the preview, inside the card, after a hairline. Shown on the Preview tab and in full screen. */
  panel?: ReactNode;
  /** A named example: a heading above the card. */
  title?: ReactNode;
  /** Next to the title, e.g. a Free / Pro badge. */
  badge?: ReactNode;
  description?: ReactNode;
  /** Id for the title (for the table of contents). */
  titleId?: string;
  /** Heading level of the title. Default 3. */
  titleLevel?: 2 | 3 | 4;
  /** Remount the preview so entrance animations run again. Default true. */
  replay?: boolean;
  /** Expand the card to the whole window. Default true. */
  fullscreen?: boolean;
  /** URL of a page that renders just this preview. Enables the viewport and theme buttons. */
  frame?: (o: DocsPreviewFrameOptions) => string;
  viewports?: PreviewViewport[];
  /** Zoom steps, e.g. [0.5, 0.75, 1] for full-page blocks. Hidden with one step or none. */
  zoomLevels?: number[];
  /** Show the preview-only theme switch (needs `frame`). Default true when `frame` is set. */
  themeSwitch?: boolean;
  /** Extra buttons at the start of the toolbar. */
  toolbar?: ReactNode;
  /** No inner padding (for previews that bring their own spacing). */
  flush?: boolean;
  /** Minimum preview height in px. */
  minHeight?: number;
  className?: string;
}

/* ── Icons ── */

const I = ({ d, className }: { d: ReactNode; className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cn("size-4", className)}>
    {d}
  </svg>
);
const ICONS = {
  mobile: <I d={<><rect x="4.5" y="1.75" width="7" height="12.5" rx="1.75" /><path d="M7.25 11.75h1.5" /></>} />,
  tablet: <I d={<><rect x="2.5" y="1.75" width="11" height="12.5" rx="1.75" /><path d="M7.25 11.75h1.5" /></>} />,
  desktop: <I d={<><rect x="1.5" y="2.5" width="13" height="8.5" rx="1.5" /><path d="M5.5 13.5h5M8 11v2.5" /></>} />,
  replay: <I d={<path d="M2.75 8a5.25 5.25 0 1 0 1.6-3.77M2.5 2.75v2.5H5" />} />,
  expand: <I d={<path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" />} />,
  collapse: <I d={<path d="M13.5 6.5h-4v-4M2.5 9.5h4v4M9.5 6.5l4-4M6.5 9.5l-4 4" />} />,
  sun: <I d={<><circle cx="8" cy="8" r="2.75" /><path d="M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.6 3.6l1.05 1.05M11.35 11.35l1.05 1.05M3.6 12.4l1.05-1.05M11.35 4.65l1.05-1.05" /></>} />,
  moon: <I d={<path d="M13.25 9.5A5.5 5.5 0 0 1 6.5 2.75a5.5 5.5 0 1 0 6.75 6.75Z" />} />,
};

const tool =
  "grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-ring aria-pressed:bg-muted aria-pressed:text-foreground";

function Tool({ label, onClick, pressed, children }: { label: string; onClick: () => void; pressed?: boolean; children: ReactNode }) {
  return (
    <Tooltip content={label}>
      <button type="button" aria-label={label} aria-pressed={pressed} onClick={onClick} className={tool}>
        {children}
      </button>
    </Tooltip>
  );
}

const Sep = () => <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />;

/** Whether the page itself is in dark mode (the `.dark` class on <html>). */
function usePageTheme(): PreviewTheme {
  const [t, setT] = useState<PreviewTheme>("light");
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setT(el.classList.contains("dark") ? "dark" : "light");
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return t;
}

function CopyCode({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await writeClipboard(text);
        } catch {
          return;
        }
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className="h-7 rounded-md px-2 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span aria-live="polite">{done ? "Copied" : "Copy"}</span>
    </button>
  );
}

/** Iframe that grows to its page's height (the framed page posts `{ type: "kn-frame-height", height }`). */
function Frame({ src, width, zoom, minHeight }: { src: string; width: number | null; zoom: number; minHeight: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(minHeight);
  const [avail, setAvail] = useState(0);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const h = (e.data as { type?: string; height?: number } | null)?.height;
      if ((e.data as { type?: string })?.type === "kn-frame-height" && typeof h === "number") setHeight(Math.max(minHeight, Math.ceil(h)));
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [minHeight]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const w = width ?? (avail ? avail / zoom : 0);
  const scale = width ? fitScale(width, avail - 32, zoom) : zoom;
  return (
    <div ref={box} className="flex justify-center overflow-hidden py-4">
      <div style={{ width: w * scale, height: height * scale }} className={cn("relative shrink-0", width && "rounded-xl shadow-[0_0_0_1px_var(--border)]")}>
        <iframe
          ref={ref}
          src={src}
          title="Preview"
          loading="lazy"
          style={{ width: w, height, transform: `scale(${scale})` }}
          className={cn("absolute top-0 left-0 origin-top-left border-0 bg-background", width && "rounded-xl")}
        />
      </div>
    </div>
  );
}

export function DocsPreview({
  children,
  code,
  lang = "tsx",
  renderCode,
  codePanel,
  onTabChange,
  panel,
  title,
  badge,
  description,
  titleId,
  titleLevel = 3,
  replay = true,
  fullscreen = true,
  frame,
  viewports = ["mobile", "tablet", "desktop"],
  zoomLevels,
  themeSwitch,
  toolbar,
  flush,
  minHeight = 0,
  className,
}: DocsPreviewProps) {
  const id = useId();
  const [tab, setTabState] = useState<"preview" | "code">("preview");
  const setTab = (t: "preview" | "code") => {
    setTabState(t);
    onTabChange?.(t);
  };
  const [run, setRun] = useState(0);
  const [full, setFull] = useState(false);
  const [viewport, setViewport] = useState<PreviewViewport>("desktop");
  const pageTheme = usePageTheme();
  const [ownTheme, setOwnTheme] = useState<PreviewTheme | null>(null);
  const theme = ownTheme ?? pageTheme;
  const zooms = zoomLevels && zoomLevels.length > 1 ? zoomLevels : null;
  const [zoom, setZoom] = useState(1);
  // CSS zoom changes the boxes previews measure without resizing the window: tell them, so blocks that
  // re-measure on window resize redraw their lines. The demo stays mounted (its state is kept).
  const zoomed = useRef(false);
  useEffect(() => {
    if (!zoomed.current) {
      zoomed.current = true;
      return;
    }
    const raf = requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    return () => cancelAnimationFrame(raf);
  }, [zoom]);
  const card = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const preview = useRef<HTMLDivElement>(null);
  const [inlineHeight, setInlineHeight] = useState(minHeight);

  const framed = Boolean(frame) && (viewport !== "desktop" || theme !== pageTheme);
  const showTheme = Boolean(frame) && (themeSwitch ?? true);

  // Remember the inline height so the iframe opens at about the same size.
  useEffect(() => {
    if (framed || !preview.current) return;
    const el = preview.current;
    const ro = new ResizeObserver(() => setInlineHeight(Math.max(minHeight, el.offsetHeight)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [framed, minHeight]);

  const close = useCallback(() => {
    setFull(false);
    opener.current?.focus();
  }, []);
  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    card.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [full, close]);

  const H = `h${titleLevel}` as "h2" | "h3" | "h4";
  const text = code?.trim();
  const tabs = Boolean(text || codePanel);

  const body = framed ? (
    <Frame key={`${viewport}-${theme}-${run}`} src={frame!({ viewport, theme })} width={VIEWPORT_WIDTH[viewport]} zoom={zoom} minHeight={Math.max(240, inlineHeight)} />
  ) : (
    <div ref={preview} style={zoom !== 1 ? { zoom } : undefined} className={cn(!flush && "p-3 sm:p-4")}>
      <div key={run} style={minHeight ? { minHeight } : undefined}>
        {children}
      </div>
    </div>
  );

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      {title && (
        <div>
          <H id={titleId} className="flex scroll-mt-24 flex-wrap items-center gap-2 text-[15px] font-semibold tracking-tight">
            {title}
            {badge}
          </H>
          {description && <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      )}
      <div
        ref={card}
        tabIndex={full ? -1 : undefined}
        role={full ? "dialog" : undefined}
        aria-modal={full || undefined}
        aria-label={full ? "Preview, full screen" : undefined}
        data-fullscreen={full || undefined}
        className={cn("min-w-0 outline-none", full ? "fixed inset-0 z-50 flex flex-col overflow-auto bg-background" : "overflow-hidden rounded-2xl border bg-muted/20")}
      >
        <div className="sticky top-0 z-10 flex h-11 items-center justify-between gap-2 border-b bg-card/80 px-2 backdrop-blur">
          {tabs ? (
            <div role="tablist" aria-label="Example view" className="flex items-center gap-0.5">
              {(["preview", "code"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  id={`${id}-${t}`}
                  aria-selected={tab === t}
                  aria-controls={`${id}-${t}-panel`}
                  tabIndex={tab === t ? 0 : -1}
                  onClick={() => setTab(t)}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                    e.preventDefault();
                    const n = t === "preview" ? "code" : "preview";
                    setTab(n);
                    document.getElementById(`${id}-${n}`)?.focus();
                  }}
                  className="rounded-md px-2.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-ring aria-selected:bg-muted aria-selected:font-medium aria-selected:text-foreground"
                >
                  {t === "preview" ? "Preview" : "Code"}
                </button>
              ))}
            </div>
          ) : (
            <span data-md="skip" className="px-2.5 text-[13px] font-medium">Preview</span>
          )}
          {tab === "code" && text ? (
            <CopyCode text={text} />
          ) : (
            <div role="toolbar" aria-label="Preview tools" className="flex items-center">
              {toolbar}
              {frame && viewports.length > 1 && (
                <div className="hidden items-center sm:flex">
                  {viewports.map((v) => (
                    <Tool key={v} label={v === "desktop" ? "Full width" : `${v === "mobile" ? "Phone" : "Tablet"}, ${VIEWPORT_WIDTH[v]}px`} pressed={viewport === v} onClick={() => setViewport(v)}>
                      {ICONS[v]}
                    </Tool>
                  ))}
                  <Sep />
                </div>
              )}
              {zooms && (
                <div className="hidden items-center sm:flex">
                  {zooms.map((z) => (
                    <Tooltip key={z} content={`Zoom ${Math.round(z * 100)}%`}>
                      <button type="button" aria-pressed={zoom === z} onClick={() => setZoom(z)} className={cn(tool, "w-auto px-1.5 font-mono text-[11.5px] tabular-nums")}>
                        {Math.round(z * 100)}%
                      </button>
                    </Tooltip>
                  ))}
                  <Sep />
                </div>
              )}
              {showTheme && (
                <Tool label={theme === "dark" ? "Preview in light" : "Preview in dark"} onClick={() => setOwnTheme(theme === "dark" ? "light" : "dark")}>
                  {theme === "dark" ? ICONS.sun : ICONS.moon}
                </Tool>
              )}
              {replay && (
                <Tool label="Replay" onClick={() => setRun((r) => r + 1)}>
                  {ICONS.replay}
                </Tool>
              )}
              {fullscreen && (
                <Tool
                  label={full ? "Exit full screen" : "Full screen"}
                  onClick={() => {
                    if (full) close();
                    else {
                      opener.current = document.activeElement as HTMLElement | null;
                      setFull(true);
                    }
                  }}
                >
                  {full ? ICONS.collapse : ICONS.expand}
                </Tool>
              )}
            </div>
          )}
        </div>
        {/* The preview stays mounted on the Code tab, so live demos keep their state. */}
        <div data-docs-preview-body="" data-toc="false" id={`${id}-preview-panel`} role={tabs ? "tabpanel" : undefined} aria-labelledby={tabs ? `${id}-preview` : undefined} hidden={tab !== "preview"} className={cn(full && "flex flex-1 flex-col")}>
          {body}
          {panel && !framed && (
            <div data-docs-preview-panel="" className={cn("border-t px-3 py-3 sm:px-4", full && "sticky bottom-0 mt-auto bg-background")}>
              {panel}
            </div>
          )}
        </div>
        {tabs && tab === "code" && (
          <div id={`${id}-code-panel`} role="tabpanel" aria-labelledby={`${id}-code`} className={cn("kn-scroll overflow-auto bg-card", full ? "flex-1" : "max-h-[560px]")}>
            {!text ? (
              codePanel
            ) : renderCode ? (
              renderCode(text, lang)
            ) : (
              <pre tabIndex={0} className="p-4 font-mono text-[12.5px] leading-relaxed">
                <code>{text}</code>
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
