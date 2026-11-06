"use client";
/** @registry name="content-core" type="block" title="Content core" description="Shared pieces for the content blocks: article typography and content blocks (headings, lists, quotes, code, callouts, images, tables), covers, author chips, and helpers for reading time, table of contents, reading progress, filters, highlighted matches and a small search." */

import { useState, type ReactNode } from "react";
import { cn, focusRing, writeClipboard } from "@/registry/knowns/lib/knowns/utils";
import { JSON_TOKEN_CLASS, jsonTokens } from "@/registry/knowns/lib/knowns/json";
import { initialsOf, uniqueSlugs, type TocItem } from "./content-utils";

/* ── Content model ── */

/**
 * Article content as data, so the same post renders in a blog, a changelog or a help center, and the
 * table of contents comes from the headings. For your own MDX, wrap it in <Prose> instead.
 */
export type ProseBlock =
  | { type: "h2" | "h3"; text: string; id?: string }
  | { type: "p"; text: ReactNode }
  | { type: "ul" | "ol"; items: ReactNode[] }
  | { type: "quote"; text: ReactNode; cite?: string }
  | { type: "code"; code: string; lang?: string; file?: string }
  | { type: "callout"; tone?: "info" | "tip" | "warning" | "neutral"; title?: string; text: ReactNode }
  | { type: "image"; src?: string; alt: string; caption?: ReactNode; ratio?: number; hue?: number }
  | { type: "table"; head: string[]; rows: ReactNode[][] };

/** Heading ids for a list of blocks: their own `id`, else a unique slug of the text. */
export function headingIds(blocks: ProseBlock[]): Map<number, string> {
  const heads = blocks.map((b, i) => ({ b, i })).filter(({ b }) => b.type === "h2" || b.type === "h3") as { b: Extract<ProseBlock, { type: "h2" | "h3" }>; i: number }[];
  const slugs = uniqueSlugs(heads.map(({ b }) => b.text));
  return new Map(heads.map(({ b, i }, n) => [i, b.id ?? slugs[n]]));
}

/** The table of contents for a list of blocks (h2 and h3). */
export function tocOf(blocks: ProseBlock[]): TocItem[] {
  const ids = headingIds(blocks);
  return blocks.flatMap((b, i) => (b.type === "h2" || b.type === "h3" ? [{ id: ids.get(i)!, text: b.text, level: b.type === "h2" ? 2 : 3 }] : []));
}

/** Plain text of the blocks, for reading time and search. */
export function blocksText(blocks: ProseBlock[]): string {
  const t = (n: ReactNode): string => (typeof n === "string" || typeof n === "number" ? String(n) : Array.isArray(n) ? n.map(t).join(" ") : "");
  return blocks
    .map((b) => {
      switch (b.type) {
        case "ul":
        case "ol":
          return b.items.map(t).join(" ");
        case "code":
          return "";
        case "table":
          return [...b.head, ...b.rows.flat().map(t)].join(" ");
        case "image":
          return typeof b.caption === "string" ? b.caption : "";
        default:
          return typeof b.text === "string" ? b.text : t(b.text);
      }
    })
    .join(" ");
}

/* ── Typography ── */

/** Article typography: headings, paragraphs, lists, links, inline code, quotes. Wrap your own MDX in it. */
export const proseClass = cn(
  "max-w-none text-[15px] leading-[1.75] text-foreground/85",
  "[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:scroll-mt-24 [&_h2]:text-[24px] [&_h2]:leading-snug [&_h2]:font-semibold [&_h2]:text-foreground",
  "[&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:scroll-mt-24 [&_h3]:text-[20px] [&_h3]:font-semibold [&_h3]:text-foreground",
  "[&_p]:my-4 [&>:first-child]:mt-0",
  "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1.5 [&_li]:pl-1 [&_li::marker]:text-muted-foreground",
  "[&_a]:[&_a]:text-foreground [&_a]:underline [&_a]:decoration-foreground/25 [&_a]:underline-offset-[3px] hover:[&_a]:decoration-foreground/60",
  "[&_:not(pre)>code]:rounded-[5px] [&_:not(pre)>code]:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-px [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.86em] [&_:not(pre)>code]:text-foreground",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
);

export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(proseClass, className)}>{children}</div>;
}

/* ── Pieces ── */

/** A tiny seeded PRNG, so a placeholder cover draws the same on server and client. */
function seeded(seed: number) {
  let t = (seed * 2654435761) >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

type Waypoint = { x: number; lane: number };

/** A route through the lanes: from a start lane, 1-3 turns to other lanes, ending on any lane. Pure. */
export function coverRoute(rnd: () => number, lanes: number, x0: number, x1: number): Waypoint[] {
  const turns = 1 + Math.floor(rnd() * 3);
  let lane = Math.floor(rnd() * lanes);
  const pts: Waypoint[] = [{ x: x0, lane }];
  for (let i = 1; i <= turns; i++) {
    const x = x0 + ((x1 - x0) * i) / (turns + 1);
    let next = Math.floor(rnd() * (lanes - 1));
    if (next >= lane) next++; // a different lane every turn
    pts.push({ x, lane }, { x, lane: next });
    lane = next;
  }
  pts.push({ x: x1, lane });
  return pts;
}

/**
 * Line art for a cover without an image: hairline lanes with commit dots, plus a composition picked by
 * `seed`: one accent route with 1-3 turns, sometimes a second muted route, sometimes a small node cluster.
 * Quiet on purpose: a neutral surface, one accent, no gradients. Drawn in percentages with fixed pixel
 * strokes and dots, so it looks the same at any cover size.
 */
function PlaceholderArt({ seed }: { seed: number }) {
  const rnd = seeded(seed);
  const lanes = 3 + Math.floor(rnd() * 2);
  const ys = Array.from({ length: lanes }, (_, i) => 22 + i * (56 / (lanes - 1)));
  const ink = "color-mix(in srgb, var(--foreground) 14%, transparent)";
  const dot = "color-mix(in srgb, var(--foreground) 30%, transparent)";
  const muted = "color-mix(in srgb, var(--foreground) 38%, transparent)";
  const acc = "color-mix(in srgb, #6366f1 78%, var(--foreground))";
  const pct = (n: number) => `${n}%`;
  const x0 = 10 + Math.round(rnd() * 14);
  const x1 = 70 + Math.round(rnd() * 20);
  const main = coverRoute(rnd, lanes, x0, x1);
  const extra = rnd();
  const second = extra < 0.4 ? coverRoute(rnd, lanes, 6 + Math.round(rnd() * 10), 40 + Math.round(rnd() * 20)) : null;
  const cluster = extra >= 0.4 && extra < 0.75 ? { x: 30 + Math.round(rnd() * 40), lane: Math.floor(rnd() * lanes), n: 3 + Math.floor(rnd() * 2) } : null;

  const route = (pts: Waypoint[], color: string, width: number) => (
    <g stroke={color} strokeWidth={width} strokeLinecap="round">
      {pts.slice(1).map((p, i) => {
        const q = pts[i];
        return <line key={i} x1={pct(q.x)} x2={pct(p.x)} y1={pct(ys[q.lane])} y2={pct(ys[p.lane])} />;
      })}
    </g>
  );

  return (
    <svg aria-hidden="true" className="absolute inset-0 size-full" overflow="hidden">
      {ys.map((y, i) => (
        <g key={i}>
          <line x1="0" x2="100%" y1={pct(y)} y2={pct(y)} stroke={ink} strokeWidth="1" />
          {[0, 1, 2, 3, 4, 5].map((n) => {
            const x = 8 + n * 17 + ((i * 7 + seed) % 9);
            return x < 96 ? <circle key={n} cx={pct(x)} cy={pct(y)} r="3" fill={dot} /> : null;
          })}
        </g>
      ))}
      {second && (
        <>
          {route(second, muted, 1.25)}
          <circle cx={pct(second[second.length - 1].x)} cy={pct(ys[second[second.length - 1].lane])} r="3.5" fill={muted} />
        </>
      )}
      {cluster && (
        <g stroke={muted} strokeWidth="1.25">
          {Array.from({ length: cluster.n }, (_, i) => {
            const lane = Math.min(lanes - 1, Math.max(0, cluster.lane + (i % 2 ? 1 : -1)));
            const x = cluster.x + (i - (cluster.n - 1) / 2) * 7;
            return (
              <g key={i}>
                <line x1={pct(cluster.x)} y1={pct(ys[cluster.lane])} x2={pct(x)} y2={pct(ys[lane])} />
                <circle cx={pct(x)} cy={pct(ys[lane])} r="3.5" fill="var(--card)" />
              </g>
            );
          })}
          <circle cx={pct(cluster.x)} cy={pct(ys[cluster.lane])} r="4.5" fill={muted} stroke="none" />
        </g>
      )}
      {route(main, acc, 1.75)}
      <circle cx={pct(main[0].x)} cy={pct(ys[main[0].lane])} r="4" fill={acc} />
      <circle cx={pct(main[main.length - 1].x)} cy={pct(ys[main[main.length - 1].lane])} r="4" fill="var(--card)" stroke={acc} strokeWidth="1.75" />
    </svg>
  );
}

/** A cover: your image, or quiet line art (seeded by `hue`) when there is none. Aspect-locked and lazy. */
export function Cover({ src, alt = "", hue = 230, ratio = 16 / 9, className, rounded = true }: { src?: string; alt?: string; hue?: number; ratio?: number; className?: string; rounded?: boolean }) {
  return (
    <div
      className={cn("relative w-full overflow-hidden bg-[color-mix(in_srgb,var(--foreground)_3.5%,var(--card))] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--foreground)_8%,transparent)]", rounded && "rounded-[12px]", className)}
      style={{ aspectRatio: ratio }}
    >
      {src ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} className="absolute inset-0">
          <PlaceholderArt seed={hue} />
        </div>
      )}
    </div>
  );
}

export interface ContentAuthor {
  name: string;
  /** Photo URL; initials when missing. */
  avatar?: string;
  role?: string;
}

export function AuthorChip({ author, size = "sm", className }: { author: ContentAuthor; size?: "sm" | "md"; className?: string }) {
  const box = size === "md" ? "size-8 text-[12.5px]" : "size-6 text-[10.5px]";
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      {author.avatar ? (
        <img src={author.avatar} alt="" loading="lazy" className={cn(box, "shrink-0 rounded-full object-cover")} />
      ) : (
        <span aria-hidden="true" className={cn(box, "grid shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] text-foreground/80")}>
          {initialsOf(author.name)}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-[13px] text-foreground">{author.name}</span>
        {size === "md" && author.role && <span className="block truncate text-[13px] text-muted-foreground">{author.role}</span>}
      </span>
    </span>
  );
}

/** A copy button for code. */
function CopyCode({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void writeClipboard(code).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        });
      }}
      className={cn("rounded-[8px] px-1.5 py-0.5 text-[13px] text-muted-foreground transition-colors hover:bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] hover:text-foreground", focusRing)}
    >
      <span aria-live="polite">{done ? "Copied" : "Copy"}</span>
    </button>
  );
}

/** A code block with a file name or language, a copy button, and JSON colouring. */
export function CodeBlock({ code, lang, file }: { code: string; lang?: string; file?: string }) {
  const json = lang === "json";
  return (
    <figure className="my-5 overflow-hidden rounded-[12px] bg-[color-mix(in_srgb,var(--foreground)_4%,var(--card))] shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_8%,transparent)]">
      <figcaption className="flex h-9 items-center justify-between gap-2 border-b border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] px-3 text-[13px] text-muted-foreground">
        <span className="truncate font-mono">{file ?? lang ?? "code"}</span>
        <CopyCode code={code} />
      </figcaption>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed text-foreground/90">
        <code>{json ? jsonTokens(code).map((t, i) => (t.kind === "plain" ? t.text : <span key={i} className={JSON_TOKEN_CLASS[t.kind]}>{t.text}</span>)) : code}</code>
      </pre>
    </figure>
  );
}

const CALLOUT = {
  info: { label: "Note", cls: "bg-sky-500/[.07] shadow-[inset_3px_0_0_rgb(14_165_233/.7)]" },
  tip: { label: "Tip", cls: "bg-emerald-500/[.07] shadow-[inset_3px_0_0_rgb(16_185_129/.7)]" },
  warning: { label: "Warning", cls: "bg-amber-500/[.08] shadow-[inset_3px_0_0_rgb(245_158_11/.75)]" },
  /** No colour of its own: for a note that sits next to something already coloured. */
  neutral: { label: "Note", cls: "bg-[color-mix(in_oklab,var(--foreground)_3.5%,transparent)] shadow-[inset_2px_0_0_color-mix(in_oklab,var(--foreground)_30%,transparent)]" },
};

/** Renders content blocks with the article typography. */
export function ProseBlocks({ blocks, className }: { blocks: ProseBlock[]; className?: string }) {
  const ids = headingIds(blocks);
  return (
    <div className={cn(proseClass, className)}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h2":
            return <h2 key={i} id={ids.get(i)}>{b.text}</h2>;
          case "h3":
            return <h3 key={i} id={ids.get(i)}>{b.text}</h3>;
          case "p":
            return <p key={i}>{b.text}</p>;
          case "ul":
            return <ul key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>;
          case "ol":
            return <ol key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ol>;
          case "quote":
            return (
              <blockquote key={i} className="my-6 border-l-2 border-foreground/20 pl-4 text-[16px] text-foreground/80 italic">
                <p className="!my-0">{b.text}</p>
                {b.cite && <cite className="mt-2 block text-[13px] text-muted-foreground not-italic">{b.cite}</cite>}
              </blockquote>
            );
          case "code":
            return <CodeBlock key={i} code={b.code} lang={b.lang} file={b.file} />;
          case "callout": {
            const c = CALLOUT[b.tone ?? "info"];
            return (
              <div key={i} role="note" aria-label={b.title ?? c.label} className={cn("my-5 rounded-[12px] px-4 py-3 text-[14px] leading-relaxed", c.cls)}>
                <strong className="mb-0.5 block text-[13px]">{b.title ?? c.label}</strong>
                <span className="text-foreground/85">{b.text}</span>
              </div>
            );
          }
          case "image":
            return (
              <figure key={i} className="my-6">
                <Cover src={b.src} alt={b.alt} hue={b.hue} ratio={b.ratio ?? 16 / 9} />
                {b.caption && <figcaption className="mt-2 text-center text-[13px] text-muted-foreground">{b.caption}</figcaption>}
              </figure>
            );
          case "table":
            return (
              <div key={i} className="my-5 overflow-x-auto rounded-[12px] shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_8%,transparent)]">
                <table className="w-full border-collapse text-left text-[14px]">
                  <thead className="bg-[color-mix(in_srgb,var(--foreground)_3.5%,transparent)] text-[13px] text-muted-foreground">
                    <tr>{b.head.map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className="border-t border-[color-mix(in_srgb,var(--foreground)_7%,transparent)]">
                        {r.map((c, k) => <td key={k} className="px-3 py-2 align-top">{c}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
