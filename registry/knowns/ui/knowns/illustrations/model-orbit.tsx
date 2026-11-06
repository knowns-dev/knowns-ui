"use client";
/** @registry name="model-orbit" type="ui" title="Model orbit" description="Model logos orbiting an agent hub, with the active model linked and a smooth hand-over between models." */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn, focusRing } from "@/registry/knowns/lib/knowns/utils";
import { AGENT_PALETTE, initials } from "@/registry/knowns/lib/knowns/status";
import { modelIcon } from "@/registry/knowns/lib/knowns/icons/model-icons";
import type { Pt } from "./illust-utils";
import { MOTION_GATE, useLive } from "./use-in-view";

export interface OrbitModel {
  /** Label, e.g. "Claude". Also the key for `active`. */
  name: string;
  /** Passed to modelIcon(), e.g. "Opus 5.5". Default: the name. */
  model?: string;
  icon?: ReactNode;
}

export type OrbitSize = "sm" | "md" | "lg";

export interface ModelOrbitProps {
  /** 2–8 models on the ring. */
  models?: OrbitModel[];
  /** Name of the model the agent is using (controlled). Leave it out to let the orbit hand over by itself. */
  active?: string;
  /** Called when the active model changes (a click, or the automatic hand-over). */
  onActiveChange?: (name: string) => void;
  /** Seconds on each model before handing over. 0 stops the automatic hand-over. Default 3.6. */
  cycle?: number;
  /** Seconds for one turn of the ring. 0 holds it still. Default 64. */
  spin?: number;
  /** The agent's tile in the middle. Default a neutral hub mark. */
  hub?: ReactNode;
  /** Name of the agent, for the label and the caption. Default "Agent". */
  hubLabel?: string;
  /** Pill under the hub. Default the active model's name. false hides it. */
  caption?: ReactNode | false;
  /** Max width: 280, 380, 480 px or a number. Default "md". */
  size?: OrbitSize | number;
  paused?: boolean;
  className?: string;
}

const DEFAULT_MODELS: OrbitModel[] = [
  { name: "Claude", model: "Opus 5.5" },
  { name: "GPT", model: "GPT-5" },
  { name: "Gemini", model: "Gemini 2.5 Pro" },
  { name: "Llama", model: "Llama" },
  { name: "Mistral", model: "Mistral" },
  { name: "DeepSeek", model: "DeepSeek" },
];

const S = 400;
const C: Pt = { x: S / 2, y: S / 2 };
const R = 148;
const HUB_R = 40;
const CHIP_R = 28;
const WIDTH: Record<OrbitSize, number> = { sm: 280, md: 380, lg: 480 };
const EASE = "cubic-bezier(.22,1,.36,1)";

/** Seat angles (degrees, 0 = up, clockwise) for n models evenly around the ring. */
export function orbitAngles(n: number): number[] {
  const k = Math.max(0, Math.min(8, n));
  return Array.from({ length: k }, (_, i) => (i * 360) / k);
}

/** Point on a circle of radius r around the centre, at `deg` (0 = up, clockwise). */
export function onRing(deg: number, r = R): Pt {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: C.x + r * Math.cos(a), y: C.y + r * Math.sin(a) };
}

const f = (n: number) => +n.toFixed(1);

/** Straight beam from the hub's edge out to the chip's edge at `deg`. */
export function beamPath(deg: number): string {
  const a = onRing(deg, HUB_R + 6);
  const b = onRing(deg, R - CHIP_R - 4);
  return `M ${f(a.x)} ${f(a.y)} L ${f(b.x)} ${f(b.y)}`;
}

/** Arc along the ring from one seat to another, the short way round. */
export function handoverArc(from: number, to: number): string {
  let d = (((to - from) % 360) + 360) % 360;
  if (d > 180) d -= 360;
  const a = onRing(from);
  const b = onRing(from + d);
  const large = Math.abs(d) > 180 ? 1 : 0;
  const sweep = d >= 0 ? 1 : 0;
  return `M ${f(a.x)} ${f(a.y)} A ${R} ${R} 0 ${large} ${sweep} ${f(b.x)} ${f(b.y)}`;
}

/** Index of the next model after `name` (wraps; unknown names start at 0). */
export function nextModel(models: OrbitModel[], name: string | undefined): number {
  if (!models.length) return -1;
  const i = models.findIndex((m) => m.name === name);
  return i < 0 ? 0 : (i + 1) % models.length;
}

const CSS = `
@keyframes knmo-spin { to { transform: rotate(360deg) } }
@keyframes knmo-draw { from { stroke-dashoffset: 100 } to { stroke-dashoffset: 0 } }
@keyframes knmo-release { from { stroke-dashoffset: 0; opacity: 1 } to { stroke-dashoffset: -100; opacity: 1 } }
@keyframes knmo-flow { from { stroke-dashoffset: 0 } to { stroke-dashoffset: -100 } }
@keyframes knmo-arc { 0% { stroke-dashoffset: 16; opacity: 0 } 15% { opacity: 1 } 85% { opacity: 1 } 100% { stroke-dashoffset: -100; opacity: 0 } }
@keyframes knmo-in { from { opacity: 0; transform: scale(.9) } to { opacity: 1; transform: scale(1) } }
[data-kn-ill="model-orbit"]:hover [data-spin] { animation-play-state: paused; }
${MOTION_GATE}
`;

const SURFACE =
  "bg-card shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_10%,transparent),0_1px_2px_rgb(0_0_0/0.06),0_6px_18px_-10px_rgb(0_0_0/0.25)] dark:[background:color-mix(in_srgb,var(--card)_78%,#000)]";

function HubGlyph() {
  // A neutral hub mark: a core with three spokes; pass `hub` for your own.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5v3.3M19.4 16.3l-2.9-1.6M4.6 16.3l2.9-1.6" />
      <circle cx="12" cy="12" r="8.5" strokeOpacity={0.35} strokeDasharray="2 3" />
    </svg>
  );
}

const pct = (p: Pt): CSSProperties => ({ left: `${(p.x / S) * 100}%`, top: `${(p.y / S) * 100}%` });

/**
 * Model logos orbiting an agent hub. A beam links the hub to the model in use; on a hand-over the old
 * beam lets go, a spark runs along the ring to the next model, and its beam draws out from the hub.
 * Hands over by itself every `cycle` seconds, or follow your agent with `active`. Click a model to pick
 * it. CSS motion that pauses offscreen and in hidden tabs; reduced motion shows a still ring with the
 * active link.
 */
export function ModelOrbit({
  models = DEFAULT_MODELS,
  active,
  onActiveChange,
  cycle = 3.6,
  spin = 64,
  hub,
  hubLabel = "Agent",
  caption,
  size = "md",
  paused,
  className,
}: ModelOrbitProps) {
  const root = useRef<HTMLDivElement>(null);
  const { live, reduced } = useLive(root, paused);
  const list = models.slice(0, 8);
  const angles = orbitAngles(list.length);
  const [own, setOwn] = useState(list[0]?.name);
  const current = active ?? own;
  const idx = Math.max(0, list.findIndex((m) => m.name === current));
  const on = list[idx];

  // The previous model, kept briefly so its beam can let go and the spark can run to the new one.
  const [prev, setPrev] = useState<{ from: number; to: number; n: number } | null>(null);
  const seen = useRef(idx);
  useEffect(() => {
    if (seen.current === idx) return;
    const from = seen.current;
    seen.current = idx;
    setPrev((p) => ({ from, to: idx, n: (p?.n ?? 0) + 1 }));
    const t = setTimeout(() => setPrev(null), 900);
    return () => clearTimeout(t);
  }, [idx]);

  const pick = (name: string) => {
    if (active === undefined) setOwn(name);
    onActiveChange?.(name);
  };

  // Automatic hand-over, only while moving; restarts after every change (including a click).
  const pickRef = useRef(pick);
  pickRef.current = pick;
  useEffect(() => {
    if (!live || cycle <= 0 || list.length < 2) return;
    const t = setTimeout(() => {
      const next = list[nextModel(list, current)];
      if (next) pickRef.current(next.name);
    }, cycle * 1000);
    return () => clearTimeout(t);
  }, [live, cycle, current, list.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const width = typeof size === "number" ? size : WIDTH[size];
  const hueOf = (i: number) => AGENT_PALETTE[i % AGENT_PALETTE.length];
  const hue = hueOf(idx);
  const spinning = spin > 0 && !reduced;
  const spinStyle = (dir: "normal" | "reverse"): CSSProperties | undefined =>
    spinning ? { animation: `knmo-spin ${spin}s linear infinite ${dir}` } : undefined;
  const pill = caption === false ? null : (caption ?? (on ? on.name : null));

  return (
    <div
      ref={root}
      data-kn-ill="model-orbit"
      data-live={live}
      role="group"
      aria-label={`${hubLabel} using ${on?.name ?? "no model"}, among ${list.map((m) => m.name).join(", ")}`}
      className={cn("relative mx-auto w-full select-none [container-type:inline-size]", className)}
      style={{ maxWidth: width }}
    >
      <style href="kn-model-orbit" precedence="default">
        {CSS}
      </style>
      <div className="relative aspect-square w-full">
        {/* Static rings */}
        <svg viewBox={`0 0 ${S} ${S}`} aria-hidden="true" className="absolute inset-0 size-full" fill="none">
          <circle cx={C.x} cy={C.y} r={R} stroke="currentColor" strokeOpacity={0.09} />
          <circle cx={C.x} cy={C.y} r={R * 0.62} stroke="currentColor" strokeOpacity={0.07} strokeDasharray="2 6" />
        </svg>

        {/* The turning layer: beams, the hand-over spark and the chips all ride on it. */}
        <div data-spin="" className="absolute inset-0" style={spinStyle("normal")}>
          <svg viewBox={`0 0 ${S} ${S}`} aria-hidden="true" className="absolute inset-0 size-full overflow-visible" fill="none">
            {prev && !reduced && (
              <g key={`h${prev.n}`}>
                {/* The old beam lets go from the hub outward. */}
                <path
                  d={beamPath(angles[prev.from] ?? 0)}
                  pathLength={100}
                  stroke={hueOf(prev.from)}
                  strokeOpacity={0.5}
                  strokeWidth={1.4}
                  strokeDasharray="100 100"
                  strokeLinecap="round"
                  style={{ opacity: 0, animation: `knmo-release 500ms ${EASE} forwards` }}
                />
                {/* A spark runs along the ring to the next model. */}
                {[7, 2.4].map((w) => (
                  <path
                    key={w}
                    d={handoverArc(angles[prev.from] ?? 0, angles[prev.to] ?? 0)}
                    pathLength={100}
                    stroke={hue}
                    strokeWidth={w}
                    strokeOpacity={w > 3 ? 0.18 : 0.95}
                    strokeLinecap="round"
                    strokeDasharray="16 200"
                    style={{ opacity: 0, animation: `knmo-arc 700ms ${EASE} forwards` }}
                  />
                ))}
              </g>
            )}
            {on && (
              <g key={`b${idx}`}>
                {/* The active beam draws out from the hub (after the spark lands, on a hand-over). */}
                <path
                  d={beamPath(angles[idx])}
                  pathLength={100}
                  stroke={hue}
                  strokeOpacity={0.55}
                  strokeWidth={1.4}
                  strokeDasharray="100 100"
                  strokeLinecap="round"
                  style={{ animation: `knmo-draw 520ms ${EASE} ${prev ? 380 : 0}ms both` }}
                />
                {/* Traffic: a streak running out along the beam. */}
                <path
                  d={beamPath(angles[idx])}
                  pathLength={100}
                  stroke={hue}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeDasharray="12 88"
                  strokeOpacity={0}
                  style={reduced ? undefined : { strokeOpacity: 0.9, animation: `knmo-flow 1.5s linear ${prev ? 900 : 520}ms infinite`, strokeDashoffset: 12 }}
                />
              </g>
            )}
          </svg>

          {list.map((m, i) => {
            const isOn = i === idx;
            const logo = m.icon ?? modelIcon(m.model ?? m.name);
            return (
              <div key={m.name} className="absolute -translate-x-1/2 -translate-y-1/2" style={pct(onRing(angles[i]))}>
                <div data-spin="" style={spinStyle("reverse")}>
                  <button
                    type="button"
                    aria-pressed={isOn}
                    aria-label={`Use ${m.name}`}
                    onClick={() => pick(m.name)}
                    style={{ ["--hue" as string]: hueOf(i), transitionDelay: isOn && prev ? "380ms" : "0ms" }}
                    className={cn(
                      "relative grid size-[14cqw] cursor-pointer place-items-center rounded-full text-foreground",
                      "transition-[opacity,scale,box-shadow] duration-500 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none",
                      SURFACE,
                      focusRing,
                      isOn
                        ? "scale-[1.14] [box-shadow:0_0_0_1.5px_color-mix(in_srgb,var(--hue)_65%,transparent),0_0_0_6px_color-mix(in_srgb,var(--hue)_12%,transparent),0_10px_24px_-12px_var(--hue)]"
                        : "opacity-70 hover:scale-105 hover:opacity-100",
                    )}
                  >
                    {logo ? (
                      <span className="grid size-[6.6cqw] place-items-center [&>*]:size-full [&_svg]:size-full">{logo}</span>
                    ) : (
                      <span className="text-[3.6cqw] font-semibold tracking-tight">{initials(m.name)}</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hub (does not turn) */}
        <div className="absolute -translate-x-1/2 -translate-y-1/2" style={pct(C)} aria-hidden="true">
          <div
            key={`g${idx}`}
            className="absolute -inset-[7cqw] rounded-full [animation:knmo-in_600ms_ease-out_both]"
            style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${hue} 24%, transparent), transparent)` }}
          />
          <div className={cn("relative grid size-[20cqw] place-items-center rounded-[5.5cqw]", SURFACE)}>
            <span className="grid size-[8.4cqw] place-items-center text-foreground [&>*]:size-full [&_svg]:size-full">{hub ?? <HubGlyph />}</span>
          </div>
        </div>
        {pill && (
          <div className="absolute -translate-x-1/2" style={{ left: "50%", top: `${((C.y + HUB_R + 18) / S) * 100}%` }}>
            <span
              key={`c${idx}`}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-card px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_9%,transparent)] [animation:knmo-in_400ms_ease-out_both] dark:[background:color-mix(in_srgb,var(--card)_78%,#000)]"
            >
              <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: hue }} />
              {pill}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ModelOrbit;
