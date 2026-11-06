"use client";
/** @registry name="run-pulse" type="ui" title="Run pulse" description="A small living agent graph for heroes: streaks from lead to agents to tools, nodes that grow in." */

import { useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { AGENT_PALETTE, initials, rootAgent } from "@/registry/knowns/lib/knowns/status";
import { useAgentSnapshot, type AgentRun } from "@/registry/knowns/lib/knowns/run";
import { modelIcon } from "@/registry/knowns/lib/knowns/icons/model-icons";
import { toolIcon } from "@/registry/knowns/lib/knowns/icons/tool-icons";
import { MOTION_GATE, useLive } from "./use-in-view";

export interface PulseAgent {
  name: string;
  /** Model name ("GPT-5", "Sonnet 5.5"): picks the provider logo. */
  model?: string;
  icon?: ReactNode;
}

export interface PulseTool {
  name: string;
  icon?: ReactNode;
  /** Agent that uses it: index or name. Default: spread round-robin. */
  agent?: number | string;
}

export type PulseSize = "sm" | "md" | "lg";

export interface RunPulseProps {
  lead?: PulseAgent;
  /** 1–5 agents around the lead. */
  agents?: PulseAgent[];
  /** Tools further out, each attached to an agent. Up to 3 per agent are drawn. */
  tools?: PulseTool[];
  /** A node that grows in now and then (line draws, then the tile). `false` to turn off. */
  grow?: PulseTool | false;
  /** Playback speed. 1 = a 3.6s cycle. */
  speed?: number;
  paused?: boolean;
  /** sm 320px, md 480px, lg 640px wide, or a max width in px. It scales down with its container. */
  size?: PulseSize | number;
  /** Drive it from a real run: actors become tiles and every new call fires a streak (no loop). */
  run?: AgentRun;
  /** Accessible description. Default describes the team. */
  label?: string;
  className?: string;
}

const W = 480;
const H = 300;
const C = { x: W / 2, y: H / 2 };
const WIDTH: Record<PulseSize, number> = { sm: 320, md: 480, lg: 640 };

const DEFAULT_LEAD: PulseAgent = { name: "Lead", model: "Opus 5.5" };
const DEFAULT_AGENTS: PulseAgent[] = [
  { name: "Researcher", model: "Gemini 2.5 Pro" },
  { name: "Writer", model: "GPT-5" },
  { name: "Coder", model: "Sonnet 5.5" },
  { name: "Reviewer", model: "Haiku 5.5" },
];
const DEFAULT_TOOLS: PulseTool[] = [
  { name: "Web search", agent: 0 },
  { name: "Notion", agent: 0 },
  { name: "Slack", agent: 1 },
  { name: "GitHub", agent: 2 },
  { name: "Postgres", agent: 2 },
  { name: "Linear", agent: 3 },
];
const DEFAULT_GROW: PulseTool = { name: "Figma" };

export interface Pt {
  x: number;
  y: number;
}

export interface PulseLayout {
  agents: Pt[];
  /** tools[i][j]: the j-th tool of agent i. */
  tools: Pt[][];
  /** Seat for the growing node, next to the agent with the fewest tools. */
  grow: { agent: number; at: Pt };
}

const onEllipse = (deg: number, rx: number, ry: number): Pt => {
  const r = (deg * Math.PI) / 180;
  return { x: C.x + Math.cos(r) * rx, y: C.y + Math.sin(r) * ry };
};

/**
 * Seats in a 480×300 box: agents evenly on an inner ellipse (rotated so none sits straight above the
 * lead), each agent's tools fanned around its direction on an outer ellipse.
 */
export function pulseLayout(agentCount: number, toolsPerAgent: number[]): PulseLayout {
  const n = Math.max(1, Math.min(5, agentCount));
  const start = -90 + 180 / n;
  const angle = (i: number) => start + (i * 360) / n;
  const agents = Array.from({ length: n }, (_, i) => onEllipse(angle(i), 122, 84));
  const fan = 17;
  const tools = agents.map((_, i) => {
    const k = Math.min(3, toolsPerAgent[i] ?? 0);
    return Array.from({ length: k }, (_, j) => onEllipse(angle(i) + (j - (k - 1) / 2) * fan, 202, 128));
  });
  let fewest = 0;
  tools.forEach((t, i) => t.length < tools[fewest].length && (fewest = i));
  const k = tools[fewest].length;
  return { agents, tools, grow: { agent: fewest, at: onEllipse(angle(fewest) + ((k + 1) / 2) * fan * (k ? 1 : 0), 202, 128) } };
}

/** A gently bent path between two seats (bends clockwise, so crossing links separate). */
export function bend(a: Pt, b: Pt, amount = 0.12): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const nx = -(b.y - a.y) * amount;
  const ny = (b.x - a.x) * amount;
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${(mx + nx).toFixed(1)} ${(my + ny).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

/** Tools grouped by agent: explicit `agent` first, the rest round-robin. */
export function assignTools(tools: PulseTool[], agents: PulseAgent[]): PulseTool[][] {
  const n = Math.max(1, Math.min(5, agents.length));
  const groups: PulseTool[][] = Array.from({ length: n }, () => []);
  let rr = 0;
  for (const t of tools) {
    let i = typeof t.agent === "number" ? t.agent : typeof t.agent === "string" ? agents.findIndex((a) => a.name === t.agent) : -1;
    if (i < 0 || i >= n) {
      // Round-robin over agents that still have room.
      for (let k = 0; k < n && groups[rr % n].length >= 3; k++) rr++;
      i = rr++ % n;
    }
    if (groups[i].length < 3) groups[i].push(t);
  }
  return groups;
}

const pct = (p: Pt): CSSProperties => ({ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` });

/* Keyframes are namespaced and shipped with the component (React dedupes the style by href). */
const CSS = `
@keyframes knrp-streak { 0% { stroke-dashoffset: 12; opacity: 0 } 3% { opacity: 1 } 38% { stroke-dashoffset: -100; opacity: 1 } 39%, 100% { stroke-dashoffset: -100; opacity: 0 } }
@keyframes knrp-shot { 0% { stroke-dashoffset: 12; opacity: 0 } 8% { opacity: 1 } 92% { opacity: 1 } 100% { stroke-dashoffset: -100; opacity: 0 } }
@keyframes knrp-arrive { 0%, 34% { opacity: 0; transform: scale(.92) } 40% { opacity: .9; transform: scale(1) } 70%, 100% { opacity: 0; transform: scale(1.4) } }
@keyframes knrp-arrive-once { 0% { opacity: 0; transform: scale(.92) } 15% { opacity: .9; transform: scale(1) } 100% { opacity: 0; transform: scale(1.4) } }
@keyframes knrp-breathe { 0%, 100% { opacity: .55; transform: scale(.94) } 50% { opacity: .9; transform: scale(1.06) } }
@keyframes knrp-grow-line { 0%, 8% { stroke-dashoffset: 100; opacity: 1 } 20% { stroke-dashoffset: 0 } 82% { stroke-dashoffset: 0; opacity: 1 } 90%, 100% { stroke-dashoffset: 0; opacity: 0 } }
@keyframes knrp-grow-tile { 0%, 18% { opacity: 0; transform: scale(0) } 25% { opacity: 1; transform: scale(1.1) } 29% { transform: scale(1) } 82% { opacity: 1; transform: scale(1) } 90%, 100% { opacity: 0; transform: scale(.85) } }
${MOTION_GATE}
`;

/* Tile sizes as a share of the width, so the scene scales with its container (container query units). */
const TILE = {
  lead: "size-[12.5cqw] rounded-[3.6cqw]",
  agent: "size-[8.6cqw] rounded-[2.7cqw]",
  tool: "size-[5.8cqw] rounded-[1.9cqw]",
};
/* Logos fill their box (modelIcon / toolIcon render size-full), so each sits in a box sized per tile. */
const MARK = { lead: "size-[5.6cqw]", agent: "size-[4cqw]", tool: "size-[3cqw]" };
function Mark({ kind, children }: { kind: keyof typeof MARK; children: ReactNode }) {
  return <span className={cn("grid place-items-center [&>*]:size-full [&_svg]:size-full", MARK[kind])}>{children}</span>;
}
const SURFACE =
  "bg-card [border:1px_solid_color-mix(in_srgb,var(--foreground)_10%,transparent)] shadow-[0_1px_2px_rgb(0_0_0/0.06),0_6px_18px_-10px_rgb(0_0_0/0.25)] dark:[background:color-mix(in_srgb,var(--card)_78%,#000)]";

function Glyph({ agent, kind }: { agent: PulseAgent; kind: "lead" | "agent" }) {
  const logo = agent.icon ?? modelIcon(agent.model);
  if (logo) return <Mark kind={kind}>{logo}</Mark>;
  return <span className={cn("font-semibold tracking-tight text-muted-foreground", kind === "lead" ? "text-[3.4cqw]" : "text-[2.6cqw]")}>{initials(agent.name)}</span>;
}

function toolLogo(t: PulseTool) {
  const logo = t.icon ?? toolIcon(t.name);
  return logo ? <Mark kind="tool">{logo}</Mark> : <span className="text-[2cqw] font-semibold text-muted-foreground">{initials(t.name)}</span>;
}

interface Node {
  id: string;
  kind: "lead" | "agent" | "tool";
  at: Pt;
  hue: string;
  agent?: PulseAgent;
  tool?: PulseTool;
}

interface Link {
  id: string;
  from: string;
  to: string;
  d: string;
  hue: string;
  /** Loop delay in cycle fractions. */
  delay: number;
}

/**
 * A small living agent graph for heroes and feature sections: the lead in the middle with a soft glow,
 * agents around it, their tools further out. Light streaks run lead → agents → tools, each arrival
 * glows, and now and then a new tool grows in. Animated with CSS only; pauses offscreen, in hidden
 * tabs and on `paused`; prefers-reduced-motion shows a still, composed frame.
 */
export function RunPulse({
  lead = DEFAULT_LEAD,
  agents = DEFAULT_AGENTS,
  tools = DEFAULT_TOOLS,
  grow = DEFAULT_GROW,
  speed = 1,
  paused,
  size = "md",
  run,
  label,
  className,
}: RunPulseProps) {
  const root = useRef<HTMLDivElement>(null);
  const { live } = useLive(root, paused);
  const snap = useAgentSnapshot(run);

  // From a run: the root agent leads, other agents orbit, tools hang off the agent that called them.
  const scene = useMemo(() => {
    if (!snap) return { lead, agents: agents.slice(0, 5), groups: assignTools(tools, agents.slice(0, 5)), ids: null as null | { lead: string; agents: string[]; tools: string[][] } };
    const r = rootAgent(snap.actors);
    const others = snap.actors.filter((a) => a.type === "agent" && a !== r).slice(0, 5);
    const toolActors = snap.actors.filter((a) => a.type === "tool");
    const caller = (toolId: string) => {
      const s = [...snap.spans].reverse().find((x) => x.to === toolId && others.some((o) => o.id === x.from));
      return s ? others.findIndex((o) => o.id === s.from) : -1;
    };
    const groups: PulseTool[][] = others.map(() => []);
    const toolIds: string[][] = others.map(() => []);
    for (const t of toolActors) {
      const i = caller(t.id);
      if (i >= 0 && groups[i].length < 3) {
        groups[i].push({ name: t.label, icon: t.icon });
        toolIds[i].push(t.id);
      }
    }
    return {
      lead: r ? { name: r.label, model: r.model, icon: r.icon } : lead,
      agents: others.map((a) => ({ name: a.label, model: a.model, icon: a.icon })),
      groups,
      ids: { lead: r?.id ?? "", agents: others.map((a) => a.id), tools: toolIds },
    };
  }, [snap, lead, agents, tools]);

  const layout = pulseLayout(scene.agents.length, scene.groups.map((g) => g.length));
  const period = 3.6 / Math.max(0.1, speed);
  const n = scene.agents.length;

  const nodes: Node[] = [];
  const links: Link[] = [];
  const idOf = (kind: "lead" | "agent" | "tool", i = 0, j = 0) =>
    scene.ids ? (kind === "lead" ? scene.ids.lead : kind === "agent" ? scene.ids.agents[i] : scene.ids.tools[i][j]) : kind === "lead" ? "lead" : kind === "agent" ? `a${i}` : `t${i}.${j}`;
  nodes.push({ id: idOf("lead"), kind: "lead", at: C, hue: AGENT_PALETTE[0], agent: scene.lead });
  scene.agents.forEach((a, i) => {
    const hue = AGENT_PALETTE[(i + 1) % AGENT_PALETTE.length];
    const id = idOf("agent", i);
    nodes.push({ id, kind: "agent", at: layout.agents[i], hue, agent: a });
    const start = i / Math.max(1, n);
    links.push({ id: `${idOf("lead")}>${id}`, from: idOf("lead"), to: id, d: bend(C, layout.agents[i]), hue, delay: start });
    scene.groups[i].forEach((t, j) => {
      const tid = idOf("tool", i, j);
      nodes.push({ id: tid, kind: "tool", at: layout.tools[i][j], hue, tool: t });
      links.push({ id: `${id}>${tid}`, from: id, to: tid, d: bend(layout.agents[i], layout.tools[i][j], 0.08), hue, delay: start + 0.4 + j * 0.07 });
    });
  });
  const byId = new Map(nodes.map((x) => [x.id, x]));

  // Live mode: one streak per recent call between drawn nodes, keyed by span id (plays once).
  const shots = snap
    ? snap.spans
        .slice(-40)
        .filter((s) => byId.has(s.from) && byId.has(s.to))
        .map((s) => ({ id: s.id, from: byId.get(s.from)!, to: byId.get(s.to)! }))
    : [];
  const lastArrival = new Map<string, string>();
  for (const s of shots) lastArrival.set(s.to.id, s.id);

  const growing = !snap && grow ? { tool: grow, at: layout.grow.at, from: layout.agents[layout.grow.agent], hue: AGENT_PALETTE[(layout.grow.agent + 1) % AGENT_PALETTE.length] } : null;
  const toolCount = scene.groups.reduce((a, g) => a + g.length, 0);
  const width = typeof size === "number" ? size : WIDTH[size];

  return (
    <div
      ref={root}
      data-kn-ill="run-pulse"
      data-live={live}
      role="img"
      aria-label={label ?? `${scene.lead.name} coordinating ${n} ${n === 1 ? "agent" : "agents"} and ${toolCount} ${toolCount === 1 ? "tool" : "tools"}`}
      style={{ maxWidth: width, ["--period" as string]: `${period}s` }}
      className={cn("relative mx-auto w-full select-none [container-type:inline-size]", className)}
    >
      <style href="kn-run-pulse" precedence="default">
        {CSS}
      </style>
      <div aria-hidden="true" className="relative aspect-[480/300] w-full">
        {/* Soft hue glow behind the lead. */}
        <div
          className="absolute size-[34cqw] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 [animation:knrp-breathe_calc(var(--period)*1.5)_ease-in-out_infinite] dark:opacity-60"
          style={{ ...pct(C), background: `radial-gradient(closest-side, color-mix(in srgb, ${AGENT_PALETTE[0]} 26%, transparent), transparent)` }}
        />

        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full overflow-visible" fill="none">
          {links.map((l) => (
            <path key={l.id} d={l.d} stroke={l.hue} strokeOpacity={0.22} strokeWidth={1.2} strokeDasharray={l.from === idOf("lead") ? undefined : "2 4"} strokeLinecap="round" />
          ))}
          {growing && (
            <path
              d={bend(growing.from, growing.at, 0.08)}
              pathLength={100}
              stroke={growing.hue}
              strokeOpacity={0.35}
              strokeWidth={1.2}
              strokeDasharray="100 100"
              strokeLinecap="round"
              style={{ animation: `knrp-grow-line calc(var(--period) * 4) ease-out infinite` }}
            />
          )}
          {/* Looping streaks: a short dash running the path, with a wider faint copy as its glow. */}
          {!snap &&
            links.map((l) =>
              [5, 2].map((w) => (
                <path
                  key={`${l.id}:${w}`}
                  d={l.d}
                  pathLength={100}
                  stroke={l.hue}
                  strokeWidth={w}
                  strokeOpacity={w === 5 ? 0.18 : 0.95}
                  strokeLinecap="round"
                  strokeDasharray="12 120"
                  strokeDashoffset={12}
                  style={{ opacity: 0, animation: `knrp-streak var(--period) cubic-bezier(.45,.05,.35,1) calc(var(--period) * ${l.delay.toFixed(3)}) infinite` }}
                />
              )),
            )}
          {shots.map((s) =>
            [5, 2].map((w) => (
              <path
                key={`${s.id}:${w}`}
                d={bend(s.from.at, s.to.at, s.from.kind === "lead" ? 0.12 : 0.08)}
                pathLength={100}
                stroke={s.to.kind === "tool" ? s.from.hue : s.to.hue}
                strokeWidth={w}
                strokeOpacity={w === 5 ? 0.18 : 0.95}
                strokeLinecap="round"
                strokeDasharray="12 120"
                strokeDashoffset={12}
                style={{ opacity: 0, animation: `knrp-shot calc(var(--period) * .38) cubic-bezier(.45,.05,.35,1) both` }}
              />
            )),
          )}
        </svg>

        {nodes.map((node) => {
          const inbound = links.find((l) => l.to === node.id);
          const shot = lastArrival.get(node.id);
          return (
            <div key={node.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ ...pct(node.at), ["--hue" as string]: node.hue }}>
              <div className={cn("relative grid place-items-center", TILE[node.kind], SURFACE, node.kind === "lead" && "[box-shadow:0_0_0_1px_color-mix(in_srgb,var(--hue)_30%,transparent),0_10px_30px_-12px_color-mix(in_srgb,var(--hue)_60%,transparent)]")}>
                {node.kind === "tool" ? (
                  toolLogo(node.tool!)
                ) : (
                  <Glyph agent={node.agent!} kind={node.kind} />
                )}
                {/* Arrival glow: peaks when the streak lands. */}
                {(inbound && !snap) || shot ? (
                  <span
                    key={shot}
                    className="pointer-events-none absolute -inset-[0.6cqw] rounded-[inherit] opacity-0 [border:1.5px_solid_var(--hue)] [box-shadow:0_0_14px_color-mix(in_srgb,var(--hue)_45%,transparent)]"
                    style={{
                      animation: shot
                        ? `knrp-arrive-once calc(var(--period) * .5) ease-out calc(var(--period) * .3) both`
                        : `knrp-arrive var(--period) ease-out calc(var(--period) * ${inbound!.delay.toFixed(3)}) infinite`,
                    }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}

        {growing && (
          <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ ...pct(growing.at), ["--hue" as string]: growing.hue }}>
            <div className={cn("grid place-items-center", TILE.tool, SURFACE)} style={{ animation: `knrp-grow-tile calc(var(--period) * 4) cubic-bezier(.2,.8,.2,1) infinite` }}>
              {toolLogo(growing.tool)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RunPulse;
