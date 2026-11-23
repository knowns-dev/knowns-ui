/** @registry part-of="template-waitlist-landing" */
/** Pure helpers for the waitlist landing page: the countdown parts and the position line. No React. */

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** The launch time has passed. */
  done: boolean;
}

/** Whole days, hours, minutes and seconds left until `target` (ms since the epoch). Zero and done once it has passed. */
export function countdownParts(target: number, now: number): CountdownParts {
  const left = Math.max(0, Math.floor((target - now) / 1000));
  return {
    days: Math.floor(left / 86_400),
    hours: Math.floor((left % 86_400) / 3600),
    minutes: Math.floor((left % 3600) / 60),
    seconds: left % 60,
    done: target - now <= 0,
  };
}

/** Two digits, padded with a zero. */
export const pad2 = (n: number) => String(n).padStart(2, "0");

/** "You are number 1,204 on the list": the count with thousands separators. */
export function positionLine(position: number): string {
  return `You are number ${position.toLocaleString("en-US")} on the list`;
}
