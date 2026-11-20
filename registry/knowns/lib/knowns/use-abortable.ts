/** @registry part-of="knowns-core" */
import { useCallback, useEffect, useRef } from "react";

/**
 * One AbortSignal per call, for an AI or lookup callback. `next()` aborts the call before it and returns a fresh
 * signal; `cancel()` aborts the call in flight; unmounting aborts it too. The callback gets the signal as an extra
 * last argument, so a handler that ignores it keeps working.
 */
export function useAbortable(): { next: () => AbortSignal; cancel: () => void } {
  const ctl = useRef<AbortController | null>(null);
  const cancel = useCallback(() => {
    ctl.current?.abort();
    ctl.current = null;
  }, []);
  const next = useCallback(() => {
    ctl.current?.abort();
    ctl.current = new AbortController();
    return ctl.current.signal;
  }, []);
  useEffect(() => cancel, [cancel]);
  return { next, cancel };
}
