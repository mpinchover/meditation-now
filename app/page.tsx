"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteCustomSoundscape,
  fetchMeditationSounds,
  patchCustomSoundscapeName,
  postUploadAudioFiles,
  type MeditationSoundsResponse,
} from "@/lib/meditation-sounds-api";
import type {
  BellCategory,
  CatalogBellSound,
  CatalogSoundscape,
} from "@/lib/meditation-mocks";
import { BellsCategoryOverlayScreen } from "@/components/meditation/overlays/bells-category-overlay-screen";
import { BellsMenuOverlayScreen } from "@/components/meditation/overlays/bells-menu-overlay-screen";
import { DurationOverlayScreen } from "@/components/meditation/overlays/duration-overlay-screen";
import { SoundscapeAddFilesOverlayScreen } from "@/components/meditation/overlays/soundscape-add-files-overlay-screen";
import { SoundscapePickerOverlayScreen } from "@/components/meditation/overlays/soundscape-picker-overlay-screen";
import { catalogFromApiCustom } from "@/components/meditation/catalog";
import { FieldRow } from "@/components/meditation/field-row";
import { formatDuration } from "@/components/meditation/format";
import { MeditationSession } from "@/components/meditation/meditation-session";
import { ModalOverlayShell } from "@/components/meditation/modal-overlay-shell";
import { SoundsBootstrapSpinner } from "@/components/meditation/sounds-bootstrap-spinner";
import { isUploadableSoundFile } from "@/components/meditation/upload-helpers";
import type {
  AddSoundUploadRow,
  BellsUiStep,
  ModalId,
  MySoundsUiStep,
  SessionSnapshot,
} from "@/components/meditation/types";

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

  const onSetPendingBellId = useCallback((cat: BellCategory, id: string | null) => {
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
  }, []);

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

  const handleMySoundsConfirmDelete = useCallback(
    async (id: string) => {
      setMySoundsEditBusy(true);
      setMySoundsEditError(null);
      try {
        await deleteCustomSoundscape(id);
        await refreshSoundsQuiet();
        if (soundscapePulseId === id) {
          stopMediaPreview();
          setSoundscapePulseId(null);
        }
        setPendingSoundtrackId((cur) => (cur === id ? null : cur));
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
    [refreshSoundsQuiet, soundscapePulseId, stopMediaPreview],
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
  const minuteOptions = Array.from({ length: 60 }, (_, i) => i);

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
        <ModalOverlayShell onDismiss={() => setOpenModal(null)}>
          {openModal === "duration" && (
            <DurationOverlayScreen
              pendingHours={pendingHours}
              pendingMinutes={pendingMinutes}
              hourOptions={hourOptions}
              minuteOptions={minuteOptions}
              onChangeHours={setPendingHoursClamped}
              onChangeMinutes={setPendingMinutesClamped}
              onSave={saveDurationModal}
            />
          )}

          {openModal === "soundtrack" && mySoundsUiStep === "add_files" && (
            <SoundscapeAddFilesOverlayScreen
              addAudioFilesInputRef={addAudioFilesInputRef}
              addSoundDropZoneRef={addSoundDropZoneRef}
              addSoundDropActive={addSoundDropActive}
              setAddSoundDropActive={setAddSoundDropActive}
              addSoundUploadError={addSoundUploadError}
              addSoundRows={addSoundRows}
              onDone={finishAddSoundFilesStep}
              onFilesSelected={handleAddSoundFiles}
            />
          )}

          {openModal === "soundtrack" && mySoundsUiStep === "main" && (
            <SoundscapePickerOverlayScreen
              mySoundscapes={mySoundscapes}
              pendingSoundtrackId={pendingSoundtrackId}
              soundscapePulseId={soundscapePulseId}
              mySoundsEditError={mySoundsEditError}
              mySoundsEditingId={mySoundsEditingId}
              mySoundsEditingName={mySoundsEditingName}
              mySoundsEditMenuId={mySoundsEditMenuId}
              mySoundsDeleteConfirmId={mySoundsDeleteConfirmId}
              mySoundsEditBusy={mySoundsEditBusy}
              onPendingSoundtrackChange={setPendingSoundtrackId}
              onStopPreview={stopMediaPreview}
              onStartPreview={startMediaPreview}
              onSoundscapePulseChange={setSoundscapePulseId}
              onMySoundsEditingNameChange={setMySoundsEditingName}
              onSaveRename={handleMySoundsSaveRename}
              onCancelRowEdit={cancelMySoundsRowEdit}
              onToggleEditMenu={(id) => {
                setMySoundsEditError(null);
                setMySoundsDeleteConfirmId(null);
                setMySoundsEditingId(null);
                setMySoundsEditingName("");
                setMySoundsEditMenuId((cur) => (cur === id ? null : id));
              }}
              onStartRename={(s) => {
                setMySoundsEditMenuId(null);
                setMySoundsEditingId(s.id);
                setMySoundsEditingName(s.name);
              }}
              onRequestDelete={(id) => {
                setMySoundsEditMenuId(null);
                setMySoundsDeleteConfirmId(id);
              }}
              onCancelDelete={() => setMySoundsDeleteConfirmId(null)}
              onConfirmDelete={handleMySoundsConfirmDelete}
              onOpenAddFiles={() => {
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
              onSave={saveSoundtrackModal}
            />
          )}

          {openModal === "bells" && bellsUiStep === "menu" && (
            <BellsMenuOverlayScreen
              bellsCatalog={bellsCatalog}
              pendingStartingBellId={pendingStartingBellId}
              pendingEndingBellId={pendingEndingBellId}
              pendingIntervalBellId={pendingIntervalBellId}
              pendingIntervalEveryMinutes={pendingIntervalEveryMinutes}
              onOpenCategory={(id) => {
                setPendingBellCategory(id);
                setBellPulseId(null);
                setBellsUiStep(id);
              }}
              onSave={saveBellsModal}
            />
          )}

          {openModal === "bells" && bellsUiStep !== "menu" && (
            <BellsCategoryOverlayScreen
              bellsUiStep={bellsUiStep}
              bellsCatalog={bellsCatalog}
              pendingStartingBellId={pendingStartingBellId}
              pendingEndingBellId={pendingEndingBellId}
              pendingIntervalBellId={pendingIntervalBellId}
              pendingIntervalEveryMinutes={pendingIntervalEveryMinutes}
              bellPulseId={bellPulseId}
              onSetPendingBellId={onSetPendingBellId}
              onPendingIntervalEveryMinutesChange={setPendingIntervalEveryMinutes}
              onBack={() => {
                setBellPulseId(null);
                setBellsUiStep("menu");
              }}
              onSelectMenu={() => setBellsUiStep("menu")}
              onStopPreview={stopMediaPreview}
              onStartPreview={startMediaPreview}
              onBellPulseChange={setBellPulseId}
            />
          )}
        </ModalOverlayShell>
      )}
    </div>
  );
}
