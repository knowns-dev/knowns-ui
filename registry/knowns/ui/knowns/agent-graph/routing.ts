/** @registry part-of="agent-graph" */
/** Geometry for links: orthogonal routes with rounded corners, and walking along them. */

export type Pt = { x: number; y: number };

/** Order-independent key for a pair of actor ids. */
export const pairKey = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

export const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * Orthogonal route from a to b.
 * - "v" (top-down): tree links share a bus 62% of the way down (org-chart style);
 *   cross links drop to just above the lower node so they don't merge with a bus;
 *   same-row links dip below both nodes.
 * - "h" (left-to-right): leave sideways, turn on a vertical bus, enter sideways.
 */
export function route(a: Pt, b: Pt, cross: boolean, dip: number, orient: "v" | "h" = "v"): Pt[] {
  if (orient === "h") {
    if (Math.abs(a.y - b.y) < 0.5 || Math.abs(a.x - b.x) < 1) return [a, b];
    const dx = b.x - a.x;
    const midX = cross ? b.x - Math.sign(dx) * Math.min(32, Math.abs(dx) * 0.26) : a.x + dx / 2;
    return [a, { x: midX, y: a.y }, { x: midX, y: b.y }, b];
  }
  if (Math.abs(a.x - b.x) < 0.5) return [a, b];
  if (Math.abs(a.y - b.y) < 1) {
    const y = a.y + dip;
    return [a, { x: a.x, y }, { x: b.x, y }, b];
  }
  const up = a.y < b.y;
  const [u, l] = up ? [a, b] : [b, a];
  const midY = cross ? l.y - Math.min(32, (l.y - u.y) * 0.26) : u.y + (l.y - u.y) * 0.62;
  const pts = [u, { x: u.x, y: midY }, { x: l.x, y: midY }, l];
  return up ? pts : pts.reverse();
}

/** SVG path through orthogonal points, corners rounded with radius r. */
export function roundedPath(pts: Pt[], r: number) {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1];
    const c = pts[i];
    const n = pts[i + 1];
    const d1 = Math.hypot(c.x - p.x, c.y - p.y);
    const d2 = Math.hypot(n.x - c.x, n.y - c.y);
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const a = { x: c.x - ((c.x - p.x) / (d1 || 1)) * rr, y: c.y - ((c.y - p.y) / (d1 || 1)) * rr };
    const b = { x: c.x + ((n.x - c.x) / (d2 || 1)) * rr, y: c.y + ((n.y - c.y) / (d2 || 1)) * rr };
    d += ` L${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${last.x},${last.y}`;
}

/** Cumulative length at each point. */
export function measure(pts: Pt[]) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return cum;
}

export function pointAt(pts: Pt[], cum: number[], d: number): Pt {
  for (let i = 1; i < pts.length; i++) {
    if (d <= cum[i] || i === pts.length - 1) {
      const seg = cum[i] - cum[i - 1];
      const k = seg ? Math.max(0, Math.min(1, (d - cum[i - 1]) / seg)) : 0;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k };
    }
  }
  return pts[pts.length - 1];
}

/** Piece of the route between distances d0 and d1, keeping any corners in between. */
export function slice(pts: Pt[], cum: number[], d0: number, d1: number): Pt[] {
  const total = cum[cum.length - 1];
  const a = Math.max(0, d0);
  const b = Math.min(total, d1);
  if (b - a < 0.5) return [];
  const out = [pointAt(pts, cum, a)];
  for (let i = 1; i < pts.length - 1; i++) if (cum[i] > a && cum[i] < b) out.push(pts[i]);
  out.push(pointAt(pts, cum, b));
  return out;
}
