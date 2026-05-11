"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchMeditationSounds,
  postDownloadSound,
  type ApiCustomSoundscape,
  type ApiSoundscape,
  type MeditationSoundsResponse,
} from "@/lib/meditation-sounds-api";
import {
  type BellCategory,
  type CatalogBellSound,
  type CatalogSoundscape,
} from "@/lib/meditation-mocks";
import {
  SOUNDSCAPE_CATEGORY_TABS,
  apiSoundscapeCategoryToTab,
  displayNameForApiSoundscape,
  type SoundscapeListTab,
} from "@/lib/soundscape-categories";

type ModalId = "duration" | "soundtrack" | "bells" | null;

type BellsUiStep = "menu" | BellCategory;

type MySoundsUiStep = "list" | "add_youtube";

const BELL_TYPE_MENU: { id: BellCategory; label: string }[] = [
  { id: "starting", label: "Starting" },
  { id: "ending", label: "Ending" },
  { id: "interval", label: "Interval" },
];

function catalogFromApiCustom(c: ApiCustomSoundscape): CatalogSoundscape {
  const url = c.media_url;
  const ready =
    c.status === "success" &&
    typeof url === "string" &&
    url.length > 0;
  const label = c.name?.trim();
  return {
    id: c.id,
    name: label && label.length > 0 ? label : c.link,
    media_url: ready ? url : "",
    tab: "ambient",
  };
}

function catalogFromApiSoundscape(s: ApiSoundscape): CatalogSoundscape {
  return {
    id: s.id,
    name: displayNameForApiSoundscape(s),
    media_url: s.media_url,
    tab: apiSoundscapeCategoryToTab(s.category),
  };
}

function soundscapeListTabForSelection(
  id: string | null,
  library: CatalogSoundscape[],
  customs: CatalogSoundscape[],
): SoundscapeListTab {
  if (id === null) return "none";
  const fromLibrary = library.find((s) => s.id === id);
  if (fromLibrary) return fromLibrary.tab;
  if (customs.some((s) => s.id === id)) return "ambient";
  return "ambient";
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

function parseHttpUrl(input: string): URL | null {
  const t = input.trim();
  if (!t) return null;
  try {
    return new URL(/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(t) ? t : `https://${t}`);
  } catch {
    return null;
  }
}

function isYoutubeHost(hostname: string): boolean {
  const h = hostname.replace(/^www\./, "");
  return (
    h === "youtu.be" ||
    h === "youtube.com" ||
    h.endsWith(".youtube.com") ||
    h === "m.youtube.com" ||
    h === "youtube-nocookie.com" ||
    h.endsWith(".youtube-nocookie.com")
  );
}

/** Unwrap e.g. google.com/url?q=https://youtube.com/watch?v=… */
function unwrapRedirectUrl(candidate: URL): URL | null {
  const h = candidate.hostname.replace(/^www\./, "");
  if (h !== "google.com" && !h.endsWith(".google.com")) return null;
  const raw =
    candidate.searchParams.get("q") ??
    candidate.searchParams.get("url") ??
    candidate.searchParams.get("u");
  if (!raw?.trim()) return null;
  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded.replace(/\+/g, " "));
  } catch {
    /* keep raw */
  }
  return parseHttpUrl(decoded);
}

/**
 * Parses a YouTube URL from pasted input — full link, wrapped redirect, or text containing a URL.
 */
function parseYoutubeUrlFromInput(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  function unwrapToYoutube(start: URL | null): URL | null {
    if (!start) return null;
    let u: URL | null = start;
    for (let i = 0; i < 4 && u; i++) {
      if (isYoutubeHost(u.hostname)) return u;
      u = unwrapRedirectUrl(u);
    }
    return null;
  }

  const direct = unwrapToYoutube(parseHttpUrl(trimmed));
  if (direct) return direct;

  const embedded =
    /https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/watch\?[^\s"'<>]*v=[\w-]+[^\s"'<>]*|youtube\.com\/(?:embed|v)\/[\w-]+|youtube\.com\/shorts\/[\w-]+|youtu\.be\/[\w-]+)(?:[^\s"'<>]*)?/i.exec(
      trimmed,
    );
  if (!embedded?.[0]) return null;

  return unwrapToYoutube(parseHttpUrl(embedded[0]));
}

/** Stable id for matching the same video across URL shapes (watch, short, youtu.be). */
function youtubeVideoIdFromYoutubeUrl(u: URL): string | null {
  const h = u.hostname.replace(/^www\./, "");
  if (h === "youtu.be") {
    const seg = u.pathname.replace(/^\//, "").split("/")[0]?.split("?")[0];
    return seg && seg.length > 0 ? seg : null;
  }
  if (!isYoutubeHost(u.hostname)) return null;
  const v = u.searchParams.get("v");
  if (v) return v;
  const m = u.pathname.match(/\/(?:embed|shorts|v)\/([^/?#]+)/);
  return m?.[1] ?? null;
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
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

function MySoundDownloadSpinner() {
  return (
    <span
      className="inline-flex size-4 shrink-0 items-center justify-center"
      role="status"
      aria-label="Downloading"
    >
      <span
        className="size-3.5 shrink-0 rounded-full border-2 border-zinc-600 border-t-zinc-300 animate-spin"
        aria-hidden
      />
    </span>
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

  const [librarySoundscapes, setLibrarySoundscapes] = useState<
    CatalogSoundscape[]
  >([]);
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
  const [soundscapeListTab, setSoundscapeListTab] =
    useState<SoundscapeListTab>("none");
  const [mySoundscapes, setMySoundscapes] = useState<CatalogSoundscape[]>([]);
  const [mySoundscapeDownloadingIds, setMySoundscapeDownloadingIds] = useState<
    Set<string>
  >(() => new Set());
  const [mySoundsUiStep, setMySoundsUiStep] = useState<MySoundsUiStep>("list");
  const [pendingYoutubeUrl, setPendingYoutubeUrl] = useState("");
  const [youtubeUrlError, setYoutubeUrlError] = useState<string | null>(null);
  const [youtubeSaveBusy, setYoutubeSaveBusy] = useState(false);
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
      : librarySoundscapes.find((s) => s.id === soundtrackId)?.name ??
        mySoundscapes.find((s) => s.id === soundtrackId)?.name ??
        "None";

  const startingBellSummary =
    startingBellId === null
      ? "None"
      : bellsCatalog.find((b) => b.id === startingBellId)?.name ?? "None";

  const applySoundsResponse = useCallback((data: MeditationSoundsResponse) => {
    setLibrarySoundscapes(data.soundscapes.map(catalogFromApiSoundscape));
    setBellsCatalog(data.bells);

    setMySoundscapes(data.custom_soundscapes.map(catalogFromApiCustom));

    setMySoundscapeDownloadingIds(() => {
      const next = new Set<string>();
      for (const c of data.custom_soundscapes) {
        const ready =
          c.status === "success" &&
          typeof c.media_url === "string" &&
          c.media_url.length > 0;
        if (!ready) next.add(c.id);
      }
      return next;
    });

    setSoundtrackId((cur) => {
      const first = data.soundscapes[0]?.id ?? null;
      if (cur === null) return first;
      if (data.soundscapes.some((s) => s.id === cur)) return cur;
      if (data.custom_soundscapes.some((cs) => cs.id === cur)) return cur;
      return first;
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
    if (!openModal) {
      stopMediaPreview();
      setSoundscapePulseId(null);
      setBellPulseId(null);
      setMySoundsUiStep("list");
      setPendingYoutubeUrl("");
      setYoutubeUrlError(null);
      setYoutubeSaveBusy(false);
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
    setSoundscapeListTab(
      soundscapeListTabForSelection(soundtrackId, librarySoundscapes, mySoundscapes),
    );
    setMySoundsUiStep("list");
    setPendingYoutubeUrl("");
    setYoutubeUrlError(null);
    setOpenModal("soundtrack");
  }

  async function saveMyYoutubeSound() {
    if (youtubeSaveBusy) return;
    const parsed = parseYoutubeUrlFromInput(pendingYoutubeUrl);
    if (!parsed) {
      setYoutubeUrlError("Use a valid YouTube link (youtube.com or youtu.be).");
      return;
    }
    const targetVid = youtubeVideoIdFromYoutubeUrl(parsed);
    if (!targetVid) {
      setYoutubeUrlError("Could not read this YouTube link.");
      return;
    }
    setYoutubeUrlError(null);
    const canonical = parsed.href;

    setYoutubeSaveBusy(true);
    try {
      await postDownloadSound(canonical);
    } catch (e) {
      setYoutubeUrlError(
        e instanceof Error ? e.message : "Could not start download.",
      );
      setYoutubeSaveBusy(false);
      return;
    }

    let matchedId: string | null = null;
    try {
      for (let attempt = 0; attempt < 10; attempt++) {
        if (attempt > 0) await delayMs(2000);
        const data = await fetchMeditationSounds();
        applySoundsResponse(data);
        const match = data.custom_soundscapes.find((c) => {
          const u = parseYoutubeUrlFromInput(c.link);
          return u != null && youtubeVideoIdFromYoutubeUrl(u) === targetVid;
        });
        if (match) {
          matchedId = match.id;
          break;
        }
      }
    } catch (e) {
      setYoutubeUrlError(
        e instanceof Error ? e.message : "Could not refresh sounds after adding.",
      );
      try {
        applySoundsResponse(await fetchMeditationSounds());
      } catch {
        /* ignore */
      }
    } finally {
      setYoutubeSaveBusy(false);
    }

    if (matchedId) setPendingSoundtrackId(matchedId);
    setPendingYoutubeUrl("");
    setSoundscapeListTab("ambient");
    setMySoundsUiStep("list");
  }

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
      if (
        openModal === "soundtrack" &&
        soundscapeListTab === "ambient" &&
        mySoundsUiStep === "add_youtube"
      ) {
        setPendingYoutubeUrl("");
        setYoutubeUrlError(null);
        setMySoundsUiStep("list");
        return;
      }
      setOpenModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openModal, bellsUiStep, soundscapeListTab, mySoundsUiStep]);

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
        : mySoundscapes.find((s) => s.id === soundtrackId)?.media_url ||
          librarySoundscapes.find((s) => s.id === soundtrackId)?.media_url ||
          null;
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
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10">
          <header className="shrink-0 space-y-1 text-center">
            {/* <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
              Meditate
            </h1> */}
         
          </header>

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

            {openModal === "soundtrack" &&
              soundscapeListTab === "ambient" &&
              mySoundsUiStep === "add_youtube" && (
                <>
                  <button
                    type="button"
                    className="absolute left-3 top-3 z-10 flex h-10 items-center gap-0.5 rounded-full px-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-50"
                    aria-label="Back"
                    onClick={() => {
                      setPendingYoutubeUrl("");
                      setYoutubeUrlError(null);
                      setMySoundsUiStep("list");
                    }}
                  >
                    <span className="text-lg leading-none">‹</span>
                    <span>Back</span>
                  </button>

                  <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-14">
                    <div className="flex flex-col gap-2">
                      <label
                        htmlFor="youtube-sound-url"
                        className="text-xs font-medium uppercase tracking-wide text-zinc-500"
                      >
                        YouTube link
                      </label>
                      <input
                        id="youtube-sound-url"
                        type="text"
                        inputMode="url"
                        autoComplete="off"
                        placeholder="https://www.youtube.com/watch?v=…"
                        value={pendingYoutubeUrl}
                        onChange={(e) => {
                          setPendingYoutubeUrl(e.target.value);
                          setYoutubeUrlError(null);
                        }}
                        aria-invalid={youtubeUrlError != null}
                        aria-describedby={
                          youtubeUrlError ? "youtube-sound-url-error" : undefined
                        }
                        className={`w-full rounded-xl border bg-zinc-950/80 px-3 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none ring-0 transition focus:border-zinc-500 ${
                          youtubeUrlError != null
                            ? "border-rose-600/70"
                            : "border-zinc-700"
                        }`}
                      />
                      {youtubeUrlError ? (
                        <p
                          id="youtube-sound-url-error"
                          className="text-xs leading-relaxed text-rose-400"
                          role="alert"
                        >
                          {youtubeUrlError}
                        </p>
                      ) : (
                        <p className="text-xs leading-relaxed text-zinc-500">
                          Paste a YouTube watch link or youtu.be URL (wrapping/prefix text is
                          fine).
                        </p>
                      )}
                    </div>
                  </div>
                  <ModalSaveFooter
                    onSave={() => {
                      void saveMyYoutubeSound();
                    }}
                    disabled={pendingYoutubeUrl.trim() === "" || youtubeSaveBusy}
                    saveLabel={youtubeSaveBusy ? "Adding…" : "Save"}
                  />
                </>
              )}

            {openModal === "soundtrack" &&
              !(
                soundscapeListTab === "ambient" &&
                mySoundsUiStep === "add_youtube"
              ) && (
                <>
                  <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-14">
                    <h2 className="mb-3 shrink-0 text-center text-lg font-semibold text-zinc-50">
                      Soundscape
                    </h2>
                    <div className="mb-3 flex shrink-0 flex-wrap gap-x-1.5 gap-y-2">
                      {SOUNDSCAPE_CATEGORY_TABS.map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setSoundscapeListTab(id);
                            stopMediaPreview();
                            setSoundscapePulseId(null);
                            if (id === "none") {
                              setPendingSoundtrackId(null);
                            }
                            if (id !== "ambient") {
                              setMySoundsUiStep("list");
                              setPendingYoutubeUrl("");
                              setYoutubeUrlError(null);
                            }
                          }}
                          className={`shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium transition sm:text-sm ${
                            soundscapeListTab === id
                              ? "bg-white/[0.08] text-zinc-50 ring-1 ring-zinc-700"
                              : "text-zinc-500 hover:bg-white/[0.035] hover:text-zinc-300"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col gap-1">
                      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
                        {soundscapeListTab !== "none" && (
                          <>
                            {librarySoundscapes
                              .filter((s) => s.tab === soundscapeListTab)
                              .map((s) => {
                                const selected = pendingSoundtrackId === s.id;
                                return (
                                  <li key={s.id}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPendingSoundtrackId(s.id);
                                        setSoundscapePulseId(s.id);
                                        startMediaPreview(s.media_url, true);
                                      }}
                                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.045] active:bg-white/[0.06] ${
                                        selected
                                          ? "font-medium text-zinc-50"
                                          : "text-zinc-500"
                                      }`}
                                    >
                                      <span className="min-w-0 flex-1">{s.name}</span>
                                      {soundscapePulseId === s.id && (
                                        <span
                                          className="size-1.5 shrink-0 rounded-full bg-zinc-400 preview-pulse-dot"
                                          aria-hidden
                                        />
                                      )}
                                    </button>
                                  </li>
                                );
                              })}
                            {soundscapeListTab === "ambient" &&
                              mySoundscapes.map((s) => {
                                const selected = pendingSoundtrackId === s.id;
                                const downloading = mySoundscapeDownloadingIds.has(s.id);
                                return (
                                  <li key={s.id}>
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
                                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.045] active:bg-white/[0.06] ${
                                        selected
                                          ? "font-medium text-zinc-50"
                                          : "text-zinc-500"
                                      }`}
                                    >
                                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                                      {downloading ? (
                                        <MySoundDownloadSpinner />
                                      ) : (
                                        soundscapePulseId === s.id && (
                                          <span
                                            className="size-1.5 shrink-0 rounded-full bg-zinc-400 preview-pulse-dot"
                                            aria-hidden
                                          />
                                        )
                                      )}
                                    </button>
                                  </li>
                                );
                              })}
                          </>
                        )}
                      </ul>
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
