"use client";
/** @registry name="docs-preview" type="block" title="Docs preview" description="Preview / Code card with a toolbar: phone, tablet and full widths, zoom, a preview-only theme, Replay and Full screen, plus a named-example heading with a badge slot." */
/**
 * Docs preview card: Preview / Code tabs and a toolbar (viewport width, zoom, preview-only theme,
 * Replay, Fullscreen). The live preview renders inline; picking a phone or tablet width
 * or the other theme loads it in an iframe from `frame`, so media queries and the theme really apply.
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn, writeClipboard } from "@/registry/knowns/lib/knowns/utils";
import { CodeBlock } from "../../code-block/code-block";
import { SegmentedControl } from "../../segmented-control";
import { Tooltip } from "../../tooltip";
import { fitScale, parseViewport, VIEWPORT_KEY, VIEWPORT_WIDTH, type PreviewViewport } from "./docs-utils";

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
  "grid size-7 place-items-center rounded-md text-muted-foreground transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:bg-muted hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-ring aria-pressed:bg-muted aria-pressed:text-foreground";

function Tool({ label, onClick, pressed, children }: { label: string; onClick: () => void; pressed?: boolean; children: ReactNode }) {
  return (
    <Tooltip content={label}>
      <button type="button" aria-label={label} aria-pressed={pressed} onClick={onClick} className={tool}>
        {children}
      </button>
    </Tooltip>
  );
}

const VIEWPORT_LABEL: Record<PreviewViewport, string> = { desktop: "Desktop", tablet: "Tablet", mobile: "Phone" };

/** The viewer's width choice, remembered in localStorage (every read and write guarded: it can be blocked or full). */
function useViewport() {
  const [viewport, setViewport] = useState<PreviewViewport>("desktop");
  // Read after mount, so server and first client render agree.
  useEffect(() => {
    try {
      setViewport(parseViewport(localStorage.getItem(VIEWPORT_KEY)));
    } catch {
      /* storage unavailable: keep the default */
    }
  }, []);
  const choose = (v: PreviewViewport) => {
    setViewport(v);
    try {
      localStorage.setItem(VIEWPORT_KEY, v);
    } catch {
      /* not remembered */
    }
  };
  return [viewport, choose] as const;
}

/** Whether the window is wide enough (sm, 640px) to host the width switch. */
function useRoomForSwitch() {
  const [room, setRoom] = useState(true);
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia("(min-width: 640px)");
    const on = () => setRoom(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return room;
}

/**
 * The Preview / Code swap (a few times per visit: the standard tier). Both panels sit in one grid cell. The box
 * follows the panel that is showing: its one row is set to that panel's measured height and moves there through
 * `grid-template-rows` (the one layout transition kn-motion allows) over --kn-dur-slow on --kn-ease-inout, since
 * something already on screen resizes. The taller idle panel is clipped meanwhile. The panel that arrives fades in
 * and rises 4px over --kn-dur; the one that leaves goes back down the same way in --kn-dur-fast, both on
 * --kn-ease-out. The idle panel is invisible and inert, so only one is ever in the accessibility tree. The first
 * height is set without a transition, and `data-kn-m` lets the reduced-motion rule in knowns.css make it instant.
 */
const ROWS = "transition-[grid-template-rows] duration-(--kn-dur-slow) ease-(--kn-ease-inout)";

/** The height of whichever panel is showing, kept current while either resizes (a demo that grows, a frame). */
function useActiveHeight(active: "preview" | "code", enabled: boolean) {
  const preview = useRef<HTMLDivElement>(null);
  const code = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<{ preview: number; code: number }>({ preview: 0, code: 0 });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setH({ preview: preview.current?.offsetHeight ?? 0, code: code.current?.offsetHeight ?? 0 }));
    for (const el of [preview.current, code.current]) if (el) ro.observe(el);
    return () => ro.disconnect();
  });
  const px = active === "code" && h.code > 0 ? h.code : h.preview;
  // Turn the transition on only after the first height is in place, so nothing plays on mount.
  useEffect(() => {
    if (!px || ready) return;
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, [px, ready]);
  return { preview, code, rows: enabled && px > 0 ? `${px}px` : undefined, animate: ready };
}
const SWAP_ON = "visible translate-none opacity-100 transition-[opacity,translate,visibility] duration-(--kn-dur) ease-(--kn-ease-out)";
const SWAP_OFF = "invisible translate-y-1 opacity-0 transition-[opacity,translate,visibility] duration-(--kn-dur-fast) ease-(--kn-ease-out)";
const swap = (on: boolean) => (on ? SWAP_ON : SWAP_OFF);
/** The tool cluster only fades (no rise): it is small and its place is fixed. */
const FADE_ON = "visible opacity-100 transition-[opacity,visibility] duration-(--kn-dur) ease-(--kn-ease-out)";
const FADE_OFF = "invisible opacity-0 transition-[opacity,visibility] duration-(--kn-dur-fast) ease-(--kn-ease-out)";
const swapFade = (on: boolean) => (on ? FADE_ON : FADE_OFF);

const ORDER: PreviewViewport[] = ["desktop", "tablet", "mobile"];

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
      className="h-7 rounded-md px-2 text-[12px] font-medium text-muted-foreground transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out) hover:bg-muted hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-ring"
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
  const [chosen, setViewport] = useViewport();
  // On a narrow window the switch is hidden, so a remembered Phone or Tablet width must not apply either.
  const viewport = useRoomForSwitch() ? chosen : "desktop";
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
  // The code mounts on first use (it is highlighted then), one frame after the tab changes so it can fade in.
  const [codeSeen, setCodeSeen] = useState(false);
  useEffect(() => {
    if (tab !== "code" || codeSeen) return;
    const raf = requestAnimationFrame(() => setCodeSeen(true));
    return () => cancelAnimationFrame(raf);
  }, [tab, codeSeen]);
  const codeOn = tab === "code" && codeSeen;
  const copyOn = tab === "code" && Boolean(text);
  // Full-height (fullscreen) previews fill the viewport, so only the inline box follows the panel's height.
  const fit = useActiveHeight(codeOn ? "code" : "preview", tabs && !full);

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
        className={cn("min-w-0 outline-none", full ? "fixed inset-0 z-50 flex flex-col overflow-auto bg-background" : "overflow-clip rounded-2xl border bg-muted/20")}
      >
        <div className="sticky top-0 z-10 flex h-11 items-center justify-between gap-2 border-b bg-card/80 px-2 backdrop-blur">
          {tabs ? (
            <SegmentedControl
              size="sm"
              role="tablist"
              aria-label="Example view"
              value={tab}
              onValueChange={(v) => setTab(v as "preview" | "code")}
              options={[
                { value: "preview", label: "Preview", id: `${id}-preview`, controls: `${id}-preview-panel` },
                { value: "code", label: "Code", id: `${id}-code`, controls: `${id}-code-panel` },
              ]}
            />
          ) : (
            <span data-md="skip" className="px-2.5 text-[13px] font-medium">Preview</span>
          )}
          {/* Tools and Copy share one cell: they cross-fade, and Copy stays at the right edge. */}
          <div className="grid justify-items-end">
            <div role="toolbar" aria-label="Preview tools" data-kn-m="" inert={copyOn} className={cn("col-start-1 row-start-1 flex items-center", swapFade(!copyOn))}>
              {toolbar}
              {frame && viewports.length > 1 && (
                <div className="hidden items-center sm:flex">
                  <SegmentedControl
                    size="sm"
                    aria-label="Preview width"
                    value={viewport}
                    onValueChange={(v) => setViewport(v as PreviewViewport)}
                    options={[...viewports].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).map((v) => ({ value: v, label: VIEWPORT_LABEL[v], icon: ICONS[v] }))}
                  />
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
            {text && (
              <div data-kn-m="" inert={!copyOn} className={cn("col-start-1 row-start-1", swapFade(copyOn))}>
                <CopyCode text={text} />
              </div>
            )}
          </div>
        </div>
        {/* The preview stays mounted on the Code tab (live demos keep their state); the code mounts on first use. */}
        <div
          data-kn-m=""
          className={cn("grid", full && "min-h-0 flex-1", fit.rows && "overflow-hidden", fit.rows && fit.animate && ROWS)}
          style={fit.rows ? { gridTemplateRows: fit.rows } : undefined}
        >
          <div
            ref={fit.preview}
            data-docs-preview-body=""
            data-toc="false"
            data-kn-m=""
            id={`${id}-preview-panel`}
            role={tabs ? "tabpanel" : undefined}
            aria-labelledby={tabs ? `${id}-preview` : undefined}
            inert={tab !== "preview"}
            className={cn("col-start-1 row-start-1 min-w-0", full ? "flex flex-col" : "self-start", swap(tab === "preview"))}
          >
            {body}
            {panel && !framed && (
              <div data-docs-preview-panel="" className={cn("border-t px-3 py-3 sm:px-4", full && "sticky bottom-0 mt-auto bg-background")}>
                {panel}
              </div>
            )}
          </div>
          {tabs && (tab === "code" || codeSeen) && (
            <div
              ref={fit.code}
              id={`${id}-code-panel`}
              role="tabpanel"
              aria-labelledby={`${id}-code`}
              data-kn-m=""
              inert={!codeOn}
              className={cn("col-start-1 row-start-1 min-w-0 bg-card", !full && "self-start", swap(codeOn))}
            >
              <div className={cn("kn-scroll overflow-auto", full ? "h-full" : "max-h-[560px]")}>
                {!text ? (
                  codePanel
                ) : renderCode ? (
                  renderCode(text, lang)
                ) : (
                  <CodeBlock flush copy={false} wrapToggle={false} code={text} language={lang} trim={false} className="[&_pre]:px-1" />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
