"use client";
/** @registry name="catalog-grid" type="block" title="Catalog grid" description="A catalogue page: category tabs with counts over a grid of thumbnail cards with New and Pro badges, plus a Sketch kit for quiet monochrome thumbnails in one visual language." */

import { useMemo, useState, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Toggle } from "../../toggle-group";
import { categoryCounts, countLabel, filterCatalog, orderCategories } from "./catalog-utils";

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
  className?: string;
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
  const body = (
    <>
      <span className="relative block aspect-[16/10] w-full overflow-hidden rounded-[12px] bg-[color-mix(in_srgb,var(--foreground)_3%,var(--card))] text-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_8%,transparent)] transition-[box-shadow,background-color] duration-200 ease-out group-hover:bg-[color-mix(in_srgb,var(--foreground)_5%,var(--card))] group-hover:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_16%,transparent)]">
        <span className="absolute inset-0 grid place-items-center p-3 [&>img]:size-full [&>img]:object-contain [&>svg]:size-full">{item.thumb}</span>
        {(item.isNew || item.pro || item.proVariants) && (
          <span className="absolute top-2 right-2 flex gap-1">
            {item.isNew && <Badge tone="new">New</Badge>}
            {item.pro ? <Badge tone="pro">Pro</Badge> : item.proVariants && <Badge tone="variants">Pro variants</Badge>}
          </span>
        )}
      </span>
      <span className="mt-2.5 block min-w-0 px-0.5">
        <span className="block truncate text-[14px] leading-5 font-semibold text-foreground">{item.title}</span>
        {(item.description || count) && <span className="mt-0.5 block truncate text-[13px] leading-5 text-muted-foreground">{item.description ?? count}</span>}
      </span>
    </>
  );
  const cls = cn("group flex w-full min-w-0 flex-col rounded-[12px] text-left", focusRing);
  const label = [item.title, item.pro ? "Pro" : item.proVariants ? "Pro variants" : null, item.isNew ? "New" : null, count].filter(Boolean).join(", ");
  return item.href ? (
    <a href={item.href} aria-label={label} className={cls} onClick={onSelect ? () => onSelect(item) : undefined}>
      {body}
    </a>
  ) : (
    <button type="button" aria-label={label} className={cls} onClick={() => onSelect?.(item)}>
      {body}
    </button>
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
  className,
}: CatalogGridProps) {
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
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 @[640px]:grid-cols-3 @[1080px]:grid-cols-5">
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
  );
}

export default CatalogGrid;
