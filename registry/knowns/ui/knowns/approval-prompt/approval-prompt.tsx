"use client";
/** @registry name="approval-prompt" type="ui" title="Approval prompt" description="Requests waiting for a human decision with a preview and Approve / Deny." */

import { useEffect, useState, type ReactNode } from "react";
import type { Actor, Approval, ApprovalDecision } from "@/registry/knowns/lib/knowns/types";
import { useAgentSnapshot, type AgentRun } from "@/registry/knowns/lib/knowns/run";
import { actorColors, rootAgent } from "@/registry/knowns/lib/knowns/status";
import { actorIcon } from "@/registry/knowns/lib/knowns/icons/actor-icon";
import { Button } from "../button";
import { CodeBlock } from "../code-block/code-block";

export interface ApprovalPromptProps {
  /** With a run, decisions are emitted to it as `approval.resolve`. */
  run?: AgentRun;
  approvals?: Approval[];
  actors?: Actor[];
  /** Called on every decision (with or without a run). */
  onDecision?: (approval: Approval, decision: ApprovalDecision) => void;
  /** How many resolved requests to keep listed under the pending ones. Default 3. */
  history?: number;
  /** Rendered when nothing is waiting and there is no history. Default: nothing. */
  empty?: ReactNode;
  /** Announce new requests to screen readers (an sr-only aria-live region). Default true; turn it off for demos that ask on a timer. */
  live?: boolean;
  className?: string;
}

const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

function ago(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
}

/** Requests waiting for a human decision, newest first, with Approve / Deny. */
export function ApprovalPrompt({ run, approvals: approvalsProp, actors: actorsProp, onDecision, history = 3, empty = null, live = true, className }: ApprovalPromptProps) {
  const snap = useAgentSnapshot(run);
  const approvals = snap?.approvals ?? approvalsProp ?? [];
  const actors = snap?.actors ?? actorsProp ?? [];
  const colors = actorColors(actors);
  const root = rootAgent(actors);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const pending = approvals.filter((a) => !a.decision).sort((a, b) => b.requestedAt - a.requestedAt);
  const resolved = approvals
    .filter((a) => a.decision)
    .sort((a, b) => (b.decidedAt ?? 0) - (a.decidedAt ?? 0))
    .slice(0, history);

  const decide = (a: Approval, decision: ApprovalDecision) => {
    run?.emit({ type: "approval.resolve", id: a.id, decision });
    onDecision?.(a, decision);
  };

  if (!pending.length && !resolved.length) return <>{empty}</>;

  const avatar = (id: string, size: string) => {
    const actor = actors.find((x) => x.id === id);
    return (
      <span
        aria-hidden="true"
        style={{ ["--hue" as string]: colors.get(id) ?? "var(--muted-foreground)" }}
        className={cn("grid flex-none place-items-center rounded-lg border bg-muted/40 text-[11px] font-semibold text-[var(--hue)]", size)}
      >
        <span className="grid size-[62%] place-items-center [&>svg]:size-full">{actor ? actorIcon(actor, actor === root) : "?"}</span>
      </span>
    );
  };
  const nameOf = (id: string) => actors.find((x) => x.id === id)?.label ?? id;

  return (
    <section aria-label="Approvals" className={cn("flex flex-col gap-3", className)}>
      {live && (
        <div aria-live="polite" className="sr-only">
          {pending.length ? `${pending.length} ${pending.length === 1 ? "request needs" : "requests need"} your approval` : ""}
        </div>
      )}

      {pending.map((a) => (
        <article
          key={a.id}
          aria-label={`${nameOf(a.actor)} asks: ${a.title}`}
          className="overflow-hidden rounded-2xl border border-amber-500/40 bg-card text-card-foreground shadow-xs [box-shadow:0_0_0_4px_color-mix(in_srgb,#f59e0b_8%,transparent)]"
        >
          <div className="flex items-start gap-3 px-4 pb-3 pt-3.5">
            <div className="relative">
              {avatar(a.actor, "size-9")}
              <span aria-hidden="true" className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full border-2 border-card bg-amber-500 text-white">
                <svg viewBox="0 0 16 16" className="size-2.5">
                  <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2.2" />
                  <path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{nameOf(a.actor)}</span> wants to
                </p>
                <time className="flex-none text-xs tabular-nums text-muted-foreground" dateTime={new Date(a.requestedAt).toISOString()}>
                  {ago(now - a.requestedAt)}
                </time>
              </div>
              <h3 className="mt-0.5 text-[15px] font-semibold leading-snug">{a.title}</h3>
            </div>
          </div>
          {a.detail && (
            <CodeBlock code={a.detail} label={false} copy={false} wrapToggle={false} defaultWrap maxHeight={192} aria-label={`${a.title}, details`} className="mx-4 mb-3 rounded-lg [&_pre]:py-2.5! [&_pre]:text-[12px]! [&_[data-line]]:px-3!" />
          )}
          <div className="flex justify-end gap-2 border-t bg-muted/30 px-4 py-2.5">
            <Button variant="secondary" onClick={() => decide(a, "denied")}>
              Deny
            </Button>
            <Button onClick={() => decide(a, "approved")}>Approve</Button>
          </div>
        </article>
      ))}

      {resolved.length > 0 && (
        <ul className="divide-y rounded-2xl border bg-card text-[13px] text-card-foreground">
          {resolved.map((a) => (
            <li key={a.id} className="flex items-center gap-2.5 px-4 py-2.5">
              {avatar(a.actor, "size-6")}
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{nameOf(a.actor)}</span> <span className="text-muted-foreground">· {a.title}</span>
              </span>
              <span
                className={cn(
                  "flex-none text-xs font-medium",
                  a.decision === "approved" ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300",
                )}
              >
                {a.decision === "approved" ? "Approved" : "Denied"}
              </span>
              <span className="flex-none text-xs tabular-nums text-muted-foreground">{ago(now - (a.decidedAt ?? now))}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default ApprovalPrompt;
