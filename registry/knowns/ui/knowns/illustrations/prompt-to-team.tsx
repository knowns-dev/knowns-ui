"use client";
/** @registry name="prompt-to-team" type="ui" title="Prompt to team" description="A prompt types itself and branches into a team of agents with roles, models and tools." */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { AGENT_PALETTE, initials } from "@/registry/knowns/lib/knowns/status";
import { modelIcon } from "@/registry/knowns/lib/knowns/icons/model-icons";
import { toolIcon } from "@/registry/knowns/lib/knowns/icons/tool-icons";
import { MOTION_GATE, useLive } from "./use-in-view";

export interface TeamAgent {
  /** What the agent does: "Researcher", "Writer"… */
  role: string;
  /** Model name for the logo: "Gemini 2.5 Pro", "GPT-5"… */
  model?: string;
  /** Tool names, shown as logos (up to 3). */
  tools?: string[];
  icon?: ReactNode;
}

export interface PromptToTeamProps {
  prompt?: string;
  /** 2–4 agents. */
  team?: TeamAgent[];
  /** Milliseconds per typed character. Default 34. */
  typeSpeed?: number;
  paused?: boolean;
  className?: string;
}

const DEFAULT_TEAM: TeamAgent[] = [
  { role: "Researcher", model: "Gemini 2.5 Pro", tools: ["Web search", "Notion"] },
  { role: "Analyst", model: "Sonnet 5.5", tools: ["Postgres"] },
  { role: "Writer", model: "GPT-5", tools: ["Google Drive", "Slack"] },
];

export type TeamPhase = "typing" | "send" | "branch" | "team" | "out";

/** How long each phase lasts before the next (typing is driven per character). */
export const PHASE_MS: Record<Exclude<TeamPhase, "typing">, number> = { send: 520, branch: 700, team: 3600, out: 520 };

/** The phase after `p`; the loop goes back to typing. */
export function nextPhase(p: TeamPhase): TeamPhase {
  return p === "typing" ? "send" : p === "send" ? "branch" : p === "branch" ? "team" : p === "team" ? "out" : "typing";
}

/** Branch from the prompt's bottom centre to agent `i` of `n`, in a 600×96 box. */
export function branchPath(i: number, n: number): string {
  const x = ((i + 0.5) / n) * 600;
  return `M 300 0 L 300 22 C 300 52, ${x} 44, ${x} 96`;
}

const SURFACE =
  "bg-card [border:1px_solid_color-mix(in_srgb,var(--foreground)_10%,transparent)] shadow-[0_1px_2px_rgb(0_0_0/0.05),0_8px_22px_-14px_rgb(0_0_0/0.3)] dark:[background:color-mix(in_srgb,var(--card)_80%,#000)]";
// The 640ms line draw is kept: drawing the branch is the content. Everything else is within 280ms.
const EASE = "var(--kn-ease-out)";
const CSS = `
@keyframes knpt-caret { 0%, 49% { opacity: 1 } 50%, 100% { opacity: 0 } }
@keyframes knpt-send { 0% { transform: scale(1) } 40% { transform: scale(.97) } 100% { transform: scale(1) } }
${MOTION_GATE}
`;

/**
 * A prompt types itself, is sent, and branches into a small team: each agent with its model logo, role
 * and tool logos. Loops; pauses offscreen and in hidden tabs; reduced motion shows the finished team.
 */
export function PromptToTeam({ prompt = "Find why churn rose in Q3 and draft a fix for the team", team = DEFAULT_TEAM, typeSpeed = 34, paused, className }: PromptToTeamProps) {
  const root = useRef<HTMLDivElement>(null);
  const { live, reduced } = useLive(root, paused);
  const [phase, setPhase] = useState<TeamPhase>("typing");
  const [typed, setTyped] = useState(0);
  const members = team.slice(0, 4);
  const n = Math.max(1, members.length);

  useEffect(() => {
    if (!live) return;
    if (phase === "typing") {
      if (typed >= prompt.length) {
        const t = setTimeout(() => setPhase("send"), 260);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setTyped((c) => c + 1), typeSpeed);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      const next = nextPhase(phase);
      if (next === "typing") setTyped(0);
      setPhase(next);
    }, PHASE_MS[phase]);
    return () => clearTimeout(t);
  }, [live, phase, typed, prompt.length, typeSpeed]);

  // Reduced motion (and the server render) show the composed scene: full prompt, the team out.
  const still = reduced;
  const shown = still ? prompt : prompt.slice(0, typed);
  const branched = still || phase === "branch" || phase === "team";
  const out = !still && phase === "out";
  const teamIn = still || phase === "team";

  return (
    <div
      ref={root}
      data-kn-ill="prompt-to-team"
      data-live={live}
      data-phase={still ? "team" : phase}
      role="img"
      aria-label={`"${prompt}" becomes a team: ${members.map((m) => `${m.role}${m.model ? ` (${m.model})` : ""}`).join(", ")}`}
      className={cn("mx-auto flex w-full max-w-[600px] select-none flex-col items-stretch [container-type:inline-size]", className)}
    >
      <style href="kn-prompt-to-team" precedence="default">
        {CSS}
      </style>
      <div aria-hidden="true" className="flex flex-col" style={{ opacity: out ? 0 : 1, transition: `opacity 280ms ${EASE}` }}>
        {/* The prompt */}
        <div className={cn("mx-auto flex w-[82%] items-center gap-[1.6cqw] rounded-[3cqw] px-[2.2cqw] py-[1.8cqw]", SURFACE)}>
          <svg viewBox="0 0 16 16" className="size-[3cqw] flex-none" fill="none" stroke={AGENT_PALETTE[0]} strokeWidth={1.5} strokeLinecap="round">
            <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l1.8 1.8M10.2 10.2 12 12M12 4l-1.8 1.8M5.8 10.2 4 12" />
          </svg>
          <span className="min-w-0 flex-1 truncate text-[2.5cqw] leading-[1.4] text-foreground">
            {shown}
            {!still && phase === "typing" && <span className="ml-px inline-block h-[1em] w-px translate-y-[0.15em] bg-foreground/70 [animation:knpt-caret_1s_steps(1)_infinite]" />}
            {!shown && <span className="text-muted-foreground">Ask your agents…</span>}
          </span>
          <span
            className="grid size-[5cqw] flex-none place-items-center rounded-full bg-foreground text-background"
            style={{ animation: !still && phase === "send" ? `knpt-send 280ms ${EASE}` : undefined, opacity: shown.length === prompt.length ? 1 : 0.35, transition: "opacity 200ms" }}
          >
            <svg viewBox="0 0 16 16" className="size-[2.4cqw]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
            </svg>
          </span>
        </div>

        {/* Branches */}
        <svg viewBox="0 0 600 96" preserveAspectRatio="none" className="h-[14cqw] w-full" fill="none">
          {members.map((_, i) => (
            <path
              key={i}
              d={branchPath(i, n)}
              pathLength={100}
              stroke={AGENT_PALETTE[(i + 1) % AGENT_PALETTE.length]}
              strokeOpacity={0.55}
              strokeWidth={1.4}
              vectorEffect="non-scaling-stroke"
              strokeDasharray="100 100"
              style={{ strokeDashoffset: branched ? 0 : 100, transition: still ? "none" : `stroke-dashoffset 640ms ${EASE} ${i * 90}ms` }}
            />
          ))}
        </svg>

        {/* The team */}
        <div className="grid gap-[2cqw]" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {members.map((m, i) => {
            const hue = AGENT_PALETTE[(i + 1) % AGENT_PALETTE.length];
            const logo = m.icon ?? modelIcon(m.model);
            return (
              <div
                key={`${m.role}-${i}`}
                className={cn("flex flex-col items-center gap-[1.2cqw] rounded-[2.6cqw] px-[1.6cqw] py-[2cqw]", SURFACE)}
                style={{
                  opacity: teamIn ? 1 : 0,
                  transform: teamIn ? "none" : "translateY(1.6cqw) scale(.96)",
                  transition: still ? "none" : `opacity 280ms ${EASE} ${120 + i * 110}ms, transform 280ms ${EASE} ${120 + i * 110}ms`,
                  ["--hue" as string]: hue,
                }}
              >
                <span className="grid size-[6.4cqw] place-items-center rounded-[2cqw] [box-shadow:0_0_0_1px_color-mix(in_srgb,var(--hue)_35%,transparent),0_6px_16px_-8px_color-mix(in_srgb,var(--hue)_70%,transparent)]">
                  {logo ? (
                    <span className="grid size-[3.4cqw] place-items-center [&>*]:size-full [&_svg]:size-full">{logo}</span>
                  ) : (
                    <span className="text-[2.2cqw] font-semibold text-muted-foreground">{initials(m.role)}</span>
                  )}
                </span>
                <span className="w-full truncate text-center text-[2.3cqw] font-medium tracking-tight text-foreground">{m.role}</span>
                {m.model && <span className="-mt-[0.8cqw] w-full truncate text-center text-[1.9cqw] text-muted-foreground">{m.model}</span>}
                {!!m.tools?.length && (
                  <span className="flex items-center gap-[0.8cqw]">
                    {m.tools.slice(0, 3).map((t) => (
                      <span key={t} className="grid size-[3.6cqw] place-items-center rounded-[1cqw] bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)]">
                        {toolIcon(t) ? (
                          <span className="grid size-[2.2cqw] place-items-center [&>*]:size-full [&_svg]:size-full">{toolIcon(t)}</span>
                        ) : (
                          <span className="text-[1.5cqw] font-semibold text-muted-foreground">{initials(t)}</span>
                        )}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default PromptToTeam;
