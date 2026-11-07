"use client";
/** @registry name="activity-feed" type="block" title="Activity feed" description="A timeline of what people and agents did: grouped by day, filters, expandable details and an N new pill when items arrive while scrolled." */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { Avatar } from "@/registry/knowns/ui/knowns/avatar";
import { Button } from "@/registry/knowns/ui/knowns/button";
import { SegmentedControl } from "@/registry/knowns/ui/knowns/segmented-control";
import { fullTime, groupByDay, relativeTime } from "./app-feed-utils";
import { activityTypes, diffSummary, filterActivity, newPillText, newerThanSeen, type ActivityWho } from "./activity-utils";

export type { ActivityWho } from "./activity-utils";

export type ActivityDetails =
  | { kind: "diff"; files: number; added: number; removed: number; summary?: string }
  | { kind: "tool"; name: string; input?: string; output?: string }
  | { kind: "text"; text: string };

export interface ActivityItem {
  id: string;
  at: number;
  /** A short type used by the type filter: "commit", "run", "review". */
  type: string;
  actor: { name: string; agent?: boolean; src?: string };
  /** What they did: "merged", "finished a run on". */
  verb: string;
  /** What it was done to: "feat/export-csv". */
  object: string;
  details?: ActivityDetails;
}

const BotMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
    <path d="M12 3v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <rect x="4" y="7" width="16" height="13" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="9" cy="13" r="1.6" fill="currentColor" />
    <circle cx="15" cy="13" r="1.6" fill="currentColor" />
  </svg>
);
const Chevron = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-4 transition-transform motion-reduce:transition-none", open && "rotate-90")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export interface ActivityFeedProps {
  items: ActivityItem[];
  /** The clock (ms). Pass it so grouping and "5m" match on server and client. Default: first render time. */
  now?: number;
  /** Time zone that cuts the days. Default "UTC". */
  timeZone?: string;
  /** Show the people / agents / type filters. Default true. */
  filters?: boolean;
  /** Controlled filters. Leave out to let the feed keep them. */
  who?: ActivityWho;
  onWhoChange?: (who: ActivityWho) => void;
  types?: string[];
  onTypesChange?: (types: string[]) => void;
  /** Pressed on a row's actor or object. */
  onOpen?: (item: ActivityItem) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  emptyText?: string;
  /** Accessible name of the feed. */
  label?: string;
  /** Level of the day headings. Default 3: set it so levels do not skip on your page. */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

/** A timeline of events, newest first. One scroll area; new items that arrive while scrolled wait behind an "N new" pill. */
export function ActivityFeed({
  items,
  now: nowProp,
  timeZone = "UTC",
  filters = true,
  who: whoProp,
  onWhoChange,
  types: typesProp,
  onTypesChange,
  onOpen,
  onLoadMore,
  hasMore,
  loadingMore,
  emptyText = "No activity matches these filters.",
  label = "Activity",
  headingLevel = 3,
  className,
}: ActivityFeedProps) {
  const H = `h${headingLevel}` as "h2" | "h3" | "h4";
  const [fallbackNow] = useState(() => Date.now());
  const now = nowProp ?? fallbackNow;
  const [whoOwn, setWhoOwn] = useState<ActivityWho>("all");
  const [typesOwn, setTypesOwn] = useState<string[]>([]);
  const who = whoProp ?? whoOwn;
  const types = typesProp ?? typesOwn;
  const setWho = (v: ActivityWho) => (whoProp === undefined && setWhoOwn(v), onWhoChange?.(v));
  const setTypes = (v: string[]) => (typesProp === undefined && setTypesOwn(v), onTypesChange?.(v));
  const allTypes = useMemo(() => activityTypes(items), [items]);

  // Items that arrive while the reader is scrolled down wait behind a pill instead of shifting the page.
  const scroller = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string> | null>(null);
  const [held, setHeld] = useState<ReadonlySet<string>>(new Set());
  const [announce, setAnnounce] = useState("");
  useEffect(() => {
    if (seen.current) {
      const fresh = newerThanSeen(items, seen.current);
      if (fresh.length) {
        const scrolled = (scroller.current?.scrollTop ?? 0) > 24;
        if (scrolled) setHeld((h) => new Set([...h, ...fresh]));
        setAnnounce(`${newPillText(fresh.length)} ${fresh.length === 1 ? "activity" : "activities"}`);
      }
    }
    seen.current = new Set(items.map((i) => i.id));
  }, [items]);
  const visible = useMemo(() => items.filter((i) => !held.has(i.id)), [items, held]);
  const shown = useMemo(() => filterActivity(visible, who, types), [visible, who, types]);
  const groups = useMemo(() => groupByDay(shown, now, timeZone), [shown, now, timeZone]);
  const pending = items.filter((i) => held.has(i.id)).length;
  const interactive = pending > 0 || hasMore || shown.some((i) => i.object || i.details);
  const release = () => {
    setHeld(new Set());
    scroller.current?.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleType = (t: string) => setTypes(types.includes(t) ? types.filter((x) => x !== t) : [...types, t]);

  return (
    <section aria-label={label} className={cn("flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card", className)}>
      {filters && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3">
          <SegmentedControl
            aria-label="Who"
            size="sm"
            value={who}
            onValueChange={(v) => setWho(v as ActivityWho)}
            options={[
              { value: "all", label: "Everyone" },
              { value: "people", label: "People" },
              { value: "agents", label: "Agents" },
            ]}
          />
          {allTypes.length > 1 && (
            <div role="group" aria-label="Type" className="flex flex-wrap gap-1.5">
              {allTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={types.includes(t)}
                  onClick={() => toggleType(t)}
                  className={cn(
                    "h-7 rounded-[8px] px-2.5 text-[12px] font-medium capitalize transition-colors",
                    focusRing,
                    types.includes(t) ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      {/* Rows with no object and no details have nothing to focus: the scroll area itself takes focus so the list can still be scrolled with the keyboard. */}
      <div
        ref={scroller}
        {...(interactive ? {} : { tabIndex: 0, role: "region", "aria-label": `${label} list` })}
        className={cn("relative min-h-0 flex-1 overflow-y-auto overscroll-contain", !interactive && focusRing)}
      >
        {pending > 0 && (
          <div className="sticky top-2 z-[2] flex justify-center">
            <button
              type="button"
              onClick={release}
              className={cn("h-7 rounded-full bg-indigo-600 px-3 text-[12px] font-medium text-white shadow-sm hover:bg-indigo-500", focusRing)}
            >
              <span aria-hidden="true">↑ </span>
              {newPillText(pending)}
              <span className="sr-only"> activities, show them</span>
            </button>
          </div>
        )}
        {groups.length === 0 ? (
          <p className="px-6 py-14 text-center text-[13px] text-muted-foreground">{emptyText}</p>
        ) : (
          groups.map((g) => (
            <div key={g.key}>
              <H className="sticky top-0 z-[1] border-b border-border bg-card px-4 py-1.5 text-[12px] font-medium text-muted-foreground">{g.label}</H>
              <ul className="divide-y divide-border">
                {g.items.map((it) => (
                  <Event key={it.id} item={it} now={now} timeZone={timeZone} open={open.has(it.id)} onToggle={() => toggle(it.id)} onOpen={onOpen} />
                ))}
              </ul>
            </div>
          ))
        )}
        {hasMore && groups.length > 0 && (
          <div className="flex justify-center border-t border-border p-3">
            <Button variant="quiet" size="sm" loading={loadingMore} onClick={() => onLoadMore?.()}>
              {loadingMore ? "Loading" : "Show older"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function Event({
  item: it,
  now,
  timeZone,
  open,
  onToggle,
  onOpen,
}: {
  item: ActivityItem;
  now: number;
  timeZone: string;
  open: boolean;
  onToggle: () => void;
  onOpen?: (item: ActivityItem) => void;
}) {
  const id = useId();
  const agent = !!it.actor.agent;
  return (
    <li className="px-4 py-3">
      <div className="grid grid-cols-[auto_1fr_auto] items-start gap-x-3">
        {agent && !it.actor.src ? (
          <Avatar label={it.actor.name} icon={<BotMark />} size="sm" shape="square" decorative />
        ) : (
          <Avatar label={it.actor.name} src={it.actor.src} size="sm" shape="circle" decorative />
        )}
        <p className="min-w-0 text-[14px] leading-6 text-muted-foreground">
          <span className="font-medium text-foreground">{it.actor.name}</span>
          {agent && <span className="sr-only"> (agent)</span>} {it.verb}
          {/* An event with no object ("signed up") has nothing to open: no empty button. */}
          {it.object && (
            <>
              {" "}
              <button type="button" onClick={() => onOpen?.(it)} className={cn("rounded-sm font-medium text-foreground underline-offset-2 hover:underline", focusRing)}>
                {it.object}
              </button>
            </>
          )}
        </p>
        <div className="flex items-center gap-1">
          <time dateTime={new Date(it.at).toISOString()} title={fullTime(it.at, timeZone)} className="text-[12px] tabular-nums text-muted-foreground">
            {relativeTime(it.at, now)}
          </time>
          {it.details && (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={id}
              aria-label={`${open ? "Hide" : "Show"} details: ${[it.actor.name, it.verb, it.object].filter(Boolean).join(" ")}`}
              onClick={onToggle}
              className={cn("grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground", focusRing)}
            >
              <Chevron open={open} />
            </button>
          )}
          {/* Rows without details keep the chevron's width, so every time lines up. */}
          {!it.details && <span aria-hidden="true" className="size-6" />}
        </div>
      </div>
      {it.details && (
        <div id={id} hidden={!open} className="mt-2 pl-9">
          <Details d={it.details} />
        </div>
      )}
    </li>
  );
}

function Details({ d }: { d: ActivityDetails }) {
  if (d.kind === "diff")
    return (
      <div className="text-[13px]">
        <p className="font-mono text-[12px] tabular-nums">
          {d.files} file{d.files === 1 ? "" : "s"}
          {d.added > 0 && <span className="text-emerald-700 dark:text-emerald-400"> +{d.added}</span>}
          {d.removed > 0 && <span className="text-red-700 dark:text-red-400"> -{d.removed}</span>}
          <span className="sr-only">, {diffSummary(d)}</span>
        </p>
        {d.summary && <p className="mt-1 text-muted-foreground">{d.summary}</p>}
      </div>
    );
  if (d.kind === "tool")
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[12px] leading-5">
        <dt className="text-muted-foreground">tool</dt>
        <dd className="min-w-0 break-words">{d.name}</dd>
        {d.input && (
          <>
            <dt className="text-muted-foreground">input</dt>
            <dd className="min-w-0 break-words">{d.input}</dd>
          </>
        )}
        {d.output && (
          <>
            <dt className="text-muted-foreground">output</dt>
            <dd className="min-w-0 break-words">{d.output}</dd>
          </>
        )}
      </dl>
    );
  return <p className="text-[13px] text-muted-foreground">{d.text}</p>;
}

export default ActivityFeed;
