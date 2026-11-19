"use client";
/** @registry name="chat-composer" type="ui" title="Chat composer" description="Agent input: autosizing text, attachments, model and permission-mode menus, connected apps, working folder, dictation, send and stop." */

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { EASE, MOTION } from "@/registry/knowns/lib/knowns/motion-utils";
import { useMotionList } from "@/registry/knowns/lib/knowns/motion";
import { modelIcon } from "@/registry/knowns/lib/knowns/icons/model-icons";
import { toolIcon } from "@/registry/knowns/lib/knowns/icons/tool-icons";
import { Avatar } from "../avatar";
import { Button, type ButtonProps } from "../button";
import { Tooltip } from "../tooltip";
import { Menu, type MenuItem } from "../menu";
import { balancedWidth, canSend, formatBytes, insertSkill, isSubmitKey, toggleId, useControllable, waveHeights } from "./composer-utils";
import { useAutosize } from "./use-autosize";

/* ── Types ── */

export type PermissionMode = "ask" | "auto" | "full";
export type AttachKind = "file" | "image" | "folder" | "link";

export interface ComposerModel {
  id: string;
  name: string;
  /** One short line under the name in the picker. */
  detail?: string;
  /** Defaults to the provider logo from modelIcon(name). */
  icon?: ReactNode;
}

export interface ComposerAgent {
  id: string;
  name: string;
  /** Shown after the name in the header: "Name: role". */
  role?: string;
  /** Picture for the avatar. Falls back to `icon`, then initials. */
  avatar?: string;
  icon?: ReactNode;
  /** One short line under the name in the picker. */
  detail?: string;
}

/** The identity row above the text. `avatarNode` replaces the avatar with your own mark. */
export type ComposerHeader = Pick<ComposerAgent, "name" | "role" | "avatar" | "icon"> & { avatarNode?: ReactNode };

export interface ComposerSkill {
  /** The command without the slash: "investigate" inserts "/investigate ". */
  id: string;
  /** Hover hint. */
  description?: string;
}

export interface ComposerApp {
  id: string;
  name: string;
  /** Defaults to the brand logo from toolIcon(name). */
  icon?: ReactNode;
}

export interface ComposerAttachment {
  id: string;
  name: string;
  kind?: AttachKind;
  /** Bytes. */
  size?: number;
  /** Upload progress, 0 to 1. A thin bar fills along the bottom of the tile until it reaches 1; leave it out for a file that is already there. */
  progress?: number;
}

export interface ComposerMessage {
  text: string;
  model: string;
  mode: PermissionMode;
  attachments: ComposerAttachment[];
  apps: string[];
  folder: string | null;
}

export interface ChatComposerProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Default "Ask anything…". */
  placeholder?: string;
  /** Enter or the send button. Afterwards the text and attachments are cleared (via onValueChange / onAttachmentsChange when controlled). */
  onSubmit: (message: ComposerMessage) => void;
  /** While busy the send button becomes Stop. */
  busy?: boolean;
  /** Shows the send button pressed (0.97), for a scripted demo that sends for the visitor. The real press already scales. */
  sendPressed?: boolean;
  onStop?: () => void;
  /** Agents to pick from. Adds an "Agent: Name" menu to the toolbar and, with `header`, the identity row on top. */
  agents?: ComposerAgent[];
  agent?: string;
  defaultAgent?: string;
  onAgentChange?: (id: string) => void;
  /** Avatar and "Name: role" above the text. true shows the current agent from `agents`; an object shows its own identity, e.g. the product's agent while `agents` are profiles. Default false. */
  header?: boolean | ComposerHeader;
  /** Muted after the model name, e.g. "High" shows "(High)". */
  effort?: string;
  /** Slash commands as chips under the toolbar. A click puts the command in the text. Use ComposerSkills to place the row yourself. */
  skills?: ComposerSkill[];
  /** Line above the chips. Default "Run a skill or ask anything". */
  skillsLabel?: ReactNode;
  models?: ComposerModel[];
  model?: string;
  defaultModel?: string;
  onModelChange?: (id: string) => void;
  mode?: PermissionMode;
  defaultMode?: PermissionMode;
  onModeChange?: (mode: PermissionMode) => void;
  attachments?: ComposerAttachment[];
  onAttachmentsChange?: (attachments: ComposerAttachment[]) => void;
  /** Picked from the + menu. Add the result through `attachments` / onAttachmentsChange. */
  onAttach?: (kind: AttachKind) => void;
  apps?: ComposerApp[];
  connectedApps?: string[];
  defaultConnectedApps?: string[];
  onConnectedAppsChange?: (ids: string[]) => void;
  /** Folders to work in. An empty list hides the folder picker. */
  folders?: string[];
  folder?: string | null;
  defaultFolder?: string | null;
  onFolderChange?: (folder: string | null) => void;
  /** Voice input, driven by the caller. The transcript shows muted under the text while listening. */
  dictation?: { listening: boolean; transcript?: string; onToggle: () => void };
  /** Replaces the bottom row (folder + apps); false removes it. */
  footer?: ReactNode | false;
  /** The + menu in the toolbar. false hides it, for a layout that places its own. Default true. */
  attachMenu?: boolean;
  /** The permission-mode menu in the toolbar. Default true. */
  modeMenu?: boolean;
  /** "lg" sets the text large, for a launcher where the box is the page's hero. Default "md". */
  size?: "md" | "lg";
  /** Lines before the text scrolls. Default 8. */
  maxRows?: number;
  disabled?: boolean;
  /** Its own card (border, radius, shadow, 640px max). false: flush, for a panel that already has one. Default true. */
  frame?: boolean;
  className?: string;
}

/* ── Defaults ── */

const DEFAULT_MODELS: ComposerModel[] = [
  { id: "auto", name: "Auto", detail: "Picks a model for each task" },
  { id: "opus-5.5", name: "Opus 5.5", detail: "Deepest reasoning" },
  { id: "sonnet-5.5", name: "Sonnet 5.5", detail: "Fast and capable" },
  { id: "haiku-5.5", name: "Haiku 5.5", detail: "Quickest, for small tasks" },
  { id: "gpt-5", name: "GPT-5", detail: "OpenAI" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", detail: "Google, long context" },
];

const DEFAULT_APPS: ComposerApp[] = [
  { id: "gmail", name: "Gmail" },
  { id: "slack", name: "Slack" },
  { id: "notion", name: "Notion" },
  { id: "github", name: "GitHub" },
  { id: "linear", name: "Linear" },
];

const DEFAULT_FOLDERS = ["knowns/ui", "knowns/web", "knowns/docs"];
const DEFAULT_CONNECTED = ["slack"];
const NONE = "\u0000none";

/* ── Glyphs (16px grid, 1.5 stroke) ── */

const S = { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

const Plus = () => <svg {...S}><path d="M8 3v10M3 8h10" /></svg>;
const ArrowUp = () => <svg {...S} strokeWidth={1.8}><path d="M8 13V3.5M3.75 7.5 8 3.25l4.25 4.25" /></svg>;
const StopGlyph = () => <svg viewBox="0 0 16 16" aria-hidden><rect x="4" y="4" width="8" height="8" rx="1.75" fill="currentColor" /></svg>;
const Mic = () => <svg {...S}><rect x="5.75" y="1.75" width="4.5" height="8" rx="2.25" /><path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.25" /></svg>;
const Chevron = () => <svg {...S} className="size-3! opacity-60"><path d="m4.5 6 3.5 3.5L11.5 6" /></svg>;
const Close = () => <svg {...S}><path d="m4.5 4.5 7 7m0-7-7 7" /></svg>;
const FileGlyph = () => <svg {...S}><path d="M9 1.75H4.75a1 1 0 0 0-1 1v10.5a1 1 0 0 0 1 1h6.5a1 1 0 0 0 1-1V5L9 1.75z" /><path d="M9 1.75V5h3.25" /></svg>;
const ImageGlyph = () => <svg {...S}><rect x="2" y="2.75" width="12" height="10.5" rx="1.75" /><circle cx="5.75" cy="6.25" r="1.1" /><path d="m2.5 11.5 3.25-3 2.5 2.25 2-1.75 3.25 2.75" /></svg>;
const FolderGlyph = () => <svg {...S}><path d="M1.75 4.25a1 1 0 0 1 1-1h3.5l1.5 1.5h5.5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-10.5a1 1 0 0 1-1-1v-8z" /></svg>;
const LinkGlyph = () => <svg {...S}><path d="M6.75 9.25a2.75 2.75 0 0 0 3.9.1l2-2a2.75 2.75 0 0 0-3.9-3.9l-.9.9" /><path d="M9.25 6.75a2.75 2.75 0 0 0-3.9-.1l-2 2a2.75 2.75 0 0 0 3.9 3.9l.9-.9" /></svg>;
const Spark = () => <svg {...S}><path d="M8 2.25 9.3 6.7l4.45 1.3-4.45 1.3L8 13.75 6.7 9.3 2.25 8l4.45-1.3L8 2.25z" /></svg>;
const AppsGlyph = () => <svg {...S}><rect x="2.25" y="2.25" width="4.5" height="4.5" rx="1.25" /><rect x="9.25" y="2.25" width="4.5" height="4.5" rx="1.25" /><rect x="2.25" y="9.25" width="4.5" height="4.5" rx="1.25" /><path d="M11.5 9.5v4M9.5 11.5h4" /></svg>;

const KIND_ICON: Record<AttachKind, () => ReactNode> = { file: FileGlyph, image: ImageGlyph, folder: FolderGlyph, link: LinkGlyph };

/* ── Permission modes ── */

const MODES: { id: PermissionMode; label: string; short: string; description: string; icon: () => ReactNode }[] = [
  {
    id: "ask",
    label: "Ask before acting",
    short: "Ask",
    description: "Checks with you before each step.",
    icon: () => <svg {...S}><path d="M8 1.75 3 3.75v4c0 3 2.1 5.4 5 6.5 2.9-1.1 5-3.5 5-6.5v-4l-5-2z" /><path d="M6.6 6.4a1.45 1.45 0 1 1 2 1.35c-.4.18-.6.5-.6.9v.2M8 10.9v.05" /></svg>,
  },
  {
    id: "auto",
    label: "Auto-approve safe actions",
    short: "Auto",
    description: "Asks only before risky changes.",
    icon: () => <svg {...S}><path d="M8 1.75 3 3.75v4c0 3 2.1 5.4 5 6.5 2.9-1.1 5-3.5 5-6.5v-4l-5-2z" /><path d="m5.9 8.1 1.5 1.5 2.8-3" /></svg>,
  },
  {
    id: "full",
    label: "Full access",
    short: "Full access",
    description: "Acts on its own. Use with care.",
    icon: () => <svg {...S}><path d="M8.75 1.75 3.5 9h4l-.75 5.25L12.5 7h-4l.25-5.25z" /></svg>,
  },
];

/* ── Small parts ── */

/** A Button with a tooltip. Forwards everything Menu clones in (onClick, ref, aria-*), so it works as a menu trigger. */
function TipButton({ tip, tipClassName, ...props }: ButtonProps & { tip: ReactNode; tipClassName?: string; ref?: Ref<HTMLButtonElement> }) {
  // Hide the hint while its menu is open: it would sit under the panel.
  const expanded = props["aria-expanded"] === true || props["aria-expanded"] === "true";
  return (
    <Tooltip content={tip} className={cn(expanded && "[&>[role=tooltip]]:hidden", tipClassName)}>
      <Button {...props} />
    </Tooltip>
  );
}

function Logo({ children, className }: { children: ReactNode; className?: string }) {
  return <span aria-hidden className={cn("grid size-4 flex-none place-items-center [&>*]:size-full [&_svg]:size-full", className)}>{children}</span>;
}

/** Five bars that breathe while listening; still under reduced motion. */
function Waveform({ className }: { className?: string }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const paint = (t: number) =>
      waveHeights(t, 5).forEach((h, i) => {
        const el = bars.current[i];
        if (el) el.style.transform = `scaleY(${still ? 0.55 : h})`;
      });
    if (still) return paint(0);
    let raf = 0;
    const tick = (now: number) => {
      paint(now / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <span aria-hidden className={cn("flex h-3.5 items-center gap-[2px]", className)}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} ref={(el) => void (bars.current[i] = el)} style={{ transform: "scaleY(0.4)" }} className="h-full w-[2px] origin-center rounded-full bg-current" />
      ))}
    </span>
  );
}

/* ── Working glow ── */

/**
 * While the agent runs, one light band travels around the border (a rotating conic gradient from --kn-accent, clipped to
 * a ring) with a soft bloom just inside it. It fades in and out with `busy`, so the card lights up instead of swapping.
 * Only transform and opacity move. Reduced motion shows a still accent ring.
 */
const GLOW_CSS = `
@keyframes kncc-orbit { to { transform: translate(-50%, -50%) rotate(360deg); } }
.kncc-glow { --kncc-c: var(--kn-accent, var(--color-indigo-500, #6366f1)); position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: 0; transition: opacity var(--kn-dur-slow, ${MOTION.slow}ms) var(--kn-ease-out, ${EASE.out}); }
.dark .kncc-glow, [data-theme="dark"] .kncc-glow { --kncc-c: var(--kn-accent, var(--color-indigo-400, #818cf8)); }
.kncc-glow[data-on] { opacity: 1; }
.kncc-glow:not([data-on]) { transition-duration: var(--kn-dur, ${MOTION.base}ms); }
.kncc-ring, .kncc-bloom { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0); }
.kncc-ring { padding: 2px; }
.kncc-bloom { padding: 14px; opacity: .6; }
.kncc-band { position: absolute; left: 50%; top: 50%; width: 240%; aspect-ratio: 1; transform: translate(-50%, -50%); background: conic-gradient(from 0deg, transparent 0deg, transparent 236deg, color-mix(in srgb, var(--kncc-c) 28%, transparent) 280deg, color-mix(in srgb, var(--kncc-c) 75%, transparent) 330deg, var(--kncc-c) 352deg, color-mix(in srgb, var(--kncc-c) 55%, white) 358deg, transparent 360deg); animation: kncc-orbit 3.2s linear infinite; }
.kncc-bloom .kncc-band { filter: blur(12px); }
.kncc-glow:not([data-on]) .kncc-band { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) {
  .kncc-band { animation: none !important; transform: translate(-50%, -50%); background: var(--kncc-c); }
  .kncc-ring { opacity: .6; }
  .kncc-bloom { display: none; }
  .kncc-glow { transition: none; }
}`;

/** The travelling border light. Decorative: the Stop button and the live region carry the state. */
function WorkingGlow({ on }: { on: boolean }) {
  return (
    <span aria-hidden className="kncc-glow" data-on={on || undefined} data-kn-m="glow">
      <style href="kncc-glow" precedence="default">
        {GLOW_CSS}
      </style>
      <span className="kncc-bloom">
        <span className="kncc-band" />
      </span>
      <span className="kncc-ring">
        <span className="kncc-band" />
      </span>
    </span>
  );
}

/* ── Attachment tiles ── */

const TILE_CSS = `
.kncc-tile { display: grid; grid-template-columns: 1fr; transition: grid-template-columns var(--kn-dur-fast, ${MOTION.fast}ms) var(--kn-ease-out, ${EASE.out}), opacity var(--kn-dur-fast, ${MOTION.fast}ms) var(--kn-ease-out, ${EASE.out}); min-width: 0; }
.kncc-tile > * { min-width: 0; overflow: hidden; }
.kncc-tile[data-exiting] { grid-template-columns: 0fr; opacity: 0; pointer-events: none; }
.kncc-tile[data-exiting] { margin-right: -6px; }
@keyframes kncc-land { from { opacity: 0; transform: translateY(6px) scale(.94); } }
.kncc-tile[data-entering] > * { animation: kncc-land var(--kn-dur, ${MOTION.base}ms) var(--kn-ease-out, ${EASE.out}) var(--kncc-delay, 0ms) backwards; }
.kncc-bar { position: absolute; inset: auto 0 0 0; height: 2px; transform-origin: left; transform: scaleX(var(--kncc-p, 0)); background: var(--kn-accent, var(--color-indigo-500, #6366f1)); transition: transform var(--kn-dur-slow, ${MOTION.slow}ms) var(--kn-ease-inout, ${EASE.inOut}), opacity var(--kn-dur-fast, ${MOTION.fast}ms) var(--kn-ease-out, ${EASE.out}); }
.kncc-bar[data-done] { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .kncc-tile, .kncc-tile > *, .kncc-bar { animation: none !important; transition: none !important; } }
`;

/* ── Skill chips ── */

const CodeGlyph = () => <svg {...S}><path d="m5.75 4.5-3.5 3.5 3.5 3.5M10.25 4.5l3.5 3.5-3.5 3.5" /></svg>;

export interface ComposerSkillsProps {
  skills: ComposerSkill[];
  /** Line above the chips. Default "Run a skill or ask anything". Pass null for none. */
  label?: ReactNode;
  /** Called with the skill id when a chip is pressed. */
  onPick: (id: string) => void;
  disabled?: boolean;
  /** Wrap the chips in even rows, so the last line is never a stray chip. Default true. */
  balance?: boolean;
  className?: string;
}

/** "Run a skill or ask anything" and a wrap of "<> /command" chips. Stand-alone, so it can sit outside the card. */
export function ComposerSkills({ skills, label = "Run a skill or ask anything", onPick, disabled, balance = true, className }: ComposerSkillsProps) {
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [maxWidth, setMaxWidth] = useState<number | undefined>();
  // Measure the chips and the room, and cap the row at the width that gives the most even wrap.
  useLayoutEffect(() => {
    const el = box.current;
    const ul = list.current;
    if (!balance || !el || !ul) return;
    const measure = () => {
      const widths = Array.from(ul.children, (c) => (c as HTMLElement).offsetWidth);
      const gap = parseFloat(getComputedStyle(ul).columnGap) || 0;
      const cs = getComputedStyle(el);
      setMaxWidth(balancedWidth(widths, gap, el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [balance, skills]);
  return (
    <div ref={box} className={cn("flex flex-col gap-2.5", className)}>
      {label !== null && <p className="text-[14px] leading-6 text-muted-foreground">{label}</p>}
      <ul ref={list} aria-label="Skills" style={balance ? { maxWidth } : undefined} className="flex flex-wrap gap-2 @max-[419px]:gap-1.5">
        {skills.map((k) => (
          <li key={k.id}>
            <button
              type="button"
              disabled={disabled}
              title={k.description}
              onClick={() => onPick(k.id)}
              className="inline-flex h-8 items-center gap-2 rounded-xl bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] px-3 text-[13.5px] @max-[419px]:gap-1.5 @max-[419px]:px-2 @max-[419px]:text-[13px] text-foreground/85 transition-[background-color,transform] duration-(--kn-dur-fast) ease-(--kn-ease-out) outline-none hover:bg-[color-mix(in_srgb,var(--foreground)_11%,transparent)] focus-visible:ring-2 focus-visible:ring-ring/70 active:scale-[.97] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none"
            >
              <span aria-hidden className="grid text-muted-foreground [&_svg]:size-3.5 @max-[419px]:[&_svg]:size-3">
                <CodeGlyph />
              </span>
              /{k.id}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Component ── */

/**
 * Message box for an agent chat: auto-growing text, attachments, a permission mode, a model
 * picker, voice input and send / stop, with a quiet bottom row for the working folder and
 * connected apps. Every value works controlled or uncontrolled.
 */
export function ChatComposer({
  value,
  defaultValue = "",
  onValueChange,
  placeholder = "Ask anything…",
  onSubmit,
  busy = false,
  sendPressed = false,
  onStop,
  agents,
  agent: agentProp,
  defaultAgent,
  onAgentChange,
  header = false,
  effort,
  skills,
  skillsLabel,
  models = DEFAULT_MODELS,
  model: modelProp,
  defaultModel,
  onModelChange,
  mode: modeProp,
  defaultMode = "ask",
  onModeChange,
  attachments: attachmentsProp,
  onAttachmentsChange,
  onAttach,
  apps = DEFAULT_APPS,
  connectedApps: connectedProp,
  defaultConnectedApps = DEFAULT_CONNECTED,
  onConnectedAppsChange,
  folders = DEFAULT_FOLDERS,
  folder: folderProp,
  defaultFolder = null,
  onFolderChange,
  dictation,
  footer,
  attachMenu = true,
  modeMenu = true,
  size = "md",
  maxRows = 8,
  disabled = false,
  frame = true,
  className,
}: ChatComposerProps) {
  const [text, setText] = useControllable(value, defaultValue, onValueChange);
  const [model, setModel] = useControllable(modelProp, defaultModel ?? models[0]?.id ?? "", onModelChange);
  const [mode, setMode] = useControllable(modeProp, defaultMode, onModeChange);
  const [attachments, setAttachments] = useControllable(attachmentsProp, [] as ComposerAttachment[], onAttachmentsChange);
  const [connected, setConnected] = useControllable(connectedProp, defaultConnectedApps, onConnectedAppsChange);
  const [folder, setFolder] = useControllable(folderProp, defaultFolder, onFolderChange);
  const [agentId, setAgentId] = useControllable(agentProp, defaultAgent ?? agents?.[0]?.id ?? "", onAgentChange);

  const area = useRef<HTMLTextAreaElement>(null);
  useAutosize(area, text, maxRows);
  const hintId = useId();

  /* Polite announcements; the counter lets the same sentence be read twice. */
  const [said, setSaid] = useState({ text: "", n: 0 });
  const say = useCallback((t: string) => setSaid((s) => ({ text: t, n: s.n + 1 })), []);

  const currentAgent = agents?.find((a) => a.id === agentId) ?? agents?.[0];
  const who: ComposerHeader | undefined = header === true ? currentAgent : header || undefined;
  const current = models.find((m) => m.id === model) ?? models[0];
  // MODES always lists at least one mode, so the first is the fallback.
  const modeInfo = MODES.find((m) => m.id === mode) ?? (MODES[0] as (typeof MODES)[number]);
  const listening = !!dictation?.listening;
  const sendable = canSend(text, attachments.length);

  const submit = () => {
    if (disabled || busy || !sendable) return;
    onSubmit({ text: text.trim(), model: current?.id ?? model, mode, attachments, apps: connected, folder });
    setText("");
    if (attachments.length) setAttachments([]);
    say("Message sent");
    area.current?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSubmitKey({ key: e.key, shiftKey: e.shiftKey, altKey: e.altKey, isComposing: e.nativeEvent.isComposing, keyCode: e.keyCode })) {
      e.preventDefault();
      submit();
    }
  };

  // Esc anywhere in the composer stops dictation (open menus swallow their own Esc first).
  const onRootKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && listening && !e.defaultPrevented) {
      e.preventDefault();
      dictation?.onToggle();
    }
  };

  /* Tiles land one by one (a tile added after first paint rises in, 40ms apart, at most 4) and collapse when removed. */
  const tiles = useMotionList(attachments, (a) => a.id);
  const landing = useRef(new Map<string, number>());
  let batch = 0;
  for (const t of tiles) if (t.entering && !landing.current.has(t.key)) landing.current.set(t.key, Math.min(batch++, 3));

  /* ── Menus ── */

  const attachItems: MenuItem[] = [
    { id: "file", label: "Upload a file", icon: <FileGlyph /> },
    { id: "image", label: "Add an image", icon: <ImageGlyph /> },
    { id: "folder", label: "Attach a folder", icon: <FolderGlyph /> },
    { id: "link", label: "Paste a link", icon: <LinkGlyph /> },
  ];

  const modeItems: MenuItem[] = MODES.map((m) => ({
    id: m.id,
    label: m.label,
    description: m.description,
    icon: <m.icon />,
    kind: "radio",
    checked: m.id === mode,
  }));

  const modelItems: MenuItem[] = models.map((m) => ({
    id: m.id,
    label: m.name,
    textValue: m.name,
    description: m.detail,
    icon: <Logo>{m.icon ?? modelIcon(m.name) ?? <Spark />}</Logo>,
    kind: "radio",
    checked: m.id === current?.id,
  }));

  const agentItems: MenuItem[] = (agents ?? []).map((a) => ({
    id: a.id,
    label: a.name,
    textValue: a.name,
    description: a.detail ?? a.role,
    icon: <Logo>{a.icon ?? <Spark />}</Logo>,
    kind: "radio",
    checked: a.id === currentAgent?.id,
  }));

  const pickSkill = (id: string) => {
    setText(insertSkill(text, id));
    area.current?.focus();
  };

  const folderItems: MenuItem[] = [
    ...folders.map((f): MenuItem => ({ id: f, label: f, textValue: f, icon: <FolderGlyph />, kind: "radio", checked: f === folder })),
    ...(folder !== null ? [{ id: NONE, label: "Don't use a folder", kind: "radio" as const, checked: false }] : []),
  ];

  const appItems: MenuItem[] = apps.map((a) => ({
    id: a.id,
    label: a.name,
    textValue: a.name,
    icon: <Logo>{a.icon ?? toolIcon(a.name) ?? <AppsGlyph />}</Logo>,
    kind: "checkbox",
    checked: connected.includes(a.id),
  }));
  const connectedApps = apps.filter((a) => connected.includes(a.id));

  const removeAttachment = (a: ComposerAttachment) => {
    setAttachments(attachments.filter((x) => x.id !== a.id));
    say(`Removed ${a.name}`);
    area.current?.focus();
  };

  const words = listening && dictation?.transcript ? dictation.transcript.trim().split(/\s+/) : [];

  /* ── Render ── */

  const bottom =
    footer === false ? null : footer !== undefined ? (
      footer
    ) : folders.length || apps.length ? (
      <>
        {folders.length > 0 ? (
          <Menu
            role="listbox"
            side="auto"
            aria-label="Working folder"
            items={folderItems}
            onSelect={(item) => {
              const next = item.id === NONE ? null : item.id;
              setFolder(next);
              say(next ? `Working in ${next}` : "No folder");
            }}
            trigger={
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                aria-label={`Working folder: ${folder ?? "none"}`}
                icon={<FolderGlyph />}
                iconRight={<Chevron />}
                className="min-w-0 shrink justify-start px-2!"
              >
                <span className={cn("block truncate", folder && "text-foreground")}>{folder ?? "Work in a folder"}</span>
              </Button>
            }
          />
        ) : (
          <span />
        )}
        {apps.length > 0 && (
          <Menu
            align="end"
            side="auto"
            aria-label="Connect apps"
            items={appItems}
            footer={connectedApps.length ? `${connectedApps.length} connected` : "Nothing connected yet."}
            onSelect={(item) => {
              const on = !connected.includes(item.id);
              setConnected(toggleId(connected, item.id));
              const name = apps.find((a) => a.id === item.id)?.name ?? item.id;
              say(`${name} ${on ? "connected" : "disconnected"}`);
            }}
            trigger={
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                aria-label={connectedApps.length ? `Connect apps, ${connectedApps.map((a) => a.name).join(", ")} connected` : "Connect apps"}
                className="flex-none px-2!"
              >
                <span className="flex items-center gap-2">
                  {connectedApps.length === 0 && <AppsGlyph />}
                  <span className="@max-[360px]:hidden">Connect apps</span>
                  {connectedApps.length > 0 && (
                    <span className="flex items-center -space-x-1">
                      {connectedApps.slice(0, 3).map((a) => (
                        <span
                          key={a.id}
                          className="grid size-[18px] place-items-center rounded-full bg-card p-[3px] shadow-[0_0_0_1.5px_var(--card),0_0_0_2.5px_color-mix(in_srgb,var(--foreground)_10%,transparent)] animate-[kn-pop_var(--kn-dur)_var(--kn-ease-out)_both] motion-reduce:animate-none"
                        >
                          <Logo className="size-full">{a.icon ?? toolIcon(a.name) ?? <AppsGlyph />}</Logo>
                        </span>
                      ))}
                      {connectedApps.length > 3 && (
                        <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-muted px-1 text-[10px] font-medium text-muted-foreground tabular-nums shadow-[0_0_0_1.5px_var(--card)]">
                          +{connectedApps.length - 3}
                        </span>
                      )}
                    </span>
                  )}
                </span>
              </Button>
            }
          />
        )}
      </>
    ) : null;

  const withAgents = !!agents && agents.length > 0;
  const modelMenu =
    models.length > 0 ? (
      <Menu
        role="listbox"
        align="end"
        aria-label="Model"
        items={modelItems}
        onSelect={(item) => {
          if (item.id === current?.id) return;
          setModel(item.id);
          say(`Model: ${models.find((m) => m.id === item.id)?.name ?? item.id}`);
        }}
        trigger={
          <TipButton
            tip={current?.name}
            tipClassName="@min-[420px]:[&>[role=tooltip]]:hidden"
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-label={`Model: ${current?.name ?? "none"}${effort ? `, ${effort} effort` : ""}`}
            className={cn("px-2!", !withAgents && "@max-[419px]:w-7 @max-[419px]:px-0! pointer-coarse:@max-[419px]:w-9")}
          >
            <span key={current?.id} className="flex items-center gap-1.5 animate-[kn-word_var(--kn-dur)_var(--kn-ease-out)_both] motion-reduce:animate-none">
              <Logo className="size-3.5">{current?.icon ?? modelIcon(current?.name) ?? <Spark />}</Logo>
              <span className={cn("max-w-[140px] truncate text-foreground/85", !withAgents && "@max-[419px]:hidden")}>{current?.name}</span>
              {effort && <span className="text-muted-foreground @max-[419px]:hidden">({effort})</span>}
              <span className={cn("contents", !withAgents && "@max-[419px]:hidden")}>
                <Chevron />
              </span>
            </span>
          </TipButton>
        }
      />
    ) : null;

  return (
    <div
      onKeyDown={onRootKey}
      aria-disabled={disabled || undefined}
      className={cn(
        "@container relative w-full text-foreground",
        ...(frame ? [
          "max-w-[640px] overflow-hidden rounded-2xl bg-card",
          "shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_12%,transparent),0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.12)]",
          "transition-[box-shadow] duration-(--kn-dur) ease-(--kn-ease-out)",
          "has-[textarea:focus-visible]:shadow-[0_0_0_1px_color-mix(in_srgb,var(--ring)_70%,transparent),0_0_0_4px_color-mix(in_srgb,var(--ring)_14%,transparent),0_8px_24px_-12px_rgb(0_0_0/0.12)]",
          "dark:bg-[color-mix(in_srgb,var(--muted)_30%,var(--card))]",
        ] : []),
        disabled && "opacity-60",
        className,
      )}
    >
      {frame && <WorkingGlow on={busy} />}
      <div aria-live="polite" aria-atomic className="sr-only">
        <span key={said.n}>{said.text}</span>
      </div>

      {/* Writing area: a click anywhere that isn't a control lands in the text. */}
      <div
        className="cursor-text px-3 pt-3 pb-2"
        onMouseDown={(e) => {
          const t = e.target as HTMLElement;
          if (disabled || t.closest("button, a, input, textarea, [role]")) return;
          e.preventDefault();
          area.current?.focus();
        }}
      >
        {who && (
          <div className="mb-2 flex items-center gap-2.5 px-1 pt-0.5">
            {who.avatarNode ?? <Avatar label={who.name} src={who.avatar} icon={who.icon} shape="circle" size="sm" decorative />}
            <p key={who.name} className="min-w-0 truncate text-[13.5px] leading-6 animate-[kn-word_var(--kn-dur)_var(--kn-ease-out)_both] motion-reduce:animate-none">
              <span className="font-medium text-foreground">{who.name}</span>
              {who.role && <span className="text-muted-foreground">: {who.role}</span>}
            </p>
          </div>
        )}

        {tiles.length > 0 && (
          <ul aria-label="Attachments" className="mb-2 flex flex-wrap gap-1.5">
            <style href="kncc-tiles" precedence="default">
              {TILE_CSS}
            </style>
            {tiles.map(({ item: a, key, exiting, entering }) => {
              const Icon = KIND_ICON[a.kind ?? "file"];
              const size = formatBytes(a.size);
              const uploading = a.progress !== undefined && a.progress < 1;
              const slot = landing.current.get(key) ?? 0;
              return (
                <li
                  key={key}
                  className="kncc-tile"
                  data-entering={entering && !exiting ? "" : undefined}
                  data-exiting={exiting ? "" : undefined}
                  aria-hidden={exiting || undefined}
                  style={{ "--kncc-delay": `${slot * 40}ms` } as CSSProperties}
                >
                  <div className="group relative flex h-7 max-w-[240px] items-center gap-1.5 overflow-hidden rounded-lg bg-muted/60 pr-0.5 pl-2 text-[12.5px] shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_8%,transparent)]">
                    <span aria-hidden className="grid flex-none text-muted-foreground [&_svg]:size-3.5">
                      <Icon />
                    </span>
                    <span className="min-w-0 truncate">{a.name}</span>
                    {size && !uploading && <span className="flex-none text-[11.5px] text-muted-foreground tabular-nums">{size}</span>}
                    {uploading && <span className="flex-none text-[11.5px] text-muted-foreground tabular-nums">{Math.round(a.progress! * 100)}%</span>}
                    <TipButton
                      tip="Remove"
                      variant="ghost"
                      size="sm"
                      disabled={disabled || exiting}
                      aria-label={`Remove ${a.name}`}
                      icon={<Close />}
                      onClick={() => removeAttachment(a)}
                      className="size-6! rounded-md! [&_svg]:size-3! pointer-coarse:size-8!"
                    />
                    {a.progress !== undefined && (
                      <span
                        aria-hidden
                        role="presentation"
                        className="kncc-bar"
                        data-done={a.progress >= 1 ? "" : undefined}
                        style={{ "--kncc-p": Math.min(1, Math.max(0, a.progress)) } as CSSProperties}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <textarea
          ref={area}
          rows={1}
          value={text}
          disabled={disabled}
          placeholder={listening ? "Listening…" : placeholder}
          aria-label="Message"
          aria-describedby={hintId}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          className={cn(
            "block w-full resize-none bg-transparent px-1 text-foreground outline-none",
            size === "lg" ? "py-2 text-[clamp(20px,4.6cqw,28px)] leading-[1.35] tracking-[-0.01em]" : "py-1 text-[14.5px] leading-6",
            "placeholder:text-muted-foreground disabled:cursor-not-allowed",
          )}
        />
        <span id={hintId} className="sr-only">
          Enter to send, Shift+Enter for a new line.
        </span>

        {words.length > 0 && (
          <p aria-hidden className="px-1 pb-1 text-[14.5px] leading-6 text-muted-foreground">
            {words.map((w, i) => (
              <span key={i} className="animate-[kn-word_var(--kn-dur-slow)_var(--kn-ease-out)_both] motion-reduce:animate-none">
                {w}{" "}
              </span>
            ))}
          </p>
        )}

        {/* Toolbar */}
        <div className={cn("mt-1 flex items-center gap-1", withAgents && "-mx-3 mt-2 border-t border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] pt-2 pr-4 pl-2")}>
          {attachMenu && (
            <Menu
              aria-label="Add to message"
              items={attachItems}
              onSelect={(item) => onAttach?.(item.id as AttachKind)}
              trigger={<TipButton tip="Add files and more" variant="ghost" size="sm" disabled={disabled} aria-label="Add files and more" icon={<Plus />} />}
            />
          )}

          {modeMenu && (
            <Menu
              role="menu"
              aria-label="Permission mode"
              items={modeItems}
              footer="You can change this any time."
              width={288}
              onSelect={(item) => {
                const next = item.id as PermissionMode;
                if (next === mode) return;
                setMode(next);
                say(`Permission mode: ${MODES.find((m) => m.id === next)?.label}`);
              }}
              trigger={
                <TipButton
                  tip={modeInfo.label}
                  tipClassName="@min-[420px]:[&>[role=tooltip]]:hidden"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  aria-label={`Permission mode: ${modeInfo.label}`}
                  className={cn(
                    "px-2! @max-[419px]:w-7 @max-[419px]:px-0! pointer-coarse:@max-[419px]:w-9",
                    mode === "full" &&
                      "text-red-600 hover:bg-red-500/[0.08] hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/12 dark:hover:text-red-300",
                  )}
                >
                  {/* Keyed so a new mode cross-fades in rather than snapping. */}
                  <span key={mode} className="flex items-center gap-1.5 animate-[kn-word_var(--kn-dur)_var(--kn-ease-out)_both] motion-reduce:animate-none">
                    <span aria-hidden className="grid [&_svg]:size-3.5">
                      <modeInfo.icon />
                    </span>
                    <span className="@max-[419px]:hidden @min-[680px]:hidden">{modeInfo.short}</span>
                    <span className="hidden @min-[680px]:inline">{modeInfo.label}</span>
                  </span>
                </TipButton>
              }
            />
          )}

          {withAgents && (
            <Menu
              role="listbox"
              aria-label="Agent"
              items={agentItems}
              onSelect={(item) => {
                if (item.id === currentAgent?.id) return;
                setAgentId(item.id);
                say(`Agent: ${agents?.find((a) => a.id === item.id)?.name ?? item.id}`);
              }}
              trigger={
                <TipButton
                  tip="Choose an agent"
                  tipClassName="[&>[role=tooltip]]:hidden"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  aria-label={`Agent: ${currentAgent?.name ?? "none"}`}
                  className="px-2!"
                >
                  <span key={currentAgent?.id} className="flex items-center gap-1.5 animate-[kn-word_var(--kn-dur)_var(--kn-ease-out)_both] motion-reduce:animate-none">
                    <span className="text-muted-foreground">Agent:</span>
                    <span className="max-w-[120px] truncate text-foreground/85">{currentAgent?.name}</span>
                    <Chevron />
                  </span>
                </TipButton>
              }
            />
          )}

          {withAgents && modelMenu}

          <div className="flex-1" />

          {!withAgents && modelMenu}

          {dictation && (
            <TipButton
              tip={listening ? "Stop dictation (Esc)" : "Dictate"}
              variant="ghost"
              size="sm"
              disabled={disabled}
              aria-label={listening ? "Stop dictation" : "Dictate"}
              aria-pressed={listening}
              icon={listening ? <Waveform /> : <Mic />}
              onClick={() => {
                dictation.onToggle();
                area.current?.focus();
              }}
              className={cn(listening && "bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] text-foreground")}
            />
          )}

          {busy ? (
            <TipButton tip="Stop" variant="primary" size="sm" aria-label="Stop" icon={<StopGlyph />} onClick={onStop} className="rounded-full! animate-[kn-pop_var(--kn-dur)_var(--kn-ease-out)_both] motion-reduce:animate-none" />
          ) : (
            <TipButton
              tip="Send"
              variant="primary"
              size="sm"
              aria-label="Send"
              icon={<ArrowUp />}
              disabled={disabled || !sendable}
              onClick={submit}
              data-pressed={sendPressed || undefined}
              className="rounded-full! data-[pressed=true]:scale-[.97]"
            />
          )}
        </div>
      </div>

      {skills && skills.length > 0 && (
        <div className="border-t border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] px-3 py-2.5">
          <ComposerSkills skills={skills} label={skillsLabel} disabled={disabled} onPick={pickSkill} />
        </div>
      )}

      {bottom && (
        <div className="flex min-h-10 items-center justify-between gap-2 border-t border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] bg-muted/40 px-1.5 py-1 text-muted-foreground">
          {bottom}
        </div>
      )}
    </div>
  );
}

export default ChatComposer;
