"use client";
/** @registry part-of="agent-graph" */

import type { ReactNode, Ref } from "react";
import type { Actor, ActorState, Span } from "@/registry/knowns/lib/knowns/types";
import { STATE_LABEL, STATE_TEXT } from "@/registry/knowns/lib/knowns/status";
import { Button } from "../button";

export interface DetailCardProps {
  actor: Actor;
  state: ActorState;
  /** Newest first. */
  recent: Span[];
  peers: Actor[];
  spansPerMinute: number;
  iconFor: (a: Actor) => ReactNode;
  hueOf: (id: string) => string;
  formatSpend: (n: number) => string;
  closeRef: Ref<HTMLButtonElement>;
  onClose: () => void;
}

/** Default body of the detail popover: header, one-line summary, last spans, rate. */
export function DetailCard({
  actor,
  state,
  recent,
  peers,
  spansPerMinute,
  iconFor,
  hueOf,
  formatSpend,
  closeRef,
  onClose,
}: DetailCardProps) {
  const summary =
    actor.type === "agent" ? (
      <>
        <span className={`font-semibold ${STATE_TEXT[state]}`}>{STATE_LABEL[state]}</span>
        {actor.spend !== undefined && <> · {formatSpend(actor.spend)}</>}
        {actor.activity && <> · {actor.activity}</>}
      </>
    ) : peers.length ? (
      <>Used by {peers.map((p) => p.label).join(", ")}</>
    ) : null;

  return (
    <>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-11 flex-none place-items-center rounded-[11px] border bg-muted/50 font-semibold"
        >
          <span className="grid size-[55%] place-items-center [&>svg]:size-full">{iconFor(actor)}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold leading-tight">{actor.label}</div>
          <div className="truncate text-[13px] text-muted-foreground first-letter:uppercase">{actor.model ?? actor.type}</div>
        </div>
        <Button
          ref={closeRef}
          variant="ghost"
          size="sm"
          aria-label="Close"
          onClick={onClose}
          className="-mr-1.5 -mt-0.5 self-start"
          icon={
            <svg viewBox="0 0 16 16">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          }
        />
      </div>

      {summary && <p className="mt-3.5 text-[13px] leading-relaxed text-muted-foreground">{summary}</p>}

      {recent.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted-foreground">No calls yet.</p>
      ) : (
        <ul className="mt-3 border-t">
          {recent.map((s) => {
            const out = s.from === actor.id;
            const other = peers.find((p) => p.id === (out ? s.to : s.from));
            const ms = s.endedAt !== undefined ? s.endedAt - s.startedAt : undefined;
            return (
              <li key={s.id} className="flex h-[38px] items-center gap-2 border-b text-[13px]">
                <span className="w-3.5 flex-none text-muted-foreground" aria-label={out ? "to" : "from"}>
                  {out ? "→" : "←"}
                </span>
                {other && (
                  <span
                    aria-hidden="true"
                    style={{ ["--hue" as string]: hueOf(other.id) }}
                    className="grid size-[18px] flex-none place-items-center text-[11px] font-semibold text-[var(--hue)] [&>svg]:size-full"
                  >
                    {iconFor(other)}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">
                  <b className="font-semibold">{other?.label ?? "?"}</b>
                  {s.summary && <span className="text-muted-foreground"> · {s.summary}</span>}
                </span>
                <span
                  className={`flex-none tabular-nums ${
                    !s.outcome
                      ? "text-indigo-600 dark:text-indigo-400"
                      : s.outcome === "failure"
                        ? "font-semibold text-red-600 dark:text-red-400"
                        : "text-muted-foreground"
                  }`}
                >
                  {!s.outcome ? "…" : s.outcome === "failure" ? "Failed" : ms !== undefined ? `${ms}ms` : "ok"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="pt-3 text-[13px] text-muted-foreground">
        {spansPerMinute} {spansPerMinute === 1 ? "call" : "calls"} in the last minute
      </div>
    </>
  );
}
