"use client";
/** @registry name="chat-composer" type="ui" title="Chat composer" description="Agent input: autosizing text, attachments, model and permission-mode menus, connected apps, working folder, dictation, send and stop." */

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { modelIcon } from "@/registry/knowns/lib/knowns/icons/model-icons";
import { toolIcon } from "@/registry/knowns/lib/knowns/icons/tool-icons";
import { Button, type ButtonProps } from "../button";
import { Tooltip } from "../tooltip";
import { Menu, type MenuItem } from "../menu";
import { canSend, formatBytes, isSubmitKey, toggleId, useControllable, waveHeights } from "./composer-utils";
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
  onStop?: () => void;
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
  onStop,
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

  const area = useRef<HTMLTextAreaElement>(null);
  useAutosize(area, text, maxRows);
  const hintId = useId();

  /* Polite announcements; the counter lets the same sentence be read twice. */
  const [said, setSaid] = useState({ text: "", n: 0 });
  const say = useCallback((t: string) => setSaid((s) => ({ text: t, n: s.n + 1 })), []);

  const current = models.find((m) => m.id === model) ?? models[0];
  const modeInfo = MODES.find((m) => m.id === mode) ?? MODES[0];
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

  /* Keep the newest attachment chip from jumping: chips only animate in after first paint. */
  const mounted = useRef(false);
  useLayoutEffect(() => void (mounted.current = true), []);

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
                          className="grid size-[18px] place-items-center rounded-full bg-card p-[3px] shadow-[0_0_0_1.5px_var(--card),0_0_0_2.5px_color-mix(in_srgb,var(--foreground)_10%,transparent)] animate-[kn-pop_220ms_var(--kn-ease-out,cubic-bezier(.22,1,.36,1))_both] motion-reduce:animate-none"
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

  return (
    <div
      onKeyDown={onRootKey}
      aria-disabled={disabled || undefined}
      className={cn(
        "@container w-full text-foreground",
        ...(frame ? [
          "max-w-[640px] overflow-hidden rounded-2xl bg-card",
          "shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_12%,transparent),0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.12)]",
          "transition-[box-shadow] duration-200 ease-[var(--kn-ease-out,cubic-bezier(.22,1,.36,1))]",
          "has-[textarea:focus-visible]:shadow-[0_0_0_1px_color-mix(in_srgb,var(--ring)_70%,transparent),0_0_0_4px_color-mix(in_srgb,var(--ring)_14%,transparent),0_8px_24px_-12px_rgb(0_0_0/0.12)]",
          "dark:bg-[color-mix(in_srgb,var(--muted)_30%,var(--card))]",
        ] : []),
        disabled && "opacity-60",
        className,
      )}
    >
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
        {attachments.length > 0 && (
          <ul aria-label="Attachments" className="mb-2 flex flex-wrap gap-1.5">
            {attachments.map((a) => {
              const Icon = KIND_ICON[a.kind ?? "file"];
              const size = formatBytes(a.size);
              return (
                <li
                  key={a.id}
                  className={cn(
                    "group flex h-7 max-w-[240px] items-center gap-1.5 rounded-lg bg-muted/60 pr-0.5 pl-2 text-[12.5px] shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_8%,transparent)]",
                    mounted.current && "animate-[kn-rise_180ms_var(--kn-ease-out,cubic-bezier(.22,1,.36,1))_both] motion-reduce:animate-none",
                  )}
                >
                  <span aria-hidden className="grid flex-none text-muted-foreground [&_svg]:size-3.5">
                    <Icon />
                  </span>
                  <span className="min-w-0 truncate">{a.name}</span>
                  {size && <span className="flex-none text-[11.5px] text-muted-foreground tabular-nums">{size}</span>}
                  <TipButton
                    tip="Remove"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    aria-label={`Remove ${a.name}`}
                    icon={<Close />}
                    onClick={() => removeAttachment(a)}
                    className="size-6! rounded-md! [&_svg]:size-3! pointer-coarse:size-8!"
                  />
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
            "block w-full resize-none bg-transparent px-1 py-1 text-[14.5px] leading-6 text-foreground outline-none",
            "placeholder:text-muted-foreground disabled:cursor-not-allowed",
          )}
        />
        <span id={hintId} className="sr-only">
          Enter to send, Shift+Enter for a new line.
        </span>

        {words.length > 0 && (
          <p aria-hidden className="px-1 pb-1 text-[14.5px] leading-6 text-muted-foreground">
            {words.map((w, i) => (
              <span key={i} className="animate-[kn-word_320ms_var(--kn-ease-out,cubic-bezier(.22,1,.36,1))_both] motion-reduce:animate-none">
                {w}{" "}
              </span>
            ))}
          </p>
        )}

        {/* Toolbar */}
        <div className="mt-1 flex items-center gap-1">
          <Menu
            aria-label="Add to message"
            items={attachItems}
            onSelect={(item) => onAttach?.(item.id as AttachKind)}
            trigger={<TipButton tip="Add files and more" variant="ghost" size="sm" disabled={disabled} aria-label="Add files and more" icon={<Plus />} />}
          />

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
                <span key={mode} className="flex items-center gap-1.5 animate-[kn-word_220ms_var(--kn-ease-out,cubic-bezier(.22,1,.36,1))_both] motion-reduce:animate-none">
                  <span aria-hidden className="grid [&_svg]:size-3.5">
                    <modeInfo.icon />
                  </span>
                  <span className="@max-[419px]:hidden @min-[680px]:hidden">{modeInfo.short}</span>
                  <span className="hidden @min-[680px]:inline">{modeInfo.label}</span>
                </span>
              </TipButton>
            }
          />

          <div className="flex-1" />

          {models.length > 0 && (
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
                  aria-label={`Model: ${current?.name ?? "none"}`}
                  className="px-2! @max-[419px]:w-7 @max-[419px]:px-0! pointer-coarse:@max-[419px]:w-9"
                >
                  <span key={current?.id} className="flex items-center gap-1.5 animate-[kn-word_220ms_var(--kn-ease-out,cubic-bezier(.22,1,.36,1))_both] motion-reduce:animate-none">
                    <Logo className="size-3.5">{current?.icon ?? modelIcon(current?.name) ?? <Spark />}</Logo>
                    <span className="max-w-[140px] truncate text-foreground/85 @max-[419px]:hidden">{current?.name}</span>
                    <span className="contents @max-[419px]:hidden">
                      <Chevron />
                    </span>
                  </span>
                </TipButton>
              }
            />
          )}

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
            <TipButton tip="Stop" variant="primary" size="sm" aria-label="Stop" icon={<StopGlyph />} onClick={onStop} className="rounded-full! animate-[kn-pop_200ms_var(--kn-ease-out,cubic-bezier(.22,1,.36,1))_both] motion-reduce:animate-none" />
          ) : (
            <TipButton
              tip="Send"
              variant="primary"
              size="sm"
              aria-label="Send"
              icon={<ArrowUp />}
              disabled={disabled || !sendable}
              onClick={submit}
              className="rounded-full!"
            />
          )}
        </div>
      </div>

      {bottom && (
        <div className="flex min-h-10 items-center justify-between gap-2 border-t border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] bg-muted/40 px-1.5 py-1 text-muted-foreground">
          {bottom}
        </div>
      )}
    </div>
  );
}

export default ChatComposer;
