"use client";
/** @registry name="call-overlay" type="ui" title="Call overlay" description="A call and recording overlay for AI voice apps, built on live-activity: connecting, live, on hold, muted, recording and ended in a collapsed pill with a timer, mute and end, opening into a card with who is speaking, hold, record and a confirmed end. A recording variant has pause, stop and discard. Controlled; bring your own timer and audio." */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { SwapText } from "@/registry/knowns/lib/knowns/motion";
import { Button } from "../button";
import { Tooltip } from "../tooltip";
import { LiveActivity, formatClock, spokenClock, useElapsed } from "../live-activity/live-activity";
import { callAnnouncement, callDot, callWord, speakerLine, type CallSpeaker, type CallStatus } from "./call-state";

export { barHeights, callAnnouncement, callDot, callWord, level, rmsLevel, smoothLevel, speakerLine } from "./call-state";
export type { CallSpeaker, CallStatus } from "./call-state";

/* ── Glyphs: 16px strokes, in the button's colour ── */

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
export const MicGlyph = () => svg(<><rect x="5.75" y="1.75" width="4.5" height="7.5" rx="2.25" /><path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.25" /></>);
export const MicOffGlyph = () => svg(<><rect x="5.75" y="1.75" width="4.5" height="7.5" rx="2.25" /><path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.25M2 2l12 12" /></>);
export const PauseGlyph = () => svg(<path d="M5.5 3.5v9M10.5 3.5v9" />);
export const PlayGlyph = () => svg(<path d="M5 3.2v9.6L12.6 8z" />);
export const RecordGlyph = () => svg(<circle cx="8" cy="8" r="3.6" fill="currentColor" />);
export const StopGlyph = () => svg(<rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" />);
export const PhoneEndGlyph = () => svg(<path d="M2 9.6c3.6-3 8.4-3 12 0l-1.5 2-2.3-1v-1.8a5.6 5.6 0 0 0-4.4 0v1.8l-2.3 1z" />);
export const TrashGlyph = () => svg(<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8h5.8l.6-8" />);

/** A call's clock: milliseconds since `startedAt`, ticking each second while `running`. Pass `now` to pin it (tests, demos). */
export function useCallTimer(startedAt: Date, running: boolean, now?: Date) {
  return useElapsed(startedAt, running, undefined, now);
}

/** A coloured tile for an agent: its initials in white on a colour taken from its name (or `accent`). */
export function AgentTile({ name, accent, className }: { name: string; accent?: string; className?: string }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  return (
    <span role="img" aria-label={name} className={cn("grid size-8 flex-none place-items-center rounded-[10px] text-[12px] font-semibold text-white", className)} style={{ background: accent ?? `linear-gradient(135deg, oklch(0.66 0.17 ${h}), oklch(0.5 0.17 ${(h + 40) % 360}))` }}>
      {initials}
    </span>
  );
}

/** Five still bars that say "someone is speaking". They do not move: the Pro layer swaps in a meter that follows the voice. */
export function VoiceBars({ active = false, className }: { active?: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("inline-flex h-4 flex-none items-center gap-0.5", className)}>
      {[0.45, 0.8, 0.55, 1, 0.6].map((h, i) => (
        <span key={i} className={cn("h-full w-[3px] rounded-full transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out)", active ? "bg-[color:var(--kn-accent,var(--primary))]" : "bg-muted-foreground/35")} style={{ transform: `scaleY(${h})` }} />
      ))}
    </span>
  );
}

/** The clock as 2:05 for the eye, and in words for a screen reader (which reads it on demand, not every second). */
function Clock({ ms }: { ms: number }) {
  return (
    <>
      <span className="sr-only">Elapsed {spokenClock(ms)}</span>
      <span aria-hidden="true">{formatClock(ms)}</span>
    </>
  );
}

/** The red recording dot. Still, never pulsing: a recording dot that loops is a decoration. */
export function RecDot({ paused, className }: { paused?: boolean; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-2.5 flex-none rounded-full transition-colors duration-(--kn-dur-fast) ease-(--kn-ease-out)", paused ? "bg-muted-foreground/60" : "bg-red-500", className)} />;
}

/** One round control. A toggle says whether it is pressed; a plain one is just a button. The name is the label, shown as a tooltip. */
function Control({ label, icon, pressed, onClick, disabled, variant, size = "sm", children }: { label: string; icon: ReactNode; pressed?: boolean; onClick?: () => void; disabled?: boolean; variant?: "secondary" | "ghost" | "destructive" | "primary"; size?: "xs" | "sm"; children?: ReactNode }) {
  const v = variant ?? (pressed ? "primary" : "secondary");
  const iconOnly = (
    <Tooltip content={label}>
      <Button size={size} variant={v} icon={icon} aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick} />
    </Tooltip>
  );
  // With a text label: below 360px the card shows the same control as an icon, so End stays on the row.
  return children ? (
    <>
      <span className="contents @max-[360px]/call:hidden">
        <Button size={size} variant={v} icon={icon} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
          {children}
        </Button>
      </span>
      <span className="hidden @max-[360px]/call:contents">{iconOnly}</span>
    </>
  ) : (
    <Tooltip content={label}>
      <Button size={size} variant={v} icon={icon} aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick} />
    </Tooltip>
  );
}

export interface CallOverlayProps {
  /** The other side: an agent's name. */
  name: string;
  /** An avatar for the agent. Default: initials. */
  avatar?: ReactNode;
  status: CallStatus;
  /** Your microphone is off. A flag on a live call, not a state of its own. */
  muted?: boolean;
  onMutedChange?: (muted: boolean) => void;
  /** The call is on hold. */
  onHoldChange?: (hold: boolean) => void;
  /** The call is being recorded. */
  recording?: boolean;
  onRecordingChange?: (recording: boolean) => void;
  /** Called when the person confirms ending the call. */
  onEnd?: () => void;
  /** Ask before ending, inline in the card (never a native dialog). Default true. */
  confirmEnd?: boolean;
  /** How long the call has run, in milliseconds. You own the clock: see `useCallTimer`. */
  elapsedMs: number;
  /** Who is speaking right now. */
  speaker?: CallSpeaker;
  /** A level meter for the pill and the card (Pro: `LiveCallOverlay` fills it from a microphone). */
  meter?: ReactNode;
  /** One line of what is being said, under the speaker (Pro: `LiveCallOverlay`). */
  transcript?: ReactNode;
  /** A device picker button, between Hold and Record (Pro: `LiveCallOverlay`). */
  devices?: ReactNode;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  tone?: "auto" | "inverse" | "surface";
  accent?: string;
  className?: string;
}

/**
 * A call, as a pill that opens into a card. The pill: status dot, the word for the call, the clock, mute and end. The card adds who is
 * speaking, hold, record, and an inline "End this call?" step. Everything is controlled: you pass the state and handle the events; the
 * component never opens a microphone. The elapsed clock is yours, so a pause or a reconnect counts the way your app counts it.
 */
export function CallOverlay({ name, avatar, status, muted = false, onMutedChange, onHoldChange, recording = false, onRecordingChange, onEnd, confirmEnd = true, elapsedMs, speaker = null, meter, transcript, devices, expanded: expandedProp, defaultExpanded = false, onExpandedChange, tone = "surface", accent, className }: CallOverlayProps) {
  const [kept, setKept] = useState(defaultExpanded);
  const open = expandedProp ?? kept;
  const setOpen = (v: boolean) => {
    if (expandedProp === undefined) setKept(v);
    onExpandedChange?.(v);
  };
  const [confirming, setConfirming] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const ended = status === "ended";
  const live = status === "live";
  const word = callWord(status, muted, recording);

  // A polite live region that speaks on a change of state only, never on a tick of the clock.
  const msRef = useRef(elapsedMs);
  msRef.current = elapsedMs;
  const [said, setSaid] = useState("");
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaid(callAnnouncement(name, status, muted, recording, spokenClock(msRef.current)));
  }, [name, status, muted, recording]);

  useEffect(() => {
    if (confirming && open) keepRef.current?.focus();
  }, [confirming, open]);
  useEffect(() => {
    if (ended) setConfirming(false);
  }, [ended]);

  const askEnd = () => {
    if (!confirmEnd) return onEnd?.();
    setOpen(true);
    setConfirming(true);
  };
  const reallyEnd = () => {
    setConfirming(false);
    onEnd?.();
  };

  const toggleMute = () => onMutedChange?.(!muted);
  const rowActions = open || ended ? undefined : (
    <>
      <Control label={muted ? "Unmute microphone" : "Mute microphone"} icon={muted ? <MicOffGlyph /> : <MicGlyph />} pressed={muted} disabled={ended} onClick={toggleMute} size="xs" />
      <Control label="End call" icon={<PhoneEndGlyph />} variant="destructive" disabled={ended} onClick={askEnd} size="xs" />
    </>
  );

  return (
    <div className={cn("w-full max-w-sm @container/call", className)}>
      <LiveActivity
        leading={avatar ?? <AgentTile name={name} accent={accent} />}
        title={name}
        label={`Call with ${name}`}
        subtitle={
          <span className="flex min-w-0 items-center gap-2">
            {recording && !ended && <RecDot />}
            <SwapText value={word}>{word}</SwapText>
            {meter && live && !open && <span className="flex-none">{meter}</span>}
          </span>
        }
        trailing={status === "connecting" ? undefined : <Clock ms={elapsedMs} />}
        state={callDot(status)}
        tone={tone}
        accent={accent}
        expanded={open}
        onExpandedChange={setOpen}
        rowActions={rowActions}
      >
        <div className="flex flex-col gap-3">
          {ended ? (
            <p className="text-[13px] text-muted-foreground">
              Call ended · <span className="tabular-nums">{formatClock(elapsedMs)}</span>
            </p>
          ) : (
            <div className="flex min-h-6 items-center gap-2.5">
              {live ? (meter ?? <VoiceBars active={speaker === "agent" || (speaker === "you" && !muted)} />) : <VoiceBars />}
              <p className="min-w-0 flex-1 truncate text-[13px] text-foreground/80">
                <SwapText value={`${status}-${speaker}-${muted}`}>{speakerLine(speaker, name, status, muted)}</SwapText>
              </p>
            </div>
          )}
          {transcript && !ended && <div className="min-h-10 text-[14px] leading-snug">{transcript}</div>}
          {ended ? null : confirming ? (
            <div role="group" aria-label="End this call?" className="flex flex-col gap-2" onKeyDown={(e) => e.key === "Escape" && setConfirming(false)}>
              <p className="text-[13px] font-medium">End this call?</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="destructive" onClick={reallyEnd}>
                  End call
                </Button>
                <Button ref={keepRef} size="sm" variant="secondary" onClick={() => setConfirming(false)}>
                  Keep talking
                </Button>
              </div>
            </div>
          ) : (
            <div role="group" aria-label="Call controls" className="flex flex-wrap items-center gap-2">
              <Control label={muted ? "Unmute" : "Mute"} icon={muted ? <MicOffGlyph /> : <MicGlyph />} pressed={muted} disabled={ended} onClick={toggleMute}>
                {muted ? "Unmute" : "Mute"}
              </Control>
              <Control label={status === "hold" ? "Resume" : "Hold"} icon={status === "hold" ? <PlayGlyph /> : <PauseGlyph />} pressed={status === "hold"} disabled={ended || status === "connecting"} onClick={() => onHoldChange?.(status !== "hold")}>
                {status === "hold" ? "Resume" : "Hold"}
              </Control>
              {devices}
              <Control label={recording ? "Stop recording" : "Record"} icon={<RecordGlyph />} pressed={recording} disabled={!live} onClick={() => onRecordingChange?.(!recording)}>
                {recording ? "Stop" : "Rec"}
              </Control>
              <span className="min-w-2 flex-1" />
              <Control label="End call" icon={<PhoneEndGlyph />} variant="destructive" disabled={ended} onClick={askEnd}>
                End
              </Control>
            </div>
          )}
        </div>
      </LiveActivity>
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {said}
      </p>
    </div>
  );
}

export interface RecordingOverlayProps {
  /** What is being recorded: "Call with Aria", "Voice note". */
  title?: string;
  paused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  /** Stop and keep the recording. */
  onStop?: () => void;
  /** Throw the recording away. Asked inline first, never a native dialog. */
  onDiscard?: () => void;
  elapsedMs: number;
  /** A line in the card: where it will be saved, how big it is. */
  children?: ReactNode;
  /** A level meter next to the word (Pro: `LiveCallOverlay`'s `LevelMeter`). */
  meter?: ReactNode;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  tone?: "auto" | "inverse" | "surface";
  className?: string;
}

/** A recording: a red dot, the clock, pause or resume, and stop. The card adds Discard, with an inline "Discard this recording?" step. */
export function RecordingOverlay({ title = "Recording", paused = false, onPausedChange, onStop, onDiscard, elapsedMs, children, meter, expanded: expandedProp, defaultExpanded = false, onExpandedChange, tone = "surface", className }: RecordingOverlayProps) {
  const [kept, setKept] = useState(defaultExpanded);
  const open = expandedProp ?? kept;
  const setOpen = (v: boolean) => {
    if (expandedProp === undefined) setKept(v);
    onExpandedChange?.(v);
  };
  const [confirming, setConfirming] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming && open) keepRef.current?.focus();
  }, [confirming, open]);
  const word = paused ? "Paused" : "Recording";

  const msRef = useRef(elapsedMs);
  msRef.current = elapsedMs;
  const [said, setSaid] = useState("");
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaid(`${word}, ${spokenClock(msRef.current)}`);
  }, [word]);

  const rowActions = open ? undefined : (
    <>
      <Control label={paused ? "Resume recording" : "Pause recording"} icon={paused ? <PlayGlyph /> : <PauseGlyph />} onClick={() => onPausedChange?.(!paused)} size="xs" />
      <Control label="Stop recording" icon={<StopGlyph />} variant="destructive" onClick={onStop} size="xs" />
    </>
  );
  return (
    <div className={cn("w-full max-w-sm @container/call", className)}>
      <LiveActivity
        leading={<RecDot paused={paused} className="size-3" />}
        title={title}
        label={title}
        subtitle={
          <span className="flex min-w-0 items-center gap-2">
            <SwapText value={word}>{word}</SwapText>
            {meter && !paused && <span className="flex-none">{meter}</span>}
          </span>
        }
        trailing={<Clock ms={elapsedMs} />}
        tone={tone}
        expanded={open}
        onExpandedChange={setOpen}
        rowActions={rowActions}
      >
        <div className="flex flex-col gap-3">
          {children && <div className="text-[13px] text-muted-foreground">{children}</div>}
          {confirming ? (
            <div role="group" aria-label="Discard this recording?" className="flex flex-col gap-2" onKeyDown={(e) => e.key === "Escape" && setConfirming(false)}>
              <p className="text-[13px] font-medium">Discard this recording?</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setConfirming(false);
                    onDiscard?.();
                  }}
                >
                  Discard
                </Button>
                <Button ref={keepRef} size="sm" variant="secondary" onClick={() => setConfirming(false)}>
                  Keep it
                </Button>
              </div>
            </div>
          ) : (
            <div role="group" aria-label="Recording controls" className="flex flex-wrap items-center gap-2">
              <Control label={paused ? "Resume" : "Pause"} icon={paused ? <PlayGlyph /> : <PauseGlyph />} onClick={() => onPausedChange?.(!paused)}>
                {paused ? "Resume" : "Pause"}
              </Control>
              <Control label="Stop" icon={<StopGlyph />} variant="primary" onClick={onStop}>
                Stop
              </Control>
              <span className="min-w-2 flex-1" />
              <Control label="Discard" icon={<TrashGlyph />} variant="ghost" onClick={() => setConfirming(true)}>
                Discard
              </Control>
            </div>
          )}
        </div>
      </LiveActivity>
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {said}
      </p>
    </div>
  );
}
