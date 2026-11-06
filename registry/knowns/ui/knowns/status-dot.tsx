import { cn } from "@/registry/knowns/lib/knowns/utils";

export type StatusDotState = "idle" | "busy" | "blocked" | "failed" | "finished";

const COLOR: Record<StatusDotState, string> = {
  idle: "bg-muted-foreground/50",
  busy: "bg-indigo-500",
  blocked: "bg-amber-500",
  failed: "bg-red-500",
  finished: "bg-emerald-500",
};

const LABEL: Record<StatusDotState, string> = { idle: "Idle", busy: "Working", blocked: "Needs you", failed: "Failed", finished: "Done" };

/** Small coloured dot for a state; busy and blocked pulse. Pass `label` to announce it. */
export function StatusDot({ state = "idle", label, className }: { state?: StatusDotState; label?: string | false; className?: string }) {
  const live = state === "busy" || state === "blocked";
  return (
    <span
      role={label === false ? undefined : "img"}
      aria-label={label === false ? undefined : label ?? LABEL[state]}
      aria-hidden={label === false || undefined}
      className={cn("relative inline-flex size-2 flex-none", className)}
    >
      {live && <span className={cn("absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping", COLOR[state])} />}
      <span className={cn("relative size-full rounded-full", COLOR[state])} />
    </span>
  );
}
