import { cn } from "@/registry/knowns/lib/knowns/utils";

/** Placeholder while content loads. Size it with classes: <Skeleton className="h-4 w-32" />. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("rounded-md bg-muted motion-safe:animate-pulse", className)} />;
}
