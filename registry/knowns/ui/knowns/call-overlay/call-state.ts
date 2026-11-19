/** @registry part-of="call-overlay" */
/* Pure helpers for the call overlay: what a state is called, which dot it gets, what a screen reader hears, and the level maths. No React. */
import type { StatusDotState } from "../status-dot";

export type CallStatus = "connecting" | "live" | "hold" | "ended";
export type CallSpeaker = "agent" | "you" | null;

/** The one word for the call right now. Muted and recording are flags on a live call, so they refine the word instead of adding states. */
export function callWord(status: CallStatus, muted = false, recording = false): string {
  if (status === "connecting") return "Connecting";
  if (status === "hold") return "On hold";
  if (status === "ended") return "Ended";
  if (muted) return "Muted";
  return recording ? "Recording" : "Live";
}

/** The status dot: amber while connecting, running while live, quiet grey on hold and when it ended (an ended call is neutral, not a success). */
export function callDot(status: CallStatus): StatusDotState {
  return status === "connecting" ? "blocked" : status === "live" ? "busy" : "idle";
}

/** What a polite live region says when the state changes: "Live, 2 minutes 5 seconds". Never called per tick. */
export function callAnnouncement(name: string, status: CallStatus, muted: boolean, recording: boolean, spoken: string): string {
  const word = callWord(status, muted, recording);
  const extra = status === "live" && muted && recording ? ", recording" : "";
  return status === "connecting" ? `${word} to ${name}` : `${word}${extra} with ${name}, ${spoken}`;
}

/** The line next to the meter: who is speaking. */
export function speakerLine(speaker: CallSpeaker, name: string, status: CallStatus, muted: boolean): string {
  if (status !== "live") return status === "hold" ? "Waiting on hold" : status === "connecting" ? "Setting up the line" : "The call has ended";
  if (speaker === "agent") return `${name} is speaking`;
  if (speaker === "you") return muted ? "You are muted" : "You are speaking";
  return muted ? "You are muted" : "Listening";
}

/** A level is a fraction of full scale. Clamp it, and read a bad value as silence. */
export const level = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** The loudness of one frame of byte time-domain samples (AnalyserNode.getByteTimeDomainData, 128 = silence), 0 to 1. A little gain, so speech fills the bar. */
export function rmsLevel(samples: ArrayLike<number>, gain = 2.4): number {
  const n = samples.length;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const d = ((samples[i] ?? 128) - 128) / 128;
    sum += d * d;
  }
  return level(Math.sqrt(sum / n) * gain);
}

/** Fall back slowly and rise at once, so a bar does not flicker: the next shown level from the last one and a new reading. */
export const smoothLevel = (prev: number, next: number, fall = 0.18) => (next >= prev ? level(next) : level(prev - (prev - next) * fall));

/** `n` bar heights (0 to 1) from recent levels, newest last. Fewer levels than bars pad the left with silence. */
export function barHeights(levels: readonly number[], n: number): number[] {
  const tail = levels.slice(-n).map(level);
  return [...Array.from({ length: Math.max(0, n - tail.length) }, () => 0), ...tail];
}
