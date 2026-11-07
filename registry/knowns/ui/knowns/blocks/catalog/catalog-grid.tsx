"use client";
/** @registry name="catalog-grid" type="block" title="Catalog grid" description="A catalogue page: category tabs with counts over a grid of thumbnail cards with New and Pro badges, plus a Sketch kit for quiet monochrome thumbnails in one visual language." */

import { createContext, startTransition, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Toggle } from "../../toggle-group";
import { categoryCounts, countLabel, filterCatalog, orderCategories, pickLiveRowGroups, sampleScale, type LiveCard } from "./catalog-utils";

export interface CatalogItem {
  id: string;
  title: string;
  /** Tab it belongs to, e.g. "Forms". */
  category: string;
  href?: string;
  /** One line under the title, e.g. a short description. Optional: the grid stays scannable without it. */
  description?: string;
  /** e.g. the number of examples on the item's page. Shown from 2 up. */
  count?: number;
  /** Badges on the thumbnail. */
  isNew?: boolean;
  pro?: boolean;
  /** A Free item with Pro variants: an outline "Pro variants" badge. Ignored when `pro` is set. */
  proVariants?: boolean;
  /** The drawing: an <img>, an SVG, or a <Sketch> from ./sketch. */
  thumb?: ReactNode;
  /**
   * The live preview, mounted when the card comes into view (the thumbnail is the poster until then). Laid out
   * at `previewWidth` px and scaled down to the card. Inert and hidden from assistive tech.
   */
  preview?: () => ReactNode;
  /**
   * Design width of the live preview in px (default 720): it is laid out that wide and scaled to the card, top
   * anchored. "fit": measure the preview at its own size, then centre it and scale it to the card: down to fit, or up
   * (at most 1.75x) to fill about 65% of the width (a single small sample, such as a button or an input).
   */
  previewWidth?: number | "fit";
  /** "top" (default): the preview's top edge sits at the top of the card and the bottom is cropped, like a thumbnail. "center": centred, for small components shown at their natural size. */
  previewAlign?: "top" | "center";
}

export interface CatalogGridProps {
  items: CatalogItem[];
  /** Tab order (category ids). Categories not listed come after, in order of first use. */
  categories?: string[];
  /** Tab labels when they differ from the ids. */
  labels?: Record<string, string>;
  /** Controlled tab ("all" or a category). */
  category?: string;
  defaultCategory?: string;
  onCategoryChange?: (category: string) => void;
  /** Show the tabs. Default true. */
  tabs?: boolean;
  /** Noun for `count`, e.g. "example" or "variant". Default "example". */
  countNoun?: string;
  /** Called for items without href, or to track clicks. */
  onSelect?: (item: CatalogItem) => void;
  /** Shown when a tab has no items. */
  empty?: ReactNode;
  /**
   * Card size. "card" (default): 2 / 3 / 5 columns. "page": page-sized cards for full-page items such as
   * templates, 1 / 2 / 3 columns, so a desktop-shaped (16:10) thumbnail reads at a useful size.
   */
  size?: "card" | "page";
  /**
   * Live previews for items that have `preview`. On by default; always off on touch screens, narrow
   * viewports, Save-Data and reduced motion (the posters stay).
   */
  live?: boolean;
  /** Most live previews mounted at once; the least recently seen is unmounted first. Default 12. */
  maxLive?: number;
  className?: string;
}

/* ── Live previews ── */

/** Whether this device should run live previews: a fine pointer, room, no Save-Data, motion allowed. */
function useLiveAllowed(enabled: boolean): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const check = () => {
      const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
      setOk(matchMedia("(pointer: fine)").matches && innerWidth >= 768 && !saveData && !motion.matches);
    };
    check();
    motion.addEventListener("change", check);
    addEventListener("resize", check);
    return () => {
      motion.removeEventListener("change", check);
      removeEventListener("resize", check);
    };
  }, [enabled]);
  return enabled && ok;
}

type LiveCtx = { observe: (id: string, el: Element) => () => void; mounted: ReadonlySet<string> };
const Live = createContext<LiveCtx | null>(null);

/** One IntersectionObserver for the grid; mounts cards that come near the viewport, at most `max` at once (LRU). */
function useLiveManager(allowed: boolean, max: number): LiveCtx | null {
  const [mounted, setMounted] = useState<ReadonlySet<string>>(new Set());
  const visible = useRef(new Set<string>());
  const current = useRef<ReadonlySet<string>>(new Set());
  const ids = useRef(new Map<Element, string>());
  const io = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    if (!allowed) return;
    // Mount and unmount only once scrolling settles, and as a transition, so a fast scroll never pays for
    // mounting previews it is already past and frames keep their budget.
    let idle = 0;
    let lastScroll = 0;
    let stagger: number[] = [];
    const apply = (next: ReadonlySet<string>) => {
      current.current = next;
      startTransition(() => setMounted(next));
    };
    const commit = () => {
      window.clearTimeout(idle);
      const wait = 150 - (performance.now() - lastScroll);
      if (wait > 0) {
        idle = window.setTimeout(commit, wait);
        return;
      }
      // Mount whole rows: a row never shows some cards live and some posters. Rows nearest the middle of the
      // viewport go first, and rows are added while they fit under the cap (always at least one row).
      const cards: LiveCard[] = [];
      for (const [el, id] of ids.current) {
        if (!visible.current.has(id)) continue;
        const r = el.getBoundingClientRect();
        cards.push({ id, top: Math.round(r.top + scrollY), height: r.height });
      }
      const groups = pickLiveRowGroups(cards, scrollY + innerHeight / 2, max);
      // Rows go live whole, one row every 160ms (nearest first), so the mounting work is spread over frames.
      // Rows that left the set are unmounted at once.
      stagger.forEach((t) => window.clearTimeout(t));
      stagger = [];
      const keep = new Set(groups.flat());
      const acc = new Set([...current.current].filter((id) => keep.has(id)));
      let step = 0;
      for (const g of groups) {
        const fresh = g.some((id) => !acc.has(id));
        const mount = () => {
          g.forEach((id) => acc.add(id));
          apply(new Set(acc));
        };
        if (!fresh) continue;
        if (step === 0) mount();
        else stagger.push(window.setTimeout(mount, step * 160));
        step++;
      }
      if (step === 0 && acc.size !== current.current.size) apply(new Set(acc));
    };
    const onScroll = () => {
      lastScroll = performance.now();
    };
    addEventListener("scroll", onScroll, { passive: true });
    io.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = ids.current.get(e.target);
          if (!id) continue;
          if (e.isIntersecting) visible.current.add(id);
          else visible.current.delete(id);
        }
        // Out of view: back to the poster. Rows that no longer fit under the cap go too (an evicted card keeps its poster).
        commit();
      },
      { rootMargin: "0px 0px 120px 0px" },
    );
    for (const el of ids.current.keys()) io.current.observe(el);
    return () => {
      window.clearTimeout(idle);
      stagger.forEach((t) => window.clearTimeout(t));
      removeEventListener("scroll", onScroll);
      io.current?.disconnect();
      io.current = null;
      visible.current.clear();
      current.current = new Set();
      setMounted(new Set());
    };
  }, [allowed, max]);
  const observe = useCallback((id: string, el: Element) => {
    ids.current.set(el, id);
    io.current?.observe(el);
    return () => {
      ids.current.delete(el);
      io.current?.unobserve(el);
    };
  }, []);
  return useMemo(() => (allowed ? { observe, mounted } : null), [allowed, observe, mounted]);
}

/** The live preview layer: laid out at `width`, scaled to the card, faded in over the poster. */
/**
 * The tight box around what a sample actually shows, in its own (unscaled) pixels relative to `el`: every visible
 * descendant counts, empty boxes and screen-reader-only text do not. `scale` is the transform now applied to `el`.
 */
function contentBox(el: HTMLElement, scale: number): { w: number; h: number; x: number; y: number } | null {
  const o = el.getBoundingClientRect();
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const n of el.querySelectorAll("*")) {
    const r = n.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue;
    const cs = getComputedStyle(n);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    // A box shows something when it paints (a background, border or shadow), is an image or control, or holds text directly.
    const paints = cs.backgroundColor !== "rgba(0, 0, 0, 0)" || cs.backgroundImage !== "none" || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0 || cs.boxShadow !== "none";
    const own = [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent?.trim());
    const media = /^(svg|img|canvas|input|textarea|select|button|video|path|circle|rect|line)$/i.test(n.tagName);
    if (!paints && !own && !media) continue;
    x0 = Math.min(x0, r.left);
    y0 = Math.min(y0, r.top);
    x1 = Math.max(x1, r.right);
    y1 = Math.max(y1, r.bottom);
  }
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: (x0 - o.left) / scale, y: (y0 - o.top) / scale, w: (x1 - x0) / scale, h: (y1 - y0) / scale };
}

function LivePreview({ width, render, align = "top" }: { width: number | "fit"; render: () => ReactNode; align?: "top" | "center" }) {
  const box = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  // "fit": the sample's visible content (a tight box around it, not its declared width), measured once rendered.
  const [nat, setNat] = useState<{ w: number; h: number; x: number; y: number } | null>(null);
  const applied = useRef(1);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el || width !== "fit") return;
    const measure = () => {
      const b = contentBox(el, applied.current);
      if (b) setNat((p) => (p && Math.abs(p.w - b.w) < 0.5 && Math.abs(p.h - b.h) < 0.5 && Math.abs(p.x - b.x) < 0.5 && Math.abs(p.y - b.y) < 0.5 ? p : b));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [width, size === null]);
  const [shown, setShown] = useState(false);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Give the preview a moment to mount and lay out before it covers the poster.
  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), 250);
    return () => window.clearTimeout(t);
  }, []);
  const scale = size && width !== "fit" ? size.w / width : 0;
  // Big samples shrink to fit; small ones grow (up to 1.75x) so a row of samples reads evenly.
  const fitScale = size && nat ? sampleScale(size, nat) : 0;
  applied.current = fitScale || 1;
  const ready = width === "fit" ? fitScale > 0 : true;
  return (
    <span
      ref={box}
      aria-hidden="true"
      inert
      data-catalog-live=""
      className={cn(
        // Same inner padding as the poster (12px). The fade at the bottom edge is a static overlay on the card
        // (a mask here would re-composite the animating preview on every frame).
        // contain: strict keeps each live card's layout, paint and style work inside its own box.
        "pointer-events-none absolute inset-3 overflow-hidden [contain:strict] transition-opacity duration-300 ease-out motion-reduce:transition-none",
        shown && ready ? "opacity-100" : "opacity-0",
      )}
    >
      {width === "fit" && (
        <span
          ref={inner}
          className="absolute block w-max"
          style={{
            // The content's own centre sits on the card's centre, whatever its place inside the sample's box.
            left: nat ? `calc(50% - ${nat.x + nat.w / 2}px)` : "50%",
            top: nat ? `calc(50% - ${nat.y + nat.h / 2}px)` : "50%",
            transformOrigin: nat ? `${nat.x + nat.w / 2}px ${nat.y + nat.h / 2}px` : "0 0",
            transform: `scale(${fitScale || 1})`,
            willChange: "transform",
          }}
        >
          {render()}
        </span>
      )}
      {width !== "fit" && size && scale > 0 && (
        <span
          className={cn("absolute top-0 left-0 grid origin-top-left justify-items-center", align === "top" ? "items-start" : "items-center")}
          style={{ width, height: size.h / scale, transform: `scale(${scale})`, willChange: "transform" }}
        >
          <span className="block w-full">{render()}</span>
        </span>
      )}
    </span>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone: "new" | "pro" | "variants" }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-px text-[11px] leading-4",
        tone === "new" ? "bg-[color-mix(in_srgb,#6366f1_14%,var(--card))] text-[color-mix(in_srgb,#6366f1_70%,var(--foreground))]" : tone === "pro"
            ? "bg-card text-foreground/80 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_18%,transparent)]"
            : "border border-dashed border-[color-mix(in_srgb,var(--foreground)_28%,transparent)] bg-card py-0 text-foreground/70",
      )}
    >
      {children}
    </span>
  );
}

/** One card: the thumbnail, then the title and count. The whole card is the link. */
export function CatalogCard({ item, countNoun = "example", onSelect }: { item: CatalogItem; countNoun?: string; onSelect?: (item: CatalogItem) => void }) {
  const count = countLabel(item.count, countNoun);
  const live = useContext(Live);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const observe = live?.observe;
  const hasPreview = Boolean(item.preview);
  useEffect(() => {
    const el = thumbRef.current;
    if (!observe || !hasPreview || !el) return;
    return observe(item.id, el);
  }, [observe, hasPreview, item.id]);
  const isLive = Boolean(item.preview && live?.mounted.has(item.id));
  const body = (
    <>
      <span ref={thumbRef} className="relative block aspect-[16/10] w-full overflow-hidden rounded-[12px] bg-[color-mix(in_srgb,var(--foreground)_3%,var(--card))] text-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_8%,transparent)] transition-[box-shadow,background-color] duration-200 ease-out group-hover:bg-[color-mix(in_srgb,var(--foreground)_5%,var(--card))] group-hover:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_16%,transparent)]">
        <span className="absolute inset-0 grid place-items-center p-3 [&>img]:size-full [&>img]:object-contain [&>svg]:size-full">{item.thumb}</span>


      </span>
      <span className="mt-2.5 block min-w-0 px-0.5">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="min-w-0 truncate text-[14px] leading-5 font-semibold text-foreground">{item.title}</span>
          {item.isNew && <span aria-hidden="true" title="New" className="size-1.5 flex-none translate-y-[-2px] rounded-full bg-[color-mix(in_srgb,#6366f1_75%,var(--foreground))]" />}
          {count && <span className="ml-auto flex-none text-[12.5px] leading-5 text-muted-foreground tabular-nums">{item.count}</span>}
        </span>
        {item.description && <span className="mt-0.5 block truncate text-[13px] leading-5 text-muted-foreground">{item.description}</span>}
      </span>
    </>
  );
  const cls = cn("group flex w-full min-w-0 flex-col rounded-[12px] text-left", focusRing);
  // Outside the link (a preview has links of its own), over the thumbnail, click-through.
  const overlay = isLive && item.preview && (
    <span className="pointer-events-none absolute inset-x-0 top-0 block aspect-[16/10] overflow-hidden rounded-[12px] bg-[color-mix(in_srgb,var(--foreground)_3%,var(--card))] text-foreground">
      <LivePreview width={item.previewWidth ?? 720} align={item.previewAlign} render={item.preview} />
      {item.previewWidth !== "fit" && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[color-mix(in_srgb,var(--foreground)_3%,var(--card))] to-transparent" />}
      <span aria-hidden="true" className="absolute inset-0 rounded-[12px] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_8%,transparent)]" />
    </span>
  );
  const label = [item.title, item.pro ? "Pro" : item.proVariants ? "Pro variants" : null, item.isNew ? "New" : null, count].filter(Boolean).join(", ");
  const card = item.href ? (
    <a href={item.href} aria-label={label} className={cls} onClick={onSelect ? () => onSelect(item) : undefined}>
      {body}
    </a>
  ) : (
    <button type="button" aria-label={label} className={cls} onClick={() => onSelect?.(item)}>
      {body}
    </button>
  );
  return (
    <div className="relative flex w-full min-w-0">
      {card}
      {overlay}
      {/* Above the live preview, so Pro always shows. Click-through: the card link underneath stays the target. */}
      {(item.pro || item.proVariants) && (
        <span className="pointer-events-none absolute top-2 right-2 flex">{item.pro ? <Badge tone="pro">Pro</Badge> : <Badge tone="variants">Pro variants</Badge>}</span>
      )}
    </div>
  );
}

/**
 * A catalogue page: category tabs with counts over a grid of thumbnail cards (2 columns on phones, 3 on
 * tablets, 5 on wide screens), each with New and Pro badges. Bring your own thumbnails, or draw them with
 * the Sketch kit so they share one quiet visual language.
 */
export function CatalogGrid({
  items,
  categories: order,
  labels = {},
  category: categoryProp,
  defaultCategory = "all",
  onCategoryChange,
  tabs = true,
  countNoun,
  onSelect,
  empty,
  size = "card",
  live: liveProp = true,
  maxLive = 12,
  className,
}: CatalogGridProps) {
  const liveAllowed = useLiveAllowed(liveProp && items.some((i) => i.preview));
  const liveCtx = useLiveManager(liveAllowed, maxLive);
  const [own, setOwn] = useState(defaultCategory);
  const category = categoryProp ?? own;
  const setCategory = (c: string) => {
    if (categoryProp === undefined) setOwn(c);
    onCategoryChange?.(c);
  };
  const cats = useMemo(() => orderCategories(items, order), [items, order]);
  const counts = useMemo(() => categoryCounts(items, cats), [items, cats]);
  const shown = useMemo(() => filterCatalog(items, category), [items, category]);
  const labelOf = (id: string) => (id === "all" ? "All" : (labels[id] ?? id));

  return (
    <Live.Provider value={liveCtx}>
    <section aria-label="Catalog" className={cn("@container w-full", className)}>
      {tabs && cats.length > 1 && (
        <div role="group" aria-label="Category" className="mb-6 flex flex-wrap gap-1.5">
          {counts.map((c) => (
            <Toggle key={c.id} size="sm" variant="outline" pressed={category === c.id} onPressedChange={() => setCategory(c.id)}>
              {labelOf(c.id)} <span className="text-muted-foreground tabular-nums">{c.count}</span>
            </Toggle>
          ))}
        </div>
      )}
      {shown.length ? (
        <ul data-size={size} className={size === "page" ? "grid grid-cols-1 gap-x-6 gap-y-8 @[640px]:grid-cols-2 @[1080px]:grid-cols-3" : "grid grid-cols-2 gap-x-4 gap-y-6 @[640px]:grid-cols-3 @[1080px]:grid-cols-5"}>
          {shown.map((item) => (
            <li key={item.id} className="flex min-w-0">
              <CatalogCard item={item} countNoun={countNoun} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-[12px] bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] px-6 py-12 text-center text-[14px] text-muted-foreground">{empty ?? "Nothing here yet."}</div>
      )}
      <p className="sr-only" aria-live="polite">
        {category === "all" ? "" : `${shown.length} in ${labelOf(category)}`}
      </p>
    </section>
    </Live.Provider>
  );
}

export default CatalogGrid;
