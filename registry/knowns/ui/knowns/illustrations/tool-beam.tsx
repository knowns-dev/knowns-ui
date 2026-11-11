"use client";
/** @registry name="tool-beam" type="ui" title="Tool beam" description="Your product between the tools it connects, with data flowing along curved beams; hover to focus, click to pause." */

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { AGENT_PALETTE, initials } from "@/registry/knowns/lib/knowns/status";
import { toolIcon } from "@/registry/knowns/lib/knowns/icons/tool-icons";
import { cubicPath, type Pt } from "./illust-utils";
import { MOTION_GATE, useLive } from "./use-in-view";

export interface BeamTool {
  name: string;
  icon?: ReactNode;
}

export interface ToolBeamProps {
  /** Tools on the left: they feed your product (pulses flow in). Up to 4. */
  left?: BeamTool[];
  /** Tools on the right: your product acts on them (pulses flow out). Up to 4. */
  right?: BeamTool[];
  /** Your product's tile in the middle. */
  hub?: ReactNode;
  /** Name of the hub, for the accessible label. Default "Your app". */
  hubLabel?: string;
  /** Pill under the hub. Default "N connected". */
  caption?: ReactNode;
  /** Playback speed. 1 = a pulse every 2.4s per beam. */
  speed?: number;
  paused?: boolean;
  className?: string;
}

const W = 560;
const H = 300;
const HUB: Pt = { x: W / 2, y: H / 2 };

const DEFAULT_LEFT: BeamTool[] = [{ name: "Gmail" }, { name: "Notion" }, { name: "Google Drive" }];
const DEFAULT_RIGHT: BeamTool[] = [{ name: "Slack" }, { name: "GitHub" }, { name: "Linear" }, { name: "Postgres" }];

export interface BeamSeat {
  side: "left" | "right";
  at: Pt;
  /** Path from the tool to the hub's edge. */
  d: string;
}

/**
 * Seats for up to 4 tools per side. Each side is a gentle arc (outer tools tuck in toward the hub), and
 * every beam leaves its tool horizontally, then eases into the hub's side.
 */
export function beamLayout(left: number, right: number): BeamSeat[] {
  const side = (count: number, dir: -1 | 1): BeamSeat[] => {
    const n = Math.max(0, Math.min(4, count));
    const gap = n > 3 ? 64 : 76;
    return Array.from({ length: n }, (_, i) => {
      const off = (i - (n - 1) / 2) * gap;
      const at = { x: HUB.x + dir * (196 - Math.abs(off) * 0.32), y: HUB.y + off };
      const edge = { x: HUB.x + dir * 38, y: HUB.y + off * 0.18 };
      const mid = (at.x + edge.x) / 2;
      const p = dir < 0 ? [at, { x: mid, y: at.y }, { x: mid, y: edge.y }, edge] : [edge, { x: mid, y: edge.y }, { x: mid, y: at.y }, at];
      return { side: dir < 0 ? "left" : "right", at, d: cubicPath(p[0], p[1], p[2], p[3]) } as BeamSeat;
    });
  };
  return [...side(left, -1), ...side(right, 1)];
}

const CSS = `
@keyframes kntb-flow { from { stroke-dashoffset: 0 } to { stroke-dashoffset: -100 } }
@keyframes kntb-dot { 0%, 100% { transform: scale(.9); opacity: .6 } 50% { transform: scale(1.15); opacity: 1 } }
@keyframes kntb-halo { 0%, 100% { opacity: .5; transform: scale(.96) } 50% { opacity: .85; transform: scale(1.04) } }
[data-kn-ill="tool-beam"] [data-beam][data-hold="true"] * { animation-play-state: paused !important; }
${MOTION_GATE}
`;

const SURFACE =
  "bg-card [border:1px_solid_color-mix(in_srgb,var(--foreground)_10%,transparent)] shadow-[0_1px_2px_rgb(0_0_0/0.06),0_6px_18px_-10px_rgb(0_0_0/0.25)] dark:[background:color-mix(in_srgb,var(--card)_78%,#000)]";

function HubGlyph() {
  // A neutral stacked-layers mark; pass `hub` for your own logo.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5 20.5 8 12 12.5 3.5 8Z" />
      <path d="M3.5 12 12 16.5 20.5 12" strokeOpacity={0.6} />
      <path d="M3.5 16 12 20.5 20.5 16" strokeOpacity={0.35} />
    </svg>
  );
}

const pct = (p: Pt): CSSProperties => ({ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` });

/**
 * Your product in the middle, the tools it connects to on both sides. Pulses flow in from the left and
 * out to the right along curved beams. Hover or focus a tool to bring its beam forward; click it to pause
 * that beam. CSS-only motion that pauses offscreen; reduced motion shows the still scene.
 */
export function ToolBeam({ left = DEFAULT_LEFT, right = DEFAULT_RIGHT, hub, hubLabel = "Your app", caption, speed = 1, paused, className }: ToolBeamProps) {
  const root = useRef<HTMLDivElement>(null);
  const { live } = useLive(root, paused);
  const [focus, setFocus] = useState<string | null>(null);
  const [held, setHeld] = useState<Set<string>>(() => new Set());
  const l = left.slice(0, 4);
  const r = right.slice(0, 4);
  const seats = beamLayout(l.length, r.length);
  const tools = [...l, ...r].map((t, i) => ({ ...t, key: `${i < l.length ? "l" : "r"}:${t.name}`, seat: seats[i], hue: AGENT_PALETTE[i % AGENT_PALETTE.length] }));
  const period = 2.4 / Math.max(0.1, speed);
  const count = tools.length;
  const toggle = (k: string) =>
    setHeld((h) => {
      const next = new Set(h);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <div
      ref={root}
      data-kn-ill="tool-beam"
      data-live={live}
      role="group"
      aria-label={`${hubLabel} connected to ${tools.map((t) => t.name).join(", ")}`}
      className={cn("relative mx-auto w-full max-w-[560px] select-none [container-type:inline-size]", className)}
    >
      <style href="kn-tool-beam" precedence="default">
        {CSS}
      </style>
      <div className="relative aspect-[560/300] w-full">
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="absolute inset-0 size-full" fill="none">
          {tools.map((t, i) => {
            const dim = focus !== null && focus !== t.key;
            const on = focus === t.key;
            const hold = held.has(t.key);
            return (
              <g key={t.key} data-beam={t.key} data-hold={hold} style={{ opacity: dim ? 0.25 : 1, transition: "opacity 300ms var(--kn-ease-out)" }}>
                <path d={t.seat.d} stroke="currentColor" strokeOpacity={on ? 0.28 : 0.13} strokeWidth={on ? 1.6 : 1.25} />
                {/* Two pulses per beam: a soft wide one and a bright core, running the same dash. */}
                {[6, 2].map((w) => (
                  <path
                    key={w}
                    d={t.seat.d}
                    pathLength={100}
                    stroke={t.hue}
                    strokeWidth={w}
                    strokeOpacity={w === 6 ? 0.16 : hold ? 0.45 : 0.9}
                    strokeLinecap="round"
                    strokeDasharray="10 40"
                    style={{
                      animation: `kntb-flow ${(on ? period * 0.7 : period) * 2}s linear ${(-i * period * 0.37).toFixed(2)}s infinite`,
                      animationDirection: t.seat.side === "left" ? "normal" : "normal",
                    }}
                  />
                ))}
              </g>
            );
          })}
        </svg>

        {/* Hub */}
        <div className="absolute -translate-x-1/2 -translate-y-1/2" style={pct(HUB)} aria-hidden="true">
          <div
            className="absolute -inset-[5cqw] rounded-full [animation:kntb-halo_4s_ease-in-out_infinite]"
            style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${AGENT_PALETTE[0]} 22%, transparent), transparent)` }}
          />
          <div className={cn("relative grid size-[13cqw] place-items-center rounded-[3.8cqw] text-foreground", SURFACE)}>
            <span className="grid size-[6cqw] place-items-center [&>*]:size-full [&_svg]:size-full">{hub ?? <HubGlyph />}</span>
          </div>
        </div>
        <div className="absolute -translate-x-1/2" style={{ left: "50%", top: `${((HUB.y + 46) / H) * 100}%` }}>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-card px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_9%,transparent)] tabular-nums dark:[background:color-mix(in_srgb,var(--card)_78%,#000)]">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500 [animation:kntb-dot_2.4s_ease-in-out_infinite]" />
            {caption ?? `${count} connected`}
          </span>
        </div>

        {/* Tools */}
        {tools.map((t) => {
          const dim = focus !== null && focus !== t.key;
          const hold = held.has(t.key);
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={hold}
              aria-label={`${t.name}: ${hold ? "resume" : "pause"} its beam`}
              onPointerEnter={() => setFocus(t.key)}
              onPointerLeave={() => setFocus((f) => (f === t.key ? null : f))}
              onFocus={() => setFocus(t.key)}
              onBlur={() => setFocus((f) => (f === t.key ? null : f))}
              onClick={() => toggle(t.key)}
              style={{ ...pct(t.seat.at), ["--hue" as string]: t.hue }}
              className={cn(
                "absolute grid size-[9.4cqw] -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-[2.8cqw]",
                "transition-[opacity,scale,box-shadow] duration-300 ease-(--kn-ease-out) hover:scale-105 motion-reduce:transition-none",
                SURFACE,
                focusRing,
                dim && "opacity-40",
                hold && "[box-shadow:0_0_0_1.5px_color-mix(in_srgb,var(--hue)_55%,transparent)]",
              )}
            >
              {t.icon || toolIcon(t.name) ? (
                <span className="grid size-[4.4cqw] place-items-center [&>*]:size-full [&_svg]:size-full">{t.icon ?? toolIcon(t.name)}</span>
              ) : (
                <span className="text-[2.6cqw] font-semibold text-muted-foreground">{initials(t.name)}</span>
              )}
              {hold && (
                <span aria-hidden="true" className="absolute -right-[1cqw] -top-[1cqw] grid size-[3.6cqw] place-items-center rounded-full bg-foreground text-background">
                  <svg viewBox="0 0 12 12" className="size-[2cqw]" fill="currentColor">
                    <rect x="3" y="2.5" width="2" height="7" rx=".6" />
                    <rect x="7" y="2.5" width="2" height="7" rx=".6" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ToolBeam;
