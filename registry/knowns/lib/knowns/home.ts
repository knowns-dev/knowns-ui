/** @registry name="home-link" type="lib" title="Home link" description="Makes a brand or logo link go home: to its href, or, when that is the page already open or a preview frame, back to the top with a smooth scroll, the hash cleared and focus on the top. App templates pass onHome to switch to their home view instead." */
/**
 * useHomeLink(href, { onHome }) returns a click handler for a brand link.
 * - With `onHome` (an app that switches views in place), a click calls it instead of navigating.
 * - Without it, when the link points at the page already open, or the page is shown in a preview frame (HomeFrame), a
 *   click scrolls to the top (instant with reduced motion), clears the hash without a jump and moves focus to the top
 *   (the link itself stays focused, so keyboard users keep their place).
 * - Otherwise it is a normal link. Modified clicks, other buttons and clicks something else already handled are left alone.
 */
import { createContext, useContext, type MouseEvent } from "react";
import { prefersReducedMotion } from "./motion";
import { isSamePage } from "./home-utils";

export { isSamePage } from "./home-utils";

/** True inside a preview frame of a whole page (a template shown in an iframe): "/" would leave the page shown. */
export const HomeFrame = createContext(false);

/** Scrolls the page (or `scrollRoot`) to the top and drops the hash from the address without a jump. */
export function goToTop(scrollRoot?: HTMLElement | null) {
  const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
  (scrollRoot ?? window).scrollTo({ top: 0, behavior });
  if (window.location.hash) history.pushState(null, "", `${window.location.pathname}${window.location.search}`);
}

export function useHomeLink(href: string | undefined, opts: { onHome?: () => void; scrollRoot?: HTMLElement | null } = {}) {
  const inFrame = useContext(HomeFrame);
  return (e: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (opts.onHome) {
      e.preventDefault();
      opts.onHome();
      goToTop(opts.scrollRoot);
      return;
    }
    if (inFrame || (href !== undefined && isSamePage(href, window.location))) {
      e.preventDefault();
      goToTop(opts.scrollRoot);
    }
  };
}
