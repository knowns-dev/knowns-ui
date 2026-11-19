"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export interface AudioPlayer {
  /** Seconds played. */
  position: number;
  /** Seconds in the file; 0 until the browser knows. */
  duration: number;
  playing: boolean;
  /** 0 to 100. */
  volume: number;
  /** The element, once mounted: hand it to an analyser (see Now Playing Pro). Null on the server and before mount. */
  audio: HTMLAudioElement | null;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  /** 0 to 100. */
  setVolume: (volume: number) => void;
}

/**
 * Wires one audio element to the Now Playing props. The element is created here (never rendered), so the
 * app can also drive it its own way: Now Playing itself has no audio inside. `src` changing loads the new file and keeps playing if it was playing.
 */
export function useAudioPlayer(src: string | undefined, { onEnded, autoPlay = false }: { onEnded?: () => void; autoPlay?: boolean } = {}): AudioPlayer {
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVol] = useState(100);
  const ended = useRef(onEnded);
  ended.current = onEnded;
  const was = useRef(autoPlay);

  useEffect(() => {
    const el = new Audio();
    el.preload = "metadata";
    setAudio(el);
    const sync = () => {
      setPosition(el.currentTime);
      setDuration(Number.isFinite(el.duration) ? el.duration : 0);
      setPlaying(!el.paused);
      setVol(Math.round(el.volume * 100));
    };
    const done = () => {
      sync();
      ended.current?.();
    };
    const events = ["timeupdate", "durationchange", "loadedmetadata", "play", "pause", "volumechange", "seeked"] as const;
    for (const e of events) el.addEventListener(e, sync);
    el.addEventListener("ended", done);
    return () => {
      for (const e of events) el.removeEventListener(e, sync);
      el.removeEventListener("ended", done);
      el.pause();
      el.removeAttribute("src");
      setAudio(null);
    };
  }, []);

  useEffect(() => {
    if (!audio || !src) return;
    was.current = was.current || !audio.paused;
    audio.src = src;
    setPosition(0);
    if (was.current) void audio.play().catch(() => {});
  }, [audio, src]);

  const play = useCallback(() => {
    was.current = true;
    void audio?.play().catch(() => {});
  }, [audio]);
  const pause = useCallback(() => {
    was.current = false;
    audio?.pause();
  }, [audio]);
  const toggle = useCallback(() => (audio && !audio.paused ? pause() : play()), [audio, play, pause]);
  const seek = useCallback(
    (s: number) => {
      if (!audio) return;
      audio.currentTime = Math.max(0, s);
      setPosition(audio.currentTime);
    },
    [audio],
  );
  const setVolume = useCallback(
    (v: number) => {
      if (audio) audio.volume = Math.min(1, Math.max(0, v / 100));
    },
    [audio],
  );
  return { position, duration, playing, volume, audio, play, pause, toggle, seek, setVolume };
}
