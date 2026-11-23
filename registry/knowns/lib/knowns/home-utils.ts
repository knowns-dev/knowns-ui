/** @registry part-of="home-link" */
/** Pure part of the home link: whether a link points at the page already open. No React. */

/**
 * True when `href` resolves to the page that is open now (same origin, path and search), whatever its hash: the brand
 * link on the home page itself, or "/" on "/". A link elsewhere, or one that cannot be parsed, gives false.
 * `here` is the current location.
 */
export function isSamePage(href: string, here: { origin: string; pathname: string; search?: string }): boolean {
  let url: URL;
  try {
    url = new URL(href, `${here.origin}${here.pathname}${here.search ?? ""}`);
  } catch {
    return false;
  }
  const trim = (p: string) => p.replace(/\/+$/, "") || "/";
  return url.origin === here.origin && trim(url.pathname) === trim(here.pathname) && url.search === (here.search ?? "");
}
