"use client";
/** @registry name="record-timeline" type="block" title="Record timeline" description="One record's history: emails, calls, meetings, notes and stage changes grouped by day, with type and person filters and a note composer." */

/**
 * RecordTimeline: the history of one contact, company or deal. Events are grouped by day (in a time zone you pass),
 * newest first by default, each with an icon for its type, a title, who did it, the time and a body that folds when it
 * is long. A stage change reads "Proposal to Negotiation". Filters narrow by type and by person; when `onAddNote` is
 * given a note field sits on top (Ctrl or Cmd with Enter adds it). It holds no data, fetches nothing and reads no
 * clock: `events`, `today` and `timeZone` come in, and a new note goes out through `onAddNote`.
 */
import { useCallback, useId, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { Avatar } from "../../avatar";
import { Badge } from "../../badge";
import { Button } from "../../button";
import { FilterChips, type FilterField, type FilterValue } from "../../filter-chips";
import { Textarea } from "../../textarea";
import {
  KIND_LABEL,
  KIND_ORDER,
  NOTE_LIMIT,
  applyFilter,
  authorsOf,
  groupByDay,
  isLong,
  kindCounts,
  noteToSend,
  timeText,
  type EventKind,
  type TimelineEvent,
  type TimelineFilter,
} from "./record-timeline-utils";

export * from "./record-timeline-utils";

export interface RecordTimelineProps {
  events: TimelineEvent[];
  /** ISO date of today (YYYY-MM-DD), so the first group reads Today and Yesterday. */
  today?: string;
  /** IANA zone the days and times are shown in. Default UTC. */
  timeZone?: string;
  order?: "newest" | "oldest";
  /** Shows the note field. Return a promise to show a saving state; a rejection keeps the text and shows an error. */
  onAddNote?: (text: string) => void | Promise<void>;
  /** Controlled filter. Without it the block keeps its own. */
  filter?: TimelineFilter;
  onFilterChange?: (filter: TimelineFilter) => void;
  /** A picture for an author, by name. Without it (or when it returns nothing) the author is text only. */
  avatarFor?: (author: string) => string | undefined;
  /** Hide the filter row. */
  filterable?: boolean;
  title?: ReactNode;
  className?: string;
}

const ICON: Record<EventKind, string> = {
  email: "M2.5 4.5h11v7h-11zM2.5 5l5.5 4 5.5-4",
  call: "M4 2.5h2l1 3-1.5 1a7 7 0 0 0 3 3l1-1.5 3 1v2a1.5 1.5 0 0 1-1.5 1.5A10 10 0 0 1 2.5 4 1.5 1.5 0 0 1 4 2.5z",
  meeting: "M3 4.5h10v8.5H3zM3 7.5h10M5.5 2.5v3M10.5 2.5v3",
  note: "M3.5 2.5h9v11h-9zM5.5 6h5M5.5 8.5h5M5.5 11h3",
  stage: "M3 8h8M8.5 4.5 12 8l-3.5 3.5",
};
const TINT: Record<EventKind, string> = {
  email: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  call: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  meeting: "bg-pink-500/12 text-pink-700 dark:text-pink-300",
  note: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
  stage: "bg-primary/10 text-primary",
};

const Glyph = ({ kind }: { kind: EventKind }) => (
  <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", TINT[kind])} aria-hidden>
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
      <path d={ICON[kind]} />
    </svg>
  </span>
);

function EventRow({ e, timeZone, avatarFor }: { e: TimelineEvent; timeZone: string; avatarFor?: (author: string) => string | undefined }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const long = isLong(e.body);
  return (
    <li className="group/row relative flex gap-3 pb-5 last:pb-0">
      <span className="absolute top-8 bottom-0 left-3.5 w-px bg-border group-last/row:hidden" aria-hidden />
      <Glyph kind={e.kind} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-[13px] leading-snug font-medium">
            <span className="sr-only">{KIND_LABEL[e.kind]}: </span>
            {e.kind === "stage" && e.from && e.to ? (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                Stage changed
                <Badge tone="neutral" size="sm">
                  {e.from}
                </Badge>
                <span aria-label="to">→</span>
                <Badge tone="accent" size="sm">
                  {e.to}
                </Badge>
              </span>
            ) : (
              e.title
            )}
          </p>
          <time dateTime={e.at} className="shrink-0 text-[12px] text-muted-foreground tabular-nums">
            {timeText(e.at, timeZone)}
          </time>
        </div>
        {(e.author || e.detail) && (
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            {e.author && avatarFor?.(e.author) && <Avatar label={e.author} src={avatarFor(e.author)} size="xs" shape="circle" decorative />}
            <span className="min-w-0 truncate">{[e.author, e.detail].filter(Boolean).join(" · ")}</span>
          </p>
        )}
        {e.body && (
          <>
            <p id={bodyId} className={cn("mt-1.5 text-[13px] leading-relaxed whitespace-pre-line text-foreground/85", long && !open && "line-clamp-3")}>
              {e.body}
            </p>
            {long && (
              <button type="button" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((v) => !v)} className="mt-1 rounded-sm text-[12px] font-medium text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                {open ? "Show less" : "Show more"}
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

export function RecordTimeline({ events, today, timeZone = "UTC", order = "newest", onAddNote, filter, onFilterChange, avatarFor, filterable = true, title, className }: RecordTimelineProps) {
  const [own, setOwn] = useState<TimelineFilter>({ kinds: [], authors: [] });
  const f = filter ?? own;
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteId = useId();

  const setFilter = useCallback(
    (next: TimelineFilter) => {
      if (filter === undefined) setOwn(next);
      onFilterChange?.(next);
    },
    [filter, onFilterChange],
  );

  const counts = useMemo(() => kindCounts(events), [events]);
  const people = useMemo(() => authorsOf(events), [events]);
  const fields = useMemo<FilterField[]>(() => {
    const out: FilterField[] = [{ id: "kind", label: "Type", options: KIND_ORDER.filter((k) => counts[k] > 0).map((k) => ({ value: k, label: `${KIND_LABEL[k]} (${counts[k]})` })), plural: "types" }];
    if (people.length > 1) out.push({ id: "author", label: "Person", options: people.map((p) => ({ value: p, label: p })), plural: "people" });
    return out;
  }, [counts, people]);
  const value: FilterValue = { ...(f.kinds.length ? { kind: f.kinds } : {}), ...(f.authors.length ? { author: f.authors } : {}) };

  const shown = useMemo(() => applyFilter(events, f), [events, f]);
  const groups = useMemo(() => groupByDay(shown, { timeZone, today, order }), [shown, timeZone, today, order]);
  const filtered = f.kinds.length > 0 || f.authors.length > 0;
  const toSend = noteToSend(draft);

  const submit = async () => {
    if (!onAddNote || !toSend || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onAddNote(toSend);
      setDraft("");
    } catch {
      setError("The note was not saved. Your text is still here. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={cn("flex flex-col gap-4", className)} aria-label={typeof title === "string" ? title : "Record timeline"}>
      {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}

      {onAddNote && (
        <form
          className="flex flex-col gap-2 rounded-2xl border bg-card p-3 shadow-xs"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label htmlFor={noteId} className="sr-only">
            Add a note
          </label>
          <Textarea
            id={noteId}
            autosize
            minRows={2}
            maxRows={8}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a note about this record"
            limit={NOTE_LIMIT}
            invalid={draft.length > NOTE_LIMIT}
            disabled={saving}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <div className="flex items-center justify-between gap-3">
            <p className={cn("text-[12px]", error ? "text-red-600 dark:text-red-400" : "text-muted-foreground")} role={error ? "alert" : undefined}>
              {error ?? "Ctrl or Cmd with Enter to add"}
            </p>
            <Button type="submit" size="sm" loading={saving} disabled={!toSend}>
              Add note
            </Button>
          </div>
        </form>
      )}

      {filterable && events.length > 0 && <FilterChips fields={fields} value={value} onChange={(v) => setFilter({ kinds: (v.kind ?? []) as EventKind[], authors: v.author ?? [] })} addLabel="Filter" aria-label="Filter the timeline" />}

      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-[13px] text-muted-foreground">No history yet. Emails, calls, meetings and notes show up here as they happen.</p>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-8 text-center">
          <p className="text-[13px] text-muted-foreground">Nothing matches these filters.</p>
          {filtered && (
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => setFilter({ kinds: [], authors: [] })}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <section key={g.key || "undated"} aria-label={g.label}>
              <h3 className="mb-3 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">{g.label}</h3>
              <ol className="flex flex-col">
                {g.events.map((e) => (
                  <EventRow key={e.id} e={e} timeZone={timeZone} avatarFor={avatarFor} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

export default RecordTimeline;
