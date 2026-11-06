/** Fixed-frame geometry: fit the graph into the frame, keeping clear of the zoom controls. Pure. */

export type Rect = { x0: number; y0: number; x1: number; y1: number };
export type Corner = "bottom-right" | "top-right" | "bottom-left";
/** The zoom cluster: its size and the corner it sits in (its inset from the frame edges included). */
export type SafeArea = { w: number; h: number; corner: Corner };
export type View = { s: number; x: number; y: number };

/** Space kept between the content and the zoom cluster. */
export const SAFE_GAP = 8;

/** Where the cluster sits in a w × h frame. */
export function safeRect(frameW: number, frameH: number, safe: SafeArea): Rect {
  const right = safe.corner !== "bottom-left";
  const bottom = safe.corner !== "top-right";
  return {
    x0: right ? frameW - safe.w : 0,
    x1: right ? frameW : safe.w,
    y0: bottom ? frameH - safe.h : 0,
    y1: bottom ? frameH : safe.h,
  };
}

/** Scale (at most 1) and offset that centre `content` (canvas coordinates) in `region` (frame coordinates). */
function fitInto(region: Rect, content: Rect): View {
  const cw = Math.max(1, content.x1 - content.x0);
  const ch = Math.max(1, content.y1 - content.y0);
  const rw = Math.max(1, region.x1 - region.x0);
  const rh = Math.max(1, region.y1 - region.y0);
  const s = Math.min(1, rw / cw, rh / ch);
  return { s, x: region.x0 + (rw - cw * s) / 2 - content.x0 * s, y: region.y0 + (rh - ch * s) / 2 - content.y0 * s };
}

/** `content` as it lands in the frame under view `v`. */
export const placed = (content: Rect, v: View): Rect => ({
  x0: content.x0 * v.s + v.x,
  y0: content.y0 * v.s + v.y,
  x1: content.x1 * v.s + v.x,
  y1: content.y1 * v.s + v.y,
});

const meets = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Fit `content` (the nodes' bounding box, in canvas coordinates) into a frameW × frameH frame. With a safe
 * area, no node (`nodes`: their boxes; default, the whole bounding box) lands under the zoom cluster plus
 * SAFE_GAP. If the plain fit would put one there, the best of three is kept (largest scale):
 * - the plain fit, scaled down around the frame's centre just until the corner is clear (a sparse corner,
 *   like a radial graph's, costs little);
 * - the frame minus a band as tall as the cluster (above or below it);
 * - the frame minus a band as wide as the cluster (beside it).
 */
export function fitFrame(frameW: number, frameH: number, content: Rect, safe?: SafeArea | null, nodes?: Rect[]): View {
  const full: Rect = { x0: 0, y0: 0, x1: frameW, y1: frameH };
  const plain = fitInto(full, content);
  if (!safe || safe.w <= 0 || safe.h <= 0) return plain;
  const r = safeRect(frameW, frameH, safe);
  const keepOut: Rect = { x0: r.x0 - SAFE_GAP, y0: r.y0 - SAFE_GAP, x1: r.x1 + SAFE_GAP, y1: r.y1 + SAFE_GAP };
  const boxes = nodes?.length ? nodes : [content];
  const clear = (v: View) => !boxes.some((b) => meets(placed(b, v), keepOut));
  if (clear(plain)) return plain;
  const band = safe.corner === "top-right" ? { ...full, y0: r.y1 + SAFE_GAP } : { ...full, y1: r.y0 - SAFE_GAP };
  const side = safe.corner === "bottom-left" ? { ...full, x0: r.x1 + SAFE_GAP } : { ...full, x1: r.x0 - SAFE_GAP };
  let best = fitInto(band, content);
  const b = fitInto(side, content);
  if (b.s > best.s) best = b;
  // Shrink around the frame's centre (1% steps) while that still beats both bands.
  const cx = frameW / 2;
  const cy = frameH / 2;
  const mx = (content.x0 + content.x1) / 2;
  const my = (content.y0 + content.y1) / 2;
  for (let s = plain.s * 0.99; s > best.s; s *= 0.99) {
    const v = { s, x: cx - mx * s, y: cy - my * s };
    if (clear(v)) return v;
  }
  return best;
}

/** A node as drawn: tile plus the label under it, as wide as the label's room. */
export function nodeBox(n: { x: number; y: number; tile: number; room: number }, label = 48): Rect {
  const w = Math.max(n.tile, n.room);
  return { x0: n.x - w / 2, x1: n.x + w / 2, y0: n.y - n.tile / 2, y1: n.y + n.tile / 2 + label };
}

/** Bounding box of the nodes as drawn. */
export function contentBox(nodes: { x: number; y: number; tile: number; room: number }[], label = 48): Rect | null {
  if (!nodes.length) return null;
  const r: Rect = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const b of nodes.map((n) => nodeBox(n, label))) {
    r.x0 = Math.min(r.x0, b.x0);
    r.x1 = Math.max(r.x1, b.x1);
    r.y0 = Math.min(r.y0, b.y0);
    r.y1 = Math.max(r.y1, b.y1);
  }
  return r;
}
