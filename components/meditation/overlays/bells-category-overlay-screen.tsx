"use client";

import type { BellCategory, CatalogBellSound } from "@/lib/meditation-mocks";
import { BELL_TYPE_MENU } from "@/components/meditation/types";
import { ModalSelectFooter } from "@/components/meditation/modal-select-footer";

export function BellsCategoryOverlayScreen(props: {
  bellsUiStep: BellCategory;
  bellsCatalog: CatalogBellSound[];
  pendingStartingBellId: string | null;
  pendingEndingBellId: string | null;
  pendingIntervalBellId: string | null;
  pendingIntervalEveryMinutes: number;
  bellPulseId: string | null;
  onSetPendingBellId: (cat: BellCategory, id: string | null) => void;
  onPendingIntervalEveryMinutesChange: (minutes: number) => void;
  onBack: () => void;
  onSelectMenu: () => void;
  onStopPreview: () => void;
  onStartPreview: (url: string, loop: boolean) => void;
  onBellPulseChange: (id: string | null) => void;
}) {
  const step = props.bellsUiStep;

  function pendingFor(cat: BellCategory): string | null {
    switch (cat) {
      case "starting":
        return props.pendingStartingBellId;
      case "ending":
        return props.pendingEndingBellId;
      case "interval":
        return props.pendingIntervalBellId;
    }
  }

  return (
    <>
      <button
        type="button"
        className="absolute left-3 top-3 z-10 flex h-10 items-center gap-0.5 rounded-full px-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-50"
        aria-label="Back"
        onClick={props.onBack}
      >
        <span className="text-lg leading-none">‹</span>
        <span>Back</span>
      </button>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-14">
        <h2 className="mb-4 shrink-0 px-10 text-center text-lg font-semibold text-zinc-50">
          {BELL_TYPE_MENU.find((o) => o.id === step)?.label}
        </h2>
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
          {step === "starting" && (
            <li key="starting-none">
              <button
                type="button"
                onClick={() => {
                  props.onStopPreview();
                  props.onBellPulseChange(null);
                  props.onSetPendingBellId("starting", null);
                }}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.045] active:bg-white/[0.06] ${
                  props.pendingStartingBellId === null
                    ? "font-medium text-zinc-100"
                    : "text-zinc-500"
                }`}
              >
                None
              </button>
            </li>
          )}
          {step === "ending" && (
            <li key="ending-none">
              <button
                type="button"
                onClick={() => {
                  props.onStopPreview();
                  props.onBellPulseChange(null);
                  props.onSetPendingBellId("ending", null);
                }}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.045] active:bg-white/[0.06] ${
                  props.pendingEndingBellId === null
                    ? "font-medium text-zinc-100"
                    : "text-zinc-500"
                }`}
              >
                None
              </button>
            </li>
          )}
          {step === "interval" && (
            <li key="interval-none">
              <button
                type="button"
                onClick={() => {
                  props.onStopPreview();
                  props.onBellPulseChange(null);
                  props.onSetPendingBellId("interval", null);
                }}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.045] active:bg-white/[0.06] ${
                  props.pendingIntervalBellId === null
                    ? "font-medium text-zinc-100"
                    : "text-zinc-500"
                }`}
              >
                None
              </button>
            </li>
          )}
          {props.bellsCatalog.map((b) => {
            const selected = pendingFor(step) === b.id;
            return (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => {
                    props.onSetPendingBellId(step, b.id);
                    props.onBellPulseChange(b.id);
                    props.onStartPreview(b.media_url, false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.045] active:bg-white/[0.06] ${
                    selected ? "font-medium text-zinc-50" : "text-zinc-500"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{b.name}</span>
                  {props.bellPulseId === b.id && (
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

      {step === "interval" && (
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
              value={props.pendingIntervalEveryMinutes}
              onChange={(e) =>
                props.onPendingIntervalEveryMinutesChange(Number(e.target.value))
              }
              className="h-2 flex-1 cursor-pointer accent-zinc-500"
            />
            <span className="w-8 tabular-nums text-sm font-semibold text-zinc-300">
              {props.pendingIntervalEveryMinutes}
            </span>
          </div>
        </div>
      )}

      <ModalSelectFooter onSelect={props.onSelectMenu} />
    </>
  );
}
