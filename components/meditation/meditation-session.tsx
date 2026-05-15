"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CatalogBellSound } from "@/lib/meditation-mocks";
import { formatCountdown } from "@/components/meditation/format";
import { PauseGlyph, PlayGlyph } from "@/components/meditation/glyphs";
import type { SessionSnapshot } from "@/components/meditation/types";
import {
  SOUNDSCAPE_BASE_VOLUME,
  applySoundscapeLoopFade,
  playBellOnce,
} from "@/components/meditation/session-soundscape";

export function MeditationSession(props: {
  config: SessionSnapshot;
  bells: CatalogBellSound[];
  onExit: () => void;
  /** Only when the user taps Finish (early end), not when the timer completes. */
  onFinishPressed?: () => void;
  /** Keeps the device screen on while `true` (Screen Wake Lock API). */
  onPlaybackScreenWake?: (shouldKeepScreenOn: boolean) => void;
}) {
  const { config } = props;
  const bellsRef = useRef(props.bells);
  bellsRef.current = props.bells;

  const bellMediaUrl = useCallback((id: string | null): string | null => {
    if (id === null) return null;
    return bellsRef.current.find((b) => b.id === id)?.media_url ?? null;
  }, []);
  const [remaining, setRemaining] = useState(config.totalSeconds);
  const [paused, setPaused] = useState(false);
  const endAtRef = useRef(0);
  const startedAtRef = useRef(0);
  const pauseWallStartedAtRef = useRef<number | null>(null);
  const frozenRemainingSecRef = useRef(config.totalSeconds);
  const lastIntervalTierRef = useRef(0);
  const completedRef = useRef(false);
  const pausedRef = useRef(false);
  const soundscapeRef = useRef<HTMLAudioElement | null>(null);
  const onExitRef = useRef(props.onExit);
  onExitRef.current = props.onExit;
  const onFinishPressedRef = useRef(props.onFinishPressed);
  onFinishPressedRef.current = props.onFinishPressed;

  useEffect(() => {
    const now = Date.now();
    startedAtRef.current = now;
    endAtRef.current = now + config.totalSeconds * 1000;
    lastIntervalTierRef.current = 0;
    completedRef.current = false;

    const startUrl = bellMediaUrl(config.startingBellId);
    if (startUrl) playBellOnce(startUrl);

    let soundscapeRaf = 0;
    const cancelVolLoop = () => {
      cancelAnimationFrame(soundscapeRaf);
      soundscapeRaf = 0;
    };

    if (config.soundtrackMediaUrl) {
      const url = config.soundtrackMediaUrl;
      if (url) {
        const audio = new Audio(url);
        audio.loop = false;
        audio.volume = SOUNDSCAPE_BASE_VOLUME;

        const volLoop = () => {
          if (!soundscapeRef.current || audio.paused) {
            cancelVolLoop();
            return;
          }
          applySoundscapeLoopFade(audio);
          soundscapeRaf = requestAnimationFrame(volLoop);
        };

        const onPlay = () => {
          cancelVolLoop();
          soundscapeRaf = requestAnimationFrame(volLoop);
        };

        const onEnded = () => {
          cancelVolLoop();
          audio.currentTime = 0;
          audio.volume = SOUNDSCAPE_BASE_VOLUME;
          void audio.play().catch(() => {});
        };

        audio.addEventListener("play", onPlay);
        audio.addEventListener("ended", onEnded);

        soundscapeRef.current = audio;
        void audio.play().catch(() => {});

        return () => {
          cancelVolLoop();
          audio.removeEventListener("play", onPlay);
          audio.removeEventListener("ended", onEnded);
          const a = soundscapeRef.current;
          if (a) {
            a.pause();
            a.removeAttribute("src");
            a.load();
            soundscapeRef.current = null;
          }
        };
      }
    }

    return () => {
      cancelVolLoop();
      const a = soundscapeRef.current;
      if (a) {
        a.pause();
        a.removeAttribute("src");
        a.load();
        soundscapeRef.current = null;
      }
    };
  }, [config, bellMediaUrl]);

  useEffect(() => {
    const intervalSec = config.intervalEveryMinutes * 60;

    const tick = () => {
      if (completedRef.current) return;
      if (pausedRef.current) return;

      const now = Date.now();
      const remainingSec = Math.max(0, Math.ceil((endAtRef.current - now) / 1000));
      setRemaining(remainingSec);
      frozenRemainingSecRef.current = remainingSec;

      if (remainingSec > 0) {
        const elapsedSec = Math.floor((now - startedAtRef.current) / 1000);
        if (config.intervalBellId && intervalSec > 0 && elapsedSec >= intervalSec) {
          const tier = Math.floor(elapsedSec / intervalSec);
          if (tier > lastIntervalTierRef.current) {
            lastIntervalTierRef.current = tier;
            const url = bellMediaUrl(config.intervalBellId);
            if (url) playBellOnce(url);
          }
        }
      }

      if (remainingSec <= 0 && !completedRef.current) {
        completedRef.current = true;
        pausedRef.current = false;
        setPaused(false);
        soundscapeRef.current?.pause();
        const endUrl = bellMediaUrl(config.endingBellId);
        if (endUrl) playBellOnce(endUrl);
        onExitRef.current();
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [config, bellMediaUrl]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (pausedRef.current || completedRef.current) return;
      props.onPlaybackScreenWake?.(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [props.onPlaybackScreenWake]);

  function togglePause() {
    if (completedRef.current) return;

    if (!pausedRef.current) {
      const rem = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      frozenRemainingSecRef.current = rem;
      setRemaining(rem);
      pausedRef.current = true;
      setPaused(true);
      pauseWallStartedAtRef.current = Date.now();
      soundscapeRef.current?.pause();
      props.onPlaybackScreenWake?.(false);
      return;
    }

    const pauseStart = pauseWallStartedAtRef.current;
    if (pauseStart !== null) {
      startedAtRef.current += Date.now() - pauseStart;
      pauseWallStartedAtRef.current = null;
    }
    const rem = frozenRemainingSecRef.current;
    endAtRef.current = Date.now() + rem * 1000;
    pausedRef.current = false;
    setPaused(false);
    props.onPlaybackScreenWake?.(true);
    void soundscapeRef.current?.play().catch(() => {});
  }

  function finishSessionEarly() {
    if (completedRef.current) return;
    completedRef.current = true;
    pausedRef.current = true;
    soundscapeRef.current?.pause();
    props.onPlaybackScreenWake?.(false);
    onFinishPressedRef.current?.();
    onExitRef.current();
  }

  /** Same gap between countdown ↔ play/pause and play/pause ↔ Finish when paused */
  const sessionStackGapClass = "gap-[min(10dvh,3.75rem)]";

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">
      <div
        className={`flex min-h-0 flex-1 flex-col items-center justify-end px-5 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] pt-4 ${sessionStackGapClass}`}
      >
        <div className="w-full shrink-0 space-y-2 text-center">
          <p
            className="text-6xl font-light tabular-nums tracking-tight text-zinc-50"
            aria-live="polite"
          >
            {formatCountdown(remaining)}
          </p>
        </div>

        {!paused ? (
          <button
            type="button"
            onClick={togglePause}
            aria-label="Pause session"
            className="flex size-28 shrink-0 items-center justify-center rounded-md text-zinc-200 transition duration-300 ease-out hover:scale-[1.04] hover:text-zinc-50 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 motion-reduce:transition-none motion-reduce:hover:scale-100"
          >
            <PauseGlyph className="size-14" />
          </button>
        ) : (
          <button
            type="button"
            onClick={togglePause}
            aria-label="Resume session"
            className="flex size-28 shrink-0 items-center justify-center rounded-md text-zinc-200 transition duration-300 ease-out hover:scale-[1.04] hover:text-zinc-50 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 motion-reduce:transition-none motion-reduce:hover:scale-100"
          >
            <PlayGlyph className="size-16 pl-1" />
          </button>
        )}

        {/* Always reserve space so pausing/unpausing doesn’t shift timer + play controls */}
        <button
          type="button"
          onClick={finishSessionEarly}
          aria-hidden={!paused}
          tabIndex={paused ? 0 : -1}
          className={`w-full shrink-0 self-stretch rounded-2xl border border-zinc-600 bg-zinc-800/80 px-6 py-3 text-center text-sm font-semibold text-zinc-100 shadow-lg shadow-black/20 backdrop-blur-sm transition hover:border-zinc-500 hover:bg-zinc-700 active:scale-[0.99] ${paused ? "" : "pointer-events-none invisible"}`}
        >
          Finish
        </button>
      </div>
    </div>
  );
}
