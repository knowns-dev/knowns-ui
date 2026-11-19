/** Pure helpers for Now Playing: time text, clamping, local position ticking, labels and the generated cover colours. No React, no DOM. */

/** 83 -> "1:23", 3725 -> "1:02:05". Negative, NaN and Infinity read as 0:00. */
export function formatTime(seconds: number): string {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** What a screen reader hears for the scrubber: "1:23 of 3:45". */
export function spokenPosition(position: number, duration: number, join: (p: string, d: string) => string = (p, d) => `${p} of ${d}`): string {
  return join(formatTime(position), formatTime(duration));
}

/** Keeps a position inside 0..duration. An unknown duration (0, NaN) only floors at 0. */
export function clampPosition(position: number, duration: number): number {
  const p = Number.isFinite(position) ? Math.max(0, position) : 0;
  return duration > 0 && Number.isFinite(duration) ? Math.min(p, duration) : p;
}

/** Played share, 0 to 1. */
export function progressOf(position: number, duration: number): number {
  return duration > 0 && Number.isFinite(duration) ? clampPosition(position, duration) / duration : 0;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A gradient cover from the track's own words, so a track without art still has a stable face. Pass `hue` (0 to 360) to pick the colour yourself; otherwise it is one of five clearly different families (orange, violet-blue, teal, rose, green). */
const FAMILIES: [number, number][] = [[48, 22], [268, 232], [182, 205], [345, 312], [145, 118]];
export function coverGradient(seed: string, hue?: number): string {
  const h = hash(seed);
  const [a, b] = hue !== undefined ? [hue, (hue + 36) % 360] : FAMILIES[h % FAMILIES.length]!;
  const angle = 120 + ((h >>> 17) % 90);
  return `linear-gradient(${angle}deg, oklch(0.74 0.17 ${a}), oklch(0.58 0.2 ${b}))`;
}

/** A plain colour for where oklch() is unsupported (an old phone browser): the same family in hsl, set as the background colour under the gradient. */
export function coverFallback(seed: string, hue?: number): string {
  const h = hash(seed);
  const a = hue !== undefined ? hue : FAMILIES[h % FAMILIES.length]![0];
  return `hsl(${Math.round(a)} 72% 58%)`;
}

/** The resting level bars: a fixed, calm skyline so a paused or static player still has a shape. Values 0 to 1. */
export const STATIC_LEVELS = [0.45, 0.8, 0.55, 0.95, 0.65];

/** Turns any list of levels into exactly `count` bars, each 0.12 to 1 (a bar never vanishes). */
export function fitLevels(levels: readonly number[] | undefined, count = 5): number[] {
  const src = levels && levels.length > 0 ? levels : STATIC_LEVELS;
  return Array.from({ length: count }, (_, i) => {
    const v = src[Math.min(src.length - 1, Math.floor((i / count) * src.length))] ?? 0;
    return Math.min(1, Math.max(0.12, Number.isFinite(v) ? v : 0.12));
  });
}

/* ── Remote, pushed state ── */

/**
 * Where a position pushed from outside is now. `updatedAt` is when the host read it (ms since the epoch). While playing the clock keeps
 * running since then; paused, it stands still. Clamped to 0..duration when the duration is known.
 */
export function projectPosition({ position, updatedAt, playing, now, duration }: { position: number; updatedAt?: number; playing: boolean; now: number; duration?: number }): number {
  const base = Number.isFinite(position) ? Math.max(0, position) : 0;
  const run = playing && updatedAt !== undefined && Number.isFinite(updatedAt) ? Math.max(0, now - updatedAt) / 1000 : 0;
  const p = base + run;
  return duration && duration > 0 ? Math.min(p, duration) : p;
}

/**
 * What to show when a push arrives while a local clock is already running. A push slightly behind what is on screen (a late or
 * stale reading, up to `tolerance` seconds) is ignored so the time never jumps back; ahead of the screen, or a real seek back
 * further than the tolerance, is taken. Paused or a new track: always take the push.
 */
export function reconcilePosition({ shown, pushed, playing, tolerance = 2.5 }: { shown: number; pushed: number; playing: boolean; tolerance?: number }): number {
  if (!playing) return pushed;
  if (pushed >= shown) return pushed;
  return shown - pushed <= tolerance ? shown : pushed;
}

/** 0 to 100, whole numbers. NaN reads as 0. */
export function clampVolume(v: number): number {
  return Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : 0;
}

/* ── Text ── */

/** Every string the player shows or says. Pass any of them in `labels` (a translation, a brand word); the rest stay English. */
export interface NowPlayingLabels {
  nowPlaying: string;
  nothingPlaying: string;
  play: string;
  pause: string;
  previous: string;
  next: string;
  mute: string;
  unmute: string;
  position: string;
  volume: string;
  /** Spoken value of the scrubber. Default "1:23 of 3:45". */
  positionText: (position: string, duration: string) => string;
  /** Spoken and shown volume. Default "50%". */
  volumeText: (volume: number) => string;
  /** The pill's own button name, used when it opens. Default "Title, Artist". */
  trackText: (title: string, artist: string) => string;
}

export const DEFAULT_LABELS: NowPlayingLabels = {
  nowPlaying: "Now playing",
  nothingPlaying: "Nothing playing",
  play: "Play",
  pause: "Pause",
  previous: "Previous track",
  next: "Next track",
  mute: "Mute",
  unmute: "Unmute",
  position: "Position",
  volume: "Volume",
  positionText: (p, d) => `${p} of ${d}`,
  volumeText: (v) => `${v}%`,
  trackText: (t, a) => `${t}, ${a}`,
};

export function resolveLabels<T extends object>(defaults: T, given?: Partial<T>): T {
  const out = { ...defaults };
  for (const k of Object.keys(given ?? {}) as (keyof T)[]) if (given![k] !== undefined) out[k] = given![k] as T[keyof T];
  return out;
}
