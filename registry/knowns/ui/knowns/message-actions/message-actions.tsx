"use client";
/** @registry name="message-actions" type="ui" title="Message actions" description="The quiet action bar under an assistant message: Copy that turns into a check, Regenerate with a version switcher, thumbs up and down with a short reason picker, Read aloud with a live equalizer, and an overflow menu." */

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn, writeClipboard } from "@/registry/knowns/lib/knowns/utils";
import { Button } from "../button";
import { Menu, type MenuItem } from "../menu";
import { Tooltip } from "../tooltip";
import { Toggle } from "../toggle-group";
import { Textarea } from "../input";
import { DEFAULT_REASONS, nextFeedback, stepVersion, toggleReason, toolbarKey, type Feedback } from "./message-actions-utils";

export type { Feedback } from "./message-actions-utils";

export interface FeedbackReason {
  reasons: string[];
  note?: string;
}

export interface MessageActionsProps {
  /** The message's text, for Copy and Read aloud. */
  text: string;
  /** Called after the text is copied. */
  onCopy?: () => void;
  /** Shows Regenerate. Return a promise to spin until it settles, or control it with `regenerating`. */
  onRegenerate?: () => void | Promise<unknown>;
  regenerating?: boolean;
  /** 1-based version and how many there are; from 2 versions a ‹ 2/3 › switcher appears. */
  version?: number;
  versions?: number;
  onVersionChange?: (version: number) => void;
  /** Controlled thumbs. */
  feedback?: Feedback;
  /** Thumbs up or down; thumbs down comes with the reasons when the picker is sent. */
  onFeedback?: (value: Feedback, reason?: FeedbackReason) => void;
  /** Chips in the thumbs-down picker. */
  reasons?: string[];
  /** Offer Read aloud in the overflow menu. Uses the browser's speech when there is one. Default true. */
  readAloud?: boolean;
  /** Called when reading starts or stops (also without browser speech). */
  onReadAloud?: (playing: boolean) => void;
  /** More actions for the overflow menu. */
  more?: MenuItem[];
  onMore?: (item: MenuItem) => void;
  className?: string;
}

const CSS = `
@keyframes kmsa-pop { 0% { transform: scale(1) } 40% { transform: scale(1.28) } 100% { transform: scale(1) } }
@keyframes kmsa-eq { 0%, 100% { transform: scaleY(.35) } 50% { transform: scaleY(1) } }
@keyframes kmsa-in { from { opacity: 0; transform: translateY(-3px) } to { opacity: 1; transform: none } }
`;

/* ── Icons (16px, hairline) ── */
const I = {
  copy: <path d="M5.5 5.5V3.75c0-.69.56-1.25 1.25-1.25h5.5c.69 0 1.25.56 1.25 1.25v5.5c0 .69-.56 1.25-1.25 1.25H10.5M3.75 5.5h5.5c.69 0 1.25.56 1.25 1.25v5.5c0 .69-.56 1.25-1.25 1.25h-5.5c-.69 0-1.25-.56-1.25-1.25v-5.5c0-.69.56-1.25 1.25-1.25z" />,
  check: <path d="M3.5 8.5l3 3 6-7" />,
  regen: <path d="M12.75 6A5 5 0 1 0 13 9.5M13 3v3h-3" />,
  up: <path d="M5.5 7l2-4.25c.83 0 1.5.67 1.5 1.5V6.5h3.1c.8 0 1.4.74 1.23 1.52l-.9 4.25A1.25 1.25 0 0 1 11.2 13.25H5.5zM5.5 7H3.25v6.25H5.5" />,
  down: <path d="M10.5 9l-2 4.25c-.83 0-1.5-.67-1.5-1.5V9.5H3.9c-.8 0-1.4-.74-1.23-1.52l.9-4.25A1.25 1.25 0 0 1 4.8 2.75h5.7zM10.5 9h2.25V2.75H10.5" />,
  more: (
    <>
      <circle cx="3.5" cy="8" r=".9" fill="currentColor" />
      <circle cx="8" cy="8" r=".9" fill="currentColor" />
      <circle cx="12.5" cy="8" r=".9" fill="currentColor" />
    </>
  ),
  prev: <path d="M9.5 4l-4 4 4 4" />,
  next: <path d="M6.5 4l4 4-4 4" />,
  speak: <path d="M3 6.25h2l3-2.5v8.5l-3-2.5H3zM10.5 6a2.5 2.5 0 0 1 0 4M12.25 4.25a5 5 0 0 1 0 7.5" />,
};
const Icon = ({ children, className }: { children: ReactNode; className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cn("size-4", className)}>
    {children}
  </svg>
);

/** Three bars that move while the message is read aloud (still with reduced motion). */
function Equalizer() {
  return (
    <span aria-hidden="true" className="flex h-3 items-end gap-[2px]">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-full w-[2px] origin-bottom rounded-full bg-current motion-safe:[animation:kmsa-eq_.9s_ease-in-out_infinite]" style={{ animationDelay: `${i * 0.15}s`, transform: "scaleY(.6)" }} />
      ))}
    </span>
  );
}

/**
 * The quiet action bar under an assistant message: Copy (turns into a check), Regenerate (spins, then a
 * ‹ 2/3 › version switcher), thumbs up and down (down asks why, briefly), and an overflow menu with Read
 * aloud and your own actions. A toolbar: one tab stop, arrow keys between buttons.
 */
export function MessageActions({
  text,
  onCopy,
  onRegenerate,
  regenerating: regeneratingProp,
  version = 1,
  versions = 1,
  onVersionChange,
  feedback: feedbackProp,
  onFeedback,
  reasons = DEFAULT_REASONS,
  readAloud = true,
  onReadAloud,
  more = [],
  onMore,
  className,
}: MessageActionsProps) {
  const bar = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const regenerating = regeneratingProp ?? busy;
  const [ownFeedback, setOwnFeedback] = useState<Feedback>(null);
  const feedback = feedbackProp !== undefined ? feedbackProp : ownFeedback;
  const [popped, setPopped] = useState<"up" | "down" | null>(null);
  const [asking, setAsking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [reading, setReading] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const pickerId = useId();

  useEffect(() => () => {
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }, []);

  const say = (msg: string) => {
    setStatus("");
    requestAnimationFrame(() => setStatus(msg));
  };

  const copy = async () => {
    try {
      await writeClipboard(text);
    } catch {
      /* clipboard blocked: still report the click */
    }
    setCopied(true);
    say("Copied");
    onCopy?.();
    setTimeout(() => setCopied(false), 1600);
  };

  const regenerate = async () => {
    if (!onRegenerate || regenerating) return;
    const r = onRegenerate();
    if (r && typeof (r as Promise<unknown>).then === "function") {
      setBusy(true);
      try {
        await r;
      } finally {
        setBusy(false);
      }
    }
  };

  const setFeedback = (v: Feedback, reason?: FeedbackReason) => {
    if (feedbackProp === undefined) setOwnFeedback(v);
    onFeedback?.(v, reason);
  };
  const thumb = (which: "up" | "down") => {
    const next = nextFeedback(feedback, which);
    setPopped(next ? which : null);
    if (which === "down" && next === "down") {
      setFeedback("down");
      setAsking(true);
      return;
    }
    setAsking(false);
    setFeedback(next);
    if (next === "up") say("Thanks for the feedback");
  };
  const sendReason = () => {
    setFeedback("down", { reasons: picked, note: note.trim() || undefined });
    setAsking(false);
    setPicked([]);
    setNote("");
    say("Thanks, that helps us improve");
  };

  const toggleRead = () => {
    const next = !reading;
    setReading(next);
    onReadAloud?.(next);
    if (typeof speechSynthesis === "undefined") return;
    speechSynthesis.cancel();
    if (next) {
      const u = new SpeechSynthesisUtterance(text);
      u.onend = () => {
        setReading(false);
        onReadAloud?.(false);
      };
      speechSynthesis.speak(u);
    }
  };

  // Roving focus: one tab stop, arrows between buttons.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(bar.current?.querySelectorAll<HTMLButtonElement>("[data-ma]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (i === -1) return;
    const next = toolbarKey(i, e.key, items.length);
    if (next === null) return;
    e.preventDefault();
    setFocusIndex(next);
    items[next].focus();
  };
  let n = 0;
  const rove = () => {
    const idx = n++;
    return { "data-ma": "", tabIndex: idx === focusIndex ? 0 : -1, onFocus: () => setFocusIndex(idx) };
  };

  const iconButton = (label: string, icon: ReactNode, onClick: () => void, extra: { pressed?: boolean; className?: string; disabled?: boolean } = {}) => (
    <Tooltip content={label}>
      <Button
        {...rove()}
        variant="ghost"
        size="sm"
        aria-label={label}
        aria-pressed={extra.pressed}
        disabled={extra.disabled}
        onClick={onClick}
        className={cn("text-muted-foreground hover:text-foreground aria-pressed:text-foreground", extra.className)}
        icon={icon}
      />
    </Tooltip>
  );

  const menuItems: MenuItem[] = [...(readAloud ? [{ id: "kn-read", label: reading ? "Stop reading" : "Read aloud", icon: <Icon>{I.speak}</Icon> }] : []), ...more];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <style href="kn-message-actions" precedence="default">
        {CSS}
      </style>
      <div ref={bar} role="toolbar" aria-label="Message actions" onKeyDown={onKeyDown} className="-ml-1.5 flex flex-wrap items-center gap-0.5">
        {iconButton(copied ? "Copied" : "Copy", <Icon className={cn(copied && "text-emerald-600 dark:text-emerald-400")}>{copied ? I.check : I.copy}</Icon>, copy)}
        {iconButton("Good response", <Icon className={cn(popped === "up" && feedback === "up" && "motion-safe:[animation:kmsa-pop_.32s_ease-out]")}>{I.up}</Icon>, () => thumb("up"), { pressed: feedback === "up" })}
        {iconButton("Bad response", <Icon className={cn(popped === "down" && feedback === "down" && "motion-safe:[animation:kmsa-pop_.32s_ease-out]")}>{I.down}</Icon>, () => thumb("down"), { pressed: feedback === "down" })}
        {onRegenerate && iconButton(regenerating ? "Regenerating" : "Regenerate", <Icon className={cn(regenerating && "motion-safe:animate-spin")}>{I.regen}</Icon>, regenerate, { disabled: regenerating })}
        {versions > 1 && (
          <span className="ml-0.5 flex items-center motion-safe:[animation:kmsa-in_.2s_ease-out]">
            {iconButton("Previous version", <Icon>{I.prev}</Icon>, () => onVersionChange?.(stepVersion(version, versions, -1)), { disabled: version <= 1 })}
            <span className="min-w-[2.5rem] text-center text-[13px] text-muted-foreground tabular-nums" aria-live="polite">
              {`${version}/${versions}`}
            </span>
            {iconButton("Next version", <Icon>{I.next}</Icon>, () => onVersionChange?.(stepVersion(version, versions, 1)), { disabled: version >= versions })}
          </span>
        )}
        {reading && (
          <Button {...rove()} variant="ghost" size="sm" onClick={toggleRead} aria-label="Stop reading" className="gap-1.5 text-foreground">
            <Equalizer />
            <span className="text-[13px]">Stop</span>
          </Button>
        )}
        {menuItems.length > 0 && (
          <Menu
            trigger={<Button {...rove()} variant="ghost" size="sm" aria-label="More actions" className="text-muted-foreground hover:text-foreground" icon={<Icon>{I.more}</Icon>} />}
            items={menuItems}
            onSelect={(item) => (item.id === "kn-read" ? toggleRead() : onMore?.(item))}
            aria-label="More actions"
          />
        )}
      </div>

      {asking && (
        <div role="group" aria-labelledby={`${pickerId}-t`} className="max-w-md rounded-[8px] bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] px-3 py-2.5 motion-safe:[animation:kmsa-in_.2s_ease-out]">
          <p id={`${pickerId}-t`} className="mb-2 text-[13px] font-semibold text-foreground">
            What went wrong?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {reasons.map((r) => (
              <Toggle key={r} size="sm" variant="outline" pressed={picked.includes(r)} onPressedChange={() => setPicked((p) => toggleReason(p, r))}>
                {r}
              </Toggle>
            ))}
          </div>
          <Textarea aria-label="Anything else (optional)" placeholder="Anything else? (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="mt-2" />
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={sendReason}>
              Send
            </Button>
          </div>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {status}
      </span>
    </div>
  );
}

export default MessageActions;
