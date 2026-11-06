"use client";
/** @registry name="model-reel" type="ui" title="Model reel" description="Model logos and names drifting in a calm marquee, one or two rows." */

import { useRef, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { modelIcon } from "@/registry/knowns/lib/knowns/icons/model-icons";
import { MOTION_GATE, useLive } from "./use-in-view";

export interface ReelModel {
  /** Label on the chip, e.g. "Claude". */
  name: string;
  /** Passed to modelIcon(), e.g. "Opus 5.5". Default: the name. */
  model?: string;
  icon?: ReactNode;
}

export interface ModelReelProps {
  models?: ReelModel[];
  /** One row, or two running in opposite directions (the second starts halfway through the list). */
  rows?: 1 | 2;
  /** Seconds for one full pass of the list. Default 32. */
  duration?: number;
  paused?: boolean;
  /** Accessible description. Default lists the models. */
  label?: string;
  className?: string;
}

const DEFAULT_MODELS: ReelModel[] = [
  { name: "Claude", model: "Opus 5.5" },
  { name: "GPT", model: "GPT-5" },
  { name: "Gemini", model: "Gemini 2.5 Pro" },
  { name: "Llama", model: "Llama" },
  { name: "Mistral", model: "Mistral" },
  { name: "DeepSeek", model: "DeepSeek" },
  { name: "Qwen", model: "Qwen" },
  { name: "Grok", model: "Grok" },
  { name: "Kimi", model: "Kimi" },
];

const CSS = `
@keyframes knmr-run { from { transform: translateX(0) } to { transform: translateX(-50%) } }
[data-kn-ill="model-reel"]:hover [data-reel-track] { animation-play-state: paused; }
${MOTION_GATE}
`;

/** The list rotated by `by` places (row two starts mid-list so the rows never line up). */
export function rotate<T>(list: T[], by: number): T[] {
  if (!list.length) return list;
  const k = ((by % list.length) + list.length) % list.length;
  return [...list.slice(k), ...list.slice(0, k)];
}

function Chip({ m }: { m: ReelModel }) {
  const logo = m.icon ?? modelIcon(m.model ?? m.name);
  return (
    <span className="inline-flex h-9 flex-none items-center gap-2 rounded-full bg-card px-3.5 text-[13.5px] font-medium tracking-tight text-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_9%,transparent),0_1px_2px_rgb(0_0_0/0.05)] dark:[background:color-mix(in_srgb,var(--card)_80%,#000)]">
      {logo && <span className="grid size-[18px] place-items-center [&_svg]:size-full">{logo}</span>}
      {m.name}
    </span>
  );
}

/**
 * Model chips with provider logos drifting past, one or two rows, fading at the edges. Hover holds it.
 * CSS transform only; pauses offscreen and in hidden tabs; reduced motion shows a still row.
 */
export function ModelReel({ models = DEFAULT_MODELS, rows = 1, duration = 32, paused, label, className }: ModelReelProps) {
  const root = useRef<HTMLDivElement>(null);
  const { live } = useLive(root, paused);
  const lines = rows === 2 ? [models, rotate(models, Math.floor(models.length / 2))] : [models];
  return (
    <div
      ref={root}
      data-kn-ill="model-reel"
      data-live={live}
      role="img"
      aria-label={label ?? `Works with ${models.map((m) => m.name).join(", ")}`}
      className={cn("flex w-full select-none flex-col gap-3 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]", className)}
    >
      <style href="kn-model-reel" precedence="default">
        {CSS}
      </style>
      {lines.map((list, r) => (
        <div key={r} aria-hidden="true" className="flex w-max">
          {/* Two copies: sliding by half the track lands exactly on the start again. */}
          <div
            data-reel-track=""
            className="flex w-max gap-3 pr-3"
            style={{ animation: `knmr-run ${duration}s linear infinite`, animationDirection: r === 1 ? "reverse" : "normal" }}
          >
            {[...list, ...list].map((m, i) => (
              <Chip key={`${m.name}-${i}`} m={m} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ModelReel;
