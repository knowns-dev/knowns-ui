"use client";
import { useLayoutEffect, useState, type RefObject } from "react";
import { prefersReducedMotion } from "@/registry/knowns/lib/knowns/motion";

export type RevealPhase = "idle" | "armed" | "in";

/**
 * One scroll reveal for a marketing section. "idle" (visible) on the server and before JavaScript; "armed" (hidden) only
 * when the section is below the fold; "in" once it has been seen, and for good. A section already on screen at mount, a
 * browser without IntersectionObserver and reduced motion all go straight to "in", so nothing replays and nothing stays hidden.
 */
export function useReveal(ref: RefObject<HTMLElement | null>): RevealPhase {
  const [phase, setPhase] = useState<RevealPhase>("idle");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || typeof IntersectionObserver === "undefined") return setPhase("in");
    const r = el.getBoundingClientRect();
    // Already on screen at mount: show it as is, with no entrance to replay.
    if (r.top < window.innerHeight * 0.9 && r.bottom > 0) return setPhase("in");
    setPhase("armed");
    const io = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) {
        setPhase("in");
        io.disconnect();
      }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return phase;
}
