/** @registry part-of="hold-button" */
/** Pure parts of HoldButton: progress of a press against the clock, its phase, and which keys hold. */

/** How long a press must last before it counts, ms. */
export const HOLD_MS = 1200;

/** 0..1 of the hold done after `elapsed` ms. */
export const holdProgress = (elapsed: number, duration = HOLD_MS) => (duration <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / duration)));

export type HoldPhase = "idle" | "holding" | "done";

/** The phase of a hold that started at `startedAt` (null = not pressed). Done once progress reaches 1. */
export const holdPhase = (startedAt: number | null, now: number, duration = HOLD_MS): HoldPhase => (startedAt === null ? "idle" : holdProgress(now - startedAt, duration) >= 1 ? "done" : "holding");

/** Keys that start a keyboard hold. A repeat event from holding the key down is not a new press. */
export const isHoldKey = (e: { key: string; repeat?: boolean }) => (e.key === " " || e.key === "Enter") && !e.repeat;

/** The hint under a hold button, from its duration: "Press and hold for 1.2 seconds". */
export const holdHint = (duration = HOLD_MS) => `Press and hold for ${(duration / 1000).toFixed(1)} seconds, with the mouse, a finger, or Space or Enter. Let go to cancel.`;
