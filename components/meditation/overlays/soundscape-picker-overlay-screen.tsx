"use client";

import type { CatalogSoundscape } from "@/lib/meditation-mocks";
import { ModalSaveFooter } from "@/components/meditation/modal-save-footer";

export function SoundscapePickerOverlayScreen(props: {
  soundscapes: CatalogSoundscape[];
  pendingSoundtrackId: string | null;
  soundscapePulseId: string | null;
  onPendingSoundtrackChange: (id: string | null) => void;
  onStopPreview: () => void;
  onStartPreview: (url: string, loop: boolean) => void;
  onSoundscapePulseChange: (id: string | null) => void;
  onSave: () => void;
}) {
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-14">
        <h2 className="mb-3 shrink-0 text-center text-lg font-semibold text-zinc-50">
          Soundscape
        </h2>
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
            <li key="__none">
              <button
                type="button"
                onClick={() => {
                  props.onPendingSoundtrackChange(null);
                  props.onStopPreview();
                  props.onSoundscapePulseChange(null);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.045] active:bg-white/[0.06] ${
                  props.pendingSoundtrackId === null
                    ? "font-medium text-zinc-50"
                    : "text-zinc-500"
                }`}
              >
                <span className="min-w-0 flex-1">None</span>
              </button>
            </li>
            {props.soundscapes.length === 0 && (
              <li className="list-none px-3 py-8 text-center text-sm text-zinc-500">
                No soundscapes available.
              </li>
            )}
            {props.soundscapes.map((s) => {
              const selected = props.pendingSoundtrackId === s.id;
              return (
                <li key={s.id} className="overflow-hidden rounded-lg">
                  <button
                    type="button"
                    title={s.name}
                    onClick={() => {
                      props.onPendingSoundtrackChange(s.id);
                      if (!s.media_url.trim()) {
                        props.onStopPreview();
                        props.onSoundscapePulseChange(null);
                        return;
                      }
                      props.onSoundscapePulseChange(s.id);
                      props.onStartPreview(s.media_url, true);
                    }}
                    className={`flex min-h-[2.75rem] w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition active:opacity-90 ${
                      selected
                        ? "bg-white/[0.08] font-medium text-zinc-50"
                        : "text-zinc-500 hover:bg-white/[0.045] active:bg-white/[0.06]"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    {props.soundscapePulseId === s.id ? (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-zinc-400 preview-pulse-dot"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <ModalSaveFooter onSave={props.onSave} />
    </>
  );
}
