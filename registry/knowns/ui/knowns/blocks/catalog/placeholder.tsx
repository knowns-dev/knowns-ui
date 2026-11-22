/** @registry part-of="catalog-grid" */
/**
 * Skeleton placeholders for catalog cards: the poster a card shows while it waits to go live or its preview loads.
 * One shape per kind of item, drawn as quiet static blocks in the skeleton colour (muted, nudged toward the text colour so it reads on the card tint), so a grid mid-load reads as
 * "coming" rather than as a finished drawing. Static on purpose: a page of cards waiting at once would make a
 * shimmer into noise, and each placeholder is gone as soon as its card is live.
 */
import { cn } from "@/registry/knowns/lib/knowns/utils";

export type CatalogPlaceholderShape = "sample" | "block" | "page";

/** A skeleton bar. */
function Bar({ className }: { className?: string }) {
  return <span className={cn("block rounded-[3px] bg-[color-mix(in_srgb,var(--foreground)_6%,var(--muted))]", className)} />;
}

/**
 * "sample": one small component, centred (a label over a control). "block": a panel anchored to the top, like a
 * block preview (header, lines, a media area). "page": a desktop page (top bar, sidebar, title and a row of cards).
 */
export function CatalogPlaceholder({ shape = "block", className }: { shape?: CatalogPlaceholderShape; className?: string }) {
  if (shape === "sample")
    return (
      <span aria-hidden="true" data-slot="catalog-placeholder" data-shape="sample" className={cn("flex w-[58%] flex-col gap-2", className)}>
        <Bar className="h-2 w-2/5" />
        <Bar className="h-7 w-full rounded-[8px]" />
      </span>
    );
  if (shape === "page")
    return (
      <span aria-hidden="true" data-slot="catalog-placeholder" data-shape="page" className={cn("flex size-full flex-col gap-[6%] self-stretch", className)}>
        <span className="flex items-center gap-[3%]">
          <Bar className="size-2 rounded-full" />
          <Bar className="h-1.5 w-[14%]" />
          <span className="ml-auto flex w-[22%] gap-[8%]">
            <Bar className="h-1.5 flex-1" />
            <Bar className="h-1.5 flex-1" />
          </span>
        </span>
        <span className="flex min-h-0 flex-1 gap-[4%]">
          <span className="flex w-[18%] flex-col gap-[10%]">
            <Bar className="h-1.5 w-full" />
            <Bar className="h-1.5 w-4/5" />
            <Bar className="h-1.5 w-full" />
            <Bar className="h-1.5 w-3/5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-[7%]">
            <Bar className="h-2.5 w-2/5" />
            <Bar className="h-1.5 w-3/5" />
            <span className="grid min-h-0 flex-1 grid-cols-3 gap-[5%]">
              <Bar className="h-full rounded-[6px]" />
              <Bar className="h-full rounded-[6px]" />
              <Bar className="h-full rounded-[6px]" />
            </span>
          </span>
        </span>
      </span>
    );
  return (
    <span aria-hidden="true" data-slot="catalog-placeholder" data-shape="block" className={cn("flex size-full flex-col gap-[7%] self-stretch", className)}>
      <span className="flex items-center gap-[4%]">
        <Bar className="size-4 flex-none rounded-full" />
        <span className="flex flex-1 flex-col gap-1.5">
          <Bar className="h-2 w-2/5" />
          <Bar className="h-1.5 w-1/4" />
        </span>
      </span>
      <span className="flex flex-col gap-1.5">
        <Bar className="h-1.5 w-full" />
        <Bar className="h-1.5 w-5/6" />
      </span>
      <Bar className="min-h-0 w-full flex-1 rounded-[8px]" />
    </span>
  );
}
