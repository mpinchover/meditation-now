"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteCustomSoundscape,
  fetchMeditationSounds,
  patchCustomSoundscapeName,
  postUploadAudioFiles,
  type ApiCustomSoundscape,
  type MeditationSoundsResponse,
} from "@/lib/meditation-sounds-api";
import {
  type BellCategory,
  type CatalogBellSound,
  type CatalogSoundscape,
} from "@/lib/meditation-mocks";
type ModalId = "duration" | "soundtrack" | "bells" | null;

type BellsUiStep = "menu" | BellCategory;

type MySoundsUiStep = "main" | "add_files";

type AddSoundUploadRow = {
  id: string;
  name: string;
  uploading: boolean;
  error: string | null;
};

const BELL_TYPE_MENU: { id: BellCategory; label: string }[] = [
  { id: "starting", label: "Starting" },
  { id: "ending", label: "Ending" },
  { id: "interval", label: "Interval" },
];

function catalogFromApiCustom(c: ApiCustomSoundscape): CatalogSoundscape {
  const url = c.media_url;
  const mediaUrl = typeof url === "string" && url.trim().length > 0 ? url : "";
  const label = c.name?.trim();
  return {
    id: c.id,
    name: label && label.length > 0 ? label : c.link,
    media_url: mediaUrl,
    tab: "ambient",
  };
}

function formatDuration(hours: number, minutes: number): string {
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

type SessionSnapshot = {
  totalSeconds: number;
  soundtrackId: string | null;
  /** Resolved at session start for library + user-added soundscapes. */
  soundtrackMediaUrl: string | null;
  startingBellId: string | null;
  endingBellId: string | null;
  intervalBellId: string | null;
  intervalEveryMinutes: number;
};

function playBellOnce(url: string) {
  const a = new Audio(url);
  a.volume = 0.9;
  void a.play().catch(() => {});
}

/** Matches server `/upload-audio`: MP3 and WAV only. */
function isUploadableSoundFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "mp3" || ext === "wav") return true;
  const t = file.type.toLowerCase();
  return (
    t === "audio/mpeg" ||
    t === "audio/wav" ||
    t === "audio/wave" ||
    t === "audio/x-wav"
  );
}

const SOUNDSCAPE_BASE_VOLUME = 0.85;
/** Fade soundscape volume over the last N seconds of each file before manual loop restart. */
const SOUNDSCAPE_LOOP_FADE_SEC = 3;

function smoothstep01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function PauseGlyph(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={props.className}
      aria-hidden
    >
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  );
}

function PlayGlyph(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={props.className}
      aria-hidden
    >
      <path d="M8 5v14l11-7-11-7z" />
    </svg>
  );
}

function EditGlyph(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function SoundsBootstrapSpinner(props: {
  /** Optional message shown under the spinner. */
  message?: string;
}) {
  const message = props.message ?? "Loading sounds…";
  return (
    <div
      className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-6 py-16"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="size-10 shrink-0 rounded-full border-2 border-zinc-700 border-t-zinc-300 animate-spin" />
      <p className="text-center text-sm text-zinc-400">{message}</p>
    </div>
  );
}

function applySoundscapeLoopFade(audio: HTMLAudioElement) {
  const d = audio.duration;
  if (!Number.isFinite(d) || d <= 0) {
    audio.volume = SOUNDSCAPE_BASE_VOLUME;
    return;
  }
  const fadeWindow = Math.min(SOUNDSCAPE_LOOP_FADE_SEC, d);
  const tail = d - audio.currentTime;
  if (tail <= fadeWindow && tail >= 0) {
    audio.volume = SOUNDSCAPE_BASE_VOLUME * smoothstep01(tail / fadeWindow);
  } else {
    audio.volume = SOUNDSCAPE_BASE_VOLUME;
  }
}

function MeditationSession(props: {
  config: SessionSnapshot;
  bells: CatalogBellSound[];
  onExit: () => void;
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

function bellNameOrNone(
  id: string | null,
  catalog: { id: string; name: string }[],
): string {
  if (id === null) return "None";
  return catalog.find((b) => b.id === id)?.name ?? "None";
}

function bellsMenuSummary(
  bells: CatalogBellSound[],
  cat: BellCategory,
  startingId: string | null,
  endingId: string | null,
  intervalId: string | null,
  intervalMinutes: number,
): string {
  switch (cat) {
    case "starting":
      return bellNameOrNone(startingId, bells);
    case "ending":
      return bellNameOrNone(endingId, bells);
    case "interval":
      if (intervalId === null) return "None";
      return `${bellNameOrNone(intervalId, bells)} · every ${intervalMinutes}m`;
  }
}

export default function Home() {
  const [openModal, setOpenModal] = useState<ModalId>(null);

  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(15);

  // TODO: replace with real meditation history once persisted.
  const meditationDaysCount = 5;

  const [bellsCatalog, setBellsCatalog] = useState<CatalogBellSound[]>([]);
  const [soundsLoading, setSoundsLoading] = useState(true);
  const [soundsError, setSoundsError] = useState<string | null>(null);

  const [soundtrackId, setSoundtrackId] = useState<string | null>(null);

  const [bellCategory, setBellCategory] = useState<BellCategory>("starting");
  const [startingBellId, setStartingBellId] = useState<string | null>(null);
  const [endingBellId, setEndingBellId] = useState<string | null>(null);
  const [intervalBellId, setIntervalBellId] = useState<string | null>(null);
  const [intervalEveryMinutes, setIntervalEveryMinutes] = useState(5);

  const [pendingHours, setPendingHours] = useState(hours);
  const [pendingMinutes, setPendingMinutes] = useState(minutes);
  const [pendingSoundtrackId, setPendingSoundtrackId] = useState<string | null>(
    soundtrackId,
  );
  const [pendingBellCategory, setPendingBellCategory] =
    useState<BellCategory>(bellCategory);
  const [pendingStartingBellId, setPendingStartingBellId] = useState<string | null>(
    startingBellId,
  );
  const [pendingEndingBellId, setPendingEndingBellId] = useState<string | null>(
    endingBellId,
  );
  const [pendingIntervalBellId, setPendingIntervalBellId] = useState<string | null>(
    intervalBellId,
  );
  const [pendingIntervalEveryMinutes, setPendingIntervalEveryMinutes] =
    useState(intervalEveryMinutes);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  /** Row id whose preview/dot was activated by user tap this session (not initial selection). */
  const [soundscapePulseId, setSoundscapePulseId] = useState<string | null>(null);
  const [mySoundscapes, setMySoundscapes] = useState<CatalogSoundscape[]>([]);
  const [mySoundsUiStep, setMySoundsUiStep] = useState<MySoundsUiStep>("main");
  const [addSoundRows, setAddSoundRows] = useState<AddSoundUploadRow[]>([]);
  const [addSoundUploadError, setAddSoundUploadError] = useState<string | null>(null);
  const [addSoundDropActive, setAddSoundDropActive] = useState(false);
  const [mySoundsEditMenuId, setMySoundsEditMenuId] = useState<string | null>(null);
  const [mySoundsEditingId, setMySoundsEditingId] = useState<string | null>(null);
  const [mySoundsEditingName, setMySoundsEditingName] = useState("");
  const [mySoundsDeleteConfirmId, setMySoundsDeleteConfirmId] = useState<string | null>(
    null,
  );
  const [mySoundsEditBusy, setMySoundsEditBusy] = useState(false);
  const [mySoundsEditError, setMySoundsEditError] = useState<string | null>(null);
  const addAudioFilesInputRef = useRef<HTMLInputElement>(null);
  const addSoundDropZoneRef = useRef<HTMLDivElement>(null);
  const refreshSoundsQuietDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [bellPulseId, setBellPulseId] = useState<string | null>(null);

  const [bellsUiStep, setBellsUiStep] = useState<BellsUiStep>("menu");

  const [activeSession, setActiveSession] = useState<SessionSnapshot | null>(null);
  const sessionWakeLockRef = useRef<WakeLockSentinel | null>(null);

  const releaseSessionWakeLock = useCallback(async () => {
    const lock = sessionWakeLockRef.current;
    sessionWakeLockRef.current = null;
    if (!lock) return;
    try {
      await lock.release();
    } catch {
      /* already released */
    }
  }, []);

  const acquireSessionWakeLock = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.wakeLock) return;
    await releaseSessionWakeLock();
    try {
      const lock = await navigator.wakeLock.request("screen");
      sessionWakeLockRef.current = lock;
      lock.addEventListener("release", () => {
        if (sessionWakeLockRef.current === lock) sessionWakeLockRef.current = null;
      });
    } catch {
      /* denied, unsupported, or no recent user gesture */
    }
  }, [releaseSessionWakeLock]);

  const onPlaybackScreenWake = useCallback(
    (shouldKeepScreenOn: boolean) => {
      if (shouldKeepScreenOn) void acquireSessionWakeLock();
      else void releaseSessionWakeLock();
    },
    [acquireSessionWakeLock, releaseSessionWakeLock],
  );

  function pendingBellIdFor(cat: BellCategory): string | null {
    switch (cat) {
      case "starting":
        return pendingStartingBellId;
      case "ending":
        return pendingEndingBellId;
      case "interval":
        return pendingIntervalBellId;
    }
  }

  function setPendingBellIdFor(cat: BellCategory, id: string) {
    switch (cat) {
      case "starting":
        setPendingStartingBellId(id);
        break;
      case "ending":
        setPendingEndingBellId(id);
        break;
      case "interval":
        setPendingIntervalBellId(id);
        break;
    }
  }

  const soundtrackTitle =
    soundtrackId === null
      ? "None"
      : mySoundscapes.find((s) => s.id === soundtrackId)?.name ?? "None";

  const startingBellSummary =
    startingBellId === null
      ? "None"
      : bellsCatalog.find((b) => b.id === startingBellId)?.name ?? "None";

  const applySoundsResponse = useCallback((data: MeditationSoundsResponse) => {
    setBellsCatalog(data.bells);

    setMySoundscapes(data.custom_soundscapes.map(catalogFromApiCustom));

    setSoundtrackId((cur) => {
      if (cur === null) return null;
      if (data.custom_soundscapes.some((cs) => cs.id === cur)) return cur;
      return null;
    });

    const firstBellId = data.bells[0]?.id ?? null;
    setEndingBellId((cur) =>
      cur === null || !data.bells.some((b) => b.id === cur) ? firstBellId : cur,
    );
    setIntervalBellId((cur) =>
      cur === null || !data.bells.some((b) => b.id === cur) ? firstBellId : cur,
    );
    setStartingBellId((cur) =>
      cur !== null && !data.bells.some((b) => b.id === cur) ? null : cur,
    );
  }, []);

  const refreshSoundsQuiet = useCallback(async () => {
    try {
      applySoundsResponse(await fetchMeditationSounds());
    } catch {
      /* keep existing catalog */
    }
  }, [applySoundsResponse]);

  const scheduleRefreshSoundsQuiet = useCallback(() => {
    if (refreshSoundsQuietDebounceRef.current) {
      clearTimeout(refreshSoundsQuietDebounceRef.current);
    }
    refreshSoundsQuietDebounceRef.current = setTimeout(() => {
      refreshSoundsQuietDebounceRef.current = null;
      void refreshSoundsQuiet();
    }, 300);
  }, [refreshSoundsQuiet]);

  const flushRefreshSoundsQuiet = useCallback(() => {
    if (refreshSoundsQuietDebounceRef.current) {
      clearTimeout(refreshSoundsQuietDebounceRef.current);
      refreshSoundsQuietDebounceRef.current = null;
    }
    void refreshSoundsQuiet();
  }, [refreshSoundsQuiet]);

  const finishAddSoundFilesStep = useCallback(() => {
    flushRefreshSoundsQuiet();
    setAddSoundRows([]);
    setAddSoundUploadError(null);
    setAddSoundDropActive(false);
    setMySoundsUiStep("main");
    setMySoundsEditMenuId(null);
    setMySoundsEditingId(null);
    setMySoundsEditingName("");
    setMySoundsDeleteConfirmId(null);
    setMySoundsEditError(null);
  }, [flushRefreshSoundsQuiet]);

  const cancelMySoundsRowEdit = useCallback(() => {
    setMySoundsEditingId(null);
    setMySoundsEditingName("");
    setMySoundsEditError(null);
  }, []);

  const handleMySoundsSaveRename = useCallback(async () => {
    const id = mySoundsEditingId;
    const trimmed = mySoundsEditingName.trim();
    if (!id || !trimmed) return;
    setMySoundsEditBusy(true);
    setMySoundsEditError(null);
    try {
      await patchCustomSoundscapeName(id, trimmed);
      await refreshSoundsQuiet();
      cancelMySoundsRowEdit();
      setMySoundsEditMenuId(null);
    } catch (e) {
      setMySoundsEditError(e instanceof Error ? e.message : "Could not rename");
    } finally {
      setMySoundsEditBusy(false);
    }
  }, [mySoundsEditingId, mySoundsEditingName, refreshSoundsQuiet, cancelMySoundsRowEdit]);

  const handleMySoundsConfirmDelete = useCallback(
    async (id: string) => {
      setMySoundsEditBusy(true);
      setMySoundsEditError(null);
      try {
        await deleteCustomSoundscape(id);
        await refreshSoundsQuiet();
        setMySoundsDeleteConfirmId(null);
        setMySoundsEditMenuId(null);
        setMySoundsEditingId(null);
        setMySoundsEditingName("");
      } catch (e) {
        setMySoundsEditError(e instanceof Error ? e.message : "Could not remove");
      } finally {
        setMySoundsEditBusy(false);
      }
    },
    [refreshSoundsQuiet],
  );

  const loadSounds = useCallback(async () => {
    setSoundsLoading(true);
    setSoundsError(null);
    try {
      applySoundsResponse(await fetchMeditationSounds());
    } catch (e) {
      setSoundsError(e instanceof Error ? e.message : "Could not load sounds.");
    } finally {
      setSoundsLoading(false);
    }
  }, [applySoundsResponse]);

  useEffect(() => {
    void loadSounds();
  }, [loadSounds]);

  const stopMediaPreview = useCallback(() => {
    const a = previewAudioRef.current;
    if (!a) return;
    a.pause();
    a.removeAttribute("src");
    a.load();
    previewAudioRef.current = null;
  }, []);

  const startMediaPreview = useCallback(
    (url: string, loop: boolean) => {
      stopMediaPreview();
      const audio = new Audio(url);
      audio.loop = loop;
      audio.volume = 0.85;
      previewAudioRef.current = audio;
      void audio.play().catch(() => {});
    },
    [stopMediaPreview],
  );

  useEffect(() => {
    return () => stopMediaPreview();
  }, [stopMediaPreview]);

  useEffect(() => {
    return () => {
      if (refreshSoundsQuietDebounceRef.current) {
        clearTimeout(refreshSoundsQuietDebounceRef.current);
        refreshSoundsQuietDebounceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!openModal) {
      stopMediaPreview();
      setSoundscapePulseId(null);
      setBellPulseId(null);
      setMySoundsUiStep("main");
      setAddSoundRows([]);
      setAddSoundUploadError(null);
      setAddSoundDropActive(false);
      setMySoundsEditMenuId(null);
      setMySoundsEditingId(null);
      setMySoundsEditingName("");
      setMySoundsDeleteConfirmId(null);
      setMySoundsEditBusy(false);
      setMySoundsEditError(null);
    }
  }, [openModal, stopMediaPreview]);

  useEffect(() => {
    if (openModal !== "bells") return;
    if (bellsUiStep === "menu") {
      stopMediaPreview();
      setBellPulseId(null);
    }
  }, [bellsUiStep, openModal, stopMediaPreview]);

  function clampPendingDuration(nextHours: number, nextMinutes: number) {
    if (nextHours === 0 && nextMinutes === 0) return { hours: 0, minutes: 1 };
    return { hours: nextHours, minutes: nextMinutes };
  }

  function setPendingHoursClamped(nextHours: number) {
    const next = clampPendingDuration(nextHours, pendingMinutes);
    setPendingHours(next.hours);
    setPendingMinutes(next.minutes);
  }

  function setPendingMinutesClamped(nextMinutes: number) {
    const next = clampPendingDuration(pendingHours, nextMinutes);
    setPendingHours(next.hours);
    setPendingMinutes(next.minutes);
  }

  function openDurationModal() {
    const seeded = clampPendingDuration(hours, minutes);
    setPendingHours(seeded.hours);
    setPendingMinutes(seeded.minutes);
    setOpenModal("duration");
  }

  function openSoundtrackModal() {
    setPendingSoundtrackId(soundtrackId);
    setSoundscapePulseId(null);
    setMySoundsUiStep("main");
    setAddSoundRows([]);
    setAddSoundUploadError(null);
    setAddSoundDropActive(false);
    setMySoundsEditMenuId(null);
    setMySoundsEditingId(null);
    setMySoundsEditingName("");
    setMySoundsDeleteConfirmId(null);
    setMySoundsEditError(null);
    setOpenModal("soundtrack");
  }

  const handleAddSoundFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter(isUploadableSoundFile);
      if (files.length === 0) {
        setAddSoundUploadError("Only MP3 and WAV files are accepted.");
        return;
      }
      setAddSoundUploadError(null);

      const pairs = files.map((file) => ({ id: crypto.randomUUID(), file }));

      setAddSoundRows((prev) => [
        ...prev,
        ...pairs.map(({ id, file }) => ({
          id,
          name: file.name,
          uploading: true,
          error: null as string | null,
        })),
      ]);

      for (const { id, file } of pairs) {
        void (async () => {
          try {
            const { created, errors } = await postUploadAudioFiles([file]);
            scheduleRefreshSoundsQuiet();
            const rowErr = errors.find((e) => e.filename === file.name);
            const ok = created.length > 0;
            setAddSoundRows((prev) =>
              prev.map((r) =>
                r.id !== id
                  ? r
                  : {
                      ...r,
                      uploading: false,
                      name: created[0]?.name ?? r.name,
                      error: rowErr?.error ?? (!ok ? "Upload failed" : null),
                    },
              ),
            );
          } catch (e) {
            setAddSoundRows((prev) =>
              prev.map((r) =>
                r.id !== id
                  ? r
                  : {
                      ...r,
                      uploading: false,
                      error: e instanceof Error ? e.message : "Upload failed.",
                    },
              ),
            );
          }
        })();
      }
    },
    [scheduleRefreshSoundsQuiet],
  );

  function openBellsModal() {
    setBellsUiStep("menu");
    setPendingBellCategory(bellCategory);
    setPendingStartingBellId(startingBellId);
    setPendingEndingBellId(endingBellId);
    setPendingIntervalBellId(intervalBellId);
    setPendingIntervalEveryMinutes(intervalEveryMinutes);
    setBellPulseId(null);
    setOpenModal("bells");
  }

  function saveDurationModal() {
    const saved = clampPendingDuration(pendingHours, pendingMinutes);
    setHours(saved.hours);
    setMinutes(saved.minutes);
    setOpenModal(null);
  }

  function saveSoundtrackModal() {
    setSoundtrackId(pendingSoundtrackId);
    setOpenModal(null);
  }

  function saveBellsModal() {
    setBellCategory(pendingBellCategory);
    setStartingBellId(pendingStartingBellId);
    setEndingBellId(pendingEndingBellId);
    setIntervalBellId(pendingIntervalBellId);
    setIntervalEveryMinutes(pendingIntervalEveryMinutes);
    setOpenModal(null);
  }

  useEffect(() => {
    if (!openModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (openModal === "bells" && bellsUiStep !== "menu") {
        setBellsUiStep("menu");
        return;
      }
      if (openModal === "soundtrack" && mySoundsUiStep === "add_files") {
        finishAddSoundFilesStep();
        return;
      }
      setOpenModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openModal, bellsUiStep, mySoundsUiStep, finishAddSoundFilesStep]);

  useEffect(() => {
    document.body.style.overflow = openModal ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [openModal]);

  const hourOptions = Array.from({ length: 12 }, (_, i) => i);
  const minuteOptions = Array.from({ length: 60 }, (_, i) => i );

  async function beginSession() {
    stopMediaPreview();
    setOpenModal(null);
    await acquireSessionWakeLock();
    const totalSeconds = hours * 3600 + minutes * 60;
    const soundtrackMediaUrl =
      soundtrackId === null
        ? null
        : mySoundscapes.find((s) => s.id === soundtrackId)?.media_url ?? null;
    setActiveSession({
      totalSeconds,
      soundtrackId,
      soundtrackMediaUrl,
      startingBellId,
      endingBellId,
      intervalBellId,
      intervalEveryMinutes,
    });
  }

  function endSessionFromFinish() {
    void releaseSessionWakeLock();
    setActiveSession(null);
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-950 text-zinc-100">
      <p className="fixed left-4 top-4 z-20 text-sm font-medium tracking-wide text-zinc-500">
        Callysto
      </p>
      {activeSession ? (
        <MeditationSession
          config={activeSession}
          bells={bellsCatalog}
          onExit={endSessionFromFinish}
          onPlaybackScreenWake={onPlaybackScreenWake}
        />
      ) : soundsLoading ? (
        <SoundsBootstrapSpinner />
      ) : soundsError ? (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-6 py-16">
          <p className="text-center text-sm leading-relaxed text-zinc-400">{soundsError}</p>
          <button
            type="button"
            onClick={() => void loadSounds()}
            className="rounded-xl border border-zinc-600 bg-zinc-800 px-6 py-2.5 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700 active:scale-[0.99]"
          >
            Try again
          </button>
        </div>
      ) : (
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-24 px-5 py-10">
          <section
            className="flex shrink-0 items-center justify-center gap-1.5"
            aria-label="Meditation days"
          >
            {Array.from({ length: meditationDaysCount }).map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-emerald-500"
              />
            ))}
          </section>

          <div className="flex shrink-0 flex-col gap-6">
            <section className="flex shrink-0 flex-col gap-3">
              <FieldRow
                label="Duration"
                value={formatDuration(hours, minutes)}
                onOpen={openDurationModal}
              />
              <FieldRow
                label="Soundscape"
                value={soundtrackTitle}
                onOpen={openSoundtrackModal}
              />
              <FieldRow
                label="Bells"
                value={startingBellSummary}
                onOpen={openBellsModal}
              />
            </section>

            <div className="shrink-0 pt-2">
              <button
                type="button"
                onClick={() => void beginSession()}
                className="w-full rounded-2xl border border-zinc-600 bg-zinc-800 py-4 text-center text-base font-semibold text-zinc-50 shadow-lg shadow-black/45 transition hover:border-zinc-500 hover:bg-zinc-700 active:scale-[0.99]"
              >
                Begin
              </button>
            </div>
          </div>
        </main>
      )}

      {openModal && !soundsLoading && !soundsError && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 py-6 backdrop-blur-[2px]"
          role="presentation"
          onClick={() => setOpenModal(null)}
        >
          <div
            className="relative flex h-[min(92dvh,92vh)] w-full max-w-[23.4rem] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
              aria-label="Close"
              onClick={(e) => {
                e.stopPropagation();
                setOpenModal(null);
              }}
            >
              <span className="text-xl leading-none">×</span>
            </button>

            {openModal === "duration" && (
              <>
                <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-14">
                  <h2 className="mb-4 shrink-0 text-center text-lg font-semibold text-zinc-50">
                    Duration
                  </h2>
                  <div className="flex min-h-0 flex-1 gap-3">
                    <PickerColumn
                      label="Hours"
                      value={pendingHours}
                      options={hourOptions}
                      format={(v) => String(v)}
                      onChange={setPendingHoursClamped}
                    />
                    <PickerColumn
                      label="Minutes"
                      value={pendingMinutes}
                      options={minuteOptions}
                      format={(v) => (v === 0 ? "0" : String(v).padStart(2, "0"))}
                      onChange={setPendingMinutesClamped}
                    />
                  </div>
                </div>
                <ModalSaveFooter onSave={saveDurationModal} />
              </>
            )}

            {openModal === "soundtrack" && mySoundsUiStep === "add_files" && (
              <>
                <button
                  type="button"
                  className="absolute left-3 top-3 z-10 flex h-10 items-center gap-0.5 rounded-full px-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-50"
                  aria-label="Done"
                  onClick={finishAddSoundFilesStep}
                >
                  Done
                </button>

                <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-14">
                  <input
                    ref={addAudioFilesInputRef}
                    type="file"
                    accept=".mp3,.wav,audio/mpeg,audio/wav,audio/wave,audio/x-wav"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const list = e.target.files;
                      if (list?.length) handleAddSoundFiles(list);
                      e.target.value = "";
                    }}
                  />

                  <div
                    ref={addSoundDropZoneRef}
                    role="region"
                    aria-label="Addsounds — drop MP3 or WAV files"
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setAddSoundDropActive(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      const related = e.relatedTarget as Node | null;
                      if (
                        related &&
                        addSoundDropZoneRef.current?.contains(related)
                      ) {
                        return;
                      }
                      setAddSoundDropActive(false);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "copy";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setAddSoundDropActive(false);
                      if (e.dataTransfer.files?.length) {
                        handleAddSoundFiles(e.dataTransfer.files);
                      }
                    }}
                    className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl transition ${
                      addSoundDropActive
                        ? "bg-emerald-500/5"
                        : "bg-zinc-950/50"
                    }`}
                  >
                    <div className="shrink-0 border-b border-zinc-800/50 px-4 py-3 text-center">
                      <p className="mt-2 text-sm font-medium text-zinc-300">
                        Drop MP3 or WAV files here
                      </p>
                      {addSoundUploadError && (
                        <p className="mt-2 text-center text-xs leading-snug text-red-400/90">
                          {addSoundUploadError}
                        </p>
                      )}
                    </div>

                    <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-2">
                      {addSoundRows.length === 0 ? (
                        <li className="list-none py-8 text-center text-sm text-zinc-600">
                          No files yet
                        </li>
                      ) : (
                        addSoundRows.map((row) => (
                          <li
                            key={row.id}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300"
                          >
                            <span className="min-w-0 flex-1 truncate" title={row.name}>
                              {row.name}
                            </span>
                            {row.uploading && (
                              <span
                                className="inline-flex size-4 shrink-0 items-center justify-center"
                                role="status"
                                aria-label={`Uploading ${row.name}`}
                              >
                                <span
                                  className="size-3.5 shrink-0 rounded-full border-2 border-zinc-600 border-t-zinc-300 animate-spin"
                                  aria-hidden
                                />
                              </span>
                            )}
                            {row.error && (
                              <span
                                className="max-w-[45%] shrink-0 truncate text-xs text-red-400/90"
                                title={row.error}
                              >
                                {row.error}
                              </span>
                            )}
                          </li>
                        ))
                      )}
                    </ul>

                    <div className="shrink-0 border-t border-zinc-800/70 p-3">
                      <button
                        type="button"
                        onClick={() => addAudioFilesInputRef.current?.click()}
                        className="w-full rounded-xl border border-zinc-600 bg-zinc-800 py-3 text-center text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700 active:scale-[0.99]"
                      >
                        Choose files
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {openModal === "soundtrack" && mySoundsUiStep === "main" && (
              <>
                <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-14">
                  <h2 className="mb-3 shrink-0 text-center text-lg font-semibold text-zinc-50">
                    Soundscape
                  </h2>
                  <div className="flex min-h-0 flex-1 flex-col gap-1">
                    {mySoundsEditError && (
                      <p className="shrink-0 px-3 text-xs leading-snug text-red-400/90">
                        {mySoundsEditError}
                      </p>
                    )}
                    <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
                      <li key="__none">
                        <button
                          type="button"
                          onClick={() => {
                            setPendingSoundtrackId(null);
                            stopMediaPreview();
                            setSoundscapePulseId(null);
                          }}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.045] active:bg-white/[0.06] ${
                            pendingSoundtrackId === null
                              ? "font-medium text-zinc-50"
                              : "text-zinc-500"
                          }`}
                        >
                          <span className="min-w-0 flex-1">None</span>
                        </button>
                      </li>
                      {mySoundscapes.length === 0 && (
                        <li className="list-none px-3 py-8 text-center text-sm text-zinc-500">
                          No custom sounds yet.
                        </li>
                      )}
                      {mySoundscapes.map((s) => {
                          const selected = pendingSoundtrackId === s.id;
                          return (
                            <li
                              key={s.id}
                              className="rounded-lg transition hover:bg-white/[0.035]"
                            >
                              {mySoundsEditingId === s.id ? (
                                <div className="px-3 py-2.5">
                                  <input
                                    type="text"
                                    value={mySoundsEditingName}
                                    onChange={(e) => setMySoundsEditingName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        void handleMySoundsSaveRename();
                                      }
                                    }}
                                    className="w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-zinc-500 focus:ring-1"
                                    autoFocus
                                    disabled={mySoundsEditBusy}
                                    aria-label="Track name"
                                  />
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      disabled={
                                        mySoundsEditBusy || !mySoundsEditingName.trim()
                                      }
                                      onClick={() => void handleMySoundsSaveRename()}
                                      className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-700 disabled:opacity-40"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      disabled={mySoundsEditBusy}
                                      onClick={cancelMySoundsRowEdit}
                                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-white/[0.05] hover:text-zinc-200 disabled:opacity-40"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2 px-3 py-2.5">
                                    <button
                                      type="button"
                                      title={s.name}
                                      onClick={() => {
                                        setPendingSoundtrackId(s.id);
                                        if (!s.media_url.trim()) {
                                          stopMediaPreview();
                                          setSoundscapePulseId(null);
                                          return;
                                        }
                                        setSoundscapePulseId(s.id);
                                        startMediaPreview(s.media_url, true);
                                      }}
                                      className={`min-w-0 flex-1 truncate text-left text-sm transition active:opacity-90 ${
                                        selected
                                          ? "font-medium text-zinc-50"
                                          : "text-zinc-500"
                                      }`}
                                    >
                                      {s.name}
                                    </button>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                      {soundscapePulseId === s.id ? (
                                        <span
                                          className="size-1.5 shrink-0 rounded-full bg-zinc-400 preview-pulse-dot"
                                          aria-hidden
                                        />
                                      ) : null}
                                      <button
                                        type="button"
                                        aria-label={`Edit ${s.name}`}
                                        disabled={mySoundsEditBusy}
                                        onClick={() => {
                                          setMySoundsEditError(null);
                                          setMySoundsDeleteConfirmId(null);
                                          setMySoundsEditingId(null);
                                          setMySoundsEditingName("");
                                          setMySoundsEditMenuId((cur) =>
                                            cur === s.id ? null : s.id,
                                          );
                                        }}
                                        className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200 disabled:opacity-40"
                                      >
                                        <EditGlyph className="size-5" />
                                      </button>
                                    </div>
                                  </div>
                                  {mySoundsEditMenuId === s.id && (
                                    <div className="flex flex-wrap gap-2 border-t border-zinc-800/50 px-3 pb-2.5 pt-2">
                                      <button
                                        type="button"
                                        disabled={mySoundsEditBusy}
                                        onClick={() => {
                                          setMySoundsEditMenuId(null);
                                          setMySoundsEditingId(s.id);
                                          setMySoundsEditingName(s.name);
                                        }}
                                        className="rounded-lg border border-zinc-600 bg-zinc-800/90 px-3 py-1.5 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-700 disabled:opacity-40"
                                      >
                                        Rename
                                      </button>
                                      <button
                                        type="button"
                                        disabled={mySoundsEditBusy}
                                        onClick={() => {
                                          setMySoundsEditMenuId(null);
                                          setMySoundsDeleteConfirmId(s.id);
                                        }}
                                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-400/90 transition hover:bg-red-500/10 disabled:opacity-40"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  )}
                                  {mySoundsDeleteConfirmId === s.id && (
                                    <div className="flex flex-col gap-2 border-t border-zinc-800/50 px-3 pb-2.5 pt-2">
                                      <p className="text-xs leading-snug text-zinc-400">
                                        Remove &ldquo;{s.name}&rdquo;? This cannot be undone.
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          disabled={mySoundsEditBusy}
                                          onClick={() =>
                                            void handleMySoundsConfirmDelete(s.id)
                                          }
                                          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-40"
                                        >
                                          Remove track
                                        </button>
                                        <button
                                          type="button"
                                          disabled={mySoundsEditBusy}
                                          onClick={() => setMySoundsDeleteConfirmId(null)}
                                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-white/[0.05] hover:text-zinc-200 disabled:opacity-40"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </li>
                          );
                        })}
                    </ul>
                    <div className="shrink-0 border-t border-zinc-800/70 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setMySoundsEditMenuId(null);
                          setMySoundsEditingId(null);
                          setMySoundsEditingName("");
                          setMySoundsDeleteConfirmId(null);
                          setMySoundsEditError(null);
                          setAddSoundRows([]);
                          setAddSoundUploadError(null);
                          setAddSoundDropActive(false);
                          setMySoundsUiStep("add_files");
                        }}
                        className="w-full rounded-xl border border-zinc-600 bg-zinc-800/90 py-3 text-center text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800 active:scale-[0.99]"
                      >
                        Add sounds
                      </button>
                    </div>
                  </div>
                </div>
                <ModalSaveFooter onSave={saveSoundtrackModal} />
              </>
            )}

            {openModal === "bells" && bellsUiStep === "menu" && (
              <>
                <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-14">
                  <h2 className="mb-6 shrink-0 text-center text-lg font-semibold text-zinc-50">
                    Bells
                  </h2>
                  <div className="flex min-h-0 flex-1 flex-col justify-start gap-3">
                    {BELL_TYPE_MENU.map((opt) => (
                      <FieldRow
                        key={opt.id}
                        label={opt.label}
                        value={bellsMenuSummary(
                          bellsCatalog,
                          opt.id,
                          pendingStartingBellId,
                          pendingEndingBellId,
                          pendingIntervalBellId,
                          pendingIntervalEveryMinutes,
                        )}
                        onOpen={() => {
                          setPendingBellCategory(opt.id);
                          setBellPulseId(null);
                          setBellsUiStep(opt.id);
                        }}
                      />
                    ))}
                  </div>
                </div>
                <ModalSaveFooter onSave={saveBellsModal} />
              </>
            )}

            {openModal === "bells" && bellsUiStep !== "menu" && (
              <>
                <button
                  type="button"
                  className="absolute left-3 top-3 z-10 flex h-10 items-center gap-0.5 rounded-full px-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-50"
                  aria-label="Back"
                  onClick={() => {
                    setBellPulseId(null);
                    setBellsUiStep("menu");
                  }}
                >
                  <span className="text-lg leading-none">‹</span>
                  <span>Back</span>
                </button>

                <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-14">
                  <h2 className="mb-4 shrink-0 px-10 text-center text-lg font-semibold text-zinc-50">
                    {BELL_TYPE_MENU.find((o) => o.id === bellsUiStep)?.label}
                  </h2>
                  <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
                    {bellsUiStep === "starting" && (
                      <li key="starting-none">
                        <button
                          type="button"
                          onClick={() => {
                            stopMediaPreview();
                            setBellPulseId(null);
                            setPendingStartingBellId(null);
                          }}
                          className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.045] active:bg-white/[0.06] ${
                            pendingStartingBellId === null
                              ? "font-medium text-zinc-100"
                              : "text-zinc-500"
                          }`}
                        >
                          None
                        </button>
                      </li>
                    )}
                    {bellsUiStep === "ending" && (
                      <li key="ending-none">
                        <button
                          type="button"
                          onClick={() => {
                            stopMediaPreview();
                            setBellPulseId(null);
                            setPendingEndingBellId(null);
                          }}
                          className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.045] active:bg-white/[0.06] ${
                            pendingEndingBellId === null
                              ? "font-medium text-zinc-100"
                              : "text-zinc-500"
                          }`}
                        >
                          None
                        </button>
                      </li>
                    )}
                    {bellsUiStep === "interval" && (
                      <li key="interval-none">
                        <button
                          type="button"
                          onClick={() => {
                            stopMediaPreview();
                            setBellPulseId(null);
                            setPendingIntervalBellId(null);
                          }}
                          className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.045] active:bg-white/[0.06] ${
                            pendingIntervalBellId === null
                              ? "font-medium text-zinc-100"
                              : "text-zinc-500"
                          }`}
                        >
                          None
                        </button>
                      </li>
                    )}
                    {bellsCatalog.map((b) => {
                      const cat = bellsUiStep;
                      const selected = pendingBellIdFor(cat) === b.id;
                      return (
                        <li key={b.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingBellIdFor(cat, b.id);
                              setBellPulseId(b.id);
                              startMediaPreview(b.media_url, false);
                            }}
                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.045] active:bg-white/[0.06] ${
                              selected
                                ? "font-medium text-zinc-50"
                                : "text-zinc-500"
                            }`}
                          >
                            <span className="min-w-0 flex-1 truncate">{b.name}</span>
                            {bellPulseId === b.id && (
                              <span
                                className="size-1.5 shrink-0 rounded-full bg-zinc-400 preview-pulse-dot"
                                aria-hidden
                              />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {bellsUiStep === "interval" && (
                  <div className="shrink-0 border-t border-zinc-800 px-4 py-3">
                    <label
                      htmlFor="interval-slider"
                      className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500"
                    >
                      Bell every (minutes)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        id="interval-slider"
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        value={pendingIntervalEveryMinutes}
                        onChange={(e) =>
                          setPendingIntervalEveryMinutes(Number(e.target.value))
                        }
                        className="h-2 flex-1 cursor-pointer accent-zinc-500"
                      />
                      <span className="w-8 tabular-nums text-sm font-semibold text-zinc-300">
                        {pendingIntervalEveryMinutes}
                      </span>
                    </div>
                  </div>
                )}

                <ModalSelectFooter onSelect={() => setBellsUiStep("menu")} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ModalSaveFooter(props: {
  onSave: () => void;
  disabled?: boolean;
  saveLabel?: string;
}) {
  const disabled = props.disabled ?? false;
  const label = props.saveLabel ?? "Save";
  return (
    <div className="shrink-0 px-4 py-3 backdrop-blur-sm">
      <button
        type="button"
        disabled={disabled}
        onClick={props.onSave}
        className={`w-full rounded-xl py-3 text-center text-sm font-semibold transition active:scale-[0.99] ${
          disabled
            ? "cursor-not-allowed bg-zinc-700 text-zinc-500"
            : "border border-zinc-600 bg-zinc-800 text-zinc-50 hover:border-zinc-500 hover:bg-zinc-700"
        }`}
      >
        {label}
      </button>
    </div>
  );
}

function ModalSelectFooter(props: { onSelect: () => void }) {
  return (
    <div className="shrink-0 px-4 py-3 backdrop-blur-sm">
      <button
        type="button"
        onClick={props.onSelect}
        className="w-full rounded-xl border border-zinc-600 bg-zinc-800 py-3 text-center text-sm font-semibold text-zinc-50 transition hover:border-zinc-500 hover:bg-zinc-700 active:scale-[0.99]"
      >
        Select
      </button>
    </div>
  );
}

function FieldRow(props: {
  label: string;
  value: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onOpen}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 px-4 py-4 text-left transition hover:border-zinc-700 hover:bg-zinc-900"
    >
      <span className="text-sm font-medium text-zinc-400">{props.label}</span>
      <span className="truncate text-sm font-semibold text-zinc-100">{props.value}</span>
    </button>
  );
}

function PickerColumn(props: {
  label: string;
  value: number;
  options: number[];
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl ">
      <div className="shrink-0 px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-zinc-500">
        {props.label}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-2">
        {props.options.map((opt) => (
          <li key={opt}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                props.onChange(opt);
              }}
              className={`mb-1 w-full rounded-lg border py-2.5 text-center text-sm font-medium transition ${
                props.value === opt
                  ? "border-zinc-500 bg-zinc-700 text-zinc-50"
                  : "border-transparent text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {props.format(opt)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
