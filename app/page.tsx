"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MOCK_BELL_SOUNDS,
  MOCK_SOUNDSCAPES,
  type BellCategory,
} from "@/lib/meditation-mocks";

type ModalId = "duration" | "soundtrack" | "bells" | null;

type BellsUiStep = "menu" | BellCategory;

const BELL_TYPE_MENU: { id: BellCategory; label: string }[] = [
  { id: "starting", label: "Starting" },
  { id: "opening", label: "Opening" },
  { id: "interval", label: "Interval" },
];

function bellCatalogFor(_cat: BellCategory) {
  return MOCK_BELL_SOUNDS;
}

function formatDuration(hours: number, minutes: number): string {
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

function bellNameOrNone(
  id: string | null,
  catalog: { id: string; name: string }[],
): string {
  if (id === null) return "None";
  return catalog.find((b) => b.id === id)?.name ?? "None";
}

function bellsMenuSummary(
  cat: BellCategory,
  startingId: string | null,
  openingId: string | null,
  intervalId: string | null,
  intervalMinutes: number,
): string {
  switch (cat) {
    case "starting":
      return bellNameOrNone(startingId, MOCK_BELL_SOUNDS);
    case "opening":
      return bellNameOrNone(openingId, MOCK_BELL_SOUNDS);
    case "interval":
      if (intervalId === null) return "None";
      return `${bellNameOrNone(intervalId, MOCK_BELL_SOUNDS)} · every ${intervalMinutes}m`;
  }
}

export default function Home() {
  const [openModal, setOpenModal] = useState<ModalId>(null);

  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(15);

  const [soundtrackId, setSoundtrackId] = useState<string | null>(
    MOCK_SOUNDSCAPES[0]?.id ?? null,
  );

  const [bellCategory, setBellCategory] = useState<BellCategory>("starting");
  const [startingBellId, setStartingBellId] = useState<string | null>(null);
  const [openingBellId, setOpeningBellId] = useState<string | null>(
    MOCK_BELL_SOUNDS[0]?.id ?? null,
  );
  const [intervalBellId, setIntervalBellId] = useState<string | null>(
    MOCK_BELL_SOUNDS[0]?.id ?? null,
  );
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
  const [pendingOpeningBellId, setPendingOpeningBellId] = useState<string | null>(
    openingBellId,
  );
  const [pendingIntervalBellId, setPendingIntervalBellId] = useState<string | null>(
    intervalBellId,
  );
  const [pendingIntervalEveryMinutes, setPendingIntervalEveryMinutes] =
    useState(intervalEveryMinutes);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  /** Row id whose preview/dot was activated by user tap this session (not initial selection). */
  const [soundscapePulseId, setSoundscapePulseId] = useState<string | null>(null);
  const [bellPulseId, setBellPulseId] = useState<string | null>(null);

  const [bellsUiStep, setBellsUiStep] = useState<BellsUiStep>("menu");

  function pendingBellIdFor(cat: BellCategory): string | null {
    switch (cat) {
      case "starting":
        return pendingStartingBellId;
      case "opening":
        return pendingOpeningBellId;
      case "interval":
        return pendingIntervalBellId;
    }
  }

  function setPendingBellIdFor(cat: BellCategory, id: string) {
    switch (cat) {
      case "starting":
        setPendingStartingBellId(id);
        break;
      case "opening":
        setPendingOpeningBellId(id);
        break;
      case "interval":
        setPendingIntervalBellId(id);
        break;
    }
  }

  const soundtrackTitle =
    soundtrackId === null
      ? "None"
      : MOCK_SOUNDSCAPES.find((s) => s.id === soundtrackId)?.name ?? "None";

  const startingBellSummary =
    startingBellId === null
      ? "None"
      : MOCK_BELL_SOUNDS.find((b) => b.id === startingBellId)?.name ?? "None";

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
    }
  }, [openModal, stopMediaPreview]);

  useEffect(() => {
    if (openModal !== "bells") return;
    if (bellsUiStep === "menu") {
      stopMediaPreview();
      setBellPulseId(null);
    }
  }, [bellsUiStep, openModal, stopMediaPreview]);

  function openDurationModal() {
    setPendingHours(hours);
    setPendingMinutes(minutes);
    setOpenModal("duration");
  }

  function openSoundtrackModal() {
    setPendingSoundtrackId(soundtrackId);
    setSoundscapePulseId(null);
    setOpenModal("soundtrack");
  }

  function openBellsModal() {
    setBellsUiStep("menu");
    setPendingBellCategory(bellCategory);
    setPendingStartingBellId(startingBellId);
    setPendingOpeningBellId(openingBellId);
    setPendingIntervalBellId(intervalBellId);
    setPendingIntervalEveryMinutes(intervalEveryMinutes);
    setBellPulseId(null);
    setOpenModal("bells");
  }

  function saveDurationModal() {
    setHours(pendingHours);
    setMinutes(pendingMinutes);
    setOpenModal(null);
  }

  function saveSoundtrackModal() {
    setSoundtrackId(pendingSoundtrackId);
    setOpenModal(null);
  }

  function saveBellsModal() {
    setBellCategory(pendingBellCategory);
    setStartingBellId(pendingStartingBellId);
    setOpeningBellId(pendingOpeningBellId);
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
      setOpenModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openModal, bellsUiStep]);

  useEffect(() => {
    document.body.style.overflow = openModal ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [openModal]);

  const hourOptions = Array.from({ length: 12 }, (_, i) => i);
  const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-950 text-zinc-100">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10">
        <header className="shrink-0 space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Meditate
          </h1>
          <p className="text-sm text-zinc-400">Set your session, then begin.</p>
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
            className="w-full rounded-2xl bg-emerald-600 py-4 text-center text-base font-semibold text-white shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-500 active:scale-[0.99]"
          >
            Begin
          </button>
        </div>
      </main>

      {openModal && (
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
                      onChange={setPendingHours}
                    />
                    <PickerColumn
                      label="Minutes"
                      value={pendingMinutes}
                      options={minuteOptions}
                      format={(v) => (v === 0 ? "0" : String(v).padStart(2, "0"))}
                      onChange={setPendingMinutes}
                    />
                  </div>
                </div>
                <ModalSaveFooter onSave={saveDurationModal} />
              </>
            )}

            {openModal === "soundtrack" && (
              <>
                <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-14">
                  <h2 className="mb-3 shrink-0 text-center text-lg font-semibold text-zinc-50">
                    Soundscape
                  </h2>
                  <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
                    <li key="soundtrack-none">
                      <button
                        type="button"
                        onClick={() => {
                          stopMediaPreview();
                          setSoundscapePulseId(null);
                          setPendingSoundtrackId(null);
                        }}
                        className={`flex w-full rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.045] active:bg-white/[0.06] ${
                          pendingSoundtrackId === null
                            ? "font-medium text-zinc-100"
                            : "text-zinc-500"
                        }`}
                      >
                        None
                      </button>
                    </li>
                    {MOCK_SOUNDSCAPES.map((s) => {
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
                  </ul>
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
                          opt.id,
                          pendingStartingBellId,
                          pendingOpeningBellId,
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
                    {bellsUiStep === "opening" && (
                      <li key="opening-none">
                        <button
                          type="button"
                          onClick={() => {
                            stopMediaPreview();
                            setBellPulseId(null);
                            setPendingOpeningBellId(null);
                          }}
                          className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.045] active:bg-white/[0.06] ${
                            pendingOpeningBellId === null
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
                    {bellCatalogFor(bellsUiStep).map((b) => {
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
                        className="h-2 flex-1 cursor-pointer accent-emerald-500"
                      />
                      <span className="w-8 tabular-nums text-sm font-semibold text-emerald-400">
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

function ModalSaveFooter(props: { onSave: () => void }) {
  return (
    <div className="shrink-0 px-4 py-3 backdrop-blur-sm">
      <button
        type="button"
        onClick={props.onSave}
        className="w-full rounded-xl bg-emerald-600 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-500 active:scale-[0.99]"
      >
        Save
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
        className="w-full rounded-xl bg-emerald-600 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-500 active:scale-[0.99]"
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
              className={`mb-1 w-full rounded-lg py-2.5 text-center text-sm font-medium transition ${
                props.value === opt
                  ? "bg-emerald-700 text-white"
                  : "text-zinc-300 hover:bg-zinc-800"
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
