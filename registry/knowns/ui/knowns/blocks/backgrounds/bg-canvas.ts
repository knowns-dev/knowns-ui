/** @registry part-of="backgrounds-core" */
/** Browser helpers for the canvas backgrounds: theme colours as RGBA, theme-change events, DPR-aware sizing. */

/**
 * A CSS colour (a token like var(--foreground), color-mix, oklch…) resolved in `el`'s context to
 * [r, g, b, a] (0–255): read through a hidden probe, then painted on a 1×1 canvas so any colour space
 * comes back as sRGB bytes.
 */
export function resolveRgba(el: HTMLElement, css: string): [number, number, number, number] {
  const probe = document.createElement("span");
  probe.style.color = css;
  probe.style.display = "none";
  el.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [128, 128, 128, 255];
  ctx.fillStyle = computed || "rgb(128 128 128)";
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2], d[3]];
}

/** Calls `cb` when the theme may have changed: a class, style or data-theme change on <html>, or the OS scheme. */
export function watchTheme(cb: () => void): () => void {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
  const scheme = matchMedia("(prefers-color-scheme: dark)");
  scheme.addEventListener("change", cb);
  return () => {
    mo.disconnect();
    scheme.removeEventListener("change", cb);
  };
}

/**
 * How much `el` is drawn bigger or smaller than its layout size: CSS `zoom` on an ancestor (a docs preview at
 * 50%) or a scale transform. getBoundingClientRect is in screen px; CSS sizes and canvas drawing are not.
 */
export function drawScale(el: HTMLElement): number {
  const w = el.offsetWidth;
  const s = w ? el.getBoundingClientRect().width / w : 1;
  return s > 0 && Number.isFinite(s) ? s : 1;
}

/**
 * Sizes `cv` to `el`: `w`/`h` in the element's own CSS px (layout size, right under CSS zoom), and a backing
 * store of the size it is really drawn at on screen (`W`/`H`), so it stays crisp when zoomed out or in.
 * `dpr` is device px per CSS px for drawing (DPR capped at `maxDpr`, times any zoom).
 */
export function fitCanvas(cv: HTMLCanvasElement, el: HTMLElement, maxDpr = 2): { w: number; h: number; dpr: number; W: number; H: number } {
  const w = Math.max(1, Math.round(el.clientWidth));
  const h = Math.max(1, Math.round(el.clientHeight));
  const dpr = Math.min(maxDpr, window.devicePixelRatio || 1) * drawScale(el);
  const W = Math.round(w * dpr);
  const H = Math.round(h * dpr);
  if (cv.width !== W) cv.width = W;
  if (cv.height !== H) cv.height = H;
  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  return { w, h, dpr, W, H };
}

/** A fixed content-safe box in fractions of the field, or true to measure the content, or false for none. */
export type BgClear = boolean | { x: number; y: number; w: number; h: number };

const isContent = (c: Element) => !c.hasAttribute("aria-hidden") && c.tagName !== "STYLE" && c.tagName !== "CANVAS";
const hasText = (c: Element) => !!c.textContent?.trim() || !!c.querySelector("button, a, input, img, svg, video");

/**
 * What a background keeps clear: its own children, or, when it has none (used as a backdrop, e.g. a hero's
 * or a CTA's background prop), the content next to it: the siblings of its nearest ancestor that has any.
 */
export function contentRoots(el: HTMLElement): Element[] {
  const own = [...el.children].filter((c) => isContent(c) && hasText(c));
  if (own.length) return own;
  let node: Element = el;
  for (let up = el.parentElement; up; node = up, up = up.parentElement) {
    const beside = [...up.children].filter((c) => c !== node && isContent(c) && hasText(c));
    if (beside.length) return beside;
  }
  return [];
}

/**
 * The content box in CSS px relative to the field, [x0, y0, x1, y1]: the union of the text, controls and
 * media in the content (text measured by its glyph boxes, not its block), padded a little. A fixed `clear`
 * box is scaled to the field instead. Null when there is nothing to keep clear.
 */
export function contentBox(el: HTMLElement, clear: BgClear, box = el.getBoundingClientRect(), pad: [number, number] = [20, 16]): [number, number, number, number] | null {
  if (!clear) return null;
  // Screen px (getBoundingClientRect) to the field's own CSS px, so the box is right under CSS zoom too.
  const k = 1 / drawScale(el);
  if (typeof clear === "object") return [clear.x * box.width * k, clear.y * box.height * k, (clear.x + clear.w) * box.width * k, (clear.y + clear.h) * box.height * k];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const add = (r: DOMRect) => {
    if (!r.width || !r.height) return;
    x0 = Math.min(x0, r.left - box.left);
    y0 = Math.min(y0, r.top - box.top);
    x1 = Math.max(x1, r.right - box.left);
    y1 = Math.max(y1, r.bottom - box.top);
  };
  const range = document.createRange();
  for (const c of contentRoots(el)) {
    const walk = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
    for (let t = walk.nextNode(); t; t = walk.nextNode()) {
      if (!t.textContent?.trim()) continue;
      range.selectNodeContents(t);
      for (const r of range.getClientRects()) add(r);
    }
    for (const n of c.querySelectorAll("button, a, input, select, textarea, img, svg, video, canvas, [role=button]")) add(n.getBoundingClientRect());
  }
  if (!Number.isFinite(x0)) return null;
  return [x0 * k - pad[0], y0 * k - pad[1], x1 * k + pad[0], y1 * k + pad[1]];
}

/**
 * Keeps `onChange` in step with the content's size: the field's own box, the content roots (text wrapping)
 * and web fonts loading. Returns the cleanup.
 */
export function watchContent(el: HTMLElement, onChange: () => void): () => void {
  const ro = new ResizeObserver(onChange);
  for (const c of contentRoots(el)) ro.observe(c);
  let live = true;
  document.fonts?.ready.then(() => live && onChange());
  return () => {
    live = false;
    ro.disconnect();
  };
}

/**
 * The content as many tight boxes in CSS px relative to the field, [x0, y0, x1, y1] each: one per line of
 * text (its glyph boxes) and one per control or media element, padded a little. Use it with
 * holeFieldRects for a hole that follows the copy instead of one rectangle around all of it.
 * A fixed `clear` box gives that one box. Empty when there is nothing to keep clear.
 */
export function contentRects(el: HTMLElement, clear: BgClear, box = el.getBoundingClientRect(), pad: [number, number] = [20, 16]): [number, number, number, number][] {
  if (!clear) return [];
  // Screen px (getBoundingClientRect) to the field's own CSS px, so the holes are right under CSS zoom too.
  const k = 1 / drawScale(el);
  if (typeof clear === "object") return [[clear.x * box.width * k, clear.y * box.height * k, (clear.x + clear.w) * box.width * k, (clear.y + clear.h) * box.height * k]];
  const out: [number, number, number, number][] = [];
  const add = (r: DOMRect) => {
    if (!r.width || !r.height) return;
    out.push([(r.left - box.left) * k - pad[0], (r.top - box.top) * k - pad[1], (r.right - box.left) * k + pad[0], (r.bottom - box.top) * k + pad[1]]);
  };
  const range = document.createRange();
  for (const c of contentRoots(el)) {
    const walk = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
    for (let t = walk.nextNode(); t; t = walk.nextNode()) {
      if (!t.textContent?.trim()) continue;
      range.selectNodeContents(t);
      for (const r of range.getClientRects()) add(r);
    }
    for (const n of c.querySelectorAll("button, a, input, select, textarea, img, svg, video, canvas, [role=button]")) add(n.getBoundingClientRect());
  }
  return out;
}
