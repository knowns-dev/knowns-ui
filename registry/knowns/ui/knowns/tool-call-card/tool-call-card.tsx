"use client";

import { useEffect, useState } from "react";
import type { Actor, Span } from "@/registry/knowns/lib/knowns/types";
import { useAgentSnapshot, type AgentRun } from "@/registry/knowns/lib/knowns/run";
import { Json } from "@/registry/knowns/lib/knowns/json";
import { actorColors, rootAgent } from "@/registry/knowns/lib/knowns/status";
import { actorIcon } from "@/registry/knowns/lib/knowns/icons/actor-icon";
import { Button } from "../button";

export interface ToolCallCardProps {
  /** The span to show. Or pass `run` + `spanId` to follow it live. */
  span?: Span;
  run?: AgentRun;
  spanId?: string;
  /** Used for names and icons when no run is given. */
  actors?: Actor[];
  /** Open the input/output sections on first render. Default: open output, or error on failure. */
  defaultOpen?: boolean;
  /** Shows a Retry button on failed calls. */
  onRetry?: (span: Span) => void;
  className?: string;
}

const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const preview = (v: unknown) => {
  const t = typeof v === "string" ? v : JSON.stringify(v);
  return t && t.length > 72 ? `${t.slice(0, 72)}…` : t;
};

function Section({ label, value, open, tone }: { label: string; value: unknown; open: boolean; tone?: "error" }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard?.writeText(typeof value === "string" ? value : JSON.stringify(value, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <details open={open} className="group border-t first:border-t-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 16 16" className="size-3 flex-none text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true">
          <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className={cn("w-14 flex-none font-medium", tone === "error" ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>{label}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground group-open:invisible">{preview(value)}</span>
      </summary>
      <div className="relative px-4 pb-3">
        <pre
          className={cn(
            "max-h-72 overflow-auto rounded-lg border px-3 py-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words",
            tone === "error" ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300" : "bg-muted/40",
          )}
        >
          <Json value={value} />
        </pre>
        <Button variant="secondary" size="sm" onClick={copy} className="absolute right-6 top-2 h-6 px-2 text-[11px]">
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </details>
  );
}

/** One tool call in detail: who called whom, status and duration, input, output or error. */
export function ToolCallCard({ span: spanProp, run, spanId, actors: actorsProp, defaultOpen, onRetry, className }: ToolCallCardProps) {
  const snap = useAgentSnapshot(run);
  const span = spanProp ?? snap?.spans.find((s) => s.id === spanId);
  const actors = snap?.actors ?? actorsProp ?? [];
  const running = !!span && !span.outcome;

  // Live elapsed time while running.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [running]);

  if (!span) {
    return (
      <div className={cn("rounded-2xl border border-dashed bg-card px-4 py-6 text-center text-[13px] text-muted-foreground", className)}>
        Select a call to see its details.
      </div>
    );
  }

  const colors = actorColors(actors);
  const root = rootAgent(actors);
  const from = actors.find((a) => a.id === span.from);
  const to = actors.find((a) => a.id === span.to);
  const ms = (span.endedAt ?? now) - span.startedAt;
  const duration = ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)}s`;
  const failed = span.outcome === "failure";

  const who = (a: Actor | undefined, id: string) => (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        aria-hidden="true"
        style={{ ["--hue" as string]: colors.get(id) ?? "var(--muted-foreground)" }}
        className="grid size-6 flex-none place-items-center rounded-md border bg-muted/40 text-[11px] font-semibold text-[var(--hue)]"
      >
        <span className="grid size-[70%] place-items-center [&>svg]:size-full">{a ? actorIcon(a, a === root) : "?"}</span>
      </span>
      <span className="truncate font-semibold">{a?.label ?? id}</span>
    </span>
  );

  return (
    <article className={cn("@container overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-xs", className)} aria-label={`Call from ${from?.label ?? span.from} to ${to?.label ?? span.to}`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-3 pt-3.5">
        <div className="flex w-full min-w-0 items-center gap-2 text-sm @[420px]:w-auto @[420px]:flex-1">
          {who(from, span.from)}
          <span className="flex-none text-muted-foreground" aria-label="to">
            →
          </span>
          {who(to, span.to)}
        </div>
        <span
          className={cn(
            "inline-flex flex-none items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums",
            running && "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
            span.outcome === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
            failed && "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
          )}
        >
          {running ? (
            <svg viewBox="0 0 16 16" className="size-3 animate-spin motion-reduce:animate-none" aria-hidden="true">
              <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="2" />
              <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <span aria-hidden="true" className={cn("size-1.5 rounded-full", failed ? "bg-red-500" : "bg-emerald-500")} />
          )}
          {running ? "Running" : failed ? "Failed" : "Success"} · {duration}
        </span>
        {span.summary && <p className="basis-full truncate text-[13px] text-muted-foreground">{span.summary}</p>}
      </header>

      {(span.input !== undefined || span.output !== undefined || span.error) && (
        <div className="border-t">
          {span.input !== undefined && <Section label="Input" value={span.input} open={!!defaultOpen} />}
          {span.output !== undefined && <Section label="Output" value={span.output} open={defaultOpen ?? !failed} />}
          {span.error && <Section label="Error" value={span.error} open tone="error" />}
        </div>
      )}

      <footer className="flex items-center justify-between gap-3 border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        <time dateTime={new Date(span.startedAt).toISOString()} className="tabular-nums">
          {new Date(span.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </time>
        {failed && onRetry && (
          <Button variant="secondary" size="sm" onClick={() => onRetry(span)}>
            Retry
          </Button>
        )}
      </footer>
    </article>
  );
}

export default ToolCallCard;
