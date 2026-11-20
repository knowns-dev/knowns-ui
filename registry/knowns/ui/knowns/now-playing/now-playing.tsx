"use client";
/** @registry name="now-playing" type="ui" title="Now playing" description="A music player for an app that does not own the audio or does. A capsule built on Live Activity (pill that opens into a card), or a tile in three sizes (compact, medium, large) that fills its container and picks the size from its width. Headless: pass the pushed state (track, position, playing, volume) and the handlers; the time keeps running between pushes and never jumps back on a stale one. Empty and pending states, every string translatable, a read-only progress bar when there is no seek, and an optional useAudioPlayer hook." */

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/registry/knowns/lib/knowns/utils";
import { Button } from "../button";
import { LiveActivity, type LiveActivityProps } from "../live-activity/live-activity";
import { Slider } from "../slider";
import { DEFAULT_LABELS, clampPosition, clampVolume, coverFallback, coverGradient, fitLevels, formatTime, projectPosition, reconcilePosition, resolveLabels, spokenPosition, type NowPlayingLabels } from "./now-playing-utils";

export { formatTime, spokenPosition, clampPosition, progressOf, coverGradient, coverFallback, fitLevels, STATIC_LEVELS, projectPosition, reconcilePosition, clampVolume, DEFAULT_LABELS, resolveLabels } from "./now-playing-utils";
export type { NowPlayingLabels } from "./now-playing-utils";
export { useAudioPlayer, type AudioPlayer } from "./use-audio-player";

export interface NowPlayingTrack {
  title: string;
  artist: string;
  album?: string;
  /** Seconds. Can also come as the `duration` prop. */
  duration?: number;
  /** An image URL (http, https or data:), or any node. Without it a gradient is drawn from the title and artist. */
  cover?: string | ReactNode;
  /** Hue 0 to 360 for the generated gradient cover, so two tracks can be told apart. */
  hue?: number;
}

export type NowPlayingSize = "capsule" | "auto" | "large" | "medium" | "compact";

export interface NowPlayingProps extends Pick<LiveActivityProps, "expanded" | "defaultExpanded" | "onExpandedChange" | "tone" | "accent" | "className"> {
  /** What is playing. Null or omitted: the "nothing playing" state. */
  track?: NowPlayingTrack | null;
  /** Where it plays: "Music", "Spotify", a device. Shown small above the title in the tile sizes. */
  source?: string;
  /** Seconds played, as of `positionUpdatedAt`. */
  position: number;
  /**
   * When `position` was read, in ms since the epoch. Give it when the state is pushed from outside (a remote, a phone, a poll every second or two):
   * the time then keeps running locally between pushes, and a push a little behind the screen is ignored so it never jumps back. Omit it
   * and `position` is shown as is, which suits a player that updates every frame.
   */
  positionUpdatedAt?: number;
  /** Seconds in the track. Overrides `track.duration`. */
  duration?: number;
  playing: boolean;
  onPlayPause?: () => void;
  /** Called with the new position in seconds. Without it the scrubber is a read-only progress bar. */
  onSeek?: (seconds: number) => void;
  onNext?: () => void;
  onPrev?: () => void;
  /** 0 to 100. Without `onVolume` there is no volume control. */
  volume?: number;
  onVolume?: (volume: number) => void;
  muted?: boolean;
  /** Adds a mute button beside the volume. */
  onMute?: () => void;
  /** A command is in flight: the controls are disabled and the player is marked busy, until the next push. */
  pending?: boolean;
  /**
   * "capsule" (default): the Live Activity pill that opens into a card. "compact", "medium", "large": a tile that fills its container.
   * "auto": a tile that picks one of those three from its own width with container queries (under 340px compact, 340 to 459 medium, 460 and up large).
   * An explicit size never uses container queries, for browsers that have none.
   */
  size?: NowPlayingSize;
  /** Every visible and spoken string. Any you leave out stay English. */
  labels?: Partial<NowPlayingLabels>;
  /**
   * Heights 0 to 1 of the level bars. Omit for a calm static skyline (lit while playing, muted when paused);
   * feed real values (see Now Playing Pro) to make them move.
   */
  levels?: readonly number[];
  /** Tints the stretch of the scrubber from this second to the end in the accent colour (a fade zone, an outro). */
  markFrom?: number;
  /** Capsule only: big artwork at the top of the open card, in px (square, centred). 0 or omitted: none. */
  artwork?: number;
  /** Capsule only: names the capsule's group. Default: the `nowPlaying` label. */
  label?: string;
  /** Capsule only: the smaller pill. */
  compact?: boolean;
  /** Extra rows at the bottom of the open card (capsule) or under the tile: an up-next list, a mix panel. */
  children?: ReactNode;
}

const icon = (d: string) => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d={d} />
  </svg>
);
const PLAY = icon("M5 2.8v10.4a.5.5 0 0 0 .76.43l8.3-5.2a.5.5 0 0 0 0-.86l-8.3-5.2A.5.5 0 0 0 5 2.8z");
const PAUSE = icon("M4.5 2.5h2.5v11H4.5zM9 2.5h2.5v11H9z");
const NEXT = icon("M3 3.1v9.8a.4.4 0 0 0 .62.34L10 8.34V12.5h2.5v-9H10v4.16L3.62 2.76A.4.4 0 0 0 3 3.1z");
const PREV = icon("M13 3.1v9.8a.4.4 0 0 1-.62.34L6 8.34V12.5H3.5v-9H6v4.16l6.38-4.9A.4.4 0 0 1 13 3.1z");
const SPEAKER = (muted: boolean) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.5 6.2v3.6h2.4L8 12.5v-9L4.9 6.2z" />
    {muted ? <path d="M10.6 6.2l3 3.6M13.6 6.2l-3 3.6" /> : <path d="M10.6 5.8a3.1 3.1 0 0 1 0 4.4" />}
  </svg>
);
const NOTE = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 11.5V3.5l6-1.2v8" />
    <circle cx="4.5" cy="11.5" r="1.6" />
    <circle cx="10.5" cy="10.3" r="1.6" />
  </svg>
);

/** The cover: an image, a node, or a gradient made from the words (with a plain colour under it for browsers without oklch). */
export function NowPlayingCover({ track, size = 32, className }: { track: NowPlayingTrack | null | undefined; size?: number; className?: string }) {
  const box = cn("block flex-none overflow-hidden rounded-md", className);
  const dim: CSSProperties = { width: size, height: size };
  if (!track) return <span aria-hidden="true" className={cn(box, "grid place-items-center bg-muted text-muted-foreground [&>svg]:size-1/2")} style={dim}>{NOTE}</span>;
  const c = track.cover;
  if (typeof c === "string") return <img src={c} alt="" width={size} height={size} className={cn(box, "object-cover")} style={dim} />;
  if (c) return <span className={cn(box, "grid place-items-center")} style={dim}>{c}</span>;
  const seed = `${track.title}${track.artist}`;
  return <span aria-hidden="true" className={box} style={{ ...dim, backgroundColor: coverFallback(seed, track.hue), backgroundImage: coverGradient(seed, track.hue) }} />;
}

/** Bars beside the title. Static by default; `levels` moves them. Decorative: the play state is said by the button. */
export function NowPlayingLevels({ levels, playing, className }: { levels?: readonly number[]; playing: boolean; className?: string }) {
  const bars = fitLevels(levels, 5);
  return (
    <span aria-hidden="true" className={cn("flex h-4 w-[22px] flex-none items-end gap-[2px]", className)}>
      {bars.map((v, i) => (
        <span
          key={i}
          className="h-full w-1 origin-bottom rounded-[3px] bg-(--kn-accent,var(--primary)) transition-[transform,opacity] duration-(--kn-dur-fast) ease-(--kn-ease-out) motion-reduce:transition-none"
          style={{ transform: `scaleY(${playing ? v : Math.min(v, 0.5)})`, opacity: playing ? 1 : 0.35 }}
        />
      ))}
    </span>
  );
}

/**
 * The time on screen. With `updatedAt` (a pushed state) it keeps running between pushes and never goes back on a slightly stale one;
 * without it the prop is shown as is. A new track, or a pause, takes the push at once.
 */
export function useShownPosition({ position, updatedAt, playing, duration, trackKey }: { position: number; updatedAt?: number; playing: boolean; duration: number; trackKey: string }): number {
  const remote = updatedAt !== undefined;
  const at = (now: number) => projectPosition({ position, updatedAt, playing, now, duration });
  const [shown, setShown] = useState(() => at(Date.now()));
  const last = useRef({ key: trackKey, shown, tick: Date.now() });
  useEffect(() => {
    if (!remote) return;
    const now = Date.now();
    const pushed = at(now);
    const fresh = last.current.key !== trackKey;
    const next = fresh ? pushed : reconcilePosition({ shown: last.current.shown, pushed, playing });
    last.current = { key: trackKey, shown: next, tick: now };
    setShown(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, updatedAt, playing, trackKey, remote]);
  useEffect(() => {
    if (!remote || !playing) return;
    const id = setInterval(() => {
      const now = Date.now();
      const next = clampPosition(last.current.shown + (now - last.current.tick) / 1000, duration);
      last.current = { ...last.current, shown: next, tick: now };
      setShown(next);
    }, 250);
    return () => clearInterval(id);
  }, [remote, playing, duration]);
  return remote ? clampPosition(shown, duration) : clampPosition(position, duration);
}

/* ── Pieces shared by the capsule and the tiles ── */

interface Parts {
  L: NowPlayingLabels;
  track: NowPlayingTrack | null;
  total: number;
  at: number;
  playing: boolean;
  pending: boolean;
  onPlayPause?: () => void;
  onSeek?: (s: number) => void;
  onNext?: () => void;
  onPrev?: () => void;
  volume?: number;
  onVolume?: (v: number) => void;
  muted?: boolean;
  onMute?: () => void;
  markFrom?: number;
  levels?: readonly number[];
  source?: string;
}

function PlayButton({ p, size, className }: { p: Parts; size: "sm" | "md" | "lg"; className?: string }) {
  return <Button variant="primary" size={size} aria-label={p.playing ? p.L.pause : p.L.play} aria-pressed={p.playing} icon={p.playing ? PAUSE : PLAY} disabled={p.pending || !p.onPlayPause || !p.track} onClick={p.onPlayPause} className={cn("rounded-full", className)} />;
}

/** The scrubber: a slider when there is `onSeek`, else a read-only progress bar. Both say "1:23 of 3:45". */
function Scrub({ p }: { p: Parts }) {
  const spoken = spokenPosition(p.at, p.total, p.L.positionText);
  const mark = p.markFrom !== undefined && p.total > 0 && p.markFrom < p.total ? p.markFrom / p.total : null;
  if (p.onSeek && p.total > 0 && !p.pending && p.track) {
    return (
      <div className="relative">
        <Slider size="sm" min={0} max={p.total} step={1} value={p.at} onValueChange={(v) => p.onSeek?.(v)} formatValue={() => spoken} hideValue aria-label={p.L.position} />
        {mark !== null && <MarkZone from={mark} inset={7} />}
      </div>
    );
  }
  const pct = p.total > 0 ? Math.min(100, (p.at / p.total) * 100) : 0;
  return (
    <div role="progressbar" aria-label={p.L.position} aria-valuemin={0} aria-valuemax={Math.round(p.total)} aria-valuenow={Math.round(p.at)} aria-valuetext={spoken} className="relative flex h-4 items-center px-0">
      <div className="relative h-1 w-full rounded-full" style={{ backgroundColor: "rgba(127,127,127,.28)" }}>
        <div className="h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} />
        {mark !== null && <MarkZone from={mark} inset={0} />}
      </div>
    </div>
  );
}

function MarkZone({ from, inset }: { from: number; inset: number }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
      style={{ right: inset, left: `calc(${inset}px + (100% - ${inset * 2}px) * ${from})`, backgroundColor: "rgba(127,127,127,.5)", backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.55) 0 2px, transparent 2px 5px)" }}
    />
  );
}

function Times({ p }: { p: Parts }) {
  return (
    <div className="flex justify-between text-[12px] text-muted-foreground tabular-nums" aria-hidden="true">
      <span>{formatTime(p.at)}</span>
      <span>{p.total > 0 ? `-${formatTime(p.total - p.at)}` : "-:--"}</span>
    </div>
  );
}

function Transport({ p, big }: { p: Parts; big?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <Button variant="ghost" size="md" aria-label={p.L.previous} icon={PREV} disabled={p.pending || !p.onPrev || !p.track} onClick={p.onPrev} className="rounded-full" />
      <PlayButton p={p} size={big ? "lg" : "md"} />
      <Button variant="ghost" size="md" aria-label={p.L.next} icon={NEXT} disabled={p.pending || !p.onNext || !p.track} onClick={p.onNext} className="rounded-full" />
    </div>
  );
}

function VolumeRow({ p }: { p: Parts }) {
  if (!p.onVolume && !p.onMute) return null;
  const v = clampVolume(p.muted ? 0 : (p.volume ?? 100));
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      {p.onMute ? (
        <Button variant="ghost" size="sm" aria-label={p.muted ? p.L.unmute : p.L.mute} aria-pressed={!!p.muted} icon={SPEAKER(!!p.muted)} disabled={p.pending} onClick={p.onMute} className="rounded-full" />
      ) : (
        <span className="size-4 flex-none [&>svg]:size-4">{SPEAKER(false)}</span>
      )}
      {p.onVolume && <Slider size="sm" min={0} max={100} step={1} largeStep={10} value={v} disabled={p.pending} onValueChange={(x) => p.onVolume?.(clampVolume(x))} formatValue={(x) => p.L.volumeText(x)} hideValue aria-label={p.L.volume} className="flex-1" />}
    </div>
  );
}

function TrackText({ p, big }: { p: Parts; big?: boolean }) {
  const t = p.track;
  return (
    <span className="min-w-0 flex-1">
      {big && t && p.source && <span className="mb-0.5 block truncate text-[11.5px] font-medium tracking-wide text-muted-foreground uppercase">{p.source}</span>}
      <span className={cn("block truncate leading-tight font-semibold", big ? "text-[16px]" : "text-[14px]")}>{t ? t.title : p.L.nothingPlaying}</span>
      {t && <span className="mt-0.5 block truncate text-[12.5px] leading-tight text-muted-foreground">{[t.artist, big ? t.album : undefined].filter(Boolean).join(" · ")}</span>}
    </span>
  );
}

const TILE = "w-full overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-[0_1px_2px_rgba(0,0,0,.05)]";

/** The three tile layouts. Each is one self-contained block; "auto" renders all three and lets container queries show one. */
function Tile({ p, variant }: { p: Parts; variant: "compact" | "medium" | "large" }) {
  if (!p.track) {
    return (
      <div className={cn(TILE, "flex items-center gap-3", variant === "compact" ? "p-2.5" : "p-3")}>
        <NowPlayingCover track={null} size={variant === "compact" ? 40 : variant === "medium" ? 56 : 72} className="rounded-lg" />
        <TrackText p={p} big={variant === "large"} />
      </div>
    );
  }
  if (variant === "compact") {
    return (
      <div className={cn(TILE, "flex items-center gap-3 p-2.5")}>
        <NowPlayingCover track={p.track} size={40} />
        <TrackText p={p} />
        {p.track && <NowPlayingLevels levels={p.levels} playing={p.playing} />}
        <PlayButton p={p} size="md" />
      </div>
    );
  }
  if (variant === "medium") {
    return (
      <div className={cn(TILE, "flex gap-3 p-3")}>
        <NowPlayingCover track={p.track} size={72} className="rounded-lg" />
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
          <div className="flex items-start gap-2">
            <TrackText p={p} />
            {p.track && <NowPlayingLevels levels={p.levels} playing={p.playing} className="mt-1" />}
          </div>
          <div className="flex flex-col gap-1">
            <Scrub p={p} />
            <Times p={p} />
          </div>
          <div className="flex items-center justify-center gap-3">
            <Transport p={p} />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={cn(TILE, "flex gap-4 p-4")}>
      <NowPlayingCover track={p.track} size={168} className="rounded-xl shadow-[0_8px_24px_-12px_rgba(0,0,0,.35)]" />
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
        <div className="flex items-start gap-2">
          <TrackText p={p} big />
          {p.track && <NowPlayingLevels levels={p.levels} playing={p.playing} className="mt-1" />}
        </div>
        <div className="flex flex-col gap-1">
          <Scrub p={p} />
          <Times p={p} />
        </div>
        <Transport p={p} big />
        <VolumeRow p={p} />
      </div>
    </div>
  );
}

/**
 * A music player. Pass the state from your app (or from a remote: see `positionUpdatedAt`) and the handlers; nothing is played inside.
 * The default is a capsule on Live Activity: a pill that opens into a card. `size="auto"` (or an explicit compact, medium, large) is a tile
 * that fills its container, for a dashboard.
 */
export function NowPlaying(props: NowPlayingProps) {
  const { track = null, source, position, positionUpdatedAt, duration, playing, onPlayPause, onSeek, onNext, onPrev, volume, onVolume, muted, onMute, pending = false, size = "capsule", labels, levels, markFrom, artwork = 0, label, compact, children, ...rest } = props;
  const L = resolveLabels(DEFAULT_LABELS, labels);
  const total = Math.max(0, duration ?? track?.duration ?? 0);
  const at = useShownPosition({ position, updatedAt: positionUpdatedAt, playing: !!track && playing, duration: total, trackKey: track ? `${track.title}\u0000${track.artist}` : "" });
  const p: Parts = { L, track, total, at, playing: !!track && playing, pending, onPlayPause, onSeek, onNext, onPrev, volume, onVolume, muted, onMute, markFrom, levels, source };

  if (size !== "capsule") {
    return (
      <div aria-busy={pending || undefined} role="group" aria-label={label ?? L.nowPlaying} onKeyDown={spaceToggle(p)} className="w-full">
        {size === "auto" ? (
          <div className="@container w-full">
            <div className="block @min-[340px]:hidden">
              <Tile p={p} variant="compact" />
            </div>
            <div className="hidden @min-[340px]:block @min-[460px]:hidden">
              <Tile p={p} variant="medium" />
            </div>
            <div className="hidden @min-[460px]:block">
              <Tile p={p} variant="large" />
            </div>
          </div>
        ) : (
          <Tile p={p} variant={size} />
        )}
        {children && <div className="mt-3 flex flex-col gap-3">{children}</div>}
      </div>
    );
  }

  const empty = !track;
  const playBtn = <PlayButton p={p} size="sm" />;
  return (
    <div role="group" aria-label={label ?? L.nowPlaying} aria-busy={pending || undefined} onKeyDown={spaceToggle(p)} className={cn("relative", compact ? "w-[280px] max-w-full" : "w-full max-w-sm")}>
      <LiveActivity
        {...rest}
        // The compact pill keeps one width and one 20px corner (a pill at 40px high) in both states, so opening is only the Fold:
        // no width or radius change, nothing to jump, and the open card has the room its controls need.
        className={cn(compact && "w-full rounded-2xl", rest.className)}
        compact={compact}
        label={track ? L.trackText(track.title, track.artist) : L.nothingPlaying}
        leading={<NowPlayingCover track={track} size={compact ? 24 : 32} />}
        title={track ? track.title : L.nothingPlaying}
        subtitle={track?.artist}
        trailing={
          empty ? undefined : (
            <span className="flex items-center gap-2">
              <NowPlayingLevels levels={levels} playing={p.playing} />
              <span className={compact ? "w-7" : "w-8"} aria-hidden="true" />
            </span>
          )
        }
      >
        {empty ? undefined : (
          <div className="flex flex-col gap-3 pt-1">
            {artwork > 0 && (
              <div className="flex justify-center pt-1">
                <NowPlayingCover track={track} size={artwork} className="rounded-xl shadow-[0_8px_24px_-12px_rgba(0,0,0,.35)]" />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Scrub p={p} />
              <Times p={p} />
            </div>
            <Transport p={p} big />
            <VolumeRow p={p} />
            {children}
          </div>
        )}
      </LiveActivity>
      {!empty && (
        <div className={cn("pointer-events-none absolute right-3 top-0 flex items-center", compact ? "h-10" : "h-13")}>
          <span className="pointer-events-auto">{playBtn}</span>
        </div>
      )}
    </div>
  );
}

/** Space toggles play from anywhere in the player except on a button, link or field. */
function spaceToggle(p: Parts) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== " " || e.defaultPrevented || p.pending || !p.onPlayPause || !p.track) return;
    if ((e.target as HTMLElement).closest("button, a, input, textarea, [role='switch']")) return;
    e.preventDefault();
    p.onPlayPause();
  };
}

export default NowPlaying;
