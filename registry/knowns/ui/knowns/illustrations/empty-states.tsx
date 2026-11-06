"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { AGENT_PALETTE } from "@/registry/knowns/lib/knowns/status";
import { MOTION_GATE, useLive } from "./use-in-view";

export interface EmptyStateProps {
  title?: ReactNode;
  description?: ReactNode;
  /** A button or link under the text. */
  action?: ReactNode;
  /** Smaller art and text, for panels and cards. */
  compact?: boolean;
  paused?: boolean;
  className?: string;
}

const HUE = AGENT_PALETTE[0];

/* Namespaced keyframes, shipped with the component. Base styles are the still frame used for reduced motion. */
const CSS = `
@keyframes knes-march { to { stroke-dashoffset: -24 } }
@keyframes knes-caret { 0%, 45% { opacity: 1 } 50%, 95% { opacity: 0 } 100% { opacity: 1 } }
@keyframes knes-wait { 0%, 100% { opacity: .55 } 50% { opacity: 1 } }
@keyframes knes-drop { 0% { opacity: 0; transform: translateY(-14px) } 18% { opacity: 1 } 42% { transform: translateY(0); opacity: 1 } 60%, 100% { transform: translateY(6px); opacity: 0 } }
@keyframes knes-check { 0%, 52% { transform: scale(.6); opacity: 0 } 62% { transform: scale(1.12); opacity: 1 } 70%, 92% { transform: scale(1); opacity: 1 } 100% { transform: scale(1); opacity: 0 } }
@keyframes knes-plug { 0%, 100% { transform: translateX(0) } 50% { transform: translateX(7px) } }
@keyframes knes-spark { 0%, 40%, 100% { opacity: 0; transform: scale(.4) } 50% { opacity: 1; transform: scale(1) } 60% { opacity: 0; transform: scale(.6) } }
@keyframes knes-orbit { to { stroke-dashoffset: -100 } }
@keyframes knes-core { 0%, 100% { transform: scale(.9); opacity: .6 } 50% { transform: scale(1.08); opacity: 1 } }
${MOTION_GATE}
`;

/* Shared strokes: hairlines in the foreground colour, so light and dark both read. */
const line = { stroke: "currentColor", strokeOpacity: 0.22, strokeWidth: 1.25, fill: "none" } as const;
const box = (o = 0.035) => ({ fill: `color-mix(in srgb, currentColor ${o * 100}%, transparent)` });
const fillBox: CSSProperties = { transformBox: "fill-box", transformOrigin: "center" };

function Frame({ name, art, title, description, action, compact, paused, className, label }: EmptyStateProps & { name: string; art: ReactNode; label: string }) {
  const root = useRef<HTMLDivElement>(null);
  const { live } = useLive(root, paused);
  return (
    <div ref={root} data-kn-ill={name} data-live={live} className={cn("flex flex-col items-center text-center", compact ? "gap-2 py-4" : "gap-3 py-8", className)}>
      <style href="kn-empty-states" precedence="default">
        {CSS}
      </style>
      <svg viewBox="0 0 160 100" role="img" aria-label={label} className={cn("text-foreground", compact ? "w-28" : "w-40")}>
        {art}
      </svg>
      {(title || description) && (
        <div className="flex max-w-[36ch] flex-col gap-1">
          {title && <p className={cn("font-medium tracking-tight text-foreground", compact ? "text-[13px]" : "text-[14.5px]")}>{title}</p>}
          {description && <p className={cn("text-muted-foreground", compact ? "text-[12px]" : "text-[13px] leading-relaxed")}>{description}</p>}
        </div>
      )}
      {action && <div className={compact ? "mt-1" : "mt-2"}>{action}</div>}
    </div>
  );
}

/** A dashed graph waiting for a first prompt: the links march, the prompt caret blinks. */
export function NoRuns({ title = "No runs yet", description = "Send a first prompt and your agents will show up here, live.", ...rest }: EmptyStateProps) {
  const sat = [
    { x: 38, y: 24 },
    { x: 122, y: 24 },
    { x: 122, y: 62 },
  ];
  return (
    <Frame
      name="no-runs"
      label="An empty agent graph waiting for a first prompt"
      title={title}
      description={description}
      {...rest}
      art={
        <>
          {sat.map((s, i) => (
            <path key={i} d={`M 80 40 L ${s.x} ${s.y}`} {...line} strokeDasharray="3 3" style={{ animation: `knes-march ${2.4 + i * 0.3}s linear infinite` }} />
          ))}
          <rect x="68" y="28" width="24" height="24" rx="7" {...line} strokeOpacity={0.4} strokeDasharray="4 3" style={{ ...box(0.05), animation: "knes-wait 2.8s ease-in-out infinite" }} />
          <circle cx="80" cy="40" r="2.5" fill={HUE} opacity={0.8} />
          {sat.map((s, i) => (
            <rect key={i} x={s.x - 8} y={s.y - 8} width="16" height="16" rx="5" {...line} strokeDasharray="3 3" style={box(0.03)} />
          ))}
          {/* The prompt, empty. */}
          <rect x="34" y="78" width="92" height="14" rx="7" {...line} strokeOpacity={0.3} style={box(0.04)} />
          <rect x="42" y="82" width="1.5" height="6" rx=".75" fill={HUE} style={{ animation: "knes-caret 1.1s steps(1) infinite" }} />
          <circle cx="118" cy="85" r="3.5" fill="currentColor" fillOpacity={0.14} />
        </>
      }
    />
  );
}

/** Approvals cleared: a card drops into the tray and a check lights up. */
export function EmptyInbox({ title = "You're all caught up", description = "No approvals waiting. Agents will ask here before anything risky.", ...rest }: EmptyStateProps) {
  return (
    <Frame
      name="empty-inbox"
      label="An empty approvals tray with a check"
      title={title}
      description={description}
      {...rest}
      art={
        <>
          {/* A card dropping in (hidden in the still frame). */}
          <g style={{ ...fillBox, opacity: 0, animation: "knes-drop 3.2s cubic-bezier(.3,.7,.3,1) infinite" }}>
            <rect x="58" y="22" width="44" height="26" rx="5" {...line} strokeOpacity={0.35} style={box(0.06)} />
            <rect x="64" y="29" width="22" height="3" rx="1.5" fill="currentColor" fillOpacity={0.2} />
            <rect x="64" y="36" width="30" height="3" rx="1.5" fill="currentColor" fillOpacity={0.12} />
          </g>
          {/* The tray. */}
          <path d="M 40 52 L 52 52 L 58 62 L 102 62 L 108 52 L 120 52 L 120 80 Q 120 86 114 86 L 46 86 Q 40 86 40 80 Z" {...line} strokeOpacity={0.35} style={box(0.04)} />
          <path d="M 40 52 L 48 36 L 112 36 L 120 52" {...line} />
          <g style={{ ...fillBox, animation: "knes-check 3.2s cubic-bezier(.2,.8,.2,1) infinite" }}>
            <circle cx="80" cy="72" r="7" fill={HUE} fillOpacity={0.14} stroke={HUE} strokeOpacity={0.6} strokeWidth={1.2} />
            <path d="M 76.6 72.2 L 79 74.5 L 83.6 69.6" stroke={HUE} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </g>
        </>
      }
    />
  );
}

/** No tools connected: a plug eases toward its socket, a spark flickers in the gap. */
export function NoTools({ title = "No tools connected", description = "Connect a tool so your agents can search, read and act.", ...rest }: EmptyStateProps) {
  return (
    <Frame
      name="no-tools"
      label="An unplugged connector"
      title={title}
      description={description}
      {...rest}
      art={
        <>
          {/* Cable and plug. */}
          <g style={{ animation: "knes-plug 2.6s ease-in-out infinite" }}>
            <path d="M 8 66 C 30 66, 34 50, 52 50" {...line} strokeOpacity={0.3} strokeWidth={2} />
            <rect x="52" y="40" width="20" height="20" rx="5" {...line} strokeOpacity={0.4} style={box(0.06)} />
            <path d="M 72 45.5 L 79 45.5 M 72 54.5 L 79 54.5" stroke="currentColor" strokeOpacity={0.45} strokeWidth={2} strokeLinecap="round" />
          </g>
          {/* Socket and its cable. */}
          <rect x="94" y="38" width="22" height="24" rx="6" {...line} strokeOpacity={0.4} style={box(0.06)} />
          <path d="M 100 45.5 L 104 45.5 M 100 54.5 L 104 54.5" stroke="currentColor" strokeOpacity={0.3} strokeWidth={2} strokeLinecap="round" />
          <path d="M 116 50 C 132 50, 132 34, 152 34" {...line} strokeOpacity={0.3} strokeWidth={2} />
          {/* Sparks in the gap. */}
          {[
            { x: 87, y: 44, d: 0 },
            { x: 89, y: 55, d: 0.25 },
          ].map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r="1.6" fill={HUE} style={{ ...fillBox, opacity: 0, animation: `knes-spark 2.6s ease-out ${s.d}s infinite` }} />
          ))}
          <path d="M 80 80 L 100 80" stroke="currentColor" strokeOpacity={0.12} strokeWidth={1.25} strokeDasharray="2 3" />
        </>
      }
    />
  );
}

/** No agents yet: an empty orbit with a light running around it and a core that breathes. */
export function NoAgents({ title = "No agents yet", description = "Add an agent and it takes its place around the lead.", ...rest }: EmptyStateProps) {
  const orbit = "M 30 50 A 50 22 0 1 0 130 50 A 50 22 0 1 0 30 50";
  return (
    <Frame
      name="no-agents"
      label="An empty orbit waiting for agents"
      title={title}
      description={description}
      {...rest}
      art={
        <>
          <path d="M 14 50 A 66 34 0 1 0 146 50 A 66 34 0 1 0 14 50" {...line} strokeOpacity={0.1} strokeDasharray="2 4" />
          <path d={orbit} {...line} strokeOpacity={0.22} />
          <path d={orbit} pathLength={100} stroke={HUE} strokeWidth={2} strokeLinecap="round" fill="none" strokeDasharray="6 94" style={{ animation: "knes-orbit 5s linear infinite" }} />
          {/* Empty seats on the orbit. */}
          {[
            { x: 34, y: 41 },
            { x: 126, y: 59 },
            { x: 80, y: 72 },
          ].map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r="5" {...line} strokeOpacity={0.3} strokeDasharray="2 2" style={box(0.04)} />
          ))}
          <g style={{ ...fillBox, animation: "knes-core 3s ease-in-out infinite" }}>
            <circle cx="80" cy="50" r="11" fill={HUE} fillOpacity={0.1} />
            <rect x="73" y="43" width="14" height="14" rx="4.5" fill="var(--card, #fff)" stroke="currentColor" strokeOpacity={0.3} strokeWidth={1.25} />
            <circle cx="80" cy="50" r="2.2" fill={HUE} />
          </g>
        </>
      }
    />
  );
}

/** Your own art in the same frame (title, description, action, pause handling). */
export function EmptyState({ art, label, ...rest }: EmptyStateProps & { art: ReactNode; label: string }) {
  return <Frame name="empty-state" art={art} label={label} {...rest} />;
}
